import { camelToSnakeCase, snakeToCamelCase } from "./case-conversion";

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

const isRecord = (value: unknown): value is ErrorDetails =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * An error list that describes validation problems - entries with a `field`
 * (GraphQL user errors: `{ field, message }`) or a JSON:API `source`. A list
 * of plain GraphQL errors (with `extensions`) is not one.
 */
const isErrorList = (value: unknown): value is ListedError[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      isRecord(item) &&
      !("extensions" in item) &&
      ("field" in item ||
        "source" in item ||
        "detail" in item ||
        "title" in item),
  );

/**
 * Finds the validation details of an error, whatever client produced it:
 * - a GraphQL error carries them in the `extensions` of its first error, in
 *   `errors` (Apollo 4 `CombinedGraphQLErrors`, a raw GraphQL response body)
 *   or `graphQLErrors` (Apollo 3 `ApolloError`, urql `CombinedError`),
 * - a REST error body is either the details object itself
 *   (`{ email: ["is taken"] }`) or wraps it in `errors`.
 */
const getErrorDetails = (error: unknown): ErrorDetails | undefined => {
  if (!isRecord(error)) return undefined;

  const graphQLErrors = Array.isArray(error.errors)
    ? error.errors
    : Array.isArray(error.graphQLErrors)
      ? error.graphQLErrors
      : undefined;

  if (graphQLErrors && !isErrorList(graphQLErrors)) {
    const extensions = graphQLErrors[0]?.extensions;
    if (!isRecord(extensions)) return undefined;
    // Some servers nest the field messages once more
    return isRecord(extensions.errors) ? extensions.errors : extensions;
  }

  if (isRecord(error.errors)) return error.errors;

  // Any other Error (network failure, …) has no validation details
  return error instanceof Error ? undefined : error;
};

/** The error list of `{ errors: [...] }`, `{ userErrors: [...] }` or a bare list. */
const getErrorList = (error: unknown): ListedError[] | undefined => {
  if (isErrorList(error)) return error;
  if (!isRecord(error)) return undefined;
  if (isErrorList(error.errors)) return error.errors;
  if (isErrorList(error.userErrors)) return error.userErrors;
  return undefined;
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

const sameSegment = (segment: string, name: string) =>
  segment === name ||
  snakeToCamelCase(segment) === name ||
  camelToSnakeCase(segment) === name;

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
 * Field names are matched in camelCase and snake_case, and `user.email`
 * addresses a nested field.
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
  if (Array.isArray(details.problems)) {
    const fieldPath = fieldName.split(".");

    for (const problem of details.problems) {
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

  const direct =
    getFirstMessage(details[fieldName]) ??
    getFirstMessage(details[camelToSnakeCase(fieldName)]) ??
    getFirstMessage(details[snakeToCamelCase(fieldName)]);

  if (direct) return direct;

  // Case-insensitive fallback - e.g. ASP.NET reports "Email" for "email"
  const lowerName = fieldName.toLowerCase();
  const key = Object.keys(details).find(
    (candidate) => candidate.toLowerCase() === lowerName,
  );

  return key ? getFirstMessage(details[key]) : undefined;
};

/**
 * The general message of a server error that is not tied to a field -
 * `base` (Rails), `non_field_errors` (Django REST framework), a plain list
 * of messages (`{ errors: ["…"] }`) or an error list entry without a field
 * (or a JSON:API one pointing at the whole resource, `"/data"`).
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

  return (
    getFirstMessage(details?.base) ??
    getFirstMessage(details?.non_field_errors) ??
    getFirstMessage(details?.nonFieldErrors)
  );
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
 * gives `["Item 1: must be positive"]`.
 */
export const getNestedErrors = (error: unknown): string[] => {
  const details = getErrorDetails(error);

  if (!details) return [];

  const allErrors: string[] = [];

  // Helper function to extract errors from a resource
  const extractResourceErrors = (
    resource: NestedErrorResource,
    parentName?: string,
  ): void => {
    const resourceName =
      parentName || resource.name || resource.model_name || "";

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
