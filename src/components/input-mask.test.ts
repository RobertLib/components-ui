import { describe, expect, it } from "vitest";
import {
  applyMask,
  conformToMask,
  editMasked,
  parseMask,
  type MaskEdit,
} from "./input-mask";

const zip = parseMask("### ##");
const phone = parseMask("+420 ### ### ###");
const iban = parseMask("CZ## #### #### #### #### ####");

/** An edit written with `|` for the caret before and after it. */
function edit(
  mask: ReturnType<typeof parseMask>,
  previous: string,
  next: string,
  inputType?: string,
): string {
  const caret = next.indexOf("|");
  const result: MaskEdit = editMasked(
    mask,
    previous,
    next.replace("|", ""),
    caret,
    inputType,
  );
  const { selectionEnd, selectionStart, value } = result;
  return selectionStart === selectionEnd
    ? `${value.slice(0, selectionStart)}|${value.slice(selectionStart)}`
    : `${value.slice(0, selectionStart)}[${value.slice(selectionStart, selectionEnd)}]${value.slice(selectionEnd)}`;
}

describe("parseMask", () => {
  it("reads placeholders, literals and escaped characters", () => {
    const mask = parseMask("\\#@* #");
    expect(mask.tokens.map((token) => token.kind)).toEqual([
      "literal",
      "slot",
      "slot",
      "literal",
      "slot",
    ]);
    expect(mask.numeric).toBe(false);
    expect(parseMask("### ##").numeric).toBe(true);
  });

  it("takes placeholders of your own", () => {
    const hex = parseMask("\\#HHHHHH", {
      H: { pattern: /[0-9A-F]/, transform: (char) => char.toUpperCase() },
    });
    expect(conformToMask(hex, "#ff00aa").formatted).toBe("#FF00AA");
    expect(conformToMask(hex, "zz12").raw).toBe("12");

    // A global pattern tests every character from the start
    const letters = parseMask("LL", { L: /[a-z]/g });
    expect(conformToMask(letters, "ab").raw).toBe("ab");
  });
});

describe("applyMask", () => {
  it("formats raw and formatted values alike", () => {
    expect(applyMask("### ##", "12345")).toEqual({
      complete: true,
      formatted: "123 45",
      raw: "12345",
    });
    expect(applyMask("### ##", "123 45").formatted).toBe("123 45");
    expect(applyMask("### ##", "123-45").formatted).toBe("123 45");
    expect(applyMask("### ##", "123")).toEqual({
      complete: false,
      formatted: "123",
      raw: "123",
    });
    expect(applyMask("### ##", "")).toEqual({
      complete: false,
      formatted: "",
      raw: "",
    });
  });

  it("keeps the literals a value repeats out of it", () => {
    expect(applyMask("+420 ### ### ###", "+420 777 123 456").raw).toBe(
      "777123456",
    );
    expect(applyMask("+420 ### ### ###", "420777123456").raw).toBe("777123456");
    // Digits that only look like the literal are the number
    expect(applyMask("+420 ### ### ###", "420123456").formatted).toBe(
      "+420 420 123 456",
    );
    expect(applyMask("+420 ### ### ###", "777123456").formatted).toBe(
      "+420 777 123 456",
    );
    expect(applyMask("CZ## ####", "cz65 0800").formatted).toBe("CZ65 0800");
  });

  it("takes the digits of other scripts as Latin ones", () => {
    expect(applyMask("########", "１２３４５６７８").raw).toBe("12345678");
    expect(applyMask("###", "٤٥٦").raw).toBe("456");
  });

  it("writes the literals at the end of a complete value", () => {
    expect(applyMask("###/", "12").formatted).toBe("12");
    expect(applyMask("###/", "123").formatted).toBe("123/");
  });
});

