import { useCallback, useId, useRef, useState } from "react";
import { isAriaInvalid, useFormReset } from "../../hooks/use-form-control";
import cn, { joinTokens } from "../../utils/cn";
import ColorPicker, { CHECKERBOARD, type ColorSwatch } from "./color-picker";
import {
  formatColor,
  hsvToRgb,
  normalizeColor,
  parseColor,
  rgbToHsv,
  toCssColor,
  type ColorFormat,
  type Hsva,
} from "./color";
import FormDescription from "../form-description";
import FormError from "../form-error";
import Popover from "../popover";
import { formatMessage } from "../../i18n/format";
import { useMessages } from "../../providers/ui-context";
import RequiredMark from "../required-mark";

export type { ColorFormat } from "./color";
export type { ColorSwatch } from "./color-picker";

type Dim = "xs" | "sm" | "md" | "lg";

export interface ColorInputProps extends Omit<
  React.ComponentProps<"input">,
  "defaultValue" | "onChange" | "prefix" | "size" | "type" | "value"
> {
  /**
   * Adds a slider of the opacity to the picker, and keeps the alpha of a
   * typed or picked color: `#1e90ff80`, `rgba(30, 144, 255, 0.5)`. Without
   * it the alpha is dropped.
   */
  alpha?: boolean;
  /**
   * Classes of the text `<input>` itself - not of the frame around it, its
   * label, description or error message.
   */
  className?: string;
  /** Initial color of an uncontrolled field - `""` for none. */
  defaultValue?: string;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field - the sizes of `Input`. */
  dim?: Dim;
  /**
   * Disables the field - it is then neither submitted nor validated, and
   * the swatch opens no picker.
   */
  disabled?: boolean;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Shows a button in the picker that takes a color from anywhere on the
   * screen - only where the browser has the EyeDropper API (Chromium).
   */
  eyeDropper?: boolean;
  /**
   * The format of the value - `#1e90ff`, `rgb(30, 144, 255)` or
   * `hsl(210, 100%, 56%)`. A color typed in another format is written in
   * this one.
   */
  format?: ColorFormat;
  /**
   * Id of the `<form>` the field belongs to, when it is not inside it - like
   * the `form` attribute of a native field. A reset of that form resets the
   * field too.
   */
  form?: string;
  /** Content of the `<label>` of the field. */
  label?: React.ReactNode;
  /**
   * Submits the color - in `format` - in a hidden input of this name; `""`
   * without a color.
   */
  name?: string;
  /**
   * Called with the new color in `format` - as it is typed (on Enter or
   * leaving the field), picked or dragged; `""` when the field is emptied.
   */
  onChange?: (value: string) => void;
  /**
   * The field shows the color and takes the focus, but it cannot be typed
   * over and the swatch opens no picker. Unlike a disabled field, it is
   * submitted with the form.
   */
  readOnly?: boolean;
  /**
   * The visible text field - e.g. for `focus()`. The value itself comes
   * with `onChange` and, with a `name`, in a hidden input.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * Preset colors under the picker - in any format the field reads; with a
   * `label` to name them for screen readers.
   */
  swatches?: (string | ColorSwatch)[];
  /** Color of a controlled field - `""` for none. */
  value?: string;
}

