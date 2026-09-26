import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { attachRef, useFormReset } from "../../hooks/use-form-control";
import cn from "../../utils/cn";
import { flushSync } from "react-dom";
import { formatMessage } from "../../i18n/format";
import { getStepNumberFormat, stepValue, toCanonical } from "./number-format";
import { InputBase } from "../input";
import { useLocale, useMessages } from "../../providers/ui-context";

// Page Up / Page Down step this many times
const PAGE_STEPS = 10;
// Holding a step button repeats the step after this pause, then this often
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 60;

const chevronSizes = { xs: 12, sm: 12, md: 14, lg: 16 };
const signSizes = { xs: 14, sm: 14, md: 16, lg: 18 };

type MobilePlatform = "android" | "iphone" | "other";

const noSubscription = () => () => {};

/** The phone whose on-screen keyboard `inputMode` has to suit. */
function getMobilePlatform(): MobilePlatform {
  const { userAgent } = navigator;
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

/**
 * The on-screen keyboard for the number: the numeric keyboards of an iPhone
 * have no minus sign, and the decimal keyboard of Android has none either -
 * picked as React Aria's NumberField does.
 */
function inputModeFor(
  platform: MobilePlatform,
  hasDecimals: boolean,
  allowsNegative: boolean,
): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (platform === "iphone" && allowsNegative) return "text";
  if (platform === "android" && allowsNegative) return "numeric";
  return hasDecimals ? "decimal" : "numeric";
}

const clamp = (value: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));

/** A finite number - anything else (`undefined`, `NaN`) is no value. */
const toValue = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Puts back the text a keystroke would have made no number - with the caret
 * where it was before the keystroke.
 */
function revertInput(input: HTMLInputElement, text: string) {
  const caret = Math.max(
    0,
    (input.selectionStart ?? text.length) - (input.value.length - text.length),
  );
  input.value = text;
  input.setSelectionRange(caret, caret);
}

// `min`, `max` and `step` take numbers only - no need to omit them
export interface NumberInputProps extends Omit<
  React.ComponentProps<"input">,
  "defaultValue" | "onChange" | "prefix" | "type" | "value"
> {
  /**
   * Steps with the mouse wheel while the field has the focus - off by
   * default, as scrolling the page over a focused field would change it.
   */
  changeOnWheel?: boolean;
  /**
   * Classes of the `<input>` itself - not of the wrapper around it, its
   * label, description or error message.
   */
  className?: string;
  /** Initial value of an uncontrolled field - `null` for an empty one. */
  defaultValue?: number | null;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Places the label inside the field, floating up once it has a value. */
  floating?: boolean;
  /**
   * How the value is written while the field has no focus - options of
   * `Intl.NumberFormat` in the locale of `UIProvider`: fraction digits, a
   * currency (`{ style: "currency", currency: "CZK" }`), a percentage
   * (`{ style: "percent" }` - 0.25 shows as 25 % and is typed as 25) or a
   * unit (`{ style: "unit", unit: "kilogram" }`). The value is rounded to
   * the fraction digits the format shows - 3 by default, those of the
   * currency for one, or those of a finer `step` unless the options set
   * the digits.
   */
  formatOptions?: Intl.NumberFormatOptions;
  /** Hides the step buttons - the keyboard still steps. */
  hideStepper?: boolean;
  /** Text of the `<label>` of the field. */
  label?: string;
  /**
   * The largest value - End sets it, and a larger typed value is lowered to
   * it when the field loses the focus. A larger value the field holds
   * meanwhile (typed, or from the parent) makes the form invalid, as it
   * does a native number input: the browser refuses to submit it and says
   * why.
   */
  max?: number;
  /**
   * The most fraction digits - a shorthand for the one of `formatOptions`.
   * With `0` only whole numbers can be typed.
   */
  maximumFractionDigits?: number;
  /**
   * The smallest value - Home sets it, and a smaller typed value is raised
   * to it when the field loses the focus (a smaller value meanwhile makes
   * the form invalid, see `max`). With a `min` of 0 or more no minus sign
   * can be typed.
   */
  min?: number;
  /**
   * Called with the new value - `null` for an empty field. While typing,
   * whenever the typed text stands for another number; when the field loses
   * the focus or on Enter, with the value moved into `min` - `max`; and for
   * every step.
   */
  onChange?: (value: number | null) => void;
  /**
   * Content before the number, inside the border of the field - see the
   * `prefix` of `Input`.
   */
  prefix?: React.ReactNode;
  /**
   * What the arrow keys, the step buttons and the wheel add or take away -
   * Page Up and Page Down ten times as much. The steps count from `min` (or
   * 0), as those of a native number input: a value between two steps moves
   * to the next one. 1 by default - 0.01 (one percent) for
   * `formatOptions={{ style: "percent" }}`, whose value is the fraction. A
   * step with more fraction digits than the format keeps by default (0.0001)
   * makes the value keep them.
   */
  step?: number;
  /**
   * Content after the number, inside the border of the field - see the
   * `suffix` of `Input`.
   */
  suffix?: React.ReactNode;
  /** Value of a controlled field - `null` for an empty one. */
  value?: number | null;
}

