/**
 * `firstName` → `first_name`. Acronyms and numbers are words of their own:
 * `userID` → `user_id`, `HTMLParser` → `html_parser`, `addressLine1` →
 * `address_line_1` - and an acronym keeps its plural `s`: `userIDs` →
 * `user_ids`.
 */
export const camelToSnakeCase = (str: string): string => {
  return (
    str
      .replace(/([a-z\d])([A-Z])/g, "$1_$2")
      // "HTMLParser" - but not the "s" ending a plural "IDs"
      .replace(/([A-Z])([A-Z](?!s(?![a-z]))[a-z])/g, "$1_$2")
      .replace(/([a-zA-Z])(\d)/g, "$1_$2")
      .toLowerCase()
  );
};