describe("editMasked", () => {
  it("inserts literals while typing, and moves past them", () => {
    expect(edit(zip, "", "1|")).toBe("1|");
    expect(edit(zip, "123", "1234|")).toBe("123 4|");
    expect(edit(phone, "", "7|")).toBe("+420 7|");
    expect(edit(zip, "12", "13|2")).toBe("13|2");
    // In front of a literal the next digit goes after it
    expect(edit(zip, "124 5", "123|4 5")).toBe("123 |45");
  });

  it("refuses characters no placeholder takes", () => {
    expect(edit(zip, "12", "12a|")).toBe("12|");
    expect(edit(zip, "", "x|")).toBe("|");
    // The selection stays as it was
    expect(edit(zip, "123 45", "1x| 45")).toBe("1[23] 45");
  });

  it("refuses typing into a complete value, as maxLength does", () => {
    expect(edit(zip, "123 45", "129|3 45")).toBe("12|3 45");
    expect(edit(zip, "123 45", "123 456|")).toBe("123 45|");
  });

  it("replaces a selection", () => {
    expect(edit(zip, "123 45", "19| 45")).toBe("19|4 5");
    expect(edit(zip, "123 45", "9|")).toBe("9|");
  });

  it("lets a typed separator move past the literal", () => {
    expect(edit(zip, "123 45", "123 | 45")).toBe("123 |45");
    // At the end there is nothing to move past
    expect(edit(zip, "123", "123 |")).toBe("123|");
  });

  it("deletes across literals with Backspace and Delete", () => {
    expect(edit(zip, "123 45", "123|45", "deleteContentBackward")).toBe(
      "12|4 5",
    );
    expect(edit(zip, "123 45", "123|45", "deleteContentForward")).toBe(
      "123| 5",
    );
    expect(edit(zip, "123 45", "123 |5", "deleteContentBackward")).toBe(
      "123 |5",
    );
    expect(edit(zip, "123 4", "123 |", "deleteContentBackward")).toBe("123|");
    // Nothing before the leading literals - the caret walks over them
    expect(edit(phone, "+420 7", "+420|7", "deleteContentBackward")).toBe(
      "+420| 7",
    );
    expect(edit(phone, "+420 7", "|", "deleteContentBackward")).toBe("|");
  });

  it("leaves a literal cut or dragged away where it is", () => {
    expect(edit(zip, "123 45", "123|45", "deleteByCut")).toBe("123| 45");
  });

  it("guesses the direction of a deletion without an input type", () => {
    expect(edit(zip, "123 45", "123|45")).toBe("12|4 5");
  });

  it("reads pasted text with or without its separators", () => {
    expect(edit(zip, "", "123 45|", "insertFromPaste")).toBe("123 45|");
    expect(edit(zip, "", "12345|", "insertFromPaste")).toBe("123 45|");
    expect(edit(phone, "", "+420 777 123 456|", "insertFromPaste")).toBe(
      "+420 777 123 456|",
    );
    expect(
      edit(iban, "", "CZ65 0800 0000 1920 0014 5399|", "insertFromPaste"),
    ).toBe("CZ65 0800 0000 1920 0014 5399|");
    expect(edit(iban, "", "6508000000192000145399|", "insertFromPaste")).toBe(
      "CZ65 0800 0000 1920 0014 5399|",
    );
  });

  it("pastes what fits into a partly filled value", () => {
    expect(edit(zip, "1", "1987654|", "insertFromPaste")).toBe("198 76|");
  });

  it("moves the characters after an edit into the next placeholders", () => {
    const plate = parseMask("#@@ ####");
    expect(conformToMask(plate, "1AB2345").formatted).toBe("1AB 2345");
    // The letter after a deleted one is left out where a digit belongs
    expect(edit(plate, "1AB 2345", "1|B 2345", "deleteContentBackward")).toBe(
      "1|B",
    );
  });

  it("formats the whole text when the value was not the shown one", () => {
    expect(edit(zip, "12345", "123456|")).toBe("123 45|");
  });
});