/**
 * A number field that writes the number as the locale of `UIProvider` does
 * ("1 234,5" in Czech, "1,234.5" in English) while it has no focus, and
 * reads what the user types - also "1.5" in Czech. Step buttons, the arrow
 * keys, Page Up / Page Down and Home / End change the value; a form gets it
 * as a plain number ("1234.5") under `name`.
 */
export default function NumberInput({
  changeOnWheel = false,
  className,
  defaultValue,
  description,
  dim = "md",
  disabled,
  error,
  floating = false,
  form,
  formatOptions,
  hideStepper = false,
  id,
  inputMode,
  label,
  max,
  maximumFractionDigits,
  min,
  name,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
  onPointerDown,
  prefix,
  readOnly,
  ref,
  required,
  step,
  suffix,
  value: controlledValue,
  ...props
}: NumberInputProps) {
  const locale = useLocale();
  const messages = useMessages();
  const platform = useSyncExternalStore(
    noSubscription,
    getMobilePlatform,
    () => "other" as const,
  );

  // The value of a percentage is the fraction - a step of 1 would be 100 %
  const defaultStep = formatOptions?.style === "percent" ? 0.01 : 1;
  const stepSize =
    step !== undefined && Number.isFinite(step) && step > 0
      ? step
      : defaultStep;
  // A step finer than the digits of the format keeps its digits
  const numberFormat = getStepNumberFormat(
    locale.code,
    maximumFractionDigits === undefined
      ? formatOptions
      : { ...formatOptions, maximumFractionDigits },
    stepSize,
  );
  const allowsNegative = min === undefined || min < 0;

  // What the user entered into an uncontrolled field - until then, and
  // again after a reset, it shows `defaultValue`, like a native field does
  const [enteredValue, setEnteredValue] = useState<number | null>();
  const isControlled = controlledValue !== undefined;
  const value = toValue(
    isControlled
      ? controlledValue
      : enteredValue === undefined
        ? defaultValue
        : enteredValue,
  );

  // The text being typed - `null` while the field shows the value
  const [text, setText] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // A value from elsewhere - the parent, or a change it refused - replaces
  // the typed text
  if (text !== null && numberFormat.parse(text) !== value) setText(null);

  const displayText =
    text ??
    (value === null
      ? ""
      : isFocused
        ? numberFormat.toEditText(value)
        : numberFormat.format(value));

  const inputRef = useRef<HTMLInputElement | null>(null);
  // Set by a press on the input - its focus keeps the caret of the press,
  // one from the keyboard selects the text, as in a native field
  const pointerFocus = useRef(false);

  // A value out of `min` - `max` makes the form invalid, as in a native
  // number input: a typed one not yet moved into them (a form submitted
  // from a script while the field has the focus), or one of the parent
  const rangeMessage =
    value !== null && max !== undefined && value > max
      ? formatMessage(messages.numberInput.rangeOverflow, {
          max: numberFormat.format(max),
        })
      : value !== null && min !== undefined && value < min
        ? formatMessage(messages.numberInput.rangeUnderflow, {
            min: numberFormat.format(min),
          })
        : "";
  // The message the field set last - one the page set stays
  const rangeMessageRef = useRef("");

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    if (rangeMessage) input.setCustomValidity(rangeMessage);
    else if (input.validationMessage === rangeMessageRef.current) {
      input.setCustomValidity("");
    }
    rangeMessageRef.current = rangeMessage;
  }, [rangeMessage]);

  const generatedId = useId();
  const inputId = id ?? generatedId;

  const commitValue = (next: number | null) => {
    if (next === value) return;
    if (!isControlled) setEnteredValue(next);
    onChange?.(next);
  };

  // What leaving the field or Enter makes of the typed text: its value
  // within `min` - `max`, which the field then shows
  const commit = () => {
    if (text === null) return;

    const parsed = numberFormat.parse(text);
    setText(null);
    commitValue(parsed === null ? null : clamp(parsed, min, max));
  };

  /**
   * The value `count` steps from `current`, rounded as the format rounds -
   * a step up never lowers it, one down never raises it.
   */
  const stepFrom = (
    current: number | null,
    direction: 1 | -1,
    count: number,
  ) => {
    const next = clamp(
      numberFormat.round(
        stepValue(current, direction, count, { max, min, step: stepSize }),
      ),
      min,
      max,
    );
    const backwards =
      current !== null && (direction > 0 ? next < current : next > current);
    return backwards ? current : next;
  };

  /** Steps the value - returns whether it changed. */
  const stepBy = (direction: 1 | -1, count: number) => {
    if (disabled || readOnly) return false;

    // A typed text is where the step starts
    const current = text === null ? value : numberFormat.parse(text);
    const next = stepFrom(current, direction, count);

    setText(null);
    commitValue(next);
    return next !== current;
  };

  const jumpTo = (bound: number) => {
    setText(null);
    commitValue(clamp(numberFormat.round(bound), min, max));
  };

  // A form reset - also the one after a React form action - brings back the
  // `defaultValue` of an uncontrolled field
  const formResetRef = useFormReset(() => {
    setText(null);
    if (!isControlled) setEnteredValue(undefined);
  }, form);

  // The latest state for the listeners of the wheel and the step buttons,
  // which outlive a render - updated as the render commits
  const stepRef = useRef(stepBy);
  const wheelEnabled = changeOnWheel && !disabled && !readOnly;
  const wheelEnabledRef = useRef(wheelEnabled);

  useLayoutEffect(() => {
    stepRef.current = stepBy;
    wheelEnabledRef.current = wheelEnabled;
  });

  const inputCallbackRef = useCallback(
    (input: HTMLInputElement | null) => {
      inputRef.current = input;
      const detachReset = formResetRef(input);
      const detachRef = attachRef(ref, input);

      // React listens to the wheel passively - keeping the page from
      // scrolling needs a listener of its own
      const handleWheel = (event: WheelEvent) => {
        if (
          !wheelEnabledRef.current ||
          input?.ownerDocument.activeElement !== input ||
          // Pinch zoom, or a horizontal scroll
          event.ctrlKey ||
          Math.abs(event.deltaY) <= Math.abs(event.deltaX)
        ) {
          return;
        }

        event.preventDefault();
        // Rendered at once - the next event of a fast wheel steps on from
        // this value, not again from the one before
        flushSync(() => stepRef.current(event.deltaY < 0 ? 1 : -1, 1));
      };

      input?.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        inputRef.current = null;
        input?.removeEventListener("wheel", handleWheel);
        detachReset?.();
        detachRef();
      };
    },
    [formResetRef, ref],
  );

  // Holding a step button repeats the step
  const repeatTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Set by a press of a step button - its click then steps no more
  const pressed = useRef(false);

  const stopRepeat = () => clearTimeout(repeatTimer.current);

  useEffect(() => () => clearTimeout(repeatTimer.current), []);

  const pressStep = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: 1 | -1,
    canStep: boolean,
  ) => {
    if (event.button !== 0) return;

    // A mouse moves the focus into the field - a finger does not, the
    // on-screen keyboard would cover the page
    if (event.pointerType !== "touch") inputRef.current?.focus();
    // A button at a bound only looks disabled - it keeps the focus, and
    // steps no further (its click neither)
    if (!canStep) return;

    pressed.current = true;
    stepRef.current(direction, 1);

    const repeat = (delay: number) => {
      repeatTimer.current = setTimeout(() => {
        // Up to a bound
        if (stepRef.current(direction, 1)) repeat(REPEAT_INTERVAL);
      }, delay);
    };
    repeat(REPEAT_DELAY);

    // Released anywhere - also off the button
    const release = new AbortController();
    const handleRelease = () => {
      stopRepeat();
      release.abort();
      // The click of this press follows the release
      setTimeout(() => {
        pressed.current = false;
      });
    };
    const { ownerDocument } = event.currentTarget;
    ownerDocument.addEventListener("pointerup", handleRelease, release);
    ownerDocument.addEventListener("pointercancel", handleRelease, release);
  };

  // At a bound a button only looks disabled - a `disabled` one would let
  // the press that reached the bound move the focus out of the field. The
  // bound is where a step changes nothing - also the last step below a
  // `max` off the grid of the steps.
  const canIncrement = !readOnly && stepFrom(value, 1, 1) !== value;
  const canDecrement = !readOnly && stepFrom(value, -1, 1) !== value;

  const stepButton = (direction: 1 | -1) => {
    const isUp = direction > 0;
    const canStep = isUp ? canIncrement : canDecrement;

    return (
      <button
        aria-controls={inputId}
        aria-label={
          isUp ? messages.numberInput.increment : messages.numberInput.decrement
        }
        aria-disabled={!canStep || undefined}
        className={cn(
          "flex flex-1 items-center justify-center px-1 text-neutral-500 transition-colors motion-reduce:transition-none dark:text-neutral-400 pointer-coarse:px-2.5",
          // `enabled:` - a disabled fieldset around disables the buttons too
          canStep && !disabled
            ? "cursor-pointer enabled:hover:bg-neutral-100 enabled:hover:text-neutral-700 disabled:cursor-not-allowed dark:enabled:hover:bg-neutral-800 dark:enabled:hover:text-neutral-200"
            : "cursor-not-allowed",
          // A disabled field fades as a whole
          !canStep && !disabled && "opacity-40",
          !isUp &&
            "border-t border-neutral-300 dark:border-neutral-700 pointer-coarse:border-e pointer-coarse:border-t-0",
        )}
        disabled={disabled}
        // From the keyboard or assistive technology - the buttons are out of
        // the tab order, the arrow keys of the field step
        onClick={() => {
          if (!pressed.current && canStep) stepBy(direction, 1);
        }}
        // A press keeps the focus where it is
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => pressStep(event, direction, canStep)}
        onPointerLeave={stopRepeat}
        tabIndex={-1}
        type="button"
      >
        {/* Chevrons for a mouse, larger plus and minus for a finger */}
        {isUp ? (
          <ChevronUp
            aria-hidden="true"
            className="pointer-coarse:hidden"
            size={chevronSizes[dim]}
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="pointer-coarse:hidden"
            size={chevronSizes[dim]}
          />
        )}
        {isUp ? (
          <Plus
            aria-hidden="true"
            className="hidden pointer-coarse:block"
            size={signSizes[dim]}
          />
        ) : (
          <Minus
            aria-hidden="true"
            className="hidden pointer-coarse:block"
            size={signSizes[dim]}
          />
        )}
      </button>
    );
  };

  const stepper = (
    <div
      className="flex shrink-0 flex-col self-stretch overflow-hidden rounded-e-[calc(var(--radius-md)-1px)] border-s border-neutral-300 dark:border-neutral-700 pointer-coarse:flex-row-reverse"
      // Holding a button repeats the step - no context menu over it
      onContextMenu={(event) => event.preventDefault()}
    >
      {stepButton(1)}
      {stepButton(-1)}
    </div>
  );

  return (
    <>
      {/* The form gets the plain number, not the text of the field */}
      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          readOnly
          type="hidden"
          value={value === null ? "" : toCanonical(value)}
        />
      )}
      <InputBase
        autoComplete="off"
        {...props}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? undefined : numberFormat.format(value)}
        autoCorrect="off"
        className={className}
        controls={hideStepper ? undefined : stepper}
        description={description}
        dim={dim}
        disabled={disabled}
        error={error}
        floating={floating}
        form={form}
        id={inputId}
        inputMode={
          inputMode ??
          inputModeFor(
            platform,
            numberFormat.fractionDigits > 0,
            allowsNegative,
          )
        }
        label={label}
        onBlur={(event) => {
          setIsFocused(false);
          commit();
          onBlur?.(event);
        }}
        onChange={(event) => {
          const input = event.currentTarget;

          if (!numberFormat.isPartial(input.value, allowsNegative)) {
            revertInput(input, displayText);
            return;
          }

          setText(input.value);
          commitValue(numberFormat.parse(input.value));
        }}
        onFocus={(event) => {
          setIsFocused(true);

          // The value is edited without grouping and symbols - written into
          // the input at once, so that the caret of a click lands in it
          const input = event.currentTarget;
          const editText =
            text === null && value !== null
              ? numberFormat.toEditText(value)
              : input.value;

          if (input.value !== editText) {
            input.value = editText;
            if (!pointerFocus.current) input.select();
          }
          pointerFocus.current = false;
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          // The caller's handler first - preventing the default skips ours
          onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            // The keys of an input method editor (IME) composing text -
            // the arrows pick a candidate, Enter confirms it (Safari sends
            // that Enter after `compositionend`, with the key code 229)
            event.nativeEvent.isComposing ||
            event.keyCode === 229
          ) {
            return;
          }

          if (event.key === "Enter") {
            // The value is complete before the form reads it - Enter still
            // submits the form
            flushSync(commit);
            return;
          }

          // Shift + Home & co. select text
          if (event.shiftKey) return;

          let handled = true;
          switch (event.key) {
            case "ArrowUp":
              stepBy(1, 1);
              break;
            case "ArrowDown":
              stepBy(-1, 1);
              break;
            case "PageUp":
              stepBy(1, PAGE_STEPS);
              break;
            case "PageDown":
              stepBy(-1, PAGE_STEPS);
              break;
            // Without the bound Home and End move the caret
            case "Home":
              if (min === undefined || disabled || readOnly) handled = false;
              else jumpTo(min);
              break;
            case "End":
              if (max === undefined || disabled || readOnly) handled = false;
              else jumpTo(max);
              break;
            default:
              handled = false;
          }
          if (handled) event.preventDefault();
        }}
        onPointerDown={(event) => {
          const input = event.currentTarget;
          pointerFocus.current = input !== input.ownerDocument.activeElement;
          onPointerDown?.(event);
        }}
        prefix={prefix}
        readOnly={readOnly}
        ref={inputCallbackRef}
        required={required}
        role="spinbutton"
        spellCheck={false}
        suffix={suffix}
        type="text"
        value={displayText}
      />
    </>
  );
}