// The sizes of Input - all the padding lives here
const dimStyles: Record<Dim, string> = {
  xs: "px-1 py-0 text-sm",
  sm: "px-1 py-0.5 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};

// The swatch at the start - a target of 24 × 24 px (WCAG 2.5.8), over the
// padding of the extra small field, which it would make taller
const swatchButtonStyles: Record<Dim, string> = {
  xs: "ms-0.5 -my-0.5 size-6",
  sm: "ms-0.5 size-6",
  md: "ms-1 size-6",
  lg: "ms-2 size-7",
};

const swatchSizes: Record<Dim, string> = {
  xs: "size-4",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

// The example of the message under a text that is no color
const EXAMPLES: Record<ColorFormat, string> = {
  hex: "#1e90ff",
  hsl: "hsl(210, 100%, 56%)",
  rgb: "rgb(30, 144, 255)",
};

// A color picked while the field is empty starts from white
const NO_COLOR: Hsva = { a: 1, h: 0, s: 0, v: 100 };

/**
 * A color field - the color typed as text (hex, `rgb()` or `hsl()`), or
 * picked in a popup the swatch at its start opens: an area of saturation
 * and brightness, a hue slider, an optional alpha slider, preset
 * `swatches` and the eye dropper of the browser. Works controlled (`value`
 * + `onChange`) and uncontrolled (`defaultValue`); with a `name` a hidden
 * input submits the color.
 */
export default function ColorInput({
  alpha = false,
  "aria-describedby": ariaDescribedBy,
  className,
  defaultValue,
  description,
  dim = "md",
  disabled = false,
  error,
  eyeDropper = true,
  form,
  format = "hex",
  id,
  label,
  name,
  onBlur,
  onChange,
  onKeyDown,
  readOnly = false,
  ref,
  required,
  swatches,
  value: controlledValue,
  ...props
}: ColorInputProps) {
  const messages = useMessages();
  const canOpen = !disabled && !readOnly;

  // What the user entered into an uncontrolled field. Until then, and again
  // after a reset, it shows `defaultValue` - also one that arrived late.
  const [enteredValue, setEnteredValue] = useState<string>();
  const isControlled = controlledValue !== undefined;
  const value = isControlled
    ? controlledValue
    : (enteredValue ?? defaultValue ?? "");

  // The text being typed - `null` while the field shows the value. A new
  // value (a pick, a reset) replaces it.
  const [text, setText] = useState<string | null>(null);
  const [textValue, setTextValue] = useState(value);
  // The last typed text that is no color - said under the field until the
  // typing goes on or the value changes
  const [rejected, setRejected] = useState<string | null>(null);

  if (value !== textValue) {
    setTextValue(value);
    setText(null);
    setRejected(null);
  }

  const [isOpen, setIsOpen] = useState(false);
  const open = isOpen && canOpen;

  // The color of the picker - its own while it stands for the value, so
  // that a drag keeps the hue of a gray and the fractions of the
  // channels a text rounds away
  const [pickerColor, setPickerColor] = useState<Hsva | null>(null);
  const parsed = parseColor(value);
  const shownColor =
    pickerColor && formatColor(hsvToRgb(pickerColor), format, alpha) === value
      ? pickerColor
      : parsed
        ? { ...rgbToHsv(parsed), a: alpha ? parsed.a : 1 }
        : NO_COLOR;

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const rejectedId = `${inputId}-rejected`;
  const invalid = !!error || isAriaInvalid(props["aria-invalid"]);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`
  const formResetRef = useFormReset(() => {
    setEnteredValue(undefined);
    setText(null);
    setRejected(null);
  }, form);

  // The area of the picker takes the focus once it opens
  const focusOnOpen = useRef(false);
  const areaRef = useCallback((element: HTMLDivElement | null) => {
    if (element && focusOnOpen.current) {
      focusOnOpen.current = false;
      element.focus({ preventScroll: true });
    }
  }, []);

  const commit = (next: string) => {
    if (next === value) return;
    if (!isControlled) setEnteredValue(next);
    onChange?.(next);
  };

  // Takes the typed text as the value - in `format`. A text that is no
  // color is dropped: the field shows the value again, and a message says
  // why.
  const commitText = () => {
    if (text === null) return;
    setText(null);

    const normalized = normalizeColor(text, format, alpha);
    if (normalized === null) {
      setRejected(text.trim());
    } else {
      commit(normalized);
    }
  };

  const pickColor = (color: Hsva) => {
    setPickerColor(color);
    commit(formatColor(hsvToRgb(color), format, alpha));
  };

  const swatchColor = parsed
    ? toCssColor(alpha ? parsed : { ...parsed, a: 1 })
    : undefined;
  const swatch = (
    // The color is what the swatch shows - forced colors (Windows High
    // Contrast) leave it as it is
    <span
      aria-hidden="true"
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] forced-color-adjust-none dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]",
        swatchSizes[dim],
        CHECKERBOARD,
      )}
    >
      <span
        className={cn(
          "absolute inset-0",
          // No color - a line across the squares
          !swatchColor &&
            "bg-[linear-gradient(to_bottom_right,transparent_calc(50%-1px),var(--color-danger-500)_calc(50%-1px),var(--color-danger-500)_calc(50%+1px),transparent_calc(50%+1px))]",
        )}
        style={swatchColor ? { backgroundColor: swatchColor } : undefined}
      />
    </span>
  );

  return (
    <div className="flex flex-col gap-1.5" ref={formResetRef}>
      {label && (
        <label className="block truncate text-sm font-medium" htmlFor={inputId}>
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `required` tells assistive technology */}
          {required && <RequiredMark />}
        </label>
      )}

      <div
        className={cn(
          "relative flex w-full items-center rounded-md border border-neutral-300 bg-surface transition-colors focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark",
          // Forced colors draw every border in one color - an outline makes
          // the border of an invalid field thicker
          error &&
            "border-danger-500! focus-within:ring-danger-500! forced-colors:outline-1",
          disabled && "cursor-not-allowed opacity-50",
          // Also for a disabled fieldset around, which no prop tells
          "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        )}
      >
        {canOpen ? (
          <Popover
            align="start"
            buttonTrigger
            className="flex shrink-0"
            contentClassName="max-h-none overflow-visible p-3"
            contentLabel={messages.colorInput.picker}
            onOpenChange={(next) => {
              focusOnOpen.current = next;
              setIsOpen(next);
            }}
            open={open}
            position="bottom"
            trigger={
              <button
                aria-label={messages.colorInput.openPicker}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
                  swatchButtonStyles[dim],
                )}
                data-state={open ? "open" : "closed"}
                type="button"
              >
                {swatch}
              </button>
            }
            triggerType="click"
            width="auto"
          >
            <ColorPicker
              alpha={alpha}
              areaRef={areaRef}
              color={shownColor}
              eyeDropper={eyeDropper}
              format={format}
              onChange={pickColor}
              onPickValue={(next) => {
                setPickerColor(null);
                commit(next);
              }}
              swatches={swatches}
              value={value}
            />
          </Popover>
        ) : (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center",
              swatchButtonStyles[dim],
            )}
          >
            {swatch}
          </span>
        )}

        <input
          {...props}
          aria-describedby={joinTokens(
            rejected !== null && rejectedId,
            errorId,
            descriptionId,
            ariaDescribedBy,
          )}
          aria-invalid={error ? "true" : props["aria-invalid"]}
          aria-required={required ? "true" : props["aria-required"]}
          autoCapitalize="off"
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 self-stretch bg-transparent focus:outline-hidden",
            dimStyles[dim],
            disabled && "cursor-not-allowed",
            className,
          )}
          data-disabled={disabled ? "" : undefined}
          data-invalid={invalid ? "" : undefined}
          data-readonly={readOnly ? "" : undefined}
          disabled={disabled}
          form={form}
          id={inputId}
          onBlur={(event) => {
            commitText();
            onBlur?.(event);
          }}
          onChange={(event) => {
            setText(event.target.value);
            setRejected(null);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;

            // Takes the typed text - and submits no form with it
            if (event.key === "Enter" && text !== null) {
              event.preventDefault();
              commitText();
            } else if (event.key === "Escape" && text !== null && !open) {
              event.preventDefault();
              setText(null);
              setRejected(null);
            }
          }}
          readOnly={readOnly}
          ref={ref}
          // The browser checks the text - the value follows it
          required={required}
          spellCheck={false}
          type="text"
          value={text ?? value}
        />
      </div>

      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value={value}
        />
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
      {/* Announced as the field shows its value again */}
      <FormError id={rejectedId}>
        {rejected !== null &&
          formatMessage(messages.colorInput.invalid, {
            example: EXAMPLES[format],
            text: rejected,
          })}
      </FormError>
    </div>
  );
}
