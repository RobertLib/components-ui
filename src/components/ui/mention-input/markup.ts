import logger from "../../../utils/logger";

/**
 * A mention in a value of `MentionInput` - stored in the text as a token,
 * `@[Jana Nováková](user:42)`: the trigger, the label in square brackets
 * and the id in parentheses.
 */
export interface Mention {
  /** Id of the mentioned person or record, as stored - e.g. `"user:42"`. */
  id: string;
  /** The name shown after the trigger - "Jana Nováková". */
  label: string;
  /** The character it was typed with - `"@"`, `"#"`. */
  trigger: string;
}

/** A person or a record `MentionInput` offers while the user types a mention. */
export interface MentionSuggestion {
  /** Shown, but cannot be picked - e.g. a colleague without access. */
  disabled?: boolean;
  /**
   * A second line under the label - an e-mail, a job title, the state of a
   * ticket. A static list is searched in it too.
   */
  description?: string;
  /** Shown before the label - an `Avatar`, an icon. */
  icon?: React.ReactNode;
  /** Stored in the value - `"user:42"`, `42`. It is a string there. */
  id: string | number;
  /**
   * More words a static list finds the suggestion by - a nickname, a
   * department.
   */
  keywords?: string[];
  /**
   * The name listed and inserted after the trigger - "Jana Nováková". Line
   * breaks become spaces.
   */
  label: string;
}

/** The second argument of `loadSuggestions`. */
export interface MentionLoadContext {
  /** Aborted when the query changes before the suggestions arrive. */
  signal: AbortSignal;
  /** The trigger typed - `"@"`, `"#"`. */
  trigger: string;
}

/**
 * Loads the suggestions for what follows the trigger - `""` right after it.
 * Diacritics and case are up to the API; the suggestions are listed as they
 * come.
 */
export type LoadMentionSuggestions = (
  query: string,
  context: MentionLoadContext,
) => Promise<MentionSuggestion[]> | MentionSuggestion[];

/** A character that starts a mention, with its own suggestions. */
export interface MentionTrigger {
  /**
   * Lets the query contain spaces, so that "@Jana Nov" finds "Jana
   * Nováková" - on by default. A query with a space that finds nothing
   * closes the list (it was no mention).
   */
  allowSpaces?: boolean;
  /** The character - `"@"` for people, `"#"` for tickets. One character. */
  char: string;
  /** Accessible name of the list of suggestions, e.g. "People". */
  label?: string;
  /** Loads the suggestions of this trigger - instead of the field's. */
  loadSuggestions?: LoadMentionSuggestions;
  /** The suggestions of this trigger - instead of the field's. */
  suggestions?: MentionSuggestion[];
}

/** The triggers a value is read with - see `parseMentions`. */
export interface MentionOptions {
  /**
   * The characters that start a mention - the `triggers` of the field the
   * value comes from. `["@"]` by default.
   */
  triggers?: readonly (string | MentionTrigger)[];
}

/** A mention in the text of the field: `[start, end)` of trigger + label. */
export interface MentionRange extends Mention {
  end: number;
  start: number;
}

/** A value as the field shows it - the text and where its mentions are. */
export interface ParsedValue {
  mentions: MentionRange[];
  text: string;
}

export const DEFAULT_TRIGGERS: readonly string[] = ["@"];

// Neither a trigger nor in it - the characters of the token, and white
// space, which ends a query
const RESERVED = /[[\]()\\\s]/;

/**
 * The longest label or id a mention is given - a longer one is no token
 * (with room for its escapes), so a text full of "@[" is read in linear time.
 */
export const MAX_MENTION_PART = 200;
const MAX_TOKEN_PART = MAX_MENTION_PART * 2;

/** A trigger with its options filled in. */
export interface ResolvedTrigger extends MentionTrigger {
  allowSpaces: boolean;
}

/** The valid triggers of `triggers`, the first of each character. */
export function resolveTriggers(
  triggers: readonly (string | MentionTrigger)[] = DEFAULT_TRIGGERS,
): ResolvedTrigger[] {
  const resolved: ResolvedTrigger[] = [];

  for (const trigger of triggers) {
    const options = typeof trigger === "string" ? { char: trigger } : trigger;
    const { char } = options;

    if (char.length !== 1 || RESERVED.test(char)) {
      logger.warn(
        `MentionInput: "${char}" cannot start a mention - a trigger is one character, not a space, a bracket or a backslash.`,
      );
      continue;
    }
    if (!resolved.some((other) => other.char === char)) {
      resolved.push({ ...options, allowSpaces: options.allowSpaces ?? true });
    }
  }

  return resolved;
}

