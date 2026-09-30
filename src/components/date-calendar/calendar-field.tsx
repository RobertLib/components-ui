import { useCallback, useLayoutEffect, useRef } from "react";
import cn, { joinTokens } from "../../utils/cn";
import FormDescription from "../form-description";
import FormError from "../form-error";
import hasLabel from "../datetime-picker/has-label";
import { attachRef } from "../../hooks/use-form-control";
import { useMessages } from "../../providers/ui-context";
import RequiredMark from "../required-mark";

// Out of sight, but able to take the focus the browser gives an invalid
// field - it hands it on to the calendar
const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
  bottom: 0,
  insetInlineStart: 0,
};

/** The day in the tab order of a calendar - or its first enabled button. */
const focusCalendar = (group: HTMLElement | null) =>
  (
    group?.querySelector<HTMLElement>("[data-focused-day='true']") ??
    group?.querySelector<HTMLElement>("button:not(:disabled)")
  )?.focus();

interface CalendarFieldProps {
  /** Ids of more elements describing the calendar. */
  ariaDescribedBy?: string;
  /** Accessible name without a `label` and `ariaLabelledBy`. */
  ariaLabel: string;
  /** Id of the element naming a calendar without a `label`. */
  ariaLabelledBy?: string;
  /** The calendar. */
  children: React.ReactNode;
  /** Classes of the box around the calendar. */
  className?: string;
  /** Help text under the calendar. */
  description?: React.ReactNode;
  /** Neither submitted nor focusable. */
  disabled: boolean;
  /** Validation message - also marks the calendar as invalid. */
  error?: string;
  /** Id of the `<form>` of the hidden inputs. */
  form?: string;
  /**
   * The native attributes of the calendar (`data-*`, `style`, event
   * handlers) - for the group.
   */
  groupProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Whether there is a value - for `required`. */
  hasValue: boolean;
  /** The hidden inputs submitting the value - those without a name are left out. */
  hiddenFields: { name?: string; value: string }[];
  /** Id of the group - the ids of the messages derive from it. */
  id: string;
  /** The label above the calendar. */
  label?: React.ReactNode;
  /** The focus left the calendar. */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  /** The focus entered the calendar. */
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  /** The value can be looked at, but not changed. */
  readOnly: boolean;
  /** Ref to the group. */
  ref?: React.Ref<HTMLDivElement>;
  /** A value must be picked before the form can be submitted. */
  required?: boolean;
  /**
   * Why the value cannot be picked - out of `min` / `max`, or a disabled
   * day. The form cannot be submitted with it. `""` for none.
   */
  validityMessage: string;
  /** Ref of the element around it all - of `useCalendarField`. */
  wrapperRef: React.Ref<HTMLDivElement>;
}

/**
 * The label, the box, the messages and the form inputs of an inline
 * calendar - `DateCalendar` and `RangeCalendar`.
 */
export default function CalendarField({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  description,
  disabled,
  error,
  form,
  groupProps,
  hasValue,
  hiddenFields,
  id,
  label,
  onBlur,
  onFocus,
  readOnly,
  ref,
  required,
  validityMessage,
  wrapperRef,
}: CalendarFieldProps) {
  const messages = useMessages();
  const labelId = `${id}-label`;
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  const groupRef = useRef<HTMLDivElement | null>(null);
  const validationRef = useRef<HTMLInputElement>(null);
  const labeled = hasLabel(label);

  const groupCallbackRef = useCallback(
    (element: HTMLDivElement | null) => {
      groupRef.current = element;
      const detach = attachRef(ref, element);
      return () => {
        groupRef.current = null;
        detach();
      };
    },
    [ref],
  );

  // The browser blocks a submit with the message, as for a native field.
  // Leaving read-only mode mounts a new input even when the message stays.
  useLayoutEffect(() => {
    validationRef.current?.setCustomValidity(validityMessage);
  }, [readOnly, validityMessage]);

  const isOwnElement = (node: EventTarget | null) =>
    node instanceof Node && !!groupRef.current?.contains(node);

  return (
    <div className="relative flex flex-col gap-1.5" ref={wrapperRef}>
      {labeled && (
        // No input a `<label>` would focus by itself - the day in the tab
        // order
        <label
          className="block text-sm font-medium"
          id={labelId}
          onClick={() => focusCalendar(groupRef.current)}
        >
          {label}
          {messages.form.labelSuffix} {/* The star is for the eye */}
          {required && <RequiredMark />}
        </label>
      )}

      <div
        {...groupProps}
        aria-describedby={joinTokens(errorId, descriptionId, ariaDescribedBy)}
        aria-label={labeled || ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={labeled ? labelId : ariaLabelledBy}
        className={cn(
          "max-w-full rounded-md border bg-surface p-2 dark:bg-surface-dark",
          // Forced colors (Windows High Contrast) draw every border in one
          // color - an outline makes the border of an invalid one thicker
          error
            ? "border-danger-500 forced-colors:outline-1"
            : "border-neutral-300 dark:border-neutral-700",
          disabled && "opacity-60",
          className,
        )}
        data-disabled={disabled ? "" : undefined}
        // Also a value out of the limits, or on a disabled day
        data-invalid={error || validityMessage ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        id={id}
        onBlur={(event) => {
          if (!isOwnElement(event.relatedTarget)) onBlur?.(event);
        }}
        onFocus={(event) => {
          if (!isOwnElement(event.relatedTarget)) onFocus?.(event);
        }}
        ref={groupCallbackRef}
        role="group"
      >
        {children}
      </div>

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>

      {/* Hidden inputs for form submission - none while disabled */}
      {hiddenFields.map(
        (field, index) =>
          field.name && (
            <input
              disabled={disabled}
              form={form}
              key={index}
              name={field.name}
              readOnly
              type="hidden"
              value={field.value}
            />
          ),
      )}
      {/* Lets the browser enforce `required` and the limits - not of a
          read-only calendar, like a read-only native field */}
      {(required || validityMessage) && !readOnly && (
        <input
          disabled={disabled}
          form={form}
          // Neither focusable nor seen by assistive technology - until the
          // browser reports it invalid (a submit, `reportValidity()`), then
          // it can take the focus the browser gives it, with the message
          inert
          onChange={() => {}}
          // The user belongs in the calendar (the message still shows)
          onFocus={() => focusCalendar(groupRef.current)}
          onInvalid={(event) => {
            const validationInput = event.currentTarget;
            validationInput.removeAttribute("inert");
            setTimeout(() => validationInput.setAttribute("inert", ""));
          }}
          ref={validationRef}
          required={required}
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={hasValue ? "valid" : ""}
        />
      )}
    </div>
  );
}
