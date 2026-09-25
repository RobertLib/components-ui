import { attachRef, useFormControl } from "../hooks/use-form-control";
import { formatMessage, formatNumber, formatPlural } from "../i18n/format";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useLocale } from "../providers/ui-context";

// All the padding lives here - base padding next to it would win over the
// smaller sizes, as the CSS order decides between two utilities
const dimStyles = {
  xs: "px-1 py-0.5 text-sm min-h-[48px]",
  sm: "px-1 py-0 text-sm min-h-[60px]",
  md: "px-2 py-1 text-base min-h-[80px]",
  lg: "px-3 py-2 text-lg min-h-[100px]",
};

// The vertical padding of `dimStyles`, and with the `pt-6` of a floating
// label - the rows of an autosizing field are lines plus these and the border
const verticalPaddings = {
  xs: "0.25rem",
  sm: "0rem",
  md: "0.5rem",
  lg: "1rem",
};
const floatingPaddings = {
  xs: "1.625rem",
  sm: "1.5rem",
  md: "1.75rem",
  lg: "2rem",
};

// The counter is told to screen readers this long after the typing pauses
const ANNOUNCE_DELAY = 750;

// Measures the content of an autosizing field where CSS cannot size it - a
// copy with the same classes, out of sight
const shadowStyle: React.CSSProperties = {
  height: 0,
  left: 0,
  maxHeight: "none",
  minHeight: 0,
  overflow: "hidden",
  pointerEvents: "none",
  position: "absolute",
  top: 0,
  visibility: "hidden",
};

const noSubscription = () => () => {};

/** Whether the browser sizes a textarea to its content (`field-sizing`). */
const supportsFieldSizing = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("field-sizing", "content");

/** Makes a textarea as high as the content of its measuring copy. */
function fitToShadow(
  textarea: HTMLTextAreaElement,
  shadow: HTMLTextAreaElement,
) {
  const { borderBottomWidth, borderTopWidth } = getComputedStyle(textarea);
  const borders =
    (parseFloat(borderTopWidth) || 0) + (parseFloat(borderBottomWidth) || 0);
  textarea.style.height = `${shadow.scrollHeight + borders}px`;
}

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /**
   * Grows and shrinks with the text - between `minRows` and `maxRows`
   * lines, then it scrolls. It has no resize handle then.
   */
  autosize?: boolean;
  /**
   * Classes of the `<textarea>` itself - not of the wrapper around it, its
   * label, description, counter or error message.
   */
  className?: string;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Places the label inside the field, floating up once it has a value -
   * also one the browser autofilled.
   */
  floating?: boolean;
  /** Text of the `<label>` of the field. */
  label?: string;
  /**
   * With `autosize`: the most lines the field grows to - more text
   * scrolls. No limit by default.
   */
  maxRows?: number;
  /**
   * With `autosize`: the lines of the empty field - by default it is as
   * high as one without `autosize`.
   */
  minRows?: number;
  /**
   * Shows how many characters the field has - with `maxLength` "123 /
   * 500", and near the limit screen readers are told how many are left
   * once the typing pauses.
   */
  showCount?: boolean;
}

/**
 * A multi-line text field - the same API as `Input`. `autosize` makes it
 * grow with the text, `showCount` counts the characters.
 */
