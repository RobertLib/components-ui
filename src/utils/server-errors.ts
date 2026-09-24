import { camelToSnakeCase } from "./case-conversion";

type ErrorDetails = Record<string, unknown>;

/** One entry of an error list - a GraphQL user error or a JSON:API error. */
interface ListedError {
  /** Field path of a GraphQL user error, e.g. `"email"` or `["input", "email"]`. */
  field?: string | string[] | null;
  message?: string;
  /** JSON:API */
  detail?: string;
  source?: { parameter?: string; pointer?: string };
  title?: string;
}

/** The field messages of an error, and where they come from. */
interface Details {
  /**
   * The error body itself or GraphQL `extensions` - which also hold members
   * of the error (`message`, `code`, …), unlike an `errors` map.
   */
  enveloped: boolean;
  fields: ErrorDetails;
}

const isRecord = (value: unknown): value is ErrorDetails =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A name as lower-case snake_case - `firstName`, `first_name`, `first-name`
 * and `Email` / `email` are one field, as are `addressLine1` and
 * `address_line_1` or `userID` and `user_id`.
 */
const toCanonicalName = (name: string) =>
  camelToSnakeCase(name.replace(/-/g, "_"));

const sameSegment = (segment: string, name: string) =>
  segment === name || toCanonicalName(segment) === toCanonicalName(name);

/** The key of `record` naming the field `name`, in whatever case. */
const findKey = (record: ErrorDetails, name: string) =>
  Object.hasOwn(record, name)
    ? name
    : Object.keys(record).find((key) => sameSegment(key, name));

// Members that describe the error itself. With a text they are no field
// messages (`code: "UNAUTHENTICATED"`, `detail: "Not found."`), while a list
// is still the messages of a field of that name (`title: ["can't be blank"]`).
const ERROR_MEMBERS = new Set([
  "code",
  "detail",
  "error",
  "instance",
  "message",
  "path",
  "status",
  "status_code",
  "timestamp",
  "title",
  "trace_id",
  "type",
]);

// Members that are never field messages
const STRUCTURAL_MEMBERS = new Set([
  "exception",
  "extensions",
  "locations",
  "stack_trace",
  "stacktrace",
]);

const isErrorMember = (key: string, value: unknown) => {
  const name = toCanonicalName(key);
  return (
    STRUCTURAL_MEMBERS.has(name) ||
    (ERROR_MEMBERS.has(name) && !Array.isArray(value))
  );
};

/**
 * An entry that describes a validation problem - with a `field` (GraphQL
 * user errors: `{ field, message }`) or JSON:API members. A plain GraphQL
 * error (with `extensions`) is none.
 */
const isListedError = (item: unknown): item is ListedError =>
  isRecord(item) &&
  !("extensions" in item) &&
  ("field" in item || "source" in item || "detail" in item || "title" in item);

/**
 * A list of validation problems - one such entry is enough, the entries
 * without a field (`{ message }`) are general errors. A list of plain
 * GraphQL errors is none.
 */
const isErrorList = (value: unknown): value is ListedError[] =>
  Array.isArray(value) && value.every(isRecord) && value.some(isListedError);

/**
 * The errors of a GraphQL response or client error - `errors` (a response
 * body, Apollo 4 `CombinedGraphQLErrors`) or `graphQLErrors` (Apollo 3
 * `ApolloError`, urql `CombinedError`).
 */
const getGraphQLErrors = (error: unknown): unknown[] | undefined => {
  if (!isRecord(error)) return undefined;

  const list = Array.isArray(error.errors)
    ? error.errors
    : Array.isArray(error.graphQLErrors)
      ? error.graphQLErrors
      : undefined;

  return list && !isErrorList(list) ? list : undefined;
};

/**
 * Finds the validation details of an error, whatever client produced it:
 * - a GraphQL error carries them in the `extensions` of its first error,
 * - a REST error body is either the details object itself
 *   (`{ email: ["is taken"] }`) or wraps it in `errors`.
 */
const getErrorDetails = (error: unknown): Details | undefined => {
  if (!isRecord(error)) return undefined;

  const graphQLErrors = getGraphQLErrors(error);

  if (graphQLErrors) {
    const [first] = graphQLErrors;
    const extensions = isRecord(first) ? first.extensions : undefined;
    if (!isRecord(extensions)) return undefined;

    // Some servers nest the field messages once more
    return isRecord(extensions.errors)
      ? { enveloped: false, fields: extensions.errors }
      : { enveloped: true, fields: extensions };
  }

  if (isRecord(error.errors)) return { enveloped: false, fields: error.errors };

  // Any other Error (network failure, …) has no validation details
  return error instanceof Error
    ? undefined
    : { enveloped: true, fields: error };
};

/**
 * The error list of `{ errors: [...] }`, `{ userErrors: [...] }` or a bare
 * list. Every entry of `userErrors` is a user error - also one without a
 * field.
 */
