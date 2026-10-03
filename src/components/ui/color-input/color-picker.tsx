import { Pipette } from "lucide-react";
import { useRef } from "react";
import cn from "../../../utils/cn";
import {
  formatColor,
  hsvToRgb,
  parseColor,
  toCssColor,
  type ColorFormat,
  type Hsva,
} from "./color";
import { formatMessage, formatNumber } from "../../../i18n/ui/format";
import { getNumberFormat } from "../number-input/number-format";
import { useLocale } from "../../../providers/ui-context";

/** A preset color of `ColorInput` - with a name for screen readers. */
export interface ColorSwatch {
  /** Name of the color, e.g. "Brand blue" - the color itself by default. */
  label?: string;
  /** The color, in any format the field reads. */
  value: string;
}

/** What the EyeDropper API gives - Chromium browsers only. */
interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>;
}

type EyeDropperConstructor = new () => EyeDropperApi;

/** The EyeDropper of the browser, where it has one. */
const getEyeDropper = () =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

// The squares behind a translucent color
export const CHECKERBOARD =
  "bg-[repeating-conic-gradient(var(--color-neutral-300)_0_25%,white_0_50%)] bg-size-[8px_8px] dark:bg-[repeating-conic-gradient(var(--color-neutral-600)_0_25%,var(--color-neutral-800)_0_50%)]";

const THUMB =
  "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35),0_1px_3px_rgb(0_0_0/0.3)] rtl:translate-x-1/2";

/** Whether a press may pick: the primary button of the primary pointer. */
const isPrimaryPress = (event: React.PointerEvent) =>
  event.button === 0 && event.isPrimary;

function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // A pointer that is gone already
  }
}

/**
 * The drag of a press on `element` - `onPick` with the point, at the press
 * and at every move until the release. The moves come to the element even
 * off it (pointer capture).
 */
function usePointerPick(onPick: (clientX: number, clientY: number) => void) {
  const dragging = useRef(false);

  return {
    onLostPointerCapture: () => {
      dragging.current = false;
    },
    onPointerCancel: () => {
      dragging.current = false;
    },
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!isPrimaryPress(event)) return;
      // No text selection, and the focus goes to the thumb (below)
      event.preventDefault();
      capturePointer(event.currentTarget, event.pointerId);
      dragging.current = true;
      event.currentTarget
        .querySelector<HTMLElement>("[role='slider']")
        ?.focus({ preventScroll: true });
      onPick(event.clientX, event.clientY);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (dragging.current) onPick(event.clientX, event.clientY);
    },
    onPointerUp: () => {
      dragging.current = false;
    },
  };
}

/** The share of `rect` a point is at along its width - flipped in RTL. */
function ratioAlong(clientX: number, rect: DOMRect, rtl: boolean) {
  const along =
    rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
  return rtl ? 1 - along : along;
}

interface ChannelSliderProps {
  /** The slider's accessible name. */
  label: string;
  max: number;
  onChange: (value: number) => void;
  /** Classes of the track - its gradient. */
  trackClassName?: string;
  trackStyle?: React.CSSProperties;
  /** The color of the thumb. */
  thumbColor: string;
  value: number;
  valueText: string;
}

/**
 * A slider of one channel - the hue or the alpha. The arrow keys move by
 * 1 (Shift: by 10), Page Up / Page Down by 10, Home / End to the ends.
 */