/** The characters of the triggers, joined - e.g. `"@#"`. */
export const triggerChars = (
  triggers: readonly (string | MentionTrigger)[] = DEFAULT_TRIGGERS,
) =>
  resolveTriggers(triggers)
    .map((trigger) => trigger.char)
    .join("");

/**
 * Reads the `[label](id)` of a token from the `[` at `open` - `null` when
 * there is none, e.g. an "@[" in a sentence.
 */
function readToken(value: string, open: number) {
  const readPart = (from: number, close: string) => {
    let part = "";
    let index = from;
    while (index < value.length && index - from <= MAX_TOKEN_PART) {
      const char = value[index];
      if (char === close) return { end: index, part };
      // No token spans lines
      if (char === "\n") return null;
      if (char === "\\" && index + 1 < value.length) {
        part += value[index + 1];
        index += 2;
      } else {
        part += char;
        index += 1;
      }
    }
    return null;
  };

  const label = readPart(open + 1, "]");
  if (!label || !label.part || value[label.end + 1] !== "(") return null;
  const id = readPart(label.end + 2, ")");
  if (!id || !id.part) return null;

  return { end: id.end + 1, id: id.part, label: label.part };
}

/**
 * The text of a value and its mentions - `chars` are the trigger
 * characters. Line breaks are "\n". A trigger before `\[` or `\\` is text: "@[" typed as text is
 * stored as "@\[", so that it does not read as a token.
 */
export function parseValue(raw: string, chars: string): ParsedValue {
  // The line breaks of a textarea - a form posts them as "\r\n", which the
  // field would count as two characters its offsets do not have
  const value = raw.replace(/\r\n?/g, "\n");
  const mentions: MentionRange[] = [];
  let text = "";
  let index = 0;

  while (index < value.length) {
    const char = value[index];

    if (chars.includes(char)) {
      const next = value[index + 1];
      if (next === "[") {
        const token = readToken(value, index + 1);
        if (token) {
          const start = text.length;
          text += char + token.label;
          mentions.push({
            end: text.length,
            id: token.id,
            label: token.label,
            start,
            trigger: char,
          });
          index = token.end;
          continue;
        }
      } else if (
        next === "\\" &&
        (value[index + 2] === "[" || value[index + 2] === "\\")
      ) {
        text += char + value[index + 2];
        index += 3;
        continue;
      }
    }

    text += char;
    index += 1;
  }

  return { mentions, text };
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** Text with a trigger before "[" or "\" escaped - see `parseValue`. */
function escapeText(text: string, chars: string) {
  if (!chars) return text;
  return text.replace(
    new RegExp(`([${escapeRegExp(chars)}])([[\\\\])`, "g"),
    "$1\\$2",
  );
}

const escapePart = (part: string, close: string) =>
  part.replace(close === "]" ? /[\\\]]/g : /[\\)]/g, "\\$&");

/**
 * The token of a mention as a value stores it - `@[Jana Nováková](user:42)`
 * - e.g. to write a value with a mention on the server, or to start a reply
 * with one.
 */
export const toMentionToken = ({ id, label, trigger }: Mention) =>
  `${trigger}[${escapePart(label, "]")}](${escapePart(id, ")")})`;

/** The value of a text and its mentions - the reverse of `parseValue`. */
export function serializeValue(
  text: string,
  mentions: readonly MentionRange[],
  chars: string,
) {
  let value = "";
  let cursor = 0;

  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    value += escapeText(text.slice(cursor, mention.start), chars);
    value += toMentionToken(mention);
    cursor = mention.end;
  }

  return value + escapeText(text.slice(cursor), chars);
}

/**
 * The mentions of a stored value, in the order they are written - e.g. the
 * people to notify: `parseMentions(body).map((mention) => mention.id)`.
 * Pass the `triggers` of the field. The ids are whatever the value says -
 * check them on the server like any input.
 */
export function parseMentions(
  value: string,
  options: MentionOptions = {},
): Mention[] {
  return parseValue(value, triggerChars(options.triggers)).mentions.map(
    ({ id, label, trigger }) => ({ id, label, trigger }),
  );
}

