import { describe, expect, it, vi } from "vitest";
import {
  applyTextChange,
  findQuery,
  insertMentions,
  MAX_MENTION_PART,
  mentionsToText,
  parseCopiedValue,
  parseMentions,
  parseValue,
  resolveTriggers,
  serializeValue,
  toMentionToken,
  type MentionRange,
} from "./markup";

const jana: MentionRange = {
  end: 14,
  id: "user:42",
  label: "Jana Nováková",
  start: 0,
  trigger: "@",
};

describe("parseValue and serializeValue", () => {
  it("reads the tokens as the text the field shows", () => {
    expect(
      parseValue(
        "Ahoj @[Jana Nováková](user:42), viz #[T-12](ticket:12)",
        "@#",
      ),
    ).toEqual({
      mentions: [
        { ...jana, end: 19, start: 5 },
        { end: 30, id: "ticket:12", label: "T-12", start: 25, trigger: "#" },
      ],
      text: "Ahoj @Jana Nováková, viz #T-12",
    });
  });

  it("reads tokens only of the triggers given", () => {
    expect(parseValue("#[T-12](ticket:12)", "@").text).toBe(
      "#[T-12](ticket:12)",
    );
  });

  it("keeps brackets and backslashes of labels and ids", () => {
    const mention = {
      end: 14,
      id: "a)b\\c",
      label: "Tým [HR] \\ IT",
      start: 0,
      trigger: "@",
    };
    const value = serializeValue("@Tým [HR] \\ IT a", [mention], "@");

    expect(value).toBe("@[Tým [HR\\] \\\\ IT](a\\)b\\\\c) a");
    expect(parseValue(value, "@")).toEqual({
      mentions: [mention],
      text: "@Tým [HR] \\ IT a",
    });
  });

  it.each([
    "@[text](not a mention) typed by hand",
    "@\\[ and @\\\\ and @@[x](y)",
    "jana@firma.cz, [link](https://example.com)",
    "@[]() and @[x]() and @[x] (y)",
  ])("keeps text that looks like a token text: %s", (text) => {
    const value = serializeValue(text, [], "@");
    expect(parseValue(value, "@")).toEqual({ mentions: [], text });
  });

  it("writes the labels and ids back as they were read", () => {
    const value = "@[ Jana  Nováková ](user:42) a";
    const { mentions, text } = parseValue(value, "@");

    expect(serializeValue(text, mentions, "@")).toBe(value);
  });

  it("leaves ordinary text as it is", () => {
    expect(serializeValue("Cena [Kč] (bez DPH) @ 21 %", [], "@#")).toBe(
      "Cena [Kč] (bez DPH) @ 21 %",
    );
  });

  it("reads no token across lines or of a huge label", () => {
    expect(parseValue("@[a\nb](1)", "@").mentions).toEqual([]);
    expect(parseValue(`@[${"x".repeat(500)}](1)`, "@").mentions).toEqual([]);
  });

  it("reads the line breaks a form posts as the field has them", () => {
    expect(parseValue("a\r\nb @[Petr](7)\rc", "@")).toEqual({
      mentions: [{ end: 9, id: "7", label: "Petr", start: 4, trigger: "@" }],
      text: "a\nb @Petr\nc",
    });
  });
});

describe("the helpers of stored values", () => {
  const body =
    "Díky @[Jana Nováková](user:42) a @[Petr](user:7)! #[T-12](t:12)";

  it("lists the mentions with parseMentions", () => {
    expect(parseMentions(body)).toEqual([
      { id: "user:42", label: "Jana Nováková", trigger: "@" },
      { id: "user:7", label: "Petr", trigger: "@" },
    ]);
    expect(
      parseMentions(body, { triggers: ["@", { char: "#" }] }),
    ).toHaveLength(3);
  });

  it("writes the plain text with mentionsToText", () => {
    expect(mentionsToText(body, { triggers: ["@", "#"] })).toBe(
      "Díky @Jana Nováková a @Petr! #T-12",
    );
  });

  it("writes a token with toMentionToken", () => {
    expect(toMentionToken({ id: "7", label: "Petr", trigger: "@" })).toBe(
      "@[Petr](7)",
    );
    // On one line and not too long, as the field writes it - it reads back
    expect(
      toMentionToken({ id: "7\n8", label: " Petr\n Svoboda ", trigger: "@" }),
    ).toBe("@[Petr Svoboda](7 8)");
    expect(
      parseMentions(
        toMentionToken({ id: "7", label: "P".repeat(300), trigger: "@" }),
      ),
    ).toEqual([{ id: "7", label: "P".repeat(MAX_MENTION_PART), trigger: "@" }]);
  });

  it("writes a mention that would read as no mention as text", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(toMentionToken({ id: "", label: "[Petr]", trigger: "@" })).toBe(
      "@\\[Petr]",
    );
    expect(
      toMentionToken({ id: "7".repeat(201), label: "Petr", trigger: "@" }),
    ).toBe("@Petr");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("skips invalid triggers", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      resolveTriggers(["@", "[", "ab", " ", { char: "@" }, "#"]).map(
        (trigger) => trigger.char,
      ),
    ).toEqual(["@", "#"]);
  });
});

