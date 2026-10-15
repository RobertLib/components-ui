import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { attachRef, useFormReset } from "../../../hooks/use-form-control";
import useCustomValidity from "../../../hooks/use-custom-validity";
import { formatMessage } from "../../../i18n/ui/format";
import { useLocale, useMessages } from "../../../providers/ui-context";
import { joinTokens } from "../../../utils/cn";
import logger from "../../../utils/logger";
import FormError from "../form-error";
import { useReadOnly } from "../form-scope";
import { InputBase } from "../input";
import { stepValue } from "../number-input/number-format";
import { getActiveElement } from "../overlay-stack";
import { getDurationFormat, parseIsoDuration, toIsoDuration } from "./duration";

const DEFAULT_STEP = 15;
// Page Up / Page Down step about this many minutes
const PAGE_MINUTES = 60;
// The example durations of the message under an unreadable text - 1:30
const EXAMPLE_MINUTES = 90;

type ValueFormat = "iso" | "minutes" | "seconds";

// `min`, `max` and `step` are minutes whatever the value format is
interface DurationInputBaseProps extends Omit<
  React.ComponentProps<"input">,
  | "defaultValue"
  | "max"
  | "min"
  | "onChange"
  | "prefix"
  | "step"
  | "type"
  | "value"
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
  /**
   * Adds a button that empties the field while it has a value - not while
   * it is disabled or read-only. `onChange` gets `null`, and the focus
   * moves into the field.
   */
  clearable?: boolean;
  /**
   * The unit of a whole number typed without one - "90" is 90 minutes by
   * default, with `"hours"` "8" is 8 hours. A number with a fraction ("1,5")
   * is always hours.
   */
  defaultUnit?: "hours" | "minutes";
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field. */
  dim?: "xs" | "sm" | "md" | "lg";
  /**
   * How the field writes the duration: `"clock"` (default) as hours and
   * minutes - "1:30", "0:45", "125:00"; `"units"` with the units of the
   * locale of `UIProvider` - "1 h 30 min" in Czech, "1 hr 30 min" in
   * English. Either can be typed whatever it shows.
   */
  display?: "clock" | "units";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Places the label inside the field, floating up once it has a value. */
  floating?: boolean;
  /**
   * The `<label>` of the field - a text, or content like a text with an
   * icon. Without a label give the field an `aria-label`.
   */
  label?: React.ReactNode;
  /**
   * The longest duration in minutes - End sets it, and a longer typed one
   * is shortened to it when the field loses the focus. A longer value the
   * field holds meanwhile (typed, or from the parent) makes the form
   * invalid, as it does a native number input: the browser refuses to
   * submit it and says why.
   */
  max?: number;
  /**
   * The shortest duration in minutes - 0 by default, as a duration cannot
   * be negative. Home sets it when given, and a shorter typed one is
   * lengthened to it when the field loses the focus (a shorter value
   * meanwhile makes the form invalid, see `max`).
   */
  min?: number;
  /**
   * Content before the duration, inside the border of the field - see the
   * `prefix` of `Input`.
   */
  prefix?: React.ReactNode;
  /**
   * What the arrow keys and the wheel add or take away, in whole minutes -
   * 15 by default. Page Up and Page Down step about an hour: the whole
   * number of steps nearest to 60 minutes, at least one. The steps count
   * from `min` (or 0), as those of a native number input: a value between
   * two steps moves to the next one.
   */
  step?: number;
  /**
   * Content after the duration, inside the border of the field - see the
   * `suffix` of `Input`.
   */
  suffix?: React.ReactNode;
}

/** A value in minutes. */
interface MinutesValueProps {
  /**
   * Initial value of an uncontrolled field - minutes (seconds with
   * `valueFormat="seconds"`, an ISO 8601 text with `"iso"`), `null` for an
   * empty one.
   */
  defaultValue?: number | null;
  /**
   * Called with the new value - `null` for an empty field: when the typed
   * text is taken (the field loses the focus, or Enter), for every step,
   * and at once when the field is emptied (also by the clear button).
   * The hidden input of an uncontrolled field holds the value by then.
   */
  onChange?: (value: number | null) => void;
  /**
   * Value of a controlled field - minutes (seconds with
   * `valueFormat="seconds"`, an ISO 8601 text with `"iso"`), `null` for an
   * empty one.
   */
  value?: number | null;
  /**
   * What `value`, `defaultValue`, `onChange` and the form work with:
   * `"minutes"` (default) a number of minutes; `"seconds"` a number of
   * seconds - still edited in whole minutes, so a value between them is
   * rounded to the nearest one (shown, submitted and stepped so); `"iso"`
   * an ISO 8601 duration text, "PT1H30M" ("PT0S" for none) - it also reads
   * "PT90M", "P1DT2H" (a day of 24 hours) and fractions, not years or
   * months, which have no fixed length. `min`, `max` and `step` are minutes
   * in each.
   */
  valueFormat?: "minutes";
}

