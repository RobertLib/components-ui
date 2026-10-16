/** A part of the comparison of two texts. */
export interface DiffPart {
  /** Whitespace and words, as they are written. */
  text: string;
  /** In both texts, only in the new one or only in the old one. */
  type: "same" | "added" | "removed";
}

// The largest table of the comparison - two texts of 700 words. Longer
// changed parts are shown as replaced whole.
const MAX_CELLS = 500_000;

/**
 * The words of a text, each with the whitespace before it, in their order -
 * and the whitespace at its end. A word and its space are one cell of the
 * table, so it fits twice as many words as when they are two.
 */
const tokenize = (text: string) => text.match(/\s*\S+|\s+/g) ?? [];

/**
 * What a token is compared by - the first word of a text, which has no
 * whitespace before it, as if it had a space: "a b" is in "x a b".
 */
const keyOf = (token: string, index: number) =>
  index === 0 && !/^\s/.test(token) ? ` ${token}` : token;

/** Appends a token to the parts - to the last one of the same type. */
function push(parts: DiffPart[], type: DiffPart["type"], text: string) {
  const last = parts.at(-1);
  if (last?.type === type) last.text += text;
  else parts.push({ text, type });
}

/**
 * The words of two texts compared - what stayed, what was removed and what
 * was added, in the order of the texts (the removed words before the added
 * ones they were replaced by). The longest common sequence of words, after
 * the beginning and the end they share.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  // A number for each different key - the table compares numbers, which
  // is faster than comparing texts
  const ids = new Map<string, number>();
  const keysOf = (tokens: string[]) =>
    Int32Array.from(tokens, (token, index) => {
      const key = keyOf(token, index);
      let id = ids.get(key);
      if (id === undefined) {
        id = ids.size;
        ids.set(key, id);
      }
      return id;
    });
  const keysA = keysOf(a);
  const keysB = keysOf(b);

  const parts: DiffPart[] = [];
  // A word of both texts - as the new text writes it; after words removed
  // from its start, with the whitespace the old text has before it
  const same = (i: number, j: number) =>
    push(parts, "same", j === 0 && parts.length > 0 ? a[i] : b[j]);

  let start = 0;
  while (
    start < a.length &&
    start < b.length &&
    keysA[start] === keysB[start]
  ) {
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && keysA[endA - 1] === keysB[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  for (let index = 0; index < start; index++) same(index, index);

  const n = endA - start;
  const m = endB - start;
  if (n > 0 && m > 0 && (n + 1) * (m + 1) <= MAX_CELLS) {
    // Lengths of the longest common sequences of the rest of both
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] =
          keysA[start + i] === keysB[start + j]
            ? table[(i + 1) * width + j + 1] + 1
            : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (keysA[start + i] === keysB[start + j]) {
        same(start + i, start + j);
        i += 1;
        j += 1;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        push(parts, "removed", a[start + i]);
        i += 1;
      } else {
        push(parts, "added", b[start + j]);
        j += 1;
      }
    }
    for (; i < n; i++) push(parts, "removed", a[start + i]);
    for (; j < m; j++) push(parts, "added", b[start + j]);
  } else {
    for (let i = start; i < endA; i++) push(parts, "removed", a[i]);
    for (let j = start; j < endB; j++) push(parts, "added", b[j]);
  }

  for (let index = 0; endA + index < a.length; index++) {
    same(endA + index, endB + index);
  }

  return parts;
}

/**
 * The parts with the long stretches of unchanged text shortened to the
 * `context` words next to a change - `…` in place of the rest. `null` when
 * nothing is shortened.
 */
export function withContext(
  parts: DiffPart[],
  context: number,
): (DiffPart | { type: "gap" })[] | null {
  // Nothing changed - nothing to show around
  if (parts.every((part) => part.type === "same")) return null;

  let shortened = false;
  const result: (DiffPart | { type: "gap" })[] = [];

  parts.forEach((part, index) => {
    if (part.type !== "same") {
      result.push(part);
      return;
    }

    const tokens = tokenize(part.text);
    const words = tokens.filter((token) => /\S/.test(token)).length;
    const keepStart = index > 0 ? context : 0;
    const keepEnd = index < parts.length - 1 ? context : 0;
    if (words <= keepStart + keepEnd + 2) {
      result.push(part);
      return;
    }

    shortened = true;
    // The tokens of the first `keepStart` and the last `keepEnd` words - the
    // last ones without the space before them, the gap has its own
    const cut = (count: number, fromEnd: boolean) => {
      const taken: string[] = [];
      let seen = 0;
      const ordered = fromEnd ? [...tokens].reverse() : tokens;
      for (const token of ordered) {
        if (seen === count) break;
        if (/\S/.test(token)) seen += 1;
        taken.push(token);
      }
      return fromEnd ? taken.reverse().join("").trimStart() : taken.join("");
    };
    if (keepStart > 0)
      result.push({ text: cut(keepStart, false), type: "same" });
    result.push({ type: "gap" });
    if (keepEnd > 0) result.push({ text: cut(keepEnd, true), type: "same" });
  });

  return shortened ? result : null;
}
