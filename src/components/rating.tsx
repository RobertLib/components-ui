import { Star } from "lucide-react";
import {
  attachRef,
  useFieldsetDisabled,
  useFormReset,
} from "../hooks/use-form-control";
import { useCallback, useId, useRef, useState } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { formatNumber, formatPlural } from "../i18n/format";
import { useLocale } from "../providers/ui-context";
import RequiredMark from "./required-mark";

type Dim = "xs" | "sm" | "md" | "lg";

/** The theme colors of the picked icons of a `Rating`. */
export type RatingColor = "warning" | "primary" | "success" | "danger";

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the slider, as `id`, `ref` and
 * `className` do.
 */
export interface RatingProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "children"
  | "dangerouslySetInnerHTML"
  | "defaultChecked"
  | "defaultValue"
  | "onChange"
> {
  /**
   * Id of the element describing the rating - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a rating without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a rating without `label`. */
  "aria-labelledby"?: string;
  /**
   * Half steps: a click on the start half of an icon picks a half, the
   * arrow keys move by halves.
   */
  allowHalf?: boolean;
  /** Classes of the row of icons - the slider itself. */
  className?: string;
  /**
   * A click on the picked value clears the rating - back to none (`0`);
   * so do Backspace and Delete, and the arrow keys and Home go down to
   * none.
   */
  clearable?: boolean;
  /** Color of the picked icons. */
  color?: RatingColor;
  /** Initial value of an uncontrolled rating - `0` for none. */
  defaultValue?: number;
  /** Help text under the icons - it describes the rating. */
  description?: React.ReactNode;
  /** Size of the icons. */
  dim?: Dim;
  /**
   * Disables the rating - it is then neither submitted nor focusable. A
   * disabled `<fieldset>` around it disables it too, as a native field.
   */
  disabled?: boolean;
  /** The icon of the values not reached - `icon` by default. */
  emptyIcon?: React.ReactNode;
  /** Validation message - also marks the rating as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the hidden input belongs to, when the rating is not
   * inside it - like the `form` attribute of a native field. A reset of
   * that form resets the rating too.
   */
  form?: string;
  /**
   * Text of the value for screen readers (`aria-valuetext`) - "3 of 5
   * stars" in the language of the locale by default; say hearts for
   * hearts.
   */
  formatValueText?: (value: number, max: number) => string;
  /**
   * The icon - a star by default. An SVG icon (`<Heart />` of lucide) is
   * filled with the `color` where it is picked.
   */
  icon?: React.ReactNode;
  /** Id of the slider - the ids of the messages derive from it. */
  id?: string;
  /** Content of the label above the icons - the name of the rating. */
  label?: React.ReactNode;
  /** The highest rating - the number of icons. */
  max?: number;
  /**
   * Submits the value in a hidden input of this name - `""` while nothing
   * is picked.
   */
  name?: string;
  /** Called when the rating loses the focus. */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  /** Called with the new value - `0` when the rating is cleared. */
  onChange?: (value: number) => void;
  /** Called when the rating gets the focus. */
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  /**
   * Shows the value - any number, e.g. an average of 4.3 fills a third of
   * the fifth star - and takes the focus, but neither a click nor a key
   * changes it. Unlike a disabled rating, it is submitted with the form.
   */
  readOnly?: boolean;
  /** Ref to the slider - e.g. for `focus()`. */
  ref?: React.Ref<HTMLDivElement>;
  /** A rating must be picked before the form can be submitted. */
  required?: boolean;
  /** Value of a controlled rating - `0` for none. */
  value?: number;
}

const iconSizes: Record<Dim, string> = {
  xs: "size-4",
  sm: "size-5",
  md: "size-6",
  lg: "size-8",
};

