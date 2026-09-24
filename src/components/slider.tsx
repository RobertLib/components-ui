import {
  attachRef,
  useFieldsetDisabled,
  useFormReset,
} from "../hooks/use-form-control";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { formatMessage, formatNumber } from "../i18n/format";
import { useLocale } from "../providers/ui-context";

/** A single value, or a range - its start and its end. */
export type SliderValue = number | [number, number];

export interface SliderMark {
  /** Where the mark is - between `min` and `max`. */
  value: number;
  /** Text under the mark. */
  label?: React.ReactNode;
}

export interface SliderProps<T extends SliderValue = number> {
  /**
   * Id of the element describing the slider - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a slider without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a slider without `label`. */
  "aria-labelledby"?: string;
  /**
   * Classes of the slider itself - its track, thumbs and marks, not the
   * label or the messages. Give a vertical slider its height here (`h-48`
   * by default).
   */
  className?: string;
  /**
   * Initial value of an uncontrolled slider - `[start, end]` makes it a
   * range. Defaults to `min`.
   */
  defaultValue?: T;
  /** Help text under the slider - it describes it. */
  description?: React.ReactNode;
  /**
   * Disables the slider - it is then neither submitted nor focusable. A
   * disabled `<fieldset>` around it disables it too, as a native field.
   */
  disabled?: boolean;
  /** Validation message - also marks the slider as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the hidden inputs belong to, when the slider is not
   * inside it - like the `form` attribute of a native field. A reset of
   * that form resets the slider too.
   */
  form?: string;
  /**
   * Text of a value - in the value label, next to the label (`showValue`)
   * and for screen readers (`aria-valuetext`). The number in the format of
   * the locale by default.
   */
  formatValue?: (value: number) => string;
  /**
   * Id of the first thumb - the ids of the messages derive from it.
   */
  id?: string;
  /** Text above the slider - the name of its thumbs. */
  label?: string;
  /** Marks along the track, with an optional label under each. */
  marks?: SliderMark[];
  /** The highest value. */
  max?: number;
  /** Range only: the least distance between the start and the end. */
  minDistance?: number;
  /** The lowest value. */
  min?: number;
  /**
   * Submits the value in a hidden input of this name. A range submits two
   * values under it, the start first - `formData.getAll(name)` returns
   * both (name it `price[]` for a backend that needs the brackets).
   */
  name?: string;
  /** Called when the focus leaves the thumbs. */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  /** Called with the new value as it changes - with every step of a drag. */
  onChange?: (value: T) => void;
  /**
   * Called with the value once a change is done - the pointer released,
   * or a key pressed. For work too heavy for every step of a drag, like
   * loading data.
   */
  onChangeEnd?: (value: T) => void;
  /** Called when the focus moves into the thumbs. */
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  /** `vertical` - the value grows upwards. */
  orientation?: "horizontal" | "vertical";
  /** Ref to the first thumb - e.g. for `focus()`. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Marks the label as required. A slider always has a value, so the form
   * never misses it.
   */
  required?: boolean;
  /** Shows the value next to the label. */
  showValue?: boolean;
  /** Size of the track and the thumbs. */
  size?: "sm" | "md" | "lg";
  /**
   * The values lie on steps of this size from `min` - a drag and the arrow
   * keys move by it, Page Up / Page Down by a tenth of the range.
   */
  step?: number;
  /** Value of a controlled slider - `[start, end]` makes it a range. */
  value?: T;
  /**
   * When the value shows above a thumb (beside it in a vertical slider):
   * `auto` - while it is dragged, hovered or has the keyboard focus, like a
   * tooltip over what is around; `always` - with room kept for it above
   * the track; or `never`.
   */
  valueLabel?: "auto" | "always" | "never";
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** The decimal places of a number, e.g. of a step like 0.25. */
function countDecimals(value: number) {
  const [digits, exponent] = String(value).split("e-");
  const fraction = digits.split(".")[1]?.length ?? 0;
  return fraction + (exponent ? Number(exponent) : 0);
}

/**
 * `value` on the nearest step from `min` - without the noise of floating
 * point arithmetic (0.1 + 0.2).
 */
function snapToStep(
  value: number,
  min: number,
  step: number,
  decimals: number,
) {
  if (!(step > 0)) return value;
  const snapped = min + Math.round((value - min) / step) * step;
  return Number(snapped.toFixed(decimals));
}

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Whether a press may move a thumb: the primary button of the primary
 * pointer - not a right click nor the Ctrl + click that opens the context
 * menu on a Mac.
 */
function isPrimaryPress(event: React.PointerEvent) {
  if (event.button !== 0 || !event.isPrimary) return false;
  return !(event.ctrlKey && isMac());
}

/** Pixels a finger may move before its press is no tap. */
const TAP_SLOP = 8;

/**
 * What a move of a finger pressed on the track is: `jitter` - too small to
 * tell, `across` - across the track, a scroll of the page the browser takes
 * over, or `along` - along the track, a drag.
 */
function classifyFingerMove(dx: number, dy: number, vertical: boolean) {
  if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return "jitter";
  const along = Math.abs(vertical ? dy : dx);
  const across = Math.abs(vertical ? dx : dy);
  return along > across ? "along" : "across";
}

function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // A pointer that is gone already
  }
}