function ChannelSlider({
  label,
  max,
  onChange,
  thumbColor,
  trackClassName,
  trackStyle,
  value,
  valueText,
}: ChannelSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerPick((clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.round(
      ratioAlong(clientX, track.getBoundingClientRect(), isRtl(track)) * max,
    );
    if (next !== value) onChange(next);
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    // Right is back in a right-to-left page
    const forward = isRtl(event.currentTarget) ? -step : step;
    const target =
      event.key === "ArrowRight"
        ? value + forward
        : event.key === "ArrowLeft"
          ? value - forward
          : event.key === "ArrowUp"
            ? value + step
            : event.key === "ArrowDown"
              ? value - step
              : event.key === "PageUp"
                ? value + 10
                : event.key === "PageDown"
                  ? value - 10
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? max
                      : undefined;
    if (target === undefined) return;

    event.preventDefault();
    const next = clamp(Math.round(target), 0, max);
    if (next !== value) onChange(next);
  };

  return (
    // The padding keeps the thumb at the ends inside the panel
    <div className="touch-none px-2 py-1" {...pointer}>
      <div
        // The colors are what the track shows - forced colors (Windows High
        // Contrast) leave them, and the thumb with its ring, as they are
        className={cn(
          "relative h-3 rounded-full forced-color-adjust-none",
          trackClassName,
        )}
        ref={trackRef}
        style={trackStyle}
      >
        <div
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemax={max}
          aria-valuemin={0}
          aria-valuenow={Math.round(value)}
          aria-valuetext={valueText}
          className={cn(
            THUMB,
            "top-1/2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
          )}
          data-orientation="horizontal"
          onKeyDown={handleKeyDown}
          role="slider"
          style={{
            backgroundColor: thumbColor,
            insetInlineStart: `${(clamp(value, 0, max) / max) * 100}%`,
          }}
          tabIndex={0}
        />
      </div>
    </div>
  );
}

interface ColorPickerProps {
  /** With a slider of the alpha. */
  alpha: boolean;
  /** The color shown. */
  color: Hsva;
  /** Shows the EyeDropper button where the browser has the API. */
  eyeDropper: boolean;
  /** The format of the values - to find the picked swatch. */
  format: ColorFormat;
  /** Called with the new color - of a drag, a key or the eye dropper. */
  onChange: (color: Hsva) => void;
  /** Called with a picked swatch - a value in `format` already. */
  onPickValue: (value: string) => void;
  /** Called with the area once it is in the page - to take the focus. */
  areaRef?: React.Ref<HTMLDivElement>;
  /** The preset colors. */
  swatches?: (string | ColorSwatch)[];
  /** The value of the field - the swatch of this value is picked. */
  value: string;
}

/**
 * The popup of `ColorInput`: the area of saturation and brightness, the
 * hue and alpha sliders, the eye dropper and the swatches.
 */
export default function ColorPicker({
  alpha,
  areaRef,
  color,
  eyeDropper,
  format,
  onChange,
  onPickValue,
  swatches,
  value,
}: ColorPickerProps) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const percent = (share: number) =>
    getNumberFormat(locale.code, {
      maximumFractionDigits: 0,
      style: "percent",
    }).format(share);

  const opaque = toCssColor({ ...hsvToRgb(color), a: 1 });
  const EyeDropper = eyeDropper ? getEyeDropper() : undefined;

  // The area - the saturation along it, the brightness up it
  const areaElement = useRef<HTMLDivElement>(null);
  const areaPointer = usePointerPick((clientX, clientY) => {
    const area = areaElement.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const down =
      rect.height > 0 ? clamp((clientY - rect.top) / rect.height, 0, 1) : 0;
    onChange({
      ...color,
      s: ratioAlong(clientX, rect, isRtl(area)) * 100,
      v: (1 - down) * 100,
    });
  });

  const handleAreaKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    // The thumb moves the way of the arrow - the saturation grows from the
    // start side
    const forward = isRtl(event.currentTarget) ? -step : step;
    let { s, v } = color;
    switch (event.key) {
      case "ArrowRight":
        s += forward;
        break;
      case "ArrowLeft":
        s -= forward;
        break;
      case "ArrowUp":
        v += step;
        break;
      case "ArrowDown":
        v -= step;
        break;
      case "PageUp":
        v += 10;
        break;
      case "PageDown":
        v -= 10;
        break;
      case "Home":
        s = 0;
        break;
      case "End":
        s = 100;
        break;
      default:
        return;
    }
    event.preventDefault();
    // On whole percents - a step from a dragged 43.7 % goes to 44 %
    const next = {
      ...color,
      s: clamp(Math.round(s), 0, 100),
      v: clamp(Math.round(v), 0, 100),
    };
    if (next.s !== color.s || next.v !== color.v) onChange(next);
  };

  const pickFromScreen = () => {
    if (!EyeDropper) return;
    new EyeDropper()
      .open()
      .then(({ sRGBHex }) => {
        // The picker may have closed while the browser picked a color,
        // including when its field was disabled or made read-only.
        if (!areaElement.current) return;
        const picked = parseColor(sRGBHex);
        if (picked) onPickValue(formatColor(picked, format, alpha));
      })
      // Canceled with Escape - nothing picked
      .catch(() => {});
  };

  const presets = (swatches ?? []).flatMap((swatch) => {
    const item = typeof swatch === "string" ? { value: swatch } : swatch;
    const parsed = parseColor(item.value);
    if (!parsed) return [];
    const normalized = formatColor(parsed, format, alpha);
    return [
      {
        css: toCssColor(alpha ? parsed : { ...parsed, a: 1 }),
        label: item.label ?? normalized,
        value: normalized,
      },
    ];
  });
  const checkedIndex = presets.findIndex((preset) => preset.value === value);

  // The swatches are a radio group - one tab stop, the arrow keys move and
  // pick
  const handleSwatchKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const rtl = isRtl(event.currentTarget);
    const next =
      event.key === "ArrowDown" ||
      event.key === (rtl ? "ArrowLeft" : "ArrowRight")
        ? index + 1
        : event.key === "ArrowUp" ||
            event.key === (rtl ? "ArrowRight" : "ArrowLeft")
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? presets.length - 1
              : undefined;
    if (next === undefined) return;

    event.preventDefault();
    const target = (next + presets.length) % presets.length;
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        "[role='radio']",
      );
    buttons?.[target]?.focus();
    onPickValue(presets[target].value);
  };

  return (
    <div className="flex w-60 flex-col gap-3">
      {/* The saturation grows along the reading direction - from the right
          in a right-to-left page. Forced colors (Windows High Contrast)
          leave the colors of the area, and the thumb with its ring, as they
          are. */}
      <div
        className="relative h-36 cursor-crosshair touch-none rounded-md forced-color-adjust-none"
        ref={areaElement}
        style={{ backgroundColor: `hsl(${color.h} 100% 50%)` }}
        {...areaPointer}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-md bg-[linear-gradient(to_top,black,transparent),linear-gradient(to_right,white,transparent)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] rtl:bg-[linear-gradient(to_top,black,transparent),linear-gradient(to_left,white,transparent)]"
        />
        <div
          aria-label={messages.colorInput.area}
          aria-roledescription={messages.colorInput.areaRole}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(color.s)}
          aria-valuetext={formatMessage(messages.colorInput.areaValue, {
            brightness: percent(color.v / 100),
            saturation: percent(color.s / 100),
          })}
          className={cn(
            THUMB,
            "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
          )}
          onKeyDown={handleAreaKeyDown}
          ref={areaRef}
          role="slider"
          style={{
            backgroundColor: opaque,
            insetInlineStart: `${clamp(color.s, 0, 100)}%`,
            top: `${100 - clamp(color.v, 0, 100)}%`,
          }}
          tabIndex={0}
        />
      </div>

      <div className="flex items-center gap-2">
        {EyeDropper && (
          <button
            aria-label={messages.colorInput.eyeDropper}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            onClick={pickFromScreen}
            title={messages.colorInput.eyeDropper}
            type="button"
          >
            <Pipette aria-hidden="true" size={16} />
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ChannelSlider
            label={messages.colorInput.hue}
            max={360}
            onChange={(h) => onChange({ ...color, h })}
            thumbColor={`hsl(${color.h} 100% 50%)`}
            trackClassName="bg-[linear-gradient(to_right,red,yellow,lime,cyan,blue,magenta,red)] rtl:bg-[linear-gradient(to_left,red,yellow,lime,cyan,blue,magenta,red)]"
            value={color.h}
            valueText={formatMessage(messages.colorInput.hueValue, {
              degrees: formatNumber(locale.code, Math.round(color.h)),
            })}
          />
          {alpha && (
            <ChannelSlider
              label={messages.colorInput.alpha}
              max={100}
              onChange={(a) => onChange({ ...color, a: a / 100 })}
              thumbColor={toCssColor({ ...hsvToRgb(color) })}
              trackClassName={cn(
                CHECKERBOARD,
                "before:absolute before:inset-0 before:rounded-full before:bg-[linear-gradient(to_right,transparent,var(--cui-color))] before:content-[''] rtl:before:bg-[linear-gradient(to_left,transparent,var(--cui-color))]",
              )}
              trackStyle={{ "--cui-color": opaque } as React.CSSProperties}
              value={Math.round(color.a * 100)}
              valueText={percent(color.a)}
            />
          )}
        </div>
      </div>

      {presets.length > 0 && (
        <div
          aria-label={messages.colorInput.swatches}
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
        >
          {presets.map((preset, index) => {
            const checked = index === checkedIndex;
            return (
              <button
                aria-checked={checked}
                aria-label={preset.label}
                className={cn(
                  "relative size-6 cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
                  CHECKERBOARD,
                  // Forced colors (Windows High Contrast) draw no ring - an
                  // outline of the system's highlight color then
                  checked &&
                    "ring-2 ring-neutral-900 ring-offset-1 ring-offset-surface dark:ring-white dark:ring-offset-surface-dark forced-colors:outline-2 forced-colors:outline-offset-1 forced-colors:outline-[Highlight]",
                )}
                data-state={checked ? "checked" : "unchecked"}
                key={`${preset.value}-${index}`}
                onClick={() => onPickValue(preset.value)}
                onKeyDown={(event) => handleSwatchKeyDown(index, event)}
                role="radio"
                tabIndex={index === Math.max(checkedIndex, 0) ? 0 : -1}
                title={preset.label}
                type="button"
              >
                {/* Its color, which forced colors leave as it is */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 forced-color-adjust-none"
                  style={{ backgroundColor: preset.css }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