const getErrorList = (error: unknown): ListedError[] | undefined => {
  if (isErrorList(error)) return error;
  if (!isRecord(error)) return undefined;
  if (isErrorList(error.errors)) return error.errors;

  const { userErrors } = error;
  return Array.isArray(userErrors) && userErrors.every(isRecord)
    ? userErrors
    : undefined;
};

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === "string");

/** General messages as a plain list - `{ errors: ["…"] }` or `["…"]`. */
const getMessageList = (error: unknown): string[] | undefined => {
  if (isStringList(error)) return error;
  if (isRecord(error) && isStringList(error.errors)) return error.errors;
  return undefined;
};

/**
 * Field messages come either as a list (`["is taken"]`) or a single string
 */
const getFirstMessage = (messages: unknown): string | undefined => {
  if (typeof messages === "string") return messages;

  if (Array.isArray(messages) && typeof messages[0] === "string") {
    return messages[0];
  }

  return undefined;
};

/** What the details hold for the field `name` - not a member of the error. */
const getFieldValue = ({ enveloped, fields }: Details, name: string) => {
  const key = findKey(fields, name);
  if (key === undefined) return undefined;

  const value = fields[key];
  return enveloped && isErrorMember(key, value) ? undefined : value;
};

/**
 * Follows a dotted field name into nested records and lists -
 * `address.street` in `{ address: { street: [...] } }`, `items.0.price`.
 */
const getNestedValue = (details: Details, path: string[]) => {
  let value = getFieldValue(details, path[0]);

  for (const segment of path.slice(1)) {
    if (Array.isArray(value) && /^\d+$/.test(segment)) {
      value = value[Number(segment)];
    } else if (isRecord(value)) {
      const key = findKey(value, segment);
      value = key === undefined ? undefined : value[key];
    } else {
      return undefined;
    }
  }

  return value;
};

/** A list of messages, or a record of such lists (nested objects). */
const holdsMessages = (value: unknown): boolean =>
  (Array.isArray(value) && value.length > 0) ||
  (isRecord(value) && Object.values(value).some(holdsMessages));

/**
 * Whether the details carry field messages. Next to the members of the
 * error, a text is no sure sign - GraphQL servers add their own
 * `extensions` (`classification: "DataFetchingException"`).
 */
const hasFieldMessages = ({ enveloped, fields }: Details) =>
  Object.entries(fields).some(([key, value]) =>
    enveloped
      ? !isErrorMember(key, value) && holdsMessages(value)
      : holdsMessages(value) || (typeof value === "string" && value !== ""),
  );

const getListedErrorPath = (item: ListedError): string[] | null => {
  if (Array.isArray(item.field)) return item.field.map(String);
  if (typeof item.field === "string") return item.field.split(".");

  const pointer = item.source?.pointer ?? item.source?.parameter;
  if (pointer) {
    // "/data/attributes/email" -> ["email"]
    const segments = pointer.split("/").filter(Boolean);
    // "/data" (or "") points at the whole resource - a general error
    if (
      segments.length === 0 ||
      (segments.length === 1 && segments[0] === "data")
    ) {
      return [];
    }
    return segments.slice(segments.indexOf("attributes") + 1);
  }

  return null;
};

const matchesPath = (path: string[], fieldName: string) => {
  const fieldPath = fieldName.split(".");

  if (
    path.length === fieldPath.length &&
    path.every((segment, index) => sameSegment(segment, fieldPath[index]))
  ) {
    return true;
  }

  // `["input", "email"]` still belongs to the field "email"
  return (
    fieldPath.length === 1 &&
    path.length > 1 &&
    sameSegment(path[path.length - 1], fieldName)
  );
};

const getListedErrorMessage = (item: ListedError) =>
  item.message ?? item.detail ?? item.title;

/**
 * The message for one form field from a server error, or `undefined`.
 * Understands the error shapes of common GraphQL and REST backends:
 *
 * - GraphQL errors with field messages in `extensions`
 *   (`{ email: ["is taken"] }`) or `extensions.problems`,
 * - GraphQL user errors - `[{ field: ["input", "email"], message }]`,
 * - REST bodies - `{ email: ["is taken"] }`, `{ errors: { email: [...] } }`,
 *   `{ errors: [{ field, message }] }` and JSON:API `errors` with a
 *   `source.pointer`.
 *
 * Field names are matched in camelCase, snake_case and any letter case, and
 * `address.street` addresses a nested field - also in nested objects
 * (`{ address: { street: [...] } }`). In a body without an `errors` map, a
 * text in a member that describes the error itself (`message`, `code`,
 * `title`, `detail`, `status`, `type`, …) is no field message - a list there
 * is (`title: ["can't be blank"]`), and so is anything inside `errors`.
 */
