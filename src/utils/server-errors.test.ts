import { describe, expect, it } from "vitest";
import { getBaseError, getFieldError, getNestedErrors } from "./server-errors";

describe("getFieldError", () => {
  it("reads a REST body with the field messages at the top", () => {
    expect(getFieldError({ email: ["is taken"] }, "email")).toBe("is taken");
  });

  it("reads a REST body wrapping them in `errors`", () => {
    const body = { errors: { email: ["is taken", "is too short"] } };
    expect(getFieldError(body, "email")).toBe("is taken");
  });

  it("matches camelCase and snake_case field names", () => {
    expect(getFieldError({ first_name: ["can't be blank"] }, "firstName")).toBe(
      "can't be blank",
    );
    expect(getFieldError({ firstName: "missing" }, "first_name")).toBe(
      "missing",
    );
  });

  it("matches field names case-insensitively as a fallback", () => {
    expect(getFieldError({ errors: { Email: ["invalid"] } }, "email")).toBe(
      "invalid",
    );
  });

  it("reads the extensions of a GraphQL response or client error", () => {
    const response = {
      errors: [{ extensions: { email: ["is taken"] }, message: "Invalid" }],
    };
    const apollo3 = { graphQLErrors: response.errors, message: "Invalid" };
    expect(getFieldError(response, "email")).toBe("is taken");
    expect(getFieldError(apollo3, "email")).toBe("is taken");
  });

  it("reads graphql-ruby problems by their path", () => {
    const error = {
      errors: [
        {
          extensions: {
            problems: [
              { explanation: "must be a date", path: ["user", "born_on"] },
            ],
          },
        },
      ],
    };
    expect(getFieldError(error, "user.bornOn")).toBe("must be a date");
    expect(getFieldError(error, "bornOn")).toBeUndefined();
  });

  it("reads GraphQL user errors and error lists", () => {
    const payload = {
      userErrors: [{ field: ["input", "email"], message: "is taken" }],
    };
    expect(getFieldError(payload, "email")).toBe("is taken");
    expect(
      getFieldError(
        { errors: [{ field: "name", message: "is required" }] },
        "name",
      ),
    ).toBe("is required");
  });

  it("reads JSON:API errors by their pointer", () => {
    const body = {
      errors: [
        { detail: "is invalid", source: { pointer: "/data/attributes/email" } },
      ],
    };
    expect(getFieldError(body, "email")).toBe("is invalid");
  });

  it("returns undefined for other errors", () => {
    expect(getFieldError(new Error("Network error"), "email")).toBeUndefined();
    expect(getFieldError(null, "email")).toBeUndefined();
    expect(getFieldError({ email: ["x"] }, "name")).toBeUndefined();
  });
});

describe("getBaseError", () => {
  it("reads base and non-field errors", () => {
    expect(getBaseError({ errors: { base: ["Locked"] } })).toBe("Locked");
    expect(getBaseError({ non_field_errors: ["Nope"] })).toBe("Nope");
    expect(
      getBaseError({
        errors: [{ extensions: { base: ["Denied"] }, message: "" }],
      }),
    ).toBe("Denied");
  });

  it("takes the list entry without a field", () => {
    expect(
      getBaseError({
        errors: [
          { field: null, message: "Try later" },
          { field: "a", message: "x" },
        ],
      }),
    ).toBe("Try later");
  });

  it("reads a plain list of messages", () => {
    const error = { errors: ["Account locked", "Try later"] };

    expect(getBaseError(error)).toBe("Account locked");
    expect(getBaseError(["Quota exceeded"])).toBe("Quota exceeded");
    expect(getFieldError(error, "email")).toBeUndefined();
    expect(getNestedErrors(error)).toEqual([]);
  });

  it("takes a JSON:API error pointing at the whole resource", () => {
    const error = {
      errors: [
        { detail: "is taken", source: { pointer: "/data/attributes/email" } },
        { detail: "Record is stale", source: { pointer: "/data" } },
      ],
    };

    expect(getBaseError(error)).toBe("Record is stale");
    expect(getFieldError(error, "data")).toBeUndefined();
    expect(getFieldError(error, "email")).toBe("is taken");
  });
});

describe("getNestedErrors", () => {
  it("collects the messages of nested records", () => {
    const body = {
      errors: {
        items: [
          { errors: { price: ["must be positive"] }, name: "Item 1" },
          { errors: {}, name: "Item 2" },
        ],
      },
    };
    expect(getNestedErrors(body)).toEqual(["Item 1: must be positive"]);
  });
});