/**
 * A stored value as plain text - the mentions written as "@Jana Nováková",
 * e.g. for a notification e-mail or a search index. Pass the `triggers` of
 * the field.
 */
export function mentionsToText(value: string, options: MentionOptions = {}) {
  return parseValue(value, triggerChars(options.triggers)).text;
}

/**
 * The mentions once the text changed from `previous` to `text` - those the
 * change did not touch, moved with the text after it. A mention the change
 * reaches into becomes text. `caret` is where the caret is after the change:
 * the typed text ends there, so a letter typed after a mention ending in the
 * same letter is not taken for one typed into it.
 */
export function applyTextChange(
  previous: string,
  mentions: readonly MentionRange[],
  text: string,
  caret: number | null,
): MentionRange[] {
  if (previous === text) return [...mentions];

  const shorter = Math.min(previous.length, text.length);
  let suffix = 0;
  while (
    suffix < shorter &&
    previous[previous.length - 1 - suffix] === text[text.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  if (caret !== null && caret <= text.length) {
    suffix = Math.min(suffix, text.length - caret);
  }

  let prefix = 0;
  while (prefix < shorter - suffix && previous[prefix] === text[prefix]) {
    prefix += 1;
  }

  // The changed part of `previous` is [prefix, removedEnd)
  const removedEnd = previous.length - suffix;
  const delta = text.length - previous.length;

  return mentions.flatMap((mention) =>
    mention.end <= prefix
      ? [mention]
      : mention.start >= removedEnd
        ? [
            {
              ...mention,
              end: mention.end + delta,
              start: mention.start + delta,
            },
          ]
        : [],
  );
}

/** A piece of text with mentions put in place of `[from, to)`. */
export interface TextInsertion {
  from: number;
  /** Positions within `text`. */
  mentions: readonly MentionRange[];
  text: string;
  to: number;
}

/** The mentions once `insertion` replaced its part of the text. */
export function insertMentions(
  mentions: readonly MentionRange[],
  { from, mentions: inserted, text, to }: TextInsertion,
): MentionRange[] {
  const delta = text.length - (to - from);
  const kept = mentions.flatMap((mention) =>
    mention.end <= from
      ? [mention]
      : mention.start >= to
        ? [
            {
              ...mention,
              end: mention.end + delta,
              start: mention.start + delta,
            },
          ]
        : [],
  );
  const added = inserted.map((mention) => ({
    ...mention,
    end: mention.end + from,
    start: mention.start + from,
  }));

  return [...kept, ...added].sort((a, b) => a.start - b.start);
}

/** A mention being typed - the trigger at `start`, the caret at `end`. */
export interface MentionQuery {
  char: string;
  end: number;
  start: number;
  /** What follows the trigger. */
  text: string;
}

/** The longest query - longer text after a trigger is no mention. */
export const MAX_QUERY_LENGTH = 50;

// What may stand before a trigger: nothing, white space or an opening
// bracket or quote. "jana@firma.cz" is an e-mail, no mention.
const BEFORE_TRIGGER = /[\s([{"'„“‚‘«‹]/u;

/**
 * The mention being typed before the caret - `null` when there is none: the
 * caret is not after a trigger (at the start, after white space or an
 * opening bracket), the query starts with a space, spans lines, is too long,
 * has a space the trigger does not allow, or reaches into a mention.
 */
export function findQuery(
  text: string,
  caret: number,
  mentions: readonly MentionRange[],
  triggers: readonly ResolvedTrigger[],
): MentionQuery | null {
  for (
    let start = caret - 1;
    start >= 0 && caret - start <= MAX_QUERY_LENGTH + 1;
    start--
  ) {
    const char = text[start];
    if (char === "\n") return null;

    const trigger = triggers.find((candidate) => candidate.char === char);
    if (!trigger) continue;

    if (start > 0 && !BEFORE_TRIGGER.test(text[start - 1])) return null;
    const query = text.slice(start + 1, caret);
    if (/^\s/.test(query) || (!trigger.allowSpaces && /\s/.test(query))) {
      return null;
    }
    if (
      mentions.some((mention) => mention.start < caret && mention.end > start)
    ) {
      return null;
    }

    return { char, end: caret, start, text: query };
  }

  return null;
}
