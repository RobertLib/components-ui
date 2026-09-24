import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import cn from "../../utils/cn";
import logger from "../../utils/logger";
import { attachRef } from "../../hooks/use-form-control";
import { formatMessage, toIntlLocale } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import {
  clamp,
  EPSILON,
  fitSizes,
  getPairRange,
  normalizeSizes,
  resetPair,
  resizeTo,
  sameSizes,
  stepSize,
  withPrimarySize,
  type PaneLimits,
} from "./sizes";
import {
  parseStoredSizes,
  saveSizes,
  useStoredSizes,
} from "./use-stored-sizes";

export interface SplitterProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "onChange"
> {
  /** The panes - one child each (`null` and `false` are left out). */
  children: React.ReactNode;
  /**
   * Which panes may collapse, by index - dragged below half their minimum
   * size, or with Enter on a handle next to them (Enter again restores
   * them). A collapsed pane is hidden and out of the Tab order.
   */
  collapsible?: boolean[];
  /**
   * Sizes of the panes in percent at first - scaled to add up to 100.
   * Equal sizes when left out. A double click on a handle brings back the
   * ratio of its two panes.
   */
  defaultSizes?: number[];
  /**
   * The largest size of each pane in percent. The sizes of a splitter that
   * keeps its own sizes stay within `minSizes` / `maxSizes` - also those
   * saved under `storageKey` before the limits changed.
   */
  maxSizes?: number[];
  /** The smallest size of each pane in percent (0 by default). */
  minSizes?: number[];
  /**
   * Called with the sizes of all panes in percent as a handle moves - while
   * dragging, with every move.
   */
  onSizesChange?: (sizes: number[]) => void;
  /**
   * `horizontal` - the panes side by side (with vertical handles),
   * `vertical` - stacked (give the splitter a height).
   */
  orientation?: "horizontal" | "vertical";
  /** Classes of every pane - they scroll their content by default. */
  paneClassName?: string;
  /**
   * Names of the panes, by index - a handle is named after the pane before
   * it, whose size it sets ("Resize pane 1" without them).
   */
  paneLabels?: string[];
  /**
   * The sizes of the panes in percent - use with `onSizesChange`. Leave out
   * for a splitter that keeps its own sizes (`defaultSizes`).
   */
  sizes?: number[];
  /**
   * Side-by-side panes stack on phones (below the `md` breakpoint): each
   * pane full width at its natural height, without handles - and the
   * splitter as high as its content.
   */
  stackOnMobile?: boolean;
  /**
   * `localStorage` key the sizes of an uncontrolled splitter are remembered
   * under. Rendered on the server, the splitter shows `defaultSizes` until
   * it hydrates.
   */
  storageKey?: string;
}

/** What a key press moves a handle by, in percent - with Shift the larger. */
const KEY_STEP = 1;
const LARGE_KEY_STEP = 10;

/** A pointer drag of a handle - fixed at the press. */
interface Drag {
  /** Pixels the panes share - the splitter without its handles. */
  available: number;
  /** -1 where the pointer moves the other way: right-to-left side by side. */
  direction: number;
  handle: number;
  /** The sizes the drag has come to. */
  latest: number[];
  pointerId: number;
  /** Where the pointer was pressed, along the splitter. */
  start: number;
  startSizes: number[];
}

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

const percentFormats = new Map<string, Intl.NumberFormat>();

/** A size as the language writes percentages - "30%", "30 %". */
function formatPercent(localeCode: string, value: number) {
  let format = percentFormats.get(localeCode);

  if (!format) {
    format = new Intl.NumberFormat(toIntlLocale(localeCode), {
      maximumFractionDigits: 0,
      style: "percent",
    });
    percentFormats.set(localeCode, format);
  }

  return format.format(value / 100);
}

function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // A pointer that is gone already
  }
}

function releasePointer(element: Element, pointerId: number) {
  try {
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // A pointer that is gone already
  }
}

/**
 * Keeps the resize cursor over the whole page during a drag, and the text
 * of the panes from being selected. Returns what restores the page.
 */
function styleDocumentForDrag(cursor: string) {
  const { style } = document.body;
  const previous = { cursor: style.cursor, userSelect: style.userSelect };
  style.cursor = cursor;
  style.userSelect = "none";

  return () => {
    style.cursor = previous.cursor;
    style.userSelect = previous.userSelect;
  };
}