interface PointerFollower {
  /** The pointer moved, still pressed. */
  onMove: (clientX: number, clientY: number) => void;
  /**
   * The drag is over - released at the given point, or `null` when the
   * browser took the pointer over (a finger scrolling the page) or its
   * release got lost.
   */
  onEnd: (release: { clientX: number; clientY: number } | null) => void;
  /** Escape was pressed during the drag - it ends too. */
  onEscape: () => void;
}

/**
 * Follows a press until the pointer is released - only the pressed
 * pointer, so a second finger does not take the drag over. Returns what
 * stops following it, e.g. when the slider unmounts.
 */
function followPointer(
  event: React.PointerEvent,
  { onEnd, onEscape, onMove }: PointerFollower,
) {
  const { pointerId } = event;
  // The moves and the release come to the slider even off it
  capturePointer(event.currentTarget, pointerId);

  const stop = () => {
    document.removeEventListener("pointermove", handleMove);
    document.removeEventListener("pointerup", handleUp);
    document.removeEventListener("pointercancel", handleCancel);
    window.removeEventListener("keydown", handleKeyDown, true);
  };

  function handleMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;

    // No button is pressed - the release went elsewhere, e.g. to a context
    // menu
    if (moveEvent.buttons === 0) {
      stop();
      onEnd(null);
      return;
    }

    onMove(moveEvent.clientX, moveEvent.clientY);
  }

  function handleUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    stop();
    onEnd({ clientX: upEvent.clientX, clientY: upEvent.clientY });
  }

  function handleCancel(cancelEvent: PointerEvent) {
    if (cancelEvent.pointerId !== pointerId) return;
    stop();
    onEnd(null);
  }

  function handleKeyDown(keyEvent: KeyboardEvent) {
    if (keyEvent.key !== "Escape") return;
    // It ends the drag and nothing else - not a Dialog around
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    stop();
    onEscape();
  }

  document.addEventListener("pointermove", handleMove);
  document.addEventListener("pointerup", handleUp);
  document.addEventListener("pointercancel", handleCancel);
  // Before the key handlers of the page and the overlays
  window.addEventListener("keydown", handleKeyDown, true);

  return stop;
}

const sizeStyles = {
  sm: {
    rail: "h-1",
    railVertical: "w-1",
    thumb: "size-3.5",
    // Half a thumb - the thumbs at the ends stay inside the slider
    inset: "mx-1.75",
    insetVertical: "my-1.75",
  },
  md: {
    rail: "h-1.5",
    railVertical: "w-1.5",
    thumb: "size-4.5",
    inset: "mx-2.25",
    insetVertical: "my-2.25",
  },
  lg: {
    rail: "h-2",
    railVertical: "w-2",
    thumb: "size-5.5",
    inset: "mx-2.75",
    insetVertical: "my-2.75",
  },
};

/**
 * A value - or a range of two - picked by dragging a thumb along a track.
 * Keyboard: the arrow keys move by a `step`, Page Up / Page Down by a
 * tenth of the range, Home / End to the ends. A press on the track moves
 * the nearest thumb there; the thumbs of a range do not cross.
 */
