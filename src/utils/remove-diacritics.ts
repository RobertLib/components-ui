// Letters with a stroke or bar are no letter plus an accent, so NFD leaves
// them whole. Each folds to one letter - the text keeps its length, and
// DataTable maps the positions of a match back into the original. Letters
// that would expand (ß → ss, æ → ae) stay as they are.
const FOLDED_LETTERS: Record<string, string> = {
  Ð: "D",
  ð: "d",
  Đ: "D",
  đ: "d",
  Ħ: "H",
  ħ: "h",
  ı: "i",
  Ŀ: "L",
  ŀ: "l",
  Ł: "L",
  ł: "l",
  Ŋ: "N",
  ŋ: "n",
  Ø: "O",
  ø: "o",
  ſ: "s",
  Ŧ: "T",
  ŧ: "t",
  ƀ: "b",
  Ƀ: "B",
  Ɨ: "I",
  ɨ: "i",
  Ƶ: "Z",
  ƶ: "z",
  Ǥ: "G",
  ǥ: "g",
  Ȼ: "C",
  ȼ: "c",
  Ɇ: "E",
  ɇ: "e",
  Ɉ: "J",
  ɉ: "j",
};

const FOLDED_PATTERN = new RegExp(
  `[${Object.keys(FOLDED_LETTERS).join("")}]`,
  "g",
);

/**
 * The text without accents - "Příliš žluťoučký" → "Prilis zlutoucky",
 * "Łódź" → "Lodz". A text of precomposed letters keeps its length.
 */
export default function removeDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(FOLDED_PATTERN, (letter) => FOLDED_LETTERS[letter]);
}
