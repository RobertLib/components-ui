/** A score of a password: 0 very weak, 1 weak, 2 fair, 3 good, 4 strong. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

// Words a password guesser tries first - in a password they count for
// little. Lower case, longest first (a word inside a longer one counts
// once), and matched after undoing `p@ssw0rd` spellings.
const COMMON_WORDS = [
  "iloveyou",
  "football",
  "password",
  "passwort",
  "sunshine",
  "letmein",
  "welcome",
  "dragon",
  "master",
  "monkey",
  "qwerty",
  "qwertz",
  "secret",
  "admin",
  "heslo",
  "login",
  "asdf",
  "yxcv",
  "zxcv",
  "ahoj",
];

// The digits and symbols written in place of letters
const LEET: Record<string, string> = {
  "!": "i",
  $: "s",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
};

// The bits of guessing each score starts at
const THRESHOLDS = [28, 40, 56, 72];

/**
 * A quick estimate of how hard a password is to guess, from 0 (very weak)
 * to 4 (strong) - the default scorer of `passwordStrength` on `Input`. It
 * counts the kinds of characters used and the length, where a repeated
 * character (`aaaa`), a run (`abcd`, `4321`), a year (`2026`) and a common
 * word (`heslo`, `P@ssw0rd`, `qwertz`) count for little. It knows no
 * dictionary - a long password of plain words scores well; check the
 * password on the server too.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 0;

  const chars = Array.from(password);
  let pool = 0;
  if (/\p{Ll}/u.test(password)) pool += 26;
  if (/\p{Lu}/u.test(password)) pool += 26;
  if (/\p{Nd}/u.test(password)) pool += 10;
  if (/[^\p{L}\p{Nd}]/u.test(password)) pool += 33;
  // Letters without case (Chinese, Arabic) - a large alphabet
  if (/[\p{Lo}\p{Lm}]/u.test(password)) pool += 100;

  // A character repeating the one before, or going on a run of them,
  // counts for a fifth
  let length = 0;
  for (let index = 0; index < chars.length; index++) {
    const code = chars[index].codePointAt(0) ?? 0;
    const previous = chars[index - 1]?.codePointAt(0);
    const beforePrevious = chars[index - 2]?.codePointAt(0);

    const repeats = previous === code;
    const runs =
      previous !== undefined &&
      beforePrevious !== undefined &&
      Math.abs(code - previous) === 1 &&
      code - previous === previous - beforePrevious;
    length += repeats || runs ? 0.2 : 1;
  }

  let plain = Array.from(
    password.toLowerCase(),
    (char) => LEET[char] ?? char,
  ).join("");
  for (const word of COMMON_WORDS) {
    while (plain.includes(word)) {
      length -= word.length * 0.8;
      plain = plain.replace(word, " ");
    }
  }
  length -= (password.match(/(?:19|20)\d\d/g)?.length ?? 0) * 2;

  const bits = Math.max(0, length) * Math.log2(Math.max(pool, 2));
  const score = THRESHOLDS.filter((threshold) => bits >= threshold).length;
  return score as PasswordStrength;
}
