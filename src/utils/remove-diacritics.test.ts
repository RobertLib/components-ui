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

  it("leaves the letters of other scripts whole", () => {
    // Korean syllables and Japanese kana with a voicing mark decompose into
    // pieces without an accent to remove - they come back composed
    expect(removeDiacritics("한국어")).toBe("한국어");
    expect(removeDiacritics("がぎ ダ")).toBe("がぎ ダ");
    expect(removeDiacritics("한국어 Čeština")).toHaveLength(11);
    // Written decomposed, they stay so
    const decomposed = "한국어 が".normalize("NFD");
    expect(removeDiacritics(decomposed)).toBe(decomposed);
    // Accents written as combining marks go all the same
    expect(removeDiacritics("Cafe\u0301")).toBe("Cafe");
  });

  it("folds a text as its letters fold one by one", () => {
    const text = "Příliš Łódź 한국어 がぎ Cafe\u0301 😀 Ωμέγα";

    expect(removeDiacritics(text)).toBe(
      Array.from(text, (char) => removeDiacritics(char)).join(""),
    );
  });
});