export default function Slider<T extends SliderValue = number>({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  description,
  disabled: disabledProp = false,
  error,
  form,
  formatValue,
  id,
  label,
  marks,
  max = 100,
  min = 0,
  minDistance = 0,
  name,
  onBlur,
  onChange,
  onChangeEnd,
  onFocus,
  orientation = "horizontal",
  ref,
  required = false,
  showValue = false,
  size = "md",
  step = 1,
  value,
  valueLabel = "auto",
}: SliderProps<T>) {
  const locale = useLocale();
  const { messages } = locale;

  // The thumbs are no native fields - a disabled fieldset around them
  // leaves them alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;

  // What the user set in an uncontrolled slider. Until then, and again after
  // a reset, it shows `defaultValue` - also one that arrived late.
  const [enteredValues, setEnteredValues] = useState<number[]>();
  const isControlled = value !== undefined;
  const isRange = Array.isArray(value ?? defaultValue);
  const shown: SliderValue = value ?? defaultValue ?? min;
  const values = (
    enteredValues && !isControlled
      ? enteredValues
      : Array.isArray(shown)
        ? [shown[0], shown[1]]
        : [shown]
  )
    .map((thumbValue) => clamp(thumbValue, min, max))
    .sort((a, b) => a - b);

  const decimals = Math.max(countDecimals(step), countDecimals(min));
  // A tenth of the range, in whole steps
  const pageStep = Math.max(1, Math.round((max - min) / 10 / step)) * step;
  const vertical = orientation === "vertical";
  const styles = sizeStyles[size];

  const format = (thumbValue: number) =>
    formatValue
      ? formatValue(thumbValue)
      : formatNumber(locale.code, thumbValue);
  const percent = (thumbValue: number) =>
    max > min ? ((thumbValue - min) / (max - min)) * 100 : 0;

  const generatedId = useId();
  const sliderId = id ?? generatedId;
  const labelId = `${sliderId}-label`;
  const errorId = error ? `${sliderId}-error` : undefined;
  const descriptionId = description ? `${sliderId}-description` : undefined;
  const describedBy = cn(errorId, descriptionId, ariaDescribedBy);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`
  const formResetRef = useFormReset(() => setEnteredValues(undefined), form);

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

  const firstThumbRef = useCallback(
    (element: HTMLDivElement | null) => attachRef(ref, element),
    [ref],
  );

  const railRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  // The thumb being dragged - it shows its value
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const report = (nextValues: number[]) =>
    (isRange ? [nextValues[0], nextValues[1]] : nextValues[0]) as T;

  const commit = (nextValues: number[]) => {
    if (!isControlled) setEnteredValues(nextValues);
    onChange?.(report(nextValues));
  };

  // Where a thumb may go - the thumbs of a range keep `minDistance` apart
  const boundsOf = (index: number): [number, number] =>
    !isRange
      ? [min, max]
      : index === 0
        ? [min, values[1] - minDistance]
        : [values[0] + minDistance, max];

  /** Moves a thumb to `target` - returns the new values, `null` for no change. */
  const moveThumb = (index: number, target: number) => {
    const [low, high] = boundsOf(index);
    // Also a drag of a slider disabled meanwhile stops
    if (disabled || low > high) return null;

    const next = clamp(snapToStep(target, min, step, decimals), low, high);
    if (next === values[index]) return null;

    const nextValues = values.map((thumbValue, i) =>
      i === index ? next : thumbValue,
    );
    commit(nextValues);
    return nextValues;
  };

  // A drag outlives the render that started it - its listeners call the
  // functions of the latest render, which know the latest value
  const latest = useRef({ commit, moveThumb, onChangeEnd, report });

  useLayoutEffect(() => {
    latest.current = { commit, moveThumb, onChangeEnd, report };
  });

  const stopDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => stopDrag.current?.(), []);

  const getThumb = (index: number) =>
    railRef.current?.querySelectorAll<HTMLElement>("[role='slider']")[index];

  /** The value at a point of the page - the track is measured then. */
  const valueAt = (clientX: number, clientY: number, rtl: boolean) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return min;

    const ratio = vertical
      ? (rect.bottom - clientY) / rect.height
      : (clientX - rect.left) / rect.width;
    // A track without a size (not laid out) has no point to measure
    const along = Number.isFinite(ratio) ? clamp(ratio, 0, 1) : 0;
    return min + (rtl && !vertical ? 1 - along : along) * (max - min);
  };

  const nearestThumb = (target: number) => {
    if (!isRange) return 0;
    const [start, end] = values;
    // Thumbs on the same spot - the one on the side of the press
    if (start === end) return target < start ? 0 : 1;
    return Math.abs(target - start) <= Math.abs(target - end) ? 0 : 1;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !isPrimaryPress(event)) return;

    const pressed =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[role='slider']")
        : null;
    const pressedIndex =
      pressed && event.currentTarget.contains(pressed)
        ? Number(pressed.dataset.index)
        : null;
    const rtl = isRtl(event.currentTarget);
    const target = valueAt(event.clientX, event.clientY, rtl);
    // The thumbs of a range on the same spot - the first move decides which
    // of them it drags
    let undecided = isRange && pressedIndex !== null && values[0] === values[1];
    let index = pressedIndex ?? nearestThumb(target);
    // A finger on the track may be scrolling the page - it moves the thumb
    // once it moves along the track, or when it lifts without moving (a
    // tap). Until the browser takes a scroll over, its first moves come here.
    const waitForTap = pressedIndex === null && event.pointerType === "touch";
    let waiting = waitForTap;
    let scrolling = false;
    const origin = { x: event.clientX, y: event.clientY };

    // No text selection - and the focus goes to the thumb, not the page
    event.preventDefault();
    getThumb(index)?.focus({ preventScroll: true });

    const startValues = values;
    let lastValues = values;

    if (pressedIndex === null && !waitForTap) {
      lastValues = moveThumb(index, target) ?? lastValues;
    }
    if (!waitForTap) setDraggedIndex(index);

    stopDrag.current?.();
    stopDrag.current = followPointer(event, {
      onEnd: (release) => {
        stopDrag.current = null;
        if (release && waiting && !scrolling) {
          lastValues =
            latest.current.moveThumb(
              index,
              valueAt(release.clientX, release.clientY, rtl),
            ) ?? lastValues;
        }
        setDraggedIndex(null);
        if (lastValues !== startValues) {
          latest.current.onChangeEnd?.(latest.current.report(lastValues));
        }
      },
      onEscape: () => {
        stopDrag.current = null;
        setDraggedIndex(null);
        // Back to where the drag started
        if (lastValues !== startValues) latest.current.commit(startValues);
      },
      onMove: (clientX, clientY) => {
        if (waiting) {
          // A move across the track stays a scroll, and no tap
          if (scrolling) return;
          const move = classifyFingerMove(
            clientX - origin.x,
            clientY - origin.y,
            vertical,
          );
          if (move === "jitter") return;
          if (move === "across") {
            scrolling = true;
            return;
          }
          waiting = false;
        }

        const point = valueAt(clientX, clientY, rtl);
        if (undecided) {
          if (point === startValues[0]) return;
          index = point > startValues[0] ? 1 : 0;
          undecided = false;
          getThumb(index)?.focus({ preventScroll: true });
        }
        setDraggedIndex(index);
        lastValues = latest.current.moveThumb(index, point) ?? lastValues;
      },
    });
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (disabled) return;

    const current = values[index];
    // Right is back in a right-to-left page
    const forward = !vertical && isRtl(event.currentTarget) ? -step : step;
    const target =
      event.key === "ArrowRight"
        ? current + forward
        : event.key === "ArrowLeft"
          ? current - forward
          : event.key === "ArrowUp"
            ? current + step
            : event.key === "ArrowDown"
              ? current - step
              : event.key === "PageUp"
                ? current + pageStep
                : event.key === "PageDown"
                  ? current - pageStep
                  : event.key === "Home"
                    ? min
                    : event.key === "End"
                      ? max
                      : undefined;
    if (target === undefined) return;

    event.preventDefault();
    const nextValues = moveThumb(index, target);
    if (nextValues) onChangeEnd?.(report(nextValues));
  };

  const isOwnElement = (node: EventTarget | null) =>
    node instanceof Node && !!controlRef.current?.contains(node);

  // The name of the slider - of both thumbs of a range, each with a word
  // of its own after it (a hidden element, so `aria-label` joins it too)
  const nameId = label
    ? labelId
    : (ariaLabelledBy ?? (ariaLabel ? `${sliderId}-name` : undefined));
  const thumbNameIds = [`${sliderId}-start`, `${sliderId}-end`];

  const labeledMarks = (marks ?? []).filter(
    (mark) => mark.label !== undefined && mark.label !== null,
  );

  const valueText = isRange
    ? formatMessage(messages.slider.rangeValue, {
        end: format(values[1]),
        start: format(values[0]),
      })
    : format(values[0]);

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          {label && (
            // No input a `<label>` would focus by itself - the first thumb
            <label
              className="font-medium"
              id={labelId}
              onClick={() => getThumb(0)?.focus()}
            >
              {label}
              {messages.form.labelSuffix} {/* The star is for the eye */}
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
          {/* The thumbs tell their values to assistive technology */}
          {showValue && (
            <span
              aria-hidden="true"
              className="ms-auto text-neutral-600 tabular-nums dark:text-neutral-400"
            >
              {valueText}
            </span>
          )}
        </div>
      )}

      {isRange && (
        <>
          <span hidden id={thumbNameIds[0]}>
            {messages.slider.rangeStart}
          </span>
          <span hidden id={thumbNameIds[1]}>
            {messages.slider.rangeEnd}
          </span>
        </>
      )}
      {isRange && !label && !ariaLabelledBy && ariaLabel && (
        <span hidden id={`${sliderId}-name`}>
          {ariaLabel}
        </span>
      )}

      <div
        className={cn(
          "relative select-none",
          vertical
            ? "flex h-48 w-fit touch-pan-x"
            : // Room above the track for a value label that stays
              cn("touch-pan-y", valueLabel === "always" ? "pt-8 pb-2" : "py-2"),
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          className,
        )}
        onBlur={(event) => {
          if (!isOwnElement(event.relatedTarget)) onBlur?.(event);
        }}
        onFocus={(event) => {
          if (!isOwnElement(event.relatedTarget)) onFocus?.(event);
        }}
        onPointerDown={handlePointerDown}
        ref={controlRef}
      >
        <div
          className={cn(
            "relative rounded-full bg-neutral-200 dark:bg-neutral-700",
            vertical
              ? cn(styles.railVertical, styles.insetVertical, "mx-2")
              : cn(styles.rail, styles.inset),
          )}
          ref={railRef}
        >
          {/* The filled part - from the start, or between the thumbs */}
          <div
            className={cn(
              "absolute rounded-full",
              vertical ? "inset-x-0" : "inset-y-0",
              disabled
                ? "bg-neutral-400 dark:bg-neutral-500"
                : error
                  ? "bg-danger-500"
                  : "bg-primary-500 dark:bg-primary-400",
            )}
            style={
              vertical
                ? {
                    bottom: `${isRange ? percent(values[0]) : 0}%`,
                    height: `${isRange ? percent(values[1]) - percent(values[0]) : percent(values[0])}%`,
                  }
                : {
                    insetInlineStart: `${isRange ? percent(values[0]) : 0}%`,
                    width: `${isRange ? percent(values[1]) - percent(values[0]) : percent(values[0])}%`,
                  }
            }
          />

          {marks?.map((mark) => {
            const filled = isRange
              ? mark.value >= values[0] && mark.value <= values[1]
              : mark.value <= values[0];
            return (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute size-1 rounded-full",
                  vertical
                    ? "left-1/2 -translate-x-1/2 translate-y-1/2"
                    : "top-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2",
                  filled
                    ? "bg-white/80 dark:bg-neutral-900/60"
                    : "bg-neutral-400 dark:bg-neutral-500",
                )}
                key={mark.value}
                style={
                  vertical
                    ? { bottom: `${percent(clamp(mark.value, min, max))}%` }
                    : {
                        insetInlineStart: `${percent(clamp(mark.value, min, max))}%`,
                      }
                }
              />
            );
          })}

          {values.map((thumbValue, index) => {
            const [low, high] = boundsOf(index);
            const isDragged = draggedIndex === index;

            return (
              <div
                aria-describedby={describedBy}
                aria-disabled={disabled || undefined}
                aria-invalid={error ? "true" : undefined}
                aria-label={
                  !isRange && !label && !ariaLabelledBy ? ariaLabel : undefined
                }
                aria-labelledby={
                  isRange ? cn(nameId, thumbNameIds[index]) : nameId
                }
                aria-orientation={orientation}
                aria-valuemax={high}
                aria-valuemin={low}
                aria-valuenow={thumbValue}
                aria-valuetext={format(thumbValue)}
                className={cn(
                  "group/thumb absolute touch-none rounded-full border-2 bg-white shadow transition-shadow focus:outline-none focus-visible:ring-4 motion-reduce:transition-none dark:bg-neutral-900",
                  styles.thumb,
                  vertical
                    ? "left-1/2 -translate-x-1/2 translate-y-1/2"
                    : "top-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2",
                  disabled
                    ? "border-neutral-400 dark:border-neutral-500"
                    : error
                      ? "border-danger-500 focus-visible:ring-danger-500"
                      : "border-primary-500 focus-visible:ring-primary-500 dark:border-primary-400",
                  !disabled && isDragged && "ring-4 ring-primary-300/40",
                  // Of two thumbs on the same spot, the one that can move
                  // away from the end they are at is on top
                  isRange &&
                    (index === 0) === thumbValue > (min + max) / 2 &&
                    "z-10",
                  // A bigger target for fingers than the thumb looks
                  "before:absolute before:-inset-2 before:rounded-full before:content-['']",
                )}
                data-index={index}
                id={index === 0 ? sliderId : undefined}
                key={index}
                onKeyDown={(event) => handleKeyDown(index, event)}
                ref={index === 0 ? firstThumbRef : undefined}
                role="slider"
                style={
                  vertical
                    ? { bottom: `${percent(thumbValue)}%` }
                    : { insetInlineStart: `${percent(thumbValue)}%` }
                }
                // Not focusable while disabled, like a native field
                tabIndex={disabled ? undefined : 0}
              >
                {valueLabel !== "never" && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-white tabular-nums opacity-0 transition-opacity motion-reduce:transition-none dark:bg-neutral-100 dark:text-neutral-900",
                      vertical
                        ? // Away from the labels of the marks
                          "end-full top-1/2 me-2 -translate-y-1/2"
                        : "bottom-full left-1/2 mb-2 -translate-x-1/2",
                      valueLabel === "always" || isDragged
                        ? "opacity-100"
                        : "group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100",
                    )}
                  >
                    {format(thumbValue)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {labeledMarks.length > 0 &&
          (vertical ? (
            // As wide as the widest label - the labels themselves are placed
            // along the track
            <div
              className={cn(
                "relative ms-1 grid text-xs text-neutral-600 dark:text-neutral-400",
                styles.insetVertical,
              )}
            >
              {labeledMarks.map((mark) => (
                <span
                  className="invisible h-0 whitespace-nowrap [grid-area:1/1]"
                  key={mark.value}
                >
                  {mark.label}
                </span>
              ))}
              {labeledMarks.map((mark) => (
                <span
                  className="absolute start-0 translate-y-1/2 whitespace-nowrap"
                  key={mark.value}
                  style={{ bottom: `${percent(clamp(mark.value, min, max))}%` }}
                >
                  {mark.label}
                </span>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "relative mt-2 h-4 text-xs text-neutral-600 dark:text-neutral-400",
                styles.inset,
              )}
            >
              {labeledMarks.map((mark) => {
                const position = percent(clamp(mark.value, min, max));
                return (
                  <span
                    className={cn(
                      "absolute top-0 whitespace-nowrap",
                      // The labels at the ends stay inside the slider
                      position <= 0
                        ? "translate-x-0"
                        : position >= 100
                          ? "-translate-x-full rtl:translate-x-full"
                          : "-translate-x-1/2 rtl:translate-x-1/2",
                    )}
                    key={mark.value}
                    style={{ insetInlineStart: `${position}%` }}
                  >
                    {mark.label}
                  </span>
                );
              })}
            </div>
          ))}
      </div>

      {name &&
        values.map((thumbValue, index) => (
          <input
            disabled={disabled}
            form={form}
            key={index}
            name={name}
            type="hidden"
            value={thumbValue}
          />
        ))}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
