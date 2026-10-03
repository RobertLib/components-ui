/**
 * The masks of `Input` - a pattern of placeholders and literals the typed
 * text is laid into: `### ##` makes "12345" the Czech postal code "123 45".
 * Pure functions, without the DOM - the field applies what they return.
 */

/**
 * A placeholder of a mask of your own: the characters it takes - tested one
 * by one - and how it writes them.
 */
export type MaskToken =
  | RegExp
  | {
      /** The characters the placeholder takes - tested one by one. */
      pattern: RegExp;
      /**
       * Changes a typed character before `pattern` tests it - e.g.
       * `(char) => char.toUpperCase()` for the letters of a licence plate.
       */
      transform?: (char: string) => string;
    };

/**
 * Placeholders of your own for `mask`, by the character that stands for
 * them - they may also replace `#`, `@` and `*`.
 */
export type MaskTokens = Record<string, MaskToken>;

/** What a masked value is made of - see `applyMask`. */
export interface MaskedValue {
  /** Whether every placeholder of the mask is filled. */
  complete: boolean;
  /** The text as the field shows it - `123 45`. */
  formatted: string;
  /** The characters of the placeholders alone - `12345`. */
  raw: string;
}

/** A placeholder: the character it keeps of a typed one, or `null`. */
interface Slot {
  accept: (char: string) => string | null;
  kind: "slot";
}

/** Text of the mask, written as it is - a space, `+420`, `CZ`. */
interface Literal {
  char: string;
  kind: "literal";
}

type Token = Literal | Slot;

export interface ParsedMask {
  /** Whether each placeholder takes digits only - a numeric keyboard. */
  numeric: boolean;
  /** The index in `tokens` of each placeholder, in order. */
  slots: number[];
  tokens: Token[];
}

/** The raw characters of a value laid into the mask. */
interface Layout {
  /** Where each raw character ends in `text`. */
  ends: number[];
  /** Where each raw character starts in `text`. */
  starts: number[];
  text: string;
}

/** What the characters of an insertion became. */
interface Fill {
  /** The characters placed into placeholders - as they keep them. */
  chars: string[];
  /** Characters that matched a literal of the mask - a typed space. */
  consumed: number;
  /** Characters that fit nowhere. */
  dropped: number;
  /** The token after the last character taken. */
  end: number;
}

/** The value and the selection of the field after an edit. */
export interface MaskEdit {
  /** Whether the edit changed the value - `false` for a refused one. */
  changed: boolean;
  selectionEnd: number;
  selectionStart: number;
  value: string;
}

// The zeros of the decimal digits of other scripts and keyboards - the
// full-width digits of the Japanese and Chinese input methods, Arabic,
// Persian and Devanagari - taken as the Latin ones
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0xff10];

/** The Latin digit of a decimal digit of any of `DIGIT_ZEROS`. */
export function toLatinDigit(char: string) {
  const code = char.codePointAt(0) ?? -1;
  for (const zero of DIGIT_ZEROS) {
    if (code >= zero && code <= zero + 9) return String(code - zero);
  }
  return null;
}

const isLetter = (char: string) => /^\p{L}$/u.test(char);

const BUILT_IN_TOKENS = new Map<string, (char: string) => string | null>([
  ["#", toLatinDigit],
  ["@", (char) => (isLetter(char) ? char : null)],
  ["*", (char) => toLatinDigit(char) ?? (isLetter(char) ? char : null)],
]);

/** The `accept` of a placeholder of your own. */
function acceptOf(token: MaskToken) {
  const { pattern, transform } =
    token instanceof RegExp ? { pattern: token, transform: undefined } : token;

  return (char: string) => {
    const kept = transform ? transform(char) : char;
    // A global or sticky pattern tests on from where it matched last
    pattern.lastIndex = 0;
    return pattern.test(kept) ? kept : null;
  };
}

/**
 * Reads a mask: `#` is a digit, `@` a letter, `*` a letter or a digit, and
 * any other character a literal - `\` makes the next one a literal too.
 * `tokens` adds placeholders of your own.
 */
export function parseMask(mask: string, tokens?: MaskTokens): ParsedMask {
  const parsed: ParsedMask = { numeric: true, slots: [], tokens: [] };
  const chars = Array.from(mask);

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];

    if (char === "\\" && index + 1 < chars.length) {
      index++;
      parsed.tokens.push({ char: chars[index], kind: "literal" });
      continue;
    }

    const custom =
      tokens && Object.hasOwn(tokens, char) ? tokens[char] : undefined;
    const accept = custom ? acceptOf(custom) : BUILT_IN_TOKENS.get(char);

    if (accept) {
      parsed.slots.push(parsed.tokens.length);
      parsed.tokens.push({ accept, kind: "slot" });
      if (custom || char !== "#") parsed.numeric = false;
    } else {
      parsed.tokens.push({ char, kind: "literal" });
    }
  }

  if (parsed.slots.length === 0) parsed.numeric = false;
  return parsed;
}

