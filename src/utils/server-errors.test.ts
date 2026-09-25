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

  it("reads a list in which some entries have no field", () => {
    const payload = {
      userErrors: [
        { field: ["input", "email"], message: "is taken" },
        { message: "Out of stock" },
      ],
    };
    expect(getFieldError(payload, "email")).toBe("is taken");
    expect(getFieldError(payload, "message")).toBeUndefined();

    const body = [{ field: "name", message: "is required" }, { message: "x" }];
    expect(getFieldError(body, "name")).toBe("is required");
  });

  it("does not take the members of the error for fields", () => {
    const apollo = {
      errors: [
        {
          extensions: { code: "UNAUTHENTICATED", stacktrace: ["at x"] },
          message: "Not signed in",
          path: ["createUser"],
        },
      ],
    };
    expect(getFieldError(apollo, "code")).toBeUndefined();
    expect(getFieldError(apollo, "stacktrace")).toBeUndefined();
    expect(getFieldError(apollo, "path")).toBeUndefined();
    expect(getFieldError({ message: "Boom" }, "message")).toBeUndefined();
    expect(getFieldError({ detail: "Not found." }, "detail")).toBeUndefined();
    expect(
      getFieldError({ status: 404, title: "Not Found" }, "title"),
    ).toBeUndefined();

    // A list of messages is still a field of that name, and so is anything
    // in an `errors` map
    expect(getFieldError({ title: ["can't be blank"] }, "title")).toBe(
      "can't be blank",
    );
    expect(
      getFieldError({ errors: { message: ["is required"] } }, "message"),
    ).toBe("is required");
    expect(
      getFieldError(
        { errors: [{ extensions: { code: ["is taken"] }, message: "" }] },
        "code",
      ),
    ).toBe("is taken");
  });

  it("follows dotted names into nested objects and lists", () => {
    expect(
      getFieldError(
        { address: { street: ["can't be blank"] } },
        "address.street",
      ),
    ).toBe("can't be blank");
    expect(
      getFieldError(
        { errors: { billing_address: { zip_code: "is invalid" } } },
        "billingAddress.zipCode",
      ),
    ).toBe("is invalid");
    expect(
      getFieldError({ items: [{}, { price: ["too low"] }] }, "items.1.price"),
    ).toBe("too low");
    // Rails' nested attributes report a dotted key
    expect(getFieldError({ "address.street": ["x"] }, "address.street")).toBe(
      "x",
    );
    expect(
      getFieldError({ address: { street: ["x"] } }, "address.city"),
    ).toBeUndefined();
    expect(getFieldError({ address: ["x"] }, "address.street")).toBeUndefined();
  });

  it("matches names with numbers, acronyms and dashes", () => {
    expect(getFieldError({ address_line_1: ["x"] }, "addressLine1")).toBe("x");
    expect(getFieldError({ address_line1: ["x"] }, "addressLine1")).toBe("x");
    expect(getFieldError({ addressLine1: "x" }, "address_line_1")).toBe("x");
    expect(getFieldError({ user_id: ["x"] }, "userID")).toBe("x");
    expect(getFieldError({ UserId: ["x"] }, "user_id")).toBe("x");
    expect(
      getFieldError(
        {
          errors: [
            { detail: "x", source: { pointer: "/data/attributes/first-name" } },
          ],
        },
        "firstName",
      ),
    ).toBe("x");
  });
});

