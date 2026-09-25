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

// A letter that may carry an accent - or an accent written on its own, as a
// combining mark after its letter
const NON_ASCII = /[^\p{ASCII}]/gu;

/** A letter without its accents - decomposed, stripped, composed again. */
const stripLetter = (letter: string) =>
  letter
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(FOLDED_PATTERN, (folded) => FOLDED_LETTERS[folded])
    .normalize("NFC");

// The letters folded so far - a text repeats a few of them, and a search
// folds thousands of texts at every key. Bounded for texts of scripts with
// thousands of letters.
const foldedLetters = new Map<string, string>();
const MAX_CACHED_LETTERS = 4096;

const foldLetter = (letter: string) => {
  let folded = foldedLetters.get(letter);
  if (folded === undefined) {
    folded = stripLetter(letter);
    if (foldedLetters.size >= MAX_CACHED_LETTERS) foldedLetters.clear();
    foldedLetters.set(letter, folded);
  }
  return folded;
};

/**
 * The text without accents - "Příliš žluťoučký" → "Prilis zlutoucky",
 * "Łódź" → "Lodz". Everything else stays as it is, also the letters of other
 * scripts - a Korean syllable, a kana with its voicing mark - whether they
 * are written composed or not. A text of precomposed letters keeps its
 * length. Letter by letter, so a text folds to what its letters fold to one
 * by one - a search can map a match back into the original.
 */
export default function removeDiacritics(value: string): string {
  return value.replace(NON_ASCII, foldLetter);
}

/**
 * A text as the searches of the library compare it: without accents, in
 * lower case, decomposed - "한" written composed or not is the same, as the
 * Greek final sigma is the plain one ("ΟΔΟΣ" and a typed "οδος"). A text
 * folds to what its letters fold to one by one, so a search can map a match
 * back into the original.
 */
export const foldSearchText = (text: string) =>
  removeDiacritics(text).normalize("NFD").toLowerCase().replace(/ς/g, "σ");
