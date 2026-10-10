import { camelToSnakeCase } from "./case-conversion";

type ErrorDetails = Record<string, unknown>;

/**
 * One entry of an error list - a GraphQL user error, a JSON:API error, a
 * Spring Boot field error, an express-validator or FastAPI error, an error
 * or an invalid parameter of problem details.
 */
interface ListedError {
  /** Field path of a GraphQL user error, e.g. `"email"` or `["input", "email"]`. */
  field?: string | string[] | null;
  message?: string;
  /** Spring Boot */
  defaultMessage?: string;
  /** JSON:API */
  detail?: string;
  source?: { parameter?: string; pointer?: string };
  title?: string;
  /** express-validator - the message, and the field (`param` before v7) */
  msg?: string;
  param?: string;
  path?: unknown;
  /** FastAPI - `["body", "email"]` */
  loc?: (number | string)[];
  /** Problem details (RFC 9457) - `"#/email"` in the request body */
  pointer?: string;
  /** An `invalid-params` entry of problem details (RFC 7807) */
  name?: string;
  reason?: string;
}

/** The field messages of an error, and where they come from. */
interface Details {
  /**
   * The error body itself or GraphQL `extensions` - which also hold members
   * of the error (`message`, `code`, …), unlike an `errors` map.
   */
  enveloped: boolean;
  fields: ErrorDetails;
  /** The general messages next to the fields - `formErrors` of Zod. */
  formErrors?: unknown;
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

/**
 * The segments of a field name - dotted (`items.0.name`) or with brackets
 * (`items[0].name`, `order[items][0][name]`), which name the same field.
 */
const toPath = (name: string) => {
  const path = name
    .replace(/\[([^\]]*)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  // System.Text.Json (ASP.NET) names a member of the body `$.age`
  return path[0] === "$" ? path.slice(1) : path;
};

const samePath = (path: string[], fieldPath: string[]) =>
  path.length === fieldPath.length &&
  path.every((segment, index) => sameSegment(segment, fieldPath[index]));

/**
 * The key of `record` naming the field `name`, in whatever case - also a
 * dotted key of a name with brackets, and the other way round.
 */
const findKey = (record: ErrorDetails, name: string) => {
  if (Object.hasOwn(record, name)) return name;

  const path = toPath(name);
  return Object.keys(record).find(
    (key) => sameSegment(key, name) || samePath(toPath(key), path),
  );
};

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
  ("field" in item ||
    "source" in item ||
    "detail" in item ||
    "title" in item ||
    "defaultMessage" in item ||
    "msg" in item ||
    "reason" in item);

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

/** General messages as Zod's `flatten()` gives them - or one text, or none. */
const isFormErrors = (value: unknown) =>
  value === null ||
  typeof value === "string" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

/**
 * The details of Zod's `flatten()` - `{ formErrors: [...], fieldErrors: {
 * email: [...] } }` - keep the field messages apart from the general ones.
 * A body of an API with its own members next to them - `{ code, message,
 * fieldErrors: { email: [...] } }` - has its field messages there too.
 * Either of the two is enough: a serializer leaves out an empty one
 * (Jackson's `NON_EMPTY`), an error class may set one only when it has
 * messages. Without `fieldErrors`, the field messages are those next to
 * `formErrors` (`{ formErrors: [], email: [...] }`) - read as `enveloped`
 * says, none of an `Error` (`enveloped` left out), whose other members are
 * its own. `undefined` for other details.
 */
const getFlattened = (
  source: ErrorDetails,
  enveloped?: boolean,
): Details | undefined => {
  const { fieldErrors, formErrors, ...beside } = source;
  if (isRecord(fieldErrors)) {
    return { enveloped: false, fields: fieldErrors, formErrors };
  }
  if (!isFormErrors(formErrors)) return undefined;

  return enveloped === undefined
    ? { enveloped: false, fields: {}, formErrors }
    : { enveloped, fields: beside, formErrors };
};

/**
 * Finds the validation details of an error, whatever client produced it:
 * - a GraphQL error carries them in the `extensions` of its first error,
 * - a REST error body is either the details object itself
 *   (`{ email: ["is taken"] }`) or wraps it in `errors` - also as Zod's
 *   `flatten()` gives them.
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

  if (isRecord(error.errors)) {
    return (
      getFlattened(error.errors, false) ?? {
        enveloped: false,
        fields: error.errors,
      }
    );
  }

  // The error class of an API client with the messages of the body -
  // `class ApiError extends Error { fieldErrors; formErrors }`. Any other
  // Error (network failure, …) has no validation details.
  if (error instanceof Error) return getFlattened(error);

  return getFlattened(error, true) ?? { enveloped: true, fields: error };
};

/**
 * The error list of `{ errors: [...] }`, `{ userErrors: [...] }`, FastAPI's
 * `{ detail: [...] }`, the `invalid-params` of problem details or a bare
 * list. Every entry of `userErrors` is a user error - also one without a
 * field.
 */
const getErrorList = (error: unknown): ListedError[] | undefined => {
  if (isErrorList(error)) return error;
  if (!isRecord(error)) return undefined;
  if (isErrorList(error.errors)) return error.errors;
  if (isErrorList(error.detail)) return error.detail;
  if (isErrorList(error["invalid-params"])) return error["invalid-params"];

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

/**
 * Messages getFieldError can give to a field - a list of texts, or records
 * and lists that hold one (`{ address: { street: [...] } }`,
 * `items.0.price`). A list of other objects is none - `[{ propertyPath,
 * message }]`.
 */
const holdsMessages = (value: unknown): boolean =>
  Array.isArray(value)
    ? (typeof value[0] === "string" && value[0] !== "") ||
      value.some(holdsMessages)
    : isRecord(value) && Object.values(value).some(holdsMessages);

/**
 * A key of the whole body, no field - `""` of ASP.NET's model-level errors
 * (`ModelState.AddModelError("", …)`), `"$"` of a body System.Text.Json
 * cannot read.
 */
const isBodyKey = (key: string) => toPath(key).length === 0;

/**
 * Whether the details carry field messages. Next to the members of the
 * error, a text is no sure sign - GraphQL servers add their own
 * `extensions` (`classification: "DataFetchingException"`).
 */
const hasFieldMessages = ({ enveloped, fields }: Details) =>
  Object.entries(fields).some(
    ([key, value]) =>
      !isBodyKey(key) &&
      (enveloped
        ? !isErrorMember(key, value) && holdsMessages(value)
        : holdsMessages(value) || (typeof value === "string" && value !== "")),
  );

/**
 * The segments of a JSON Pointer - `"/profile/color"`, or as the URI
 * fragment `"#/profile/color"` (percent-encoded) - with `~1` read as `/` and
 * `~0` as `~`. `""`, `"/"` and `"#"` point at the whole document.
 */
const fromPointer = (pointer: string) => {
  let text = pointer;

  if (text.startsWith("#")) {
    text = text.slice(1);
    try {
      text = decodeURIComponent(text);
    } catch {
      // Not percent-encoded after all - a "%" of the name itself
    }
  }

  return text
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
};

// Where FastAPI took a value from - before the field in its `loc`
const FASTAPI_LOCATIONS = new Set([
  "body",
  "cookie",
  "header",
  "path",
  "query",
]);

const getListedErrorPath = (item: ListedError): string[] | null => {
  if (Array.isArray(item.field)) return item.field.map(String);
  if (typeof item.field === "string") return toPath(item.field);
  // express-validator - a GraphQL error's `path` is a list, no field
  if (typeof item.path === "string") return toPath(item.path);
  if (typeof item.param === "string") return toPath(item.param);

  if (Array.isArray(item.loc)) {
    // ["body", "email"] -> ["email"]; ["body"] is the whole body
    const path = item.loc.map(String);
    return FASTAPI_LOCATIONS.has(path[0]) ? path.slice(1) : path;
  }

  // The `name` of an invalid parameter - only next to its `reason`
  if (typeof item.name === "string" && typeof item.reason === "string") {
    return toPath(item.name);
  }

  const pointer = item.source?.pointer ?? item.source?.parameter;
  if (pointer) {
    // "/data/attributes/email" -> ["email"]
    const segments = fromPointer(pointer);
    // "/data" (or "") points at the whole resource - a general error
    if (
      segments.length === 0 ||
      (segments.length === 1 && segments[0] === "data")
    ) {
      return [];
    }
    return segments.slice(segments.indexOf("attributes") + 1);
  }

  // Problem details point into the request body as it is - no JSON:API
  // `data` or `attributes` around the fields
  if (typeof item.pointer === "string") return fromPointer(item.pointer);

  return null;
};

/**
 * Whether the path of a GraphQL user error is that of the field below the
 * argument of the mutation: `["input", "email"]` is the field "email",
 * `["input", "address", "street"]` the field "address.street" - but
 * `["items", "0", "email"]` is no top-level "email".
 */
const matchesArgumentPath = (path: string[], fieldPath: string[]) =>
  path.length === fieldPath.length + 1 &&
  !/^\d+$/.test(path[0]) &&
  samePath(path.slice(1), fieldPath);

const getListedErrorMessage = (item: ListedError) =>
  item.message ??
  item.defaultMessage ??
  item.msg ??
  item.detail ??
  item.title ??
  item.reason;

/**
 * The message for one form field from a server error, or `undefined`.
 * Understands the error shapes of common GraphQL and REST backends:
 *
 * - GraphQL errors with field messages in `extensions`
 *   (`{ email: ["is taken"] }`) or `extensions.problems`,
 * - GraphQL user errors - `[{ field: ["input", "email"], message }]`,
 * - REST bodies - `{ email: ["is taken"] }`, `{ errors: { email: [...] } }`,
 *   `{ errors: [{ field, message }] }`, JSON:API `errors` with a
 *   `source.pointer`, problem details `errors` with a `pointer` (`"#/email"`,
 *   RFC 9457) or `invalid-params` (`[{ name, reason }]`, RFC 7807), Spring
 *   Boot `{ errors: [{ field, defaultMessage }] }`, express-validator
 *   `{ errors: [{ path, msg }] }`, FastAPI `{ detail: [{ loc: ["body",
 *   "email"], msg }] }` and Zod's `flatten()`, `{ formErrors, fieldErrors:
 *   { email: [...] } }` - also with one of the two left out, in a body, in
 *   its `errors` or in an error class.
 *
 * Field names are matched in camelCase, snake_case and any letter case, and
 * `address.street` (or `address[street]`, `items[0].name`) addresses a
 * nested field - also in nested objects (`{ address: { street: [...] } }`),
 * in a key of System.Text.Json (`"$.address.street"`, ASP.NET) and in a
 * GraphQL user error below the argument (`["input", "address",
 * "street"]`). In a body without an `errors` map, a text in a member that
 * describes the error itself (`message`, `code`, `title`, `detail`,
 * `status`, `type`, …) is no field message - a list there is
 * (`title: ["can't be blank"]`), and so is anything inside `errors`.
 */
export const getFieldError = (
  error: unknown,
  fieldName: string,
): string | undefined => {
  const fieldPath = toPath(fieldName);
  // `""` and `"$"` are the whole body - its messages are those of
  // getBaseError
  if (fieldPath.length === 0) return undefined;

  const list = getErrorList(error);

  if (list) {
    const paths = list.map(getListedErrorPath);
    // The field's own path first - then one below an argument, which only
    // the path list of a GraphQL user error has: in a REST `field` or a
    // JSON:API pointer, `company.name` is no top-level "name"
    const index = paths.findIndex((path) => path && samePath(path, fieldPath));
    const argumentIndex = paths.findIndex(
      (path, pathIndex) =>
        path &&
        Array.isArray(list[pathIndex].field) &&
        matchesArgumentPath(path, fieldPath),
    );
    const item = list[index >= 0 ? index : argumentIndex];
    return item ? getListedErrorMessage(item) : undefined;
  }

  const details = getErrorDetails(error);

  if (!details) return undefined;

  // graphql-ruby input validation: `problems: [{ path, explanation }]`
  const { problems } = details.fields;

  if (Array.isArray(problems)) {
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
    (fieldPath.length > 1
      ? getFirstMessage(getNestedValue(details, fieldPath))
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
 * `base` (Rails), `non_field_errors` (Django REST framework), `""` (the
 * model-level errors of ASP.NET, `"$"` for a body it cannot read),
 * `formErrors` (Zod - a list or one text, also without `fieldErrors`), a
 * plain list of messages (`{ errors: ["…"] }`) or an error list entry
 * without a field (a Spring Boot global error, a JSON:API one pointing at
 * the whole resource, `"/data"`, one of problem details pointing at the
 * whole body, `"#"`, or a FastAPI one at `["body"]`). An error without field
 * messages - none that getFieldError can give to a field - gives its own
 * message: that of a GraphQL error (`"Not authorized"`), a `detail` (Django
 * REST framework, problem details), a `message`, or the `title` of problem
 * details (ASP.NET).
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
    getFirstMessage(details?.fields.nonFieldErrors) ??
    getFirstMessage(details?.fields[""]) ??
    getFirstMessage(details?.fields.$) ??
    getFirstMessage(details?.formErrors);

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
 * Extracts all error messages of nested records in objects and lists in the
 * error details, however deeply nested, e.g. Rails' nested attributes:
 * `{ items: [{ name: "Item 1", errors: { price: ["must be positive"] } }] }`
 * gives `["Item 1: must be positive"]`. Messages of deeper records name the
 * whole path, e.g. `"Order 1 › Item A: must be positive"`.
 */
export const getNestedErrors = (error: unknown): string[] => {
  const details = getErrorDetails(error)?.fields;

  if (!details) return [];

  const allErrors: string[] = [];
  // Track only the current path: a shared record can belong to two parents,
  // while a cyclic reference must not recurse indefinitely.
  const ancestors = new WeakSet<object>();

  // Helper function to extract errors from a resource
  const extractResourceErrors = (
    resource: NestedErrorResource,
    parentName?: string,
  ): void => {
    if (ancestors.has(resource)) return;
    ancestors.add(resource);
    // The path of names from the top record, e.g. "Order 1 › Item A"
    const ownName = firstText(resource.name, resource.model_name);
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
      if (key === "errors") return;
      const nested = Array.isArray(value) ? value : [value];
      nested.forEach((nestedResource) => {
        if (isRecord(nestedResource)) {
          extractResourceErrors(nestedResource, resourceName);
        }
      });
    });
    ancestors.delete(resource);
  };

  Object.entries(details).forEach(([key, value]) => {
    if (key === "base") return;
    const resources = Array.isArray(value) ? value : [value];
    resources.forEach((resource) => {
      if (isRecord(resource)) extractResourceErrors(resource);
    });
  });

  return allErrors;
};