/**
 * Lays raw characters into the placeholders. The literals before a
 * placeholder show once it is filled, those after the last one once the
 * value is complete - so that Backspace at the end deletes what was typed.
 * Without raw characters the literals of the first `typed` tokens show -
 * those the user typed in front of the placeholders, the `+42` of `+420`.
 */
function layout(mask: ParsedMask, raw: readonly string[], typed = 0): Layout {
  const result: Layout = { ends: [], starts: [], text: "" };
  let pending = "";
  let placed = 0;

  // Only the literals typed - a mask without placeholders takes none
  if (raw.length === 0 && mask.slots.length > 0) {
    for (const token of mask.tokens.slice(0, typed)) {
      if (token.kind === "literal") result.text += token.char;
    }
    return result;
  }

  for (const token of mask.tokens) {
    if (token.kind === "literal") {
      pending += token.char;
      continue;
    }
    if (placed === raw.length) return result;

    result.text += pending;
    pending = "";
    result.starts.push(result.text.length);
    result.text += raw[placed];
    result.ends.push(result.text.length);
    placed++;
  }

  // Every placeholder is filled - the literals at the end follow
  if (placed > 0) result.text += pending;
  return result;
}

const sameChar = (a: string, b: string) =>
  a === b || a.toLocaleUpperCase() === b.toLocaleUpperCase();

/**
 * Places the characters of `text` into the placeholders from the token
 * `start` on - at most `capacity` of them. With `matchLiterals` a character
 * equal to the next literal is that literal (`123 45` pasted keeps its
 * space out of the value); without, only placeholders take characters.
 */
function fill(
  mask: ParsedMask,
  text: string,
  start: number,
  capacity: number,
  matchLiterals: boolean,
): Fill {
  const result: Fill = { chars: [], consumed: 0, dropped: 0, end: start };

  for (const char of Array.from(text)) {
    let taken = false;

    for (let index = result.end; index < mask.tokens.length; index++) {
      const token = mask.tokens[index];

      if (token.kind === "literal") {
        if (matchLiterals && sameChar(token.char, char)) {
          result.consumed++;
          result.end = index + 1;
          taken = true;
          break;
        }
        // The literal is written by the mask - the character may be the
        // next placeholder's
        continue;
      }

      const kept = result.chars.length < capacity ? token.accept(char) : null;
      if (kept !== null) {
        result.chars.push(kept);
        result.end = index + 1;
        taken = true;
      }
      // A character this placeholder refuses fits no later one either
      break;
    }

    // A dropped character leaves the literals it skipped to the next one
    if (!taken) result.dropped++;
  }

  return result;
}

/**
 * The better reading of inserted text: the one that drops fewer of its
 * characters, then the one placing more. A pasted `+420 777 123 456` keeps
 * the literals it repeats out of the value; a typed `4` in front of the
 * literal `+420` is a digit of the number, not that literal. Text as the
 * mask writes it - each literal in its place - is read so, also where a
 * placeholder would take the literals: `071` of `07### ######` is the 1 the
 * field shows, not 0, 7 and 1.
 */
function fillBest(
  mask: ParsedMask,
  text: string,
  start: number,
  capacity: number,
) {
  const literal = fill(mask, text, start, capacity, true);
  // Each token up to the last character taken took one - no literal skipped
  if (
    literal.chars.length > 0 &&
    literal.dropped === 0 &&
    literal.consumed + literal.chars.length === literal.end - start
  ) {
    return literal;
  }

  const plain = fill(mask, text, start, capacity, false);

  return plain.dropped < literal.dropped ||
    (plain.dropped === literal.dropped &&
      plain.chars.length > literal.chars.length)
    ? plain
    : literal;
}

/**
 * Puts characters that followed an edit into the placeholders after
 * `chars` - one a placeholder of another kind now refuses is left out.
 */
function relay(mask: ParsedMask, chars: string[], following: string[]) {
  const result = [...chars];

  for (const char of following) {
    const slot = mask.slots[result.length];
    if (slot === undefined) break;

    const token = mask.tokens[slot];
    const kept = token.kind === "slot" ? token.accept(char) : null;
    if (kept !== null) result.push(kept);
  }

  return result;
}

/** What `text` stands for - read as if it were pasted. */
function readRaw(mask: ParsedMask, text: string) {
  return fillBest(mask, text, 0, mask.slots.length);
}

const toValue = (mask: ParsedMask, read: Fill): MaskedValue => ({
  complete: mask.slots.length > 0 && read.chars.length === mask.slots.length,
  formatted: layout(mask, read.chars, read.end).text,
  raw: read.chars.join(""),
});

/** `text` laid into the mask - also a value written without its literals. */
export function conformToMask(mask: ParsedMask, text: string): MaskedValue {
  return toValue(mask, readRaw(mask, text));
}