describe("getFieldError paths", () => {
  it("matches a user error below the argument of the mutation", () => {
    const payload = {
      userErrors: [
        { field: ["input", "address", "street"], message: "is blank" },
        { field: ["input", "email"], message: "is taken" },
      ],
    };
    expect(getFieldError(payload, "address.street")).toBe("is blank");
    expect(getFieldError(payload, "email")).toBe("is taken");
    expect(getFieldError(payload, "street")).toBeUndefined();
  });

  it("gives no nested error to a field of the same name at the top", () => {
    const payload = {
      userErrors: [{ field: ["items", "0", "email"], message: "is invalid" }],
    };
    expect(getFieldError(payload, "email")).toBeUndefined();
    expect(getFieldError(payload, "items.0.email")).toBe("is invalid");
  });

  it("prefers the field's own path to one below an argument", () => {
    const payload = {
      userErrors: [
        { field: ["input", "email"], message: "of the input" },
        { field: ["email"], message: "of the field" },
      ],
    };
    expect(getFieldError(payload, "email")).toBe("of the field");
  });

  it("reads names with brackets as dotted ones, and the other way round", () => {
    const nested = { errors: { items: [{ name: ["is blank"] }] } };
    expect(getFieldError(nested, "items[0].name")).toBe("is blank");
    expect(getFieldError(nested, "items.0.name")).toBe("is blank");

    // Rails' `index_errors`, ASP.NET
    const flat = { errors: { "Items[0].Name": ["is blank"] } };
    expect(getFieldError(flat, "items.0.name")).toBe("is blank");
    expect(getFieldError(flat, "items[0].name")).toBe("is blank");

    const listed = { errors: [{ field: "order[items][1]", message: "…" }] };
    expect(getFieldError(listed, "order.items.1")).toBe("…");
  });

  it("matches a plural acronym to its snake_case name", () => {
    expect(getFieldError({ user_ids: ["are unknown"] }, "userIDs")).toBe(
      "are unknown",
    );
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

  it("takes the user error without a field, also next to field errors", () => {
    expect(getBaseError({ userErrors: [{ message: "Out of stock" }] })).toBe(
      "Out of stock",
    );
    expect(
      getBaseError({
        userErrors: [
          { field: ["input", "email"], message: "is taken" },
          { message: "Out of stock" },
        ],
      }),
    ).toBe("Out of stock");
    expect(
      getBaseError({ userErrors: [{ field: "email", message: "x" }] }),
    ).toBeUndefined();
  });

  it("gives the message of a GraphQL error without field messages", () => {
    const response = {
      errors: [{ message: "Not authorized", path: ["deleteUser"] }],
    };
    const apollo3 = {
      graphQLErrors: [
        { extensions: { code: "FORBIDDEN" }, message: "Not authorized" },
      ],
      message: "Not authorized",
    };

    expect(getBaseError(response)).toBe("Not authorized");
    expect(getBaseError(apollo3)).toBe("Not authorized");
    // Its message says nothing the fields do not
    expect(
      getBaseError({
        errors: [
          {
            extensions: { code: "BAD_USER_INPUT", email: ["is taken"] },
            message: "Validation failed",
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("gives the detail or title of REST errors without field messages", () => {
    expect(getBaseError({ detail: "Not found." })).toBe("Not found.");
    expect(
      getBaseError({
        status: 403,
        title: "Forbidden",
        traceId: "00-1",
        type: "https://tools.ietf.org/html/rfc9110#section-15.5.4",
      }),
    ).toBe("Forbidden");
    expect(
      getBaseError({ detail: "Order 42 is closed", status: 409, title: "x" }),
    ).toBe("Order 42 is closed");
    expect(getBaseError({ message: "Unauthenticated." })).toBe(
      "Unauthenticated.",
    );

    const validation = {
      errors: { Email: ["The Email field is required."] },
      status: 400,
      title: "One or more validation errors occurred.",
    };
    expect(getBaseError(validation)).toBeUndefined();
    expect(getFieldError(validation, "email")).toBe(
      "The Email field is required.",
    );
    expect(getBaseError(new Error("Failed to fetch"))).toBeUndefined();
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

  it("names deeper records by their path", () => {
    const body = {
      errors: {
        orders: [
          {
            errors: { date: ["is in the past"] },
            items: [
              { errors: { price: ["must be positive"] }, name: "Item A" },
              { errors: { price: ["is too high"] } },
            ],
            name: "Order 1",
          },
          {
            items: [{ errors: { qty: ["is zero"] }, model_name: "Item" }],
          },
        ],
      },
    };
    expect(getNestedErrors(body)).toEqual([
      "Order 1: is in the past",
      "Order 1 › Item A: must be positive",
      "Order 1: is too high",
      "Item: is zero",
    ]);
  });
});
