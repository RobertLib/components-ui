import { describe, expect, it } from "vitest";
import removeDiacritics from "./remove-diacritics";

describe("removeDiacritics", () => {
  it("removes accents", () => {
    expect(removeDiacritics("Příliš žluťoučký kůň")).toBe(
      "Prilis zlutoucky kun",
    );
  });

  it("folds letters with a stroke, which have no accent to remove", () => {
    expect(removeDiacritics("Łódź")).toBe("Lodz");
    expect(removeDiacritics("Øresund, Đakovo, Ħamrun, Iğdır")).toBe(
      "Oresund, Dakovo, Hamrun, Igdir",
    );
  });

  it("keeps the length of the text", () => {
    const text = "Łódź Øre đak ħal ŧa ıs Straße Æsir";

    expect(removeDiacritics(text)).toHaveLength(text.length);
    // Letters that would expand stay
    expect(removeDiacritics("Straße Æsir")).toBe("Straße Æsir");
  });
});