/**
 * Formats `text` with a mask as `Input` does - also a value written
 * without the literals of the mask, or with other separators:
 * `applyMask("### ##", "12345")` is
 * `{ formatted: "123 45", raw: "12345", complete: true }`. For a value of
 * the server, or for React Hook Form's
 * `setValueAs: (text) => applyMask(mask, text).raw`.
 */
export function applyMask(
  mask: string,
  text: string,
  tokens?: MaskTokens,
): MaskedValue {
  return conformToMask(parseMask(mask, tokens), text);
}

/** The number of raw characters that start before `position`. */
const rawBefore = (layout: Layout, position: number) =>
  layout.starts.filter((start) => start < position).length;

/**
 * The positions of the caret between the raw characters `boundary - 1` and
 * `boundary` - a range where literals stand between them.
 */
function caretRange(layout: Layout, boundary: number) {
  const high =
    boundary < layout.starts.length
      ? layout.starts[boundary]
      : layout.text.length;
  const low = boundary === 0 ? high : layout.ends[boundary - 1];
  return [Math.min(low, high), high] as const;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const keep = (value: string, start: number, end = start): MaskEdit => ({
  changed: false,
  selectionEnd: end,
  selectionStart: start,
  value,
});

/**
 * Applies an edit the browser made to a masked value: `previous` is the
 * value before, `next` the text after it with the caret at `caret`, and
 * `inputType` the one of the input event (`deleteContentBackward`, …).
 * Returns the value to show with the selection:
 *
 * - typed and pasted text goes into the placeholders from the caret on,
 *   literals it repeats are skipped, characters no placeholder takes are
 *   dropped - an edit of nothing but such characters, or one past the last
 *   placeholder, is refused and leaves the selection as it was,
 * - Backspace and Delete next to a literal delete the character beyond it,
 * - the characters after the edit move into the next placeholders.
 */
export function editMasked(
  mask: ParsedMask,
  previous: string,
  next: string,
  caret: number,
  inputType = "",
): MaskEdit {
  const raw = readRaw(mask, previous).chars;
  const before = layout(mask, raw);

  // A value the field did not show - written past it - or literals typed in
  // front of the placeholders: taken as a whole, so that the typed `+4` of
  // `+420` makes the next 2 that literal too
  if (before.text !== previous) {
    const text = conformToMask(mask, next).formatted;
    return {
      changed: text !== previous,
      selectionEnd: text.length,
      selectionStart: text.length,
      value: text,
    };
  }

  // The edit: what was removed from `previous`, and what came in its place -
  // the text after the caret is the part the edit left alone
  const end = clamp(caret, 0, next.length);
  let suffix = 0;
  const maxSuffix = Math.min(previous.length, next.length - end);
  while (
    suffix < maxSuffix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  let prefix = 0;
  const maxPrefix = Math.min(end, previous.length - suffix);
  while (prefix < maxPrefix && previous[prefix] === next[prefix]) prefix++;

  const removedEnd = previous.length - suffix;
  const inserted = next.slice(prefix, next.length - suffix);
  let rawStart = rawBefore(before, prefix);
  let rawEnd = rawBefore(before, removedEnd);

  if (inserted === "" && rawStart === rawEnd) {
    // Only literals removed: Backspace and Delete delete the character
    // beyond them, a cut or a drag of a literal changes nothing
    const forward = /^delete\w*Forward$/.test(inputType);
    const backward =
      /^delete\w*Backward$/.test(inputType) ||
      (inputType === "" && removedEnd - prefix === 1);

    if (forward && rawEnd < raw.length) rawEnd++;
    else if (backward && rawStart > 0) rawStart--;
    if (rawStart === rawEnd) return keep(previous, prefix);
  }

  const capacity = mask.slots.length - (raw.length - (rawEnd - rawStart));
  // The literals before the placeholder of `rawStart` - a typed separator
  // matches them
  const startToken = rawStart === 0 ? 0 : mask.slots[rawStart - 1] + 1;
  const insertion = fillBest(mask, inserted, startToken, capacity);

  if (
    inserted !== "" &&
    insertion.chars.length === 0 &&
    insertion.consumed === 0
  ) {
    return keep(previous, prefix, removedEnd);
  }

  // Literals typed in front of the placeholders show - the `+` of `+420`,
  // which the next keys go on with
  const after = layout(
    mask,
    relay(
      mask,
      [...raw.slice(0, rawStart), ...insertion.chars],
      raw.slice(rawEnd),
    ),
    insertion.end,
  );
  const [low, high] = caretRange(after, rawStart + insertion.chars.length);
  // Typing moves on past the literals that follow; a deletion leaves the
  // caret where the browser put it, if the value lets it stay there
  const position = inserted !== "" ? high : clamp(prefix, low, high);

  return {
    changed: after.text !== previous,
    selectionEnd: position,
    selectionStart: position,
    value: after.text,
  };
}
