import { Calendar, Clock, X } from "lucide-react";
import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn, { joinTokens } from "../../utils/cn";
import FormDescription from "../form-description";
import FormError from "../form-error";
import Popover from "../popover";
import useIsMobile from "../../hooks/use-is-mobile";
import { formatMessage } from "../../i18n/format";
import { getTabbableElements } from "../../utils/tabbable";
import { getNextTabStop } from "../overlay-stack";
import { useMessages } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/**
 * What a picker makes of a typed text: the value, or why the text gives
 * none - it is no date or time (`format`), or one out of the limits
 * (`range`).
 */
export type ParsedText = { value: string } | { error: "format" | "range" };

const dimStyles = {
  sm: "px-1 py-0 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};

const iconSizes = {
  sm: 14,
  md: 16,
  lg: 18,
};

interface PickerFieldProps extends Omit<
  CustomPickerProps,
  "max" | "min" | "minuteStep"
> {
  /** Content of the popup. */
  children: React.ReactNode;
  /**
   * Whether the field has a clear button - by default when it is not
   * `required`, like the native date inputs.
   */
  clearable?: boolean;
  /** Ref of the popup panel. */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** The value as the field shows it, in the display format of the locale. */
  displayValue: string;
  /**
   * The format to type the value in, as the placeholder of the locale
   * writes it (`DD.MM.RRRR`) - for the message under a text that is no
   * value.
   */
  format: string;
  /**
   * More hidden inputs for the form, besides the one of `name` - e.g. the
   * first and the last day of a range. Those without a name are left out.
   */
  hiddenFields?: { name?: string; value: string }[];
  /** The icon at the end of the field. */
  icon: "calendar" | "clock";
  /** Ref of the visible field. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Whether the popup is open. */
  isOpen: boolean;
  /** Called by the clear button and for an emptied field. */
  onClear: () => void;
  /** `byKeyboard` - the popup opens on a key press, not on a click. */
  onOpenChange: (open: boolean, byKeyboard: boolean) => void;
  /** Classes of the popup panel - its width. */
  panelClassName?: string;
  /**
   * The value of a text typed in the display format - or why it gives none.
   * Such a text is dropped, and a message under the field says why.
   */
  parseText: (text: string) => ParsedText;
  /**
   * Values picked in the popup so far (`usePickerPopup`) - a typed text
   * gives way to each pick, also of the value the field has already.
   */
  pickCount: number;
  /** Accessible name of the popup, e.g. "Select date". */
  popupLabel: string;
  /**
   * Why the value is out of `min` / `max` - the field is invalid with it,
   * like a native input (a submit is blocked). `""` for a value in them.
   */
  rangeMessage: string;
}

/**
 * The part all custom pickers share: the field showing the formatted value
 * - the value can also be typed into it - the clear button, the popup, the
 * hidden form inputs, the help text and the error message.
 */
export default function PickerField({
  ariaLabel,
  children,
  className,
  clearable,
  contentRef,
  description,
  descriptionId,
  dim,
  disabled,
  displayValue,
  error,
  errorId,
  fieldRef,
  format,
  hiddenFields,
  icon,
  inputId,
  inputProps,
  inputRef,
  isOpen,
  label,
  name,
  onBlur,
  onClear,
  onFocus,
  onOpenChange,
  onValueChange,
  panelClassName,
  parseText,
  pickCount,
  placeholder,
  popupLabel,
  rangeMessage,
  readOnly,
  required,
  value,
}: PickerFieldProps) {
  const messages = useMessages();
  const isMobile = useIsMobile();
  const popupId = useId();
  const Icon = icon === "clock" ? Clock : Calendar;
  const canOpen = !disabled && !readOnly;
  const hasClearButton = !!value && canOpen && (clearable ?? !required);
  const rootRef = useRef<HTMLDivElement>(null);
  // The field with its clear button - Tab leaves the popup to what follows
  const triggerRef = useRef<HTMLDivElement>(null);
  // Whether the field was last pressed with a key or with a pointer
  const keyboardRef = useRef(false);

  // The text being typed - `null` while the field shows the value. A new
  // value (a pick in the popup, a reset) replaces it.
  const [text, setText] = useState<string | null>(null);
  const [textValue, setTextValue] = useState(value);
  const [textPickCount, setTextPickCount] = useState(pickCount);
  // The last typed text that gave no value - said under the field until
  // the typing goes on or the value changes
  const [rejected, setRejected] = useState<{
    error: "format" | "range";
    text: string;
  } | null>(null);
  const rejectedId = `${inputId}-rejected`;

  if (value !== textValue || pickCount !== textPickCount) {
    setTextValue(value);
    setTextPickCount(pickCount);
    setText(null);
    setRejected(null);
  }

  // A value out of `min` / `max` makes the form invalid, as in a native
  // input - one of the parent, or a default one. The message the field set
  // last is the one it clears - one the page set stays.
  const rangeMessageRef = useRef("");

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    if (rangeMessage) input.setCustomValidity(rangeMessage);
    else if (input.validationMessage === rangeMessageRef.current) {
      input.setCustomValidity("");
    }
    rangeMessageRef.current = rangeMessage;
  }, [inputRef, rangeMessage]);

  useImperativeHandle(fieldRef, () => inputRef.current as HTMLInputElement, [
    inputRef,
  ]);

  // The picker is one field for the caller: the focus moving between the
  // field, the clear button and the popup (a portal) is neither a focus
  // nor a blur of it
  const isInPicker = (node: EventTarget | null) =>
    node instanceof Node &&
    (!!rootRef.current?.contains(node) || !!contentRef.current?.contains(node));

  // A focus event of any part of the picker as one of the field - what the
  // caller's handlers are typed for. A copy with the methods of React's
  // events (on their prototype) - React clears `currentTarget` of the
  // original after the handlers ran.
  const asFieldEvent = (event: React.FocusEvent) =>
    Object.assign(Object.create(Object.getPrototypeOf(event)), event, {
      currentTarget: inputRef.current,
      target: inputRef.current,
    }) as React.FocusEvent<HTMLInputElement>;

  // Takes the typed text as the value. A text that is no allowed value is
  // dropped - the field shows the value again.
  const commitText = () => {
    if (text === null) return;
    setText(null);

    const typed = text.trim();
    if (typed === displayValue) return;

    if (!typed) {
      if (value) onClear();
      return;
    }

    const parsed = parseText(typed);
    if ("error" in parsed) {
      setRejected({ error: parsed.error, text: typed });
    } else if (parsed.value !== value) {
      onValueChange(parsed.value);
    }
  };

  // Tab moves between the field and the popup as if the popup followed the
  // field in the page - it is a portal at the end of it. The popup has no
  // Popover to do that: the field is a control of its own.
  const handlePopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || event.defaultPrevented) return;

    // Also from an element out of the tab order, e.g. a clicked option
    const focused = event.target as Node;
    const tabbables = getTabbableElements(event.currentTarget);
    const hasTabbable = (position: number) =>
      tabbables.some(
        (element) => focused.compareDocumentPosition(element) & position,
      );

    if (event.shiftKey) {
      // From the start of the popup back to the field
      if (hasTabbable(Node.DOCUMENT_POSITION_PRECEDING)) return;
      event.preventDefault();
      inputRef.current?.focus();
      return;
    }

    // Past the end of the popup - on to what follows the picker, which
    // closes the popup (round to the first control of a dialog it is in)
    if (hasTabbable(Node.DOCUMENT_POSITION_FOLLOWING)) return;
    event.preventDefault();
    const next = triggerRef.current
      ? getNextTabStop(triggerRef.current, contentRef.current)
      : undefined;
    (next ?? inputRef.current)?.focus();
    onOpenChange(false, true);
  };

  return (
    <div
      className="flex flex-col gap-1.5"
      onBlur={(event) => {
        if (!isInPicker(event.relatedTarget)) onBlur?.(asFieldEvent(event));
      }}
      onFocus={(event) => {
        if (!isInPicker(event.relatedTarget)) onFocus?.(asFieldEvent(event));
      }}
      ref={rootRef}
    >
      {label && (
        <label className="block truncate text-sm font-medium" htmlFor={inputId}>
          {label}
          {messages.form.labelSuffix}{" "}
          {required && (
            <span
              aria-hidden="true"
              className="text-danger-700 dark:text-danger-400"
            >
              *
            </span>
          )}
        </label>
      )}

      {/* Hidden inputs for form submission */}
      {name && (
        <input
          disabled={disabled}
          form={inputProps.form}
          name={name}
          readOnly
          type="hidden"
          value={value || ""}
        />
      )}
      {hiddenFields?.map(
        (field, index) =>
          field.name && (
            <input
              disabled={disabled}
              form={inputProps.form}
              key={index}
              name={field.name}
              readOnly
              type="hidden"
              value={field.value}
            />
          ),
      )}

      <Popover
        align="left"
        contentClassName={cn("max-h-none overflow-visible p-2", panelClassName)}
        contentRef={contentRef}
        // The input is the combobox - the wrapper is no button around it
        interactiveTrigger
        onOpenChange={
          canOpen
            ? (open) => onOpenChange(open, keyboardRef.current)
            : undefined
        }
        open={isOpen && canOpen}
        // The dialog is rendered inside, with a name and an id of its own
        popupRole="none"
        position="bottom"
        trigger={
          <div className="relative" ref={triggerRef}>
            <input
              {...inputProps}
              ref={inputRef}
              className={cn(
                "form-control w-full",
                dimStyles[dim],
                error && "border-danger-500! focus:ring-danger-500!",
                disabled && "cursor-not-allowed opacity-60",
                className,
                // Last - the room for the buttons stays with any padding
                hasClearButton ? "pr-14" : "pr-8",
              )}
              aria-controls={isOpen && canOpen ? popupId : undefined}
              aria-describedby={joinTokens(
                rejected && rejectedId,
                errorId,
                descriptionId,
                inputProps["aria-describedby"],
              )}
              aria-expanded={isOpen && canOpen}
              aria-haspopup="dialog"
              aria-invalid={error ? "true" : inputProps["aria-invalid"]}
              aria-label={label ? undefined : ariaLabel}
              aria-required={required ? "true" : inputProps["aria-required"]}
              autoComplete="off"
              disabled={disabled}
              id={inputId}
              // Phones pick from the popup, without a keyboard over it
              inputMode={isMobile ? "none" : inputProps.inputMode}
              // The typed text is taken also when the focus moves on into
              // the popup - it could leave the picker from there
              onBlur={commitText}
              onChange={(event) => {
                setText(event.target.value);
                setRejected(null);
              }}
              onClick={(event) => {
                inputProps.onClick?.(event);
                // A click places the caret - it opens the popup, but does
                // not close it
                event.stopPropagation();
                keyboardRef.current = false;
                if (!event.defaultPrevented && canOpen && !isOpen) {
                  onOpenChange(true, false);
                }
              }}
              onKeyDown={(event) => {
                // The caller's handler first - preventing the default
                // skips the picker's
                inputProps.onKeyDown?.(event);
                keyboardRef.current = true;
                if (!canOpen || event.defaultPrevented) return;

                if (event.key === "Enter") {
                  // Takes a typed text - otherwise opens the popup. Never a
                  // submit of the form.
                  event.preventDefault();
                  if (text === null) {
                    onOpenChange(!isOpen, true);
                  } else {
                    commitText();
                    if (isOpen) onOpenChange(false, true);
                  }
                  return;
                }

                if (event.key === "Escape") {
                  // This Escape is left to the popover to close an open
                  // popup - the typed text goes with the next one
                  if (text !== null && !isOpen) {
                    event.preventDefault();
                    setText(null);
                  }
                  return;
                }

                if (event.key !== "ArrowDown") return;
                event.preventDefault();

                if (isOpen) {
                  // Into the open popup, to its tab stop: the day, month or
                  // week in focus, or the hour list. Leaving the field takes
                  // a typed text, and the popup moves on to it.
                  const popup = contentRef.current;
                  (
                    popup?.querySelector<HTMLElement>("[tabindex='0']") ??
                    // Nothing to pick in the shown month or year - its
                    // navigation then
                    popup?.querySelector<HTMLElement>(
                      "button:not(:disabled), select",
                    )
                  )?.focus();
                } else {
                  // A typed text first - the popup opens on it
                  commitText();
                  onOpenChange(true, true);
                }
              }}
              onPointerDown={(event) => {
                inputProps.onPointerDown?.(event);
                keyboardRef.current = false;
              }}
              placeholder={placeholder}
              readOnly={readOnly}
              // The browser checks the typed text - the value follows it
              required={required}
              role="combobox"
              type="text"
              value={text ?? displayValue}
            />
            {hasClearButton && (
              <button
                aria-label={messages.dateTimePicker.clear}
                // A 24px square - big enough to hit (WCAG 2.5.8)
                className="absolute top-1/2 right-7 flex size-6 -translate-y-1/2 items-center justify-center rounded text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                  // The button goes away with the value - keep the focus
                  // in the field
                  inputRef.current?.focus();
                }}
                // A press keeps the focus in the field
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <X size={iconSizes[dim]} />
              </button>
            )}
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400"
              size={iconSizes[dim]}
            />
          </div>
        }
        triggerType="click"
        width="auto"
      >
        <div
          aria-label={popupLabel}
          id={popupId}
          onKeyDown={handlePopupKeyDown}
          onMouseDown={(event) => {
            // A press keeps the focus where it is - in the field for
            // typing, or on the popup's element - instead of giving it to
            // the page (Safari focuses no buttons on click). The selects
            // need the press to open.
            if (!(event.target as Element).closest("select")) {
              event.preventDefault();
            }
          }}
          role="dialog"
        >
          {children}
        </div>
      </Popover>

      <FormDescription id={descriptionId}>{description}</FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
      {/* Announced as the field shows its value again */}
      <FormError id={rejectedId}>
        {rejected &&
          formatMessage(
            rejected.error === "range"
              ? messages.dateTimePicker.outOfRangeText
              : messages.dateTimePicker.invalidText,
            { format, text: rejected.text },
          )}
      </FormError>
    </div>
  );
}