export const getFieldError = (
  error: unknown,
  fieldName: string,
): string | undefined => {
  const list = getErrorList(error);

  if (list) {
    for (const item of list) {
      const path = getListedErrorPath(item);
      if (path && matchesPath(path, fieldName)) {
        return getListedErrorMessage(item);
      }
    }
    return undefined;
  }

  const details = getErrorDetails(error);

  if (!details) return undefined;

  // graphql-ruby input validation: `problems: [{ path, explanation }]`
  const { problems } = details.fields;

  if (Array.isArray(problems)) {
    const fieldPath = fieldName.split(".");

    for (const problem of problems) {
      if (
        Array.isArray(problem?.path) &&
        problem.explanation &&
        problem.path.length === fieldPath.length &&
        problem.path.every((segment: unknown, index: number) =>
          sameSegment(String(segment), fieldPath[index]),
        )
      ) {
        return problem.explanation;
      }
    }
  }

  // A dotted key of its own (Rails' nested attributes), or nested objects
  return (
    getFirstMessage(getFieldValue(details, fieldName)) ??
    (fieldName.includes(".")
      ? getFirstMessage(getNestedValue(details, fieldName.split(".")))
      : undefined)
  );
};

/** The first non-empty text among `values`. */
const firstText = (...values: unknown[]) =>
  values.find(
    (value): value is string => typeof value === "string" && value !== "",
  );

/**
 * The general message of a server error that is not tied to a field -
 * `base` (Rails), `non_field_errors` (Django REST framework), a plain list
 * of messages (`{ errors: ["…"] }`) or an error list entry without a field
 * (or a JSON:API one pointing at the whole resource, `"/data"`). An error
 * without field messages gives its own message: that of a GraphQL error
 * (`"Not authorized"`), a `detail` (Django REST framework, problem details),
 * a `message`, or the `title` of problem details (ASP.NET).
 */
export const getBaseError = (error: unknown): string | undefined => {
  const messages = getMessageList(error);
  if (messages) return messages[0];

  const list = getErrorList(error);

  if (list) {
    const general = list.find((item) => !getListedErrorPath(item)?.length);
    return general ? getListedErrorMessage(general) : undefined;
  }

  const details = getErrorDetails(error);

  const base =
    getFirstMessage(details?.fields.base) ??
    getFirstMessage(details?.fields.non_field_errors) ??
    getFirstMessage(details?.fields.nonFieldErrors);

  if (base) return base;

  // Next to field messages, the error's own message ("Validation failed")
  // says nothing the fields do not
  if (details && hasFieldMessages(details)) return undefined;

  const graphQLErrors = getGraphQLErrors(error);

  if (graphQLErrors) {
    const [first] = graphQLErrors;
    return isRecord(first) ? firstText(first.message) : undefined;
  }

  return isRecord(error) && !(error instanceof Error)
    ? firstText(error.detail, error.message, error.title, error.error)
    : undefined;
};

/**
 * Interface for nested error structures (errors of associated records)
 */
interface NestedErrorResource {
  name?: string;
  model_name?: string;
  errors?: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * Extracts all error messages of nested records (any list of records in the
 * error details, however deeply nested), e.g. Rails' nested attributes:
 * `{ items: [{ name: "Item 1", errors: { price: ["must be positive"] } }] }`
 * gives `["Item 1: must be positive"]`. Messages of deeper records name the
 * whole path, e.g. `"Order 1 › Item A: must be positive"`.
 */
export const getNestedErrors = (error: unknown): string[] => {
  const details = getErrorDetails(error)?.fields;

  if (!details) return [];

  const allErrors: string[] = [];

  // Helper function to extract errors from a resource
  const extractResourceErrors = (
    resource: NestedErrorResource,
    parentName?: string,
  ): void => {
    // The path of names from the top record, e.g. "Order 1 › Item A"
    const ownName = resource.name || resource.model_name || "";
    const resourceName = [parentName, ownName].filter(Boolean).join(" › ");

    // Add direct errors from this resource
    if (resource.errors && typeof resource.errors === "object") {
      Object.entries(resource.errors).forEach(([, messages]) => {
        if (Array.isArray(messages)) {
          messages.forEach((message) => {
            if (resourceName) {
              allErrors.push(`${resourceName}: ${message}`);
            } else {
              allErrors.push(message);
            }
          });
        }
      });
    }

    // Check for records nested in this one
    Object.entries(resource).forEach(([key, value]) => {
      if (
        Array.isArray(value) &&
        key !== "errors" &&
        value.length > 0 &&
        typeof value[0] === "object"
      ) {
        value.forEach((nestedResource) => {
          if (nestedResource && typeof nestedResource === "object") {
            extractResourceErrors(
              nestedResource as NestedErrorResource,
              resourceName,
            );
          }
        });
      }
    });
  };

  Object.entries(details).forEach(([key, value]) => {
    if (Array.isArray(value) && key !== "base") {
      value.forEach((resource) => {
        if (resource && typeof resource === "object") {
          extractResourceErrors(resource as NestedErrorResource);
        }
      });
    }
  });

  return allErrors;
};
