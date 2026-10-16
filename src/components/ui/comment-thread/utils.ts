import type { MentionInputProps } from "../mention-input";

/** What the fields of a thread take from it - the mentions and the limit. */
export type MentionFieldProps = Pick<
  MentionInputProps,
  "loadSuggestions" | "maxLength" | "suggestions" | "triggers"
>;

/** The message of a failed action - an `Error`'s own, or `fallback`. */
export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

/**
 * Whether a key press belongs to an input method editor (IME) composing text
 * - Escape cancels the conversion, not the field. Safari sends the key after
 * `compositionend`, with the key code 229.
 */
export const isImeKey = (event: React.KeyboardEvent) =>
  event.nativeEvent.isComposing || event.keyCode === 229;

/** Whether a key press is Ctrl / ⌘ + Enter - not one confirming an IME. */
export const isSubmitKey = (event: React.KeyboardEvent) =>
  event.key === "Enter" &&
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  !event.nativeEvent.isComposing;
