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

  it("keeps the plural s of an acronym", () => {
    expect(camelToSnakeCase("userIDs")).toBe("user_ids");
    expect(camelToSnakeCase("APIsList")).toBe("apis_list");
    expect(camelToSnakeCase("URLsCount")).toBe("urls_count");
    // A word after the acronym is still one of its own
    expect(camelToSnakeCase("HTTPServer")).toBe("http_server");
    expect(camelToSnakeCase("IDSet")).toBe("id_set");
  });
});
