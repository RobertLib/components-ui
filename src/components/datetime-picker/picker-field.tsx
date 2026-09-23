import { Calendar, Clock, X } from "lucide-react";
import { useImperativeHandle, useRef, useState } from "react";
import cn from "../../utils/cn";
import FormError from "../form-error";
import Popover from "../popover";
import useIsMobile from "../../hooks/use-is-mobile";
import { useMessages } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

const dimStyles = {
  sm: "px-2 py-1 text-sm",
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
  contentRef: React.RefObject<HTMLDivElement | null>;
  displayValue: string;
  icon: "calendar" | "clock";
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onClear: () => void;
  /** `byKeyboard` - the popup opens on a key press, not on a click. */
  onOpenChange: (open: boolean, byKeyboard: boolean) => void;
  panelClassName?: string;
  /**
   * The value of a text typed in the display format - `null` for a text
   * that is no allowed value, which is then dropped.
   */
  parseText: (text: string) => string | null;
}

/**
 * The part all custom pickers share: the field showing the formatted value
 * - the value can also be typed into it - the clear button, the popup, the
 * hidden form input and the error message.
 */
export default function PickerField({
  ariaLabel,
  children,
  className,
  contentRef,
  dim,
  disabled,
  displayValue,
  error,
  errorId,
  fieldRef,
  icon,
  inputId,
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
  placeholder,
  readOnly,
  required,
  value,
}: PickerFieldProps) {
  const messages = useMessages();
  const isMobile = useIsMobile();
  const Icon = icon === "clock" ? Clock : Calendar;
  const canOpen = !disabled && !readOnly;
  // Whether the field was last pressed with a key or with a pointer
  const keyboardRef = useRef(false);

  // The text being typed - `null` while the field shows the value. A new
  // value (a pick in the popup, a reset) replaces it.
  const [text, setText] = useState<string | null>(null);
  const [textValue, setTextValue] = useState(value);

  if (value !== textValue) {
    setTextValue(value);
    setText(null);
  }

  useImperativeHandle(fieldRef, () => inputRef.current as HTMLInputElement, [
    inputRef,
  ]);

  // The focus moving between the field and its popup stays in the picker -
  // the caller's `onFocus` / `onBlur` hear only of it entering and leaving
  const isPopupFocusMove = (event: React.FocusEvent) =>
    !!contentRef.current?.contains(event.relatedTarget as Node | null);

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
    if (parsed !== null && parsed !== value) onValueChange(parsed);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="block truncate text-sm font-medium" htmlFor={inputId}>
          {label}: {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      {/* Hidden input for form submission */}
      {name && (
        <input
          disabled={disabled}
          name={name}
          readOnly
          type="hidden"
          value={value || ""}
        />
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
        position="bottom"
        trigger={
          <div className="relative">
            <input
              ref={inputRef}
              className={cn(
                "form-control w-full pr-8",
                value && canOpen && "pr-14",
                dimStyles[dim],
                error && "border-danger-500! focus:ring-danger-300!",
                disabled && "cursor-not-allowed opacity-60",
                className,
              )}
              aria-describedby={errorId}
              aria-expanded={isOpen && canOpen}
              aria-haspopup="dialog"
              aria-invalid={error ? "true" : undefined}
              aria-label={label ? undefined : ariaLabel}
              aria-required={required ? "true" : undefined}
              autoComplete="off"
              disabled={disabled}
              id={inputId}
              // Phones pick from the popup, without a keyboard over it
              inputMode={isMobile ? "none" : undefined}
              onBlur={(event) => {
                // The typed text is taken also when the focus moves on into
                // the popup - it could leave the picker from there, and the
                // field would not hear of it
                commitText();
                if (!isPopupFocusMove(event)) onBlur?.(event);
              }}
              onChange={(event) => setText(event.target.value)}
              onClick={(event) => {
                // A click places the caret - it opens the popup, but does
                // not close it
                event.stopPropagation();
                keyboardRef.current = false;
                if (canOpen && !isOpen) onOpenChange(true, false);
              }}
              onFocus={(event) => {
                if (!isPopupFocusMove(event)) onFocus?.(event);
              }}
              onKeyDown={(event) => {
                keyboardRef.current = true;
                if (!canOpen) return;

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

                // An open popup has closed on this Escape already
                if (event.key === "Escape") {
                  if (text !== null && !event.defaultPrevented) {
                    event.preventDefault();
                    setText(null);
                  }
                  return;
                }

                if (event.key !== "ArrowDown") return;
                event.preventDefault();

                if (isOpen) {
                  // Into the open popup, to its tab stop: the day, month or
                  // week in focus, or the hour list
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
                  onOpenChange(true, true);
                }
              }}
              onPointerDown={() => {
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
            {value && canOpen && (
              <button
                aria-label={messages.dateTimePicker.clear}
                className="absolute top-1/2 right-8 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                  // The button goes away with the value - keep the focus
                  // in the field
                  inputRef.current?.focus();
                }}
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
        {children}
      </Popover>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
