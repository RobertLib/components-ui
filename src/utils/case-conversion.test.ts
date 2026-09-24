import { describe, expect, it } from "vitest";
import { camelToSnakeCase } from "./case-conversion";

describe("case conversion", () => {
  it("converts camelCase to snake_case, with acronyms and numbers", () => {
    expect(camelToSnakeCase("firstName")).toBe("first_name");
    expect(camelToSnakeCase("userID")).toBe("user_id");
    expect(camelToSnakeCase("HTMLParser")).toBe("html_parser");
    expect(camelToSnakeCase("addressLine1")).toBe("address_line_1");
    expect(camelToSnakeCase("Email")).toBe("email");
    expect(camelToSnakeCase("first_name")).toBe("first_name");
  });
});