const gaps: Record<Dim, string> = {
  xs: "gap-0.5",
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

// The outline of a picked icon at 3:1 on the page - the fill alone would
// not tell it from the page
const filledColors: Record<RatingColor, string> = {
  danger:
    "text-danger-600 [&_svg]:fill-danger-500 [&_svg]:stroke-danger-600 dark:text-danger-400 dark:[&_svg]:fill-danger-400 dark:[&_svg]:stroke-danger-400",
  primary:
    "text-primary-600 [&_svg]:fill-primary-500 [&_svg]:stroke-primary-600 dark:text-primary-400 dark:[&_svg]:fill-primary-400 dark:[&_svg]:stroke-primary-400",
  success:
    "text-success-700 [&_svg]:fill-success-500 [&_svg]:stroke-success-700 dark:text-success-400 dark:[&_svg]:fill-success-400 dark:[&_svg]:stroke-success-400",
  warning:
    "text-warning-700 [&_svg]:fill-warning-400 [&_svg]:stroke-warning-700 dark:text-warning-400 dark:[&_svg]:fill-warning-400 dark:[&_svg]:stroke-warning-400",
};

const emptyColors =
  "text-neutral-500 [&_svg]:stroke-neutral-500 dark:text-neutral-400 dark:[&_svg]:stroke-neutral-400";
const invalidEmptyColors =
  "text-danger-600 [&_svg]:stroke-danger-600 dark:text-danger-400 dark:[&_svg]:stroke-danger-400";

// Forced colors (Windows High Contrast) replace the theme colors - the
// picked icons take the system's highlight color, the others its text color
const forcedFilledColors =
  "forced-colors:text-[Highlight] forced-colors:[&_svg]:fill-[Highlight] forced-colors:[&_svg]:stroke-[Highlight]";
const forcedEmptyColors =
  "forced-colors:text-[CanvasText] forced-colors:[&_svg]:stroke-[CanvasText]";

// Lets the browser enforce `required` without a field of its own to show
const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

/**
 * A rating of 1 to `max` - stars by default, or any icon - optionally in
 * half steps. A slider for assistive technology, as the rating slider of
 * WAI-ARIA: one tab stop, the arrow keys change the value, and it is read
 * as "3 of 5 stars". Hovering previews the value a click picks.
 */
export default function Rating({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  allowHalf = false,
  className,
  clearable = false,
  color = "warning",
  defaultValue,
  description,
  dim = "md",
  disabled: disabledProp = false,
  emptyIcon,
  error,
  form,
  formatValueText,
  icon,
  id,
  label,
  max = 5,
  name,
  onBlur,
  onChange,
  onFocus,
  readOnly = false,
  ref,
  required = false,
  value,
  ...props
}: RatingProps) {
  const locale = useLocale();
  const { messages } = locale;

  // The slider is no native field - a disabled fieldset around it leaves it
  // alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;
  const interactive = !disabled && !readOnly;

  const count = Math.max(1, Math.round(max));
  const step = allowHalf ? 0.5 : 1;
  const lowest = clearable ? 0 : step;

  // What the user picked in an uncontrolled rating. Until then, and again
  // after a reset, it shows `defaultValue` - also one that arrived late.
  const [enteredValue, setEnteredValue] = useState<number>();
  const isControlled = value !== undefined;
  const current = clamp(
    (isControlled ? value : (enteredValue ?? defaultValue)) || 0,
    0,
    count,
  );

  // The value under the pointer - shown until it leaves the icons
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = interactive && hovered !== null ? hovered : current;

  const generatedId = useId();
  const sliderId = id ?? generatedId;
  const labelId = `${sliderId}-label`;
  const errorId = error ? `${sliderId}-error` : undefined;
  const descriptionId = description ? `${sliderId}-description` : undefined;

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`
  const formResetRef = useFormReset(() => setEnteredValue(undefined), form);

  const wrapperRef = useCallback(
    (element: HTMLDivElement | null) => {
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);

      return () => {
        detachReset?.();
        detachFieldset?.();
      };
    },
    [fieldsetRef, formResetRef],
  );

  const sliderElement = useRef<HTMLDivElement | null>(null);
  const sliderRef = useCallback(
    (element: HTMLDivElement | null) => {
      sliderElement.current = element;
      const detachRef = attachRef(ref, element);

      return () => {
        sliderElement.current = null;
        detachRef();
      };
    },
    [ref],
  );

  const commit = (next: number) => {
    if (!interactive || next === current) return;
    if (!isControlled) setEnteredValue(next);
    onChange?.(next);
  };

  /** The value a point of an icon stands for - its start half a half. */
  const valueAt = (index: number, event: React.MouseEvent<HTMLElement>) => {
    if (!allowHalf) return index + 1;

    const rect = event.currentTarget.getBoundingClientRect();
    const along = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 1;
    const fromStart = isRtl(event.currentTarget) ? 1 - along : along;
    return fromStart <= 0.5 ? index + 0.5 : index + 1;
  };

  // On the grid of the steps - also from a value in between (an average)
  const stepUp = (from: number) =>
    Math.min(count, Math.floor(from / step + 1e-9) * step + step);
  const stepDown = (from: number) =>
    Math.max(lowest, Math.ceil(from / step - 1e-9) * step - step);
  const onGrid = (target: number) =>
    clamp(Math.round(target / step) * step, lowest, count);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Right is back in a right-to-left page
    const rtl = isRtl(event.currentTarget);
    const { key } = event;
    const up = key === "ArrowUp" || key === (rtl ? "ArrowLeft" : "ArrowRight");
    const down =
      key === "ArrowDown" || key === (rtl ? "ArrowRight" : "ArrowLeft");
    // Nothing goes below none - nor down to it from none
    const canGoDown = current > lowest;

    const target = up
      ? stepUp(current)
      : down
        ? canGoDown
          ? stepDown(current)
          : current
        : key === "PageUp"
          ? onGrid(current + 1)
          : key === "PageDown"
            ? canGoDown
              ? onGrid(current - 1)
              : current
            : key === "Home"
              ? lowest
              : key === "End"
                ? count
                : (key === "Backspace" || key === "Delete") && clearable
                  ? 0
                  : undefined;
    if (target === undefined) return;

    // Also in a read-only rating - the key changes nothing, not the page
    event.preventDefault();
    commit(target);
  };

  const valueText = formatValueText
    ? formatValueText(current, count)
    : current > 0
      ? formatPlural(locale.code, messages.rating.value, count, {
          value: formatNumber(locale.code, current),
        })
      : messages.rating.none;

  const nameId = label ? labelId : ariaLabelledBy;
  const iconElement = icon ?? <Star />;

  return (
    <div className="relative flex flex-col gap-1.5" ref={wrapperRef}>
      {label && (
        // No input a `<label>` would focus by itself - the slider
        <label
          className="block text-sm font-medium"
          id={labelId}
          onClick={() => sliderElement.current?.focus()}
        >
          {label}
          {messages.form.labelSuffix} {/* The star is for the eye */}
          {required && <RequiredMark />}
        </label>
      )}

      <div
        {...props}
        aria-describedby={joinTokens(errorId, descriptionId, ariaDescribedBy)}
        aria-disabled={disabled || undefined}
        aria-invalid={error ? "true" : undefined}
        aria-label={nameId ? undefined : ariaLabel}
        aria-labelledby={nameId}
        aria-orientation="horizontal"
        aria-readonly={readOnly ? "true" : undefined}
        aria-valuemax={count}
        aria-valuemin={0}
        aria-valuenow={current}
        aria-valuetext={valueText}
        className={cn(
          "flex w-fit touch-manipulation items-center rounded select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
          gaps[dim],
          disabled
            ? "cursor-not-allowed opacity-60"
            : readOnly
              ? "cursor-default"
              : "cursor-pointer",
          className,
        )}
        data-disabled={disabled ? "" : undefined}
        data-invalid={error ? "" : undefined}
        data-orientation="horizontal"
        data-readonly={readOnly ? "" : undefined}
        id={sliderId}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (!event.defaultPrevented) handleKeyDown(event);
        }}
        onPointerLeave={(event) => {
          props.onPointerLeave?.(event);
          setHovered(null);
        }}
        ref={sliderRef}
        role="slider"
        // Not focusable while disabled, like a native field
        tabIndex={disabled ? undefined : 0}
      >
        {Array.from({ length: count }, (_, index) => {
          // How much of the icon is filled - a part of it for a value in
          // between, like an average
          const fill = clamp(shown - index, 0, 1);

          return (
            <span
              aria-hidden="true"
              className={cn("relative inline-flex shrink-0", iconSizes[dim])}
              data-index={index}
              key={index}
              onClick={(event) => {
                if (!interactive) return;
                // Of the point clicked - a tap has no hover before it
                const picked = valueAt(index, event);
                commit(clearable && picked === current ? 0 : picked);
                setHovered(null);
              }}
              onPointerMove={(event) => {
                if (interactive && event.pointerType !== "touch") {
                  setHovered(valueAt(index, event));
                }
              }}
            >
              <span
                className={cn(
                  "flex size-full [&_svg]:size-full",
                  error ? invalidEmptyColors : emptyColors,
                  forcedEmptyColors,
                )}
              >
                {emptyIcon ?? iconElement}
              </span>
              {fill > 0 && (
                <span
                  className={cn(
                    "absolute inset-y-0 start-0 flex overflow-hidden",
                    filledColors[color],
                    forcedFilledColors,
                  )}
                  style={{ width: `${fill * 100}%` }}
                >
                  <span
                    className={cn(
                      "flex shrink-0 [&_svg]:size-full",
                      iconSizes[dim],
                    )}
                  >
                    {iconElement}
                  </span>
                </span>
              )}
            </span>
          );
        })}
      </div>

      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value={current > 0 ? String(current) : ""}
        />
      )}
      {required && !readOnly && (
        <input
          aria-hidden="true"
          disabled={disabled}
          form={form}
          // Neither focusable nor seen by assistive technology - until the
          // browser reports it invalid (a submit), then it can take the
          // focus the browser gives it, with its message
          inert
          onChange={() => {}}
          // The user belongs in the rating (the message still shows)
          onFocus={() => sliderElement.current?.focus()}
          onInvalid={(event) => {
            const validationInput = event.currentTarget;
            validationInput.removeAttribute("inert");
            setTimeout(() => validationInput.setAttribute("inert", ""));
          }}
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={current > 0 ? "valid" : ""}
        />
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