export default function Textarea({
  autosize = false,
  className,
  defaultValue,
  description,
  dim = "md",
  disabled,
  error,
  floating = false,
  id,
  label,
  maxRows,
  minRows,
  name,
  ref,
  required,
  showCount = false,
  ...props
}: TextareaProps) {
  const [isFocused, setIsFocused] = useState(false);
  const locale = useLocale();
  const { messages } = locale;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shadowRef = useRef<HTMLTextAreaElement | null>(null);
  // Whether the script set the height - taken back when `autosize` goes
  const sizedByScript = useRef(false);

  const ownRef = useCallback(
    (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      const detachRef = attachRef(ref, element);

      return () => {
        textareaRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  // A value a script writes into the textarea - React Hook Form's
  // `register()`, `setValue()` - stays, and the counter follows it
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
    followScriptWrites: true,
    ref: ownRef,
  });

  // The server, and the first render in the browser, leave the sizing to
  // CSS - a browser without `field-sizing` then measures the content
  const fieldSizing = useSyncExternalStore(
    noSubscription,
    supportsFieldSizing,
    () => true,
  );
  const measures = autosize && !fieldSizing;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const shadow = shadowRef.current;
    if (!textarea) return;

    if (shadow) {
      fitToShadow(textarea, shadow);
      sizedByScript.current = true;
    } else if (sizedByScript.current) {
      textarea.style.height = "";
      sizedByScript.current = false;
    }
  });

  // A new width wraps the text anew - not in every environment (jsdom), the
  // text is measured as it changes then
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!measures || !textarea || typeof ResizeObserver === "undefined") {
      return;
    }

    let width = textarea.offsetWidth;
    const observer = new ResizeObserver(() => {
      const shadow = shadowRef.current;
      if (!shadow || textarea.offsetWidth === width) return;

      width = textarea.offsetWidth;
      fitToShadow(textarea, shadow);
    });
    observer.observe(textarea);

    return () => observer.disconnect();
  }, [measures]);

  // A numeric 0 is a value too. A value the browser autofilled - without an
  // event React would see - floats the label by CSS (`:autofill`).
  const text = String(value);
  const isLabelFloating = isFocused || text !== "";

  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const descriptionId = description ? `${textareaId}-description` : undefined;

  // The characters as `maxLength` counts them
  const count = text.length;
  const limit =
    typeof props.maxLength === "number" && props.maxLength >= 0
      ? props.maxLength
      : undefined;
  const remaining = limit === undefined ? undefined : limit - count;
  const counterText =
    limit === undefined
      ? formatNumber(locale.code, count)
      : formatMessage(messages.textarea.characterCount, {
          count: formatNumber(locale.code, count),
          max: formatNumber(locale.code, limit),
        });

  // Near the limit - the last tenth, or the last 10 characters
  const limitMessage =
    remaining === undefined || limit === undefined
      ? ""
      : remaining < 0
        ? formatPlural(
            locale.code,
            messages.textarea.charactersOver,
            -remaining,
          )
        : remaining <= Math.max(10, limit / 10)
          ? formatPlural(
              locale.code,
              messages.textarea.charactersLeft,
              remaining,
            )
          : "";

  // Told to screen readers when the typing pauses, not at every keystroke
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!showCount || !isFocused) return;

    const timeout = setTimeout(
      () => setAnnouncement(limitMessage),
      ANNOUNCE_DELAY,
    );
    return () => clearTimeout(timeout);
  }, [isFocused, limitMessage, showCount]);

  // The star is for the eye - `required` tells assistive technology
  const requiredMark = required && (
    <span aria-hidden="true" className="text-danger-700 dark:text-danger-400">
      *
    </span>
  );

  const textareaClassName = cn(
    "form-control",
    autosize ? "field-sizing-content resize-none" : "resize-y",
    dimStyles[dim],
    disabled && "cursor-not-allowed opacity-50",
    floating && "pt-6",
    error && "border-danger-500! focus:ring-danger-500!",
    className,
  );

  const rowsHeight = (rows: number) =>
    `calc(${rows}lh + ${floating ? floatingPaddings[dim] : verticalPaddings[dim]} + 2px)`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && !floating && (
        <label
          className="block truncate text-sm font-medium"
          htmlFor={textareaId}
        >
          {label}
          {messages.form.labelSuffix} {requiredMark}
        </label>
      )}

      <span className="relative">
        {label && floating && (
          <label
            className={cn(
              "pointer-events-none absolute z-10 transition-all duration-200 motion-reduce:transition-none",
              isLabelFloating
                ? "translate-x-1 translate-y-[-0.7rem] bg-surface px-1 text-xs dark:bg-surface-dark"
                : "translate-x-2 translate-y-[0.4rem] [&:has(~textarea:autofill)]:translate-x-1 [&:has(~textarea:autofill)]:translate-y-[-0.7rem] [&:has(~textarea:autofill)]:bg-surface [&:has(~textarea:autofill)]:px-1 [&:has(~textarea:autofill)]:text-xs dark:[&:has(~textarea:autofill)]:bg-surface-dark",
              // One color or the other - with both, the CSS order decides
              error
                ? "text-danger-700 dark:text-danger-400"
                : !isLabelFloating && "text-neutral-500 dark:text-neutral-400",
            )}
            htmlFor={textareaId}
          >
            {label} {requiredMark}
          </label>
        )}
        <textarea
          {...props}
          className={textareaClassName}
          aria-describedby={joinTokens(
            errorId,
            descriptionId,
            props["aria-describedby"],
          )}
          aria-invalid={error ? "true" : props["aria-invalid"]}
          aria-required={required ? "true" : props["aria-required"]}
          disabled={disabled}
          id={textareaId}
          name={name}
          onBlur={(event) => {
            setIsFocused(false);
            setAnnouncement("");
            props.onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onChange={handleChange}
          placeholder={floating ? "" : props.placeholder}
          ref={fieldRef}
          required={required}
          style={{
            minHeight:
              autosize && minRows !== undefined
                ? rowsHeight(minRows)
                : undefined,
            maxHeight:
              autosize && maxRows !== undefined
                ? rowsHeight(maxRows)
                : undefined,
            ...props.style,
          }}
          value={value}
        />
        {measures && (
          <textarea
            aria-hidden="true"
            className={textareaClassName}
            readOnly
            ref={shadowRef}
            rows={1}
            style={shadowStyle}
            tabIndex={-1}
            value={text}
          />
        )}
      </span>

      {showCount ? (
        <div className="flex items-start gap-2">
          <FormDescription className="min-w-0 flex-1" id={descriptionId}>
            {description}
          </FormDescription>
          <p
            className={cn(
              "ms-auto shrink-0 text-xs tabular-nums",
              // One color or the other - with both, the CSS order decides
              remaining !== undefined && remaining < 0
                ? "text-danger-700 dark:text-danger-400"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {counterText}
          </p>
          <span className="sr-only" role="status">
            {announcement}
          </span>
        </div>
      ) : (
        <FormDescription id={descriptionId}>{description}</FormDescription>
      )}
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