/**
 * Resizable panes with handles between them - e.g. a list and the detail of
 * its selected item. A handle is dragged with the mouse, a pen or a finger,
 * or focused and moved with the arrow keys (Shift for larger steps), Home
 * and End; Enter collapses and restores a `collapsible` pane, and a double
 * click brings back the default sizes of the two panes. Side-by-side panes
 * stack on phones.
 */
export default function Splitter({
  children,
  className,
  collapsible,
  defaultSizes,
  maxSizes,
  minSizes,
  onSizesChange,
  orientation = "horizontal",
  paneClassName,
  paneLabels,
  ref,
  sizes: sizesProp,
  stackOnMobile = true,
  storageKey,
  ...props
}: SplitterProps) {
  const locale = useLocale();
  const baseId = useId();
  const panes = Children.toArray(children);
  const count = panes.length;
  const horizontal = orientation === "horizontal";
  const stacks = horizontal && stackOnMobile;

  const limits: PaneLimits = {
    collapsible: panes.map((_, index) => !!collapsible?.[index]),
    max: panes.map((_, index) => clamp(maxSizes?.[index] ?? 100, 0, 100)),
    min: panes.map((_, index) => clamp(minSizes?.[index] ?? 0, 0, 100)),
  };
  const defaults = normalizeSizes(defaultSizes, count);

  // Uncontrolled: the sizes of this splitter - replaced by the saved ones
  // when they change (after hydrating, or in another splitter or tab)
  const storedText = useStoredSizes(storageKey);
  const [uncontrolled, setUncontrolled] = useState(() => ({
    sizes: parseStoredSizes(storedText, count) ?? defaults,
    storedText,
  }));
  if (uncontrolled.storedText !== storedText) {
    setUncontrolled({
      sizes: parseStoredSizes(storedText, count) ?? uncontrolled.sizes,
      storedText,
    });
  }

  const isControlled = sizesProp !== undefined;
  const givenSizes = normalizeSizes(
    isControlled
      ? sizesProp
      : uncontrolled.sizes.length === count
        ? uncontrolled.sizes
        : (parseStoredSizes(storedText, count) ?? defaults),
    count,
  );
  // Its own sizes stay within the limits - also sizes saved before they
  // changed, or default sizes out of them
  const sizes = isControlled ? givenSizes : fitSizes(givenSizes, limits);

  // `sizes` used to be the initial state
  useEffect(() => {
    if (isControlled && !onSizesChange) {
      logger.warn(
        "Splitter: `sizes` without `onSizesChange` cannot be resized - use `defaultSizes` for the initial sizes.",
      );
    }
  }, [isControlled, onSizesChange]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const rootRefCallback = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      const detachRef = attachRef(ref, element);
      return () => {
        rootRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  const dragRef = useRef<Drag | null>(null);
  const [draggedHandle, setDraggedHandle] = useState<number | null>(null);
  // Restores the page after a drag
  const restoreDocumentRef = useRef<(() => void) | null>(null);

  // The last size of each pane that was not 0 - what Enter restores a
  // collapsed pane to, also one the parent collapsed through `sizes`. Not
  // followed during a drag: a pane dragged shut comes back at its size
  // from before the drag.
  const [openSizes, setOpenSizes] = useState(sizes);
  const nextOpenSizes = sizes.map((size, pane) =>
    size > EPSILON ? size : (openSizes[pane] ?? 0),
  );
  if (draggedHandle === null && !sameSizes(nextOpenSizes, openSizes)) {
    setOpenSizes(nextOpenSizes);
  }

  /** Shows new sizes - while dragging, with every move. */
  const changeSizes = (next: number[]) => {
    if (!isControlled) {
      setUncontrolled((current) => ({ ...current, sizes: next }));
    }
    onSizesChange?.(next);
  };

  /** Remembers the sizes - once a change is done. */
  const saveChange = (next: number[]) => {
    if (!isControlled && storageKey) saveSizes(storageKey, next);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDraggedHandle(null);
    restoreDocumentRef.current?.();
    restoreDocumentRef.current = null;
  };

  // Escape cancels a drag - and nothing else, not a Dialog around
  useEffect(() => {
    if (draggedHandle === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const drag = dragRef.current;
      if (event.key !== "Escape" || !drag) return;

      event.preventDefault();
      event.stopPropagation();

      const handleElement = rootRef.current?.querySelectorAll(
        ":scope > [data-splitter-handle]",
      )[drag.handle];
      if (handleElement) releasePointer(handleElement, drag.pointerId);

      endDrag();
      changeSizes(drag.startSizes);
    };

    // Before the key handlers of the page and the overlays
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });

  // A splitter unmounted during a drag leaves the page as it was
  useEffect(
    () => () => {
      restoreDocumentRef.current?.();
      restoreDocumentRef.current = null;
    },
    [],
  );

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    handle: number,
  ) => {
    const root = rootRef.current;
    if (!root || event.button !== 0 || !event.isPrimary) return;

    const handles = root.querySelectorAll<HTMLElement>(
      ":scope > [data-splitter-handle]",
    );
    const handlesSize = Array.from(handles).reduce(
      (sum, element) =>
        sum + (horizontal ? element.offsetWidth : element.offsetHeight),
      0,
    );
    const rect = root.getBoundingClientRect();
    const available = (horizontal ? rect.width : rect.height) - handlesSize;
    if (available <= 0) return;

    // No text selection, no native drag - the handle takes the focus
    event.preventDefault();
    event.currentTarget.focus();
    capturePointer(event.currentTarget, event.pointerId);

    dragRef.current = {
      available,
      // The first pane is on the right side of a right-to-left page
      direction: horizontal && isRtl(root) ? -1 : 1,
      handle,
      latest: sizes,
      pointerId: event.pointerId,
      start: horizontal ? event.clientX : event.clientY,
      startSizes: sizes,
    };
    setDraggedHandle(handle);
    restoreDocumentRef.current?.();
    restoreDocumentRef.current = styleDocumentForDrag(
      horizontal ? "col-resize" : "row-resize",
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const position = horizontal ? event.clientX : event.clientY;
    const delta =
      ((position - drag.start) / drag.available) * 100 * drag.direction;
    const next = resizeTo(
      drag.startSizes,
      drag.handle,
      drag.startSizes[drag.handle] + delta,
      limits,
    );
    if (sameSizes(next, drag.latest)) return;

    drag.latest = next;
    changeSizes(next);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    endDrag();
    if (!sameSizes(drag.latest, drag.startSizes)) saveChange(drag.latest);
  };

  /**
   * Restores a collapsed pane of `handle` - or collapses its collapsible
   * pane, the one before it first.
   */
  const toggleCollapsed = (handle: number) => {
    const range = getPairRange(sizes, handle, limits);
    const pair = [handle, handle + 1].filter(
      (pane) => limits.collapsible[pane],
    );

    const collapsed = pair.find((pane) => sizes[pane] <= EPSILON);
    if (collapsed !== undefined) {
      const size =
        openSizes[collapsed] > EPSILON
          ? openSizes[collapsed]
          : defaults[collapsed];
      const primary = clamp(
        collapsed === handle ? size : range.total - size,
        range.min,
        range.max,
      );
      return withPrimarySize(sizes, handle, primary);
    }

    const pane = pair.find((candidate) =>
      candidate === handle
        ? range.canCollapsePrimary
        : range.canCollapseSecondary,
    );
    if (pane === undefined) return null;

    return withPrimarySize(sizes, handle, pane === handle ? 0 : range.total);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    handle: number,
  ) => {
    const range = getPairRange(sizes, handle, limits);
    const step = event.shiftKey ? LARGE_KEY_STEP : KEY_STEP;
    // The arrows that move the handle towards the first pane and away from
    // it - that pane is on the right in a right-to-left page
    const [shrinkKey, growKey] = !horizontal
      ? ["ArrowUp", "ArrowDown"]
      : isRtl(event.currentTarget)
        ? ["ArrowRight", "ArrowLeft"]
        : ["ArrowLeft", "ArrowRight"];
    let next: number[] | null;

    switch (event.key) {
      case shrinkKey:
        next = stepSize(sizes, handle, -step, limits);
        break;
      case growKey:
        next = stepSize(sizes, handle, step, limits);
        break;
      case "Home":
        next = withPrimarySize(sizes, handle, range.min);
        break;
      case "End":
        next = withPrimarySize(sizes, handle, range.max);
        break;
      case "Enter":
        next = toggleCollapsed(handle);
        break;
      default:
        return;
    }

    event.preventDefault();
    if (!next || sameSizes(next, sizes)) return;

    changeSizes(next);
    saveChange(next);
  };

  const handleDoubleClick = (handle: number) => {
    const next = resetPair(sizes, handle, defaults, limits);
    if (sameSizes(next, sizes)) return;

    changeSizes(next);
    saveChange(next);
  };

  const paneId = (pane: number) => `${baseId}-pane-${pane}`;

  return (
    <div
      {...props}
      className={cn(
        "flex",
        horizontal ? "flex-row" : "flex-col",
        stacks && "max-md:h-auto max-md:flex-col",
        className,
      )}
      data-orientation={orientation}
      ref={rootRefCallback}
    >
      {panes.map((pane, index) => {
        const size = sizes[index];
        const collapsed = size <= EPSILON;
        const handle = index - 1;
        const range = handle >= 0 ? getPairRange(sizes, handle, limits) : null;
        const isDragged = draggedHandle === handle;

        return (
          <Fragment
            key={isValidElement(pane) && pane.key !== null ? pane.key : index}
          >
            {range && (
              <div
                aria-controls={paneId(handle)}
                aria-label={
                  paneLabels?.[handle] ??
                  formatMessage(locale.messages.splitter.resizePane, {
                    number: handle + 1,
                  })
                }
                aria-orientation={horizontal ? "vertical" : "horizontal"}
                aria-valuemax={Math.round(
                  range.canCollapseSecondary ? range.total : range.max,
                )}
                aria-valuemin={Math.round(
                  range.canCollapsePrimary ? 0 : range.min,
                )}
                aria-valuenow={Math.round(sizes[handle])}
                aria-valuetext={formatPercent(locale.code, sizes[handle])}
                className={cn(
                  "group/handle relative flex shrink-0 touch-none items-center justify-center select-none focus:outline-none",
                  horizontal
                    ? "w-2 cursor-col-resize pointer-coarse:w-4"
                    : "h-2 cursor-row-resize pointer-coarse:h-4",
                  stacks && "max-md:hidden",
                )}
                data-splitter-handle=""
                onDoubleClick={() => handleDoubleClick(handle)}
                onKeyDown={(event) => handleKeyDown(event, handle)}
                onLostPointerCapture={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerDown={(event) => handlePointerDown(event, handle)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                role="separator"
                tabIndex={0}
              >
                {/* The line between the panes */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute transition-colors motion-reduce:transition-none",
                    horizontal
                      ? "inset-y-0 left-1/2 w-px -translate-x-1/2"
                      : "inset-x-0 top-1/2 h-px -translate-y-1/2",
                    isDragged
                      ? "bg-primary-500"
                      : "bg-neutral-200 group-hover/handle:bg-primary-400 group-focus-visible/handle:bg-primary-500 dark:bg-neutral-800",
                  )}
                />
                {/* The grip - something to aim at, also for a finger */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none relative rounded-full border bg-surface shadow-sm transition-colors motion-reduce:transition-none dark:bg-surface-dark",
                    horizontal ? "h-8 w-1.5" : "h-1.5 w-8",
                    "group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-primary-500",
                    isDragged
                      ? "border-primary-500"
                      : "border-neutral-300 group-hover/handle:border-primary-400 group-focus-visible/handle:border-primary-500 dark:border-neutral-600",
                  )}
                />
              </div>
            )}
            <div
              className={cn(
                "min-h-0 min-w-0 grow-(--splitter-pane-size) basis-0 overflow-auto",
                stacks &&
                  "max-md:grow-0 max-md:basis-auto max-md:overflow-visible",
                // Collapsed also on phones, where the panes are stacked
                collapsed && stacks && "max-md:hidden",
                paneClassName,
              )}
              id={paneId(index)}
              inert={collapsed}
              style={{ "--splitter-pane-size": size } as React.CSSProperties}
            >
              {pane}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
