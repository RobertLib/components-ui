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

/** Words and the whitespace between them, in their order. */
const tokenize = (text: string) => text.match(/\s+|[^\s]+/g) ?? [];

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

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const parts: DiffPart[] = [];
  for (let index = 0; index < start; index++) push(parts, "same", a[index]);

  const n = endA - start;
  const m = endB - start;
  if (n > 0 && m > 0 && (n + 1) * (m + 1) <= MAX_CELLS) {
    // Lengths of the longest common sequences of the rest of both
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] =
          a[start + i] === b[start + j]
            ? table[(i + 1) * width + j + 1] + 1
            : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[start + i] === b[start + j]) {
        push(parts, "same", a[start + i]);
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

  for (let index = endA; index < a.length; index++) {
    push(parts, "same", a[index]);
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
    // The tokens of the first `keepStart` and the last `keepEnd` words
    const cut = (count: number, fromEnd: boolean) => {
      const taken: string[] = [];
      let seen = 0;
      const ordered = fromEnd ? [...tokens].reverse() : tokens;
      for (const token of ordered) {
        // Up to the last word - without the space after it
        if (seen === count) break;
        if (/\S/.test(token)) seen += 1;
        taken.push(token);
      }
      return (fromEnd ? taken.reverse() : taken).join("");
    };
    if (keepStart > 0)
      result.push({ text: cut(keepStart, false), type: "same" });
    result.push({ type: "gap" });
    if (keepEnd > 0) result.push({ text: cut(keepEnd, true), type: "same" });
  });

  return shortened ? result : null;
}