describe("applyTextChange", () => {
  it("keeps a mention when text is typed before or after it", () => {
    expect(
      applyTextChange("@Jana Nováková", [jana], "@Jana Nováková!", 15),
    ).toEqual([jana]);
    expect(
      applyTextChange("@Jana Nováková", [jana], "Hi @Jana Nováková", 3),
    ).toEqual([{ ...jana, end: 17, start: 3 }]);
  });

  it("tells a letter typed after a mention from one typed into it by the caret", () => {
    // "Nováková" ends with "á" - a typed "á" after it is not in it
    expect(
      applyTextChange("@Jana Nováková", [jana], "@Jana Novákováá", 15),
    ).toEqual([jana]);
    expect(
      applyTextChange("@Jana Nováková", [jana], "@Jana Novákováá", 14),
    ).toEqual([]);
  });

  it("makes a mention text once the change reaches into it", () => {
    expect(
      applyTextChange("@Jana Nováková", [jana], "@Jana Novák", 11),
    ).toEqual([]);
    expect(applyTextChange("@Jana Nováková x", [jana], "x", 0)).toEqual([]);
  });
});

describe("insertMentions", () => {
  it("adds the inserted mentions and moves those after them", () => {
    const later = { ...jana, end: 24, start: 10 };
    expect(
      insertMentions([later], {
        from: 0,
        mentions: [{ end: 5, id: "7", label: "Petr", start: 0, trigger: "@" }],
        text: "@Petr ",
        to: 3,
      }),
    ).toEqual([
      { end: 5, id: "7", label: "Petr", start: 0, trigger: "@" },
      { ...later, end: 27, start: 13 },
    ]);
  });
});

describe("findQuery", () => {
  const triggers = resolveTriggers(["@", { allowSpaces: false, char: "#" }]);

  it("finds the mention typed before the caret", () => {
    expect(findQuery("Ahoj @Jan", 9, [], triggers)).toEqual({
      char: "@",
      end: 9,
      start: 5,
      text: "Jan",
    });
    expect(findQuery("@", 1, [], triggers)?.text).toBe("");
    expect(findQuery("(@Jana Nov", 10, [], triggers)?.text).toBe("Jana Nov");
  });

  it("finds none in an e-mail, after a space, across lines or in a mention", () => {
    expect(findQuery("jana@firma", 10, [], triggers)).toBeNull();
    expect(findQuery("@ ahoj", 6, [], triggers)).toBeNull();
    expect(findQuery("@Jana\nNov", 9, [], triggers)).toBeNull();
    expect(findQuery("#T-12 x", 7, [], triggers)).toBeNull();
    expect(findQuery("@Jana Nováková", 14, [jana], triggers)).toBeNull();
    expect(findQuery(`@${"x".repeat(60)}`, 61, [], triggers)).toBeNull();
  });
});

describe("parseCopiedValue", () => {
  it("reads a copied value with the triggers of the field it comes from", () => {
    // The tickets of a field with "#" are text in one without
    expect(
      parseCopiedValue("@[Jana](1) a #[T-12](ticket:12)", "@#", "@"),
    ).toEqual({
      mentions: [{ end: 5, id: "1", label: "Jana", start: 0, trigger: "@" }],
      text: "@Jana a #T-12",
    });
    // Text of a field without "#" that looks like a token stays text
    expect(parseCopiedValue("#[T-12](ticket:12)", "@", "@#")).toEqual({
      mentions: [],
      text: "#[T-12](ticket:12)",
    });
  });
});