/** A value in seconds - edited in whole minutes. */
interface SecondsValueProps {
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  value?: number | null;
  valueFormat: "seconds";
}

/** A value as an ISO 8601 duration - "PT1H30M". */
interface IsoValueProps {
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  value?: string | null;
  valueFormat: "iso";
}

export type DurationInputProps = DurationInputBaseProps &
  (MinutesValueProps | SecondsValueProps | IsoValueProps);

/**
 * The duration format of the locale of `UIProvider` - from a hook, so that
 * the React Compiler takes the shared object as one that does not change:
 * calling its methods would otherwise count as changing it, and nothing
 * read from it could be memoized apart.
 */
function useDurationFormat() {
  return getDurationFormat(useLocale().code);
}

const clamp = (value: number, min: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min, value));

/** Minutes of a value in `valueFormat` - `null` for none or a wrong one. */
function toMinutes(
  value: number | string | null | undefined,
  valueFormat: ValueFormat,
) {
  if (valueFormat === "iso") {
    return typeof value === "string" ? parseIsoDuration(value) : null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return valueFormat === "seconds" ? value / 60 : value;
}

/** Whole minutes as a value in `valueFormat`. */
function fromMinutes(minutes: number | null, valueFormat: ValueFormat) {
  if (minutes === null) return null;
  if (valueFormat === "iso") return toIsoDuration(minutes);
  return valueFormat === "seconds" ? minutes * 60 : minutes;
}

/**
 * A field for a duration - the time of a work report, the response time of
 * an SLA. It shows hours and minutes ("1:30", or "1 h 30 min" with
 * `display="units"`) and reads what the user types: "1:30", ":45", "1,5"
 * (hours), "90" (minutes), "1h 30m", "1 hodina 30 minut", "PT1H30M". The
 * arrow keys step it, and a form gets minutes ("90"), seconds or an ISO
 * 8601 duration under `name`.
 */
export default function DurationInput({
  "aria-describedby": ariaDescribedBy,
  changeOnWheel = false,
  className,
  clearable = false,
  defaultUnit = "minutes",
  defaultValue,
  description,
  dim = "md",
  disabled,
  display = "clock",
  error,
  floating = false,
  form,
  id,
  label,
  max: maxProp,
  min: minProp,
  name,
  onBlur,
  onChange,
  onKeyDown,
  prefix,
  readOnly: ownReadOnly,
  ref,
  required,
  step,
  suffix,
  value: controlledValue,
  valueFormat = "minutes",
  ...props
}: DurationInputProps) {
  const readOnly = useReadOnly(ownReadOnly);
  const messages = useMessages().ui.durationInput;
  const durationFormat = useDurationFormat();

  // Whole minutes - no negative durations
  const min = Math.max(
    0,
    minProp !== undefined && Number.isFinite(minProp) ? Math.ceil(minProp) : 0,
  );
  const max =
    maxProp !== undefined && Number.isFinite(maxProp)
      ? Math.floor(maxProp)
      : undefined;
  const stepSize =
    step !== undefined && Number.isFinite(step) && step >= 1
      ? Math.round(step)
      : DEFAULT_STEP;
  const pageSteps = Math.max(1, Math.round(PAGE_MINUTES / stepSize));

  // The minutes the user entered into an uncontrolled field - until then,
  // and again after a reset, it shows `defaultValue`, like a native field
  const [enteredValue, setEnteredValue] = useState<number | null>();
  const isControlled = controlledValue !== undefined;
  const sourceMinutes = isControlled
    ? toMinutes(controlledValue, valueFormat)
    : enteredValue === undefined
      ? toMinutes(defaultValue, valueFormat)
      : enteredValue;
  // Edited in whole minutes - submission, validation and stepping all use
  // the minutes the field shows
  const value = sourceMinutes === null ? null : Math.round(sourceMinutes) || 0;

  // An ISO text it cannot read leaves the field empty - say why
  const suppliedValue = isControlled ? controlledValue : defaultValue;
  const unreadable =
    typeof suppliedValue === "string" &&
    suppliedValue.trim() !== "" &&
    parseIsoDuration(suppliedValue) === null
      ? suppliedValue
      : null;
  useEffect(() => {
    if (unreadable !== null) {
      logger.warn(
        `DurationInput: "${unreadable}" is no ISO 8601 duration in weeks, days, hours, minutes and seconds - the field is empty.`,
      );
    }
  }, [unreadable]);

  // The text being typed - `null` while the field shows the value. A new
  // value (of the parent, a step, a reset) replaces it.
  const [text, setText] = useState<string | null>(null);
  const [textValue, setTextValue] = useState(value);
  // The last typed text the field dropped - said under the field until the
  // typing goes on or the value changes
  const [rejected, setRejected] = useState<{
    error: "invalid" | "negative";
    text: string;
  } | null>(null);

  if (value !== textValue) {
    setTextValue(value);
    setText(null);
    setRejected(null);
  }

  const shownText = value === null ? "" : durationFormat.format(value, display);
  // The typed text is read on every keystroke - the form and its validity
  // follow it before the field takes it as the value
  const draft = text === null ? null : durationFormat.parse(text, defaultUnit);
  // The minutes of a readable typed text - `undefined` without one
  const typedMinutes =
    draft !== null && "minutes" in draft ? draft.minutes : undefined;
  const formMinutes = draft === null ? value : (typedMinutes ?? null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const rejectedId = `${inputId}-rejected`;

  const describeRejection = (reason: "invalid" | "negative", typed: string) =>
    formatMessage(
      reason === "negative" ? messages.negativeText : messages.invalidText,
      {
        clock: durationFormat.format(EXAMPLE_MINUTES, "clock"),
        text: typed,
        units: durationFormat.format(EXAMPLE_MINUTES, "units"),
      },
    );

  // A value out of `min` - `max` makes the form invalid, as in a native
  // number input: a typed one not yet moved into them (a form submitted
  // from a script while the field has the focus), or one of the parent -
  // also one whose excess the rounding to whole minutes hides
  const isAbove = (limit: number) =>
    formMinutes !== null &&
    (formMinutes > limit ||
      (draft === null && sourceMinutes !== null && sourceMinutes > limit));
  const isBelow = (limit: number) =>
    formMinutes !== null &&
    (formMinutes < limit ||
      (draft === null && sourceMinutes !== null && sourceMinutes < limit));
  const validityMessage =
    draft !== null && "error" in draft
      ? describeRejection(draft.error, text?.trim() ?? "")
      : max !== undefined && isAbove(max)
        ? formatMessage(messages.rangeOverflow, {
            max: durationFormat.format(max, display),
          })
        : isBelow(min)
          ? formatMessage(messages.rangeUnderflow, {
              min: durationFormat.format(min, display),
            })
          : "";
  // A draft may fail its constraints for a while - an error the page set
  // stays meanwhile
  const validityProps = useCustomValidity(
    inputRef,
    validityMessage,
    text !== null,
  );

  const commitValue = (next: number | null) => {
    if (next === sourceMinutes) return;
    // The hidden input holds the value before `onChange`, which may submit
    // the form. A controlled parent can only render it after `onChange`.
    if (!isControlled) flushSync(() => setEnteredValue(next));
    // Typed by the union of the value formats - `valueFormat` picks the one
    (onChange as ((value: number | string | null) => void) | undefined)?.(
      fromMinutes(next, valueFormat),
    );
  };

  const isInRange = (next: number) =>
    next >= min && (max === undefined || next <= max);

  /**
   * What leaving the field or Enter makes of the typed text: its value
   * within `min` - `max`, which the field then shows - or nothing, and a
   * message under the field. Returns whether the text was taken.
   */
  const commit = () => {
    if (text === null) return true;
    setText(null);

    const parsed = durationFormat.parse(text, defaultUnit);
    if ("error" in parsed) {
      setRejected({ error: parsed.error, text: text.trim() });
      return false;
    }

    const next =
      parsed.minutes === null ? null : clamp(parsed.minutes, min, max);
    // With a `min` above `max` no value is in range - keep the one there is
    if (next === null || isInRange(next)) commitValue(next);
    return true;
  };

  /**
   * The value `count` steps from `current` - a step up never lowers it, one
   * down never raises it.
   */
  const stepFrom = (
    current: number | null,
    direction: 1 | -1,
    count: number,
  ) => {
    const next = stepValue(current, direction, count, {
      max,
      min,
      step: stepSize,
    });
    const backwards =
      current !== null && (direction > 0 ? next < current : next > current);
    return backwards || !isInRange(next) ? current : next;
  };

  const stepBy = (direction: 1 | -1, count: number) => {
    // An already running wheel can reach a field disabled by its fieldset.
    // Check the DOM too, including changes since the latest render.
    if (disabled || readOnly || inputRef.current?.matches(":disabled")) return;

    // A typed duration is where the step starts - moved into `min` - `max`
    // as when it is taken. An unreadable one gives way to the value.
    const start =
      typedMinutes === undefined || typedMinutes === null
        ? typedMinutes
        : clamp(typedMinutes, min, max);
    const current =
      start === undefined || (start !== null && !isInRange(start))
        ? value
        : start;

    setText(null);
    setRejected(null);
    commitValue(stepFrom(current, direction, count));
  };

  const jumpTo = (bound: number) => {
    setText(null);
    setRejected(null);
    const next = clamp(bound, min, max);
    if (isInRange(next)) commitValue(next);
  };

  // A form reset - also the one after a React form action - brings back the
  // `defaultValue` of an uncontrolled field, and drops a typed text
  const formResetRef = useFormReset(() => {
    setText(null);
    setRejected(null);
    if (!isControlled) setEnteredValue(undefined);
  }, form);

  // The latest state for the wheel listener, which outlives a render -
  // updated as the render commits
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
          input?.matches(":disabled") ||
          getActiveElement(input?.ownerDocument) !== input ||
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

  return (
    <div className="flex flex-col gap-1.5">
      {/* The form gets the value in its format, not the text of the field */}
      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          readOnly
          type="hidden"
          value={
            formMinutes === null
              ? ""
              : String(fromMinutes(formMinutes, valueFormat))
          }
        />
      )}
      <InputBase
        autoComplete="off"
        {...props}
        aria-describedby={joinTokens(rejected && rejectedId, ariaDescribedBy)}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value ?? undefined}
        aria-valuetext={
          value === null ? undefined : durationFormat.formatLong(value)
        }
        autoCorrect="off"
        className={className}
        clearable={clearable}
        description={description}
        dim={dim}
        disabled={disabled}
        error={error}
        floating={floating}
        form={form}
        id={inputId}
        {...validityProps}
        label={label}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        onChange={(event) => {
          const typed = event.currentTarget.value;
          const isEmpty = typed.trim() === "";
          // Spaces alone are no text - `required` sees the field empty
          setText(isEmpty ? "" : typed);
          setRejected(null);
          // An emptied field has no value at once - also one the clear
          // button emptied, which keeps the focus
          if (isEmpty) commitValue(null);
        }}
        onKeyDown={(event) => {
          // The caller's handler first - preventing the default skips ours
          onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.currentTarget.matches(":disabled") ||
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
            // submits the form, unless the text was dropped: the message
            // under the field says why first
            if (!flushSync(commit)) event.preventDefault();
            return;
          }

          if (event.key === "Escape") {
            // Back to the value - an Escape without a typed text is left to
            // a dialog around
            if (text === null) return;
            event.preventDefault();
            setText(null);
            setRejected(null);
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
              stepBy(1, pageSteps);
              break;
            case "PageDown":
              stepBy(-1, pageSteps);
              break;
            // Without a bound given Home and End move the caret
            case "Home":
              if (minProp === undefined || disabled || readOnly) {
                handled = false;
              } else {
                jumpTo(min);
              }
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
        prefix={prefix}
        readOnly={readOnly}
        ref={inputCallbackRef}
        required={required}
        role="spinbutton"
        spellCheck={false}
        suffix={suffix}
        type="text"
        value={text ?? shownText}
      />
      {/* Announced as the field shows its value again */}
      <FormError id={rejectedId}>
        {rejected && describeRejection(rejected.error, rejected.text)}
      </FormError>
    </div>
  );
}
