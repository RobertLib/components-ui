import {
  cloneElement,
  Fragment,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import cn, { joinTokens } from "../utils/cn";
import {
  getActiveElement,
  getDirection,
  isBelowModalOverlay,
  isEscapeKey,
  isTopmostOverlay,
  OverlayContext,
  subscribeToOverlayStack,
  useOverlayLayer,
} from "./overlay-stack";
import { ButtonGroupContext } from "./button-group-context";
import { attachRef } from "../hooks/use-form-control";
import { usePortalContainer } from "../providers/ui-context";
import {
  getClippingAncestors,
  getVisibleArea,
  isOutOfView,
  resolveSide,
  type AnchorRect,
  type FloatingSide,
  type PhysicalSide,
} from "./menu/position";

type Side = PhysicalSide;

interface Placement {
  /** Offset of the arrow along the edge it is on, in pixels. */
  arrow: number;
  /** The trigger is scrolled out of view - the tooltip hides meanwhile. */
  hidden?: boolean;
  left: number;
  side: Side;
  top: number;
}

/**
 * The tooltips on screen, but the controlled ones - one at a time: a tooltip
 * that shows hides the others. `byPointer` - shown by hovering its trigger.
 */
const shownTooltips = new Map<
  string,
  { byPointer: boolean; hide: () => void }
>();

// Once the pointer has left a tooltip, the next trigger it rests on within
// this time shows its tooltip without the `delay` - one label after another
// along a toolbar, as native tooltips do
const SKIP_DELAY_DURATION = 300;
let skipDelayUntil = 0;

/**
 * Whether a tooltip shows at once on hover: another one is shown by the
 * pointer, or one was hidden a moment ago as the pointer left it.
 */
function isDelaySkipped() {
  const now = Date.now();
  // A clock set back meanwhile (fake timers) ends the window too
  const inWindow =
    skipDelayUntil > now && skipDelayUntil - now <= SKIP_DELAY_DURATION;
  return (
    inWindow || [...shownTooltips.values()].some((tooltip) => tooltip.byPointer)
  );
}

const OPPOSITE: Record<Side, Side> = {
  bottom: "top",
  left: "right",
  right: "left",
  top: "bottom",
};

// Space kept between the tooltip and the edges of the viewport
const VIEWPORT_MARGIN = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const subscribeToNothing = () => () => {};

export interface TooltipProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /**
   * Hover time in milliseconds before the tooltip appears. Within a moment
   * after the pointer left another tooltip - or while one is shown on hover
   * - it appears at once, so moving along a toolbar reads one label after
   * another.
   */
  delay?: number;
  /**
   * The content of the tooltip is used, not only read: a click in it (text
   * selection, a scrollbar of a long list) keeps it open. Off by default - a
   * click on a plain label tooltip hides it. Every tooltip stays open while
   * the pointer is on it.
   */
  interactive?: boolean;
  /** Keeps the text on one line. */
  nowrap?: boolean;
  /**
   * Called when the tooltip wants to show or hide - on hover, focus,
   * Escape, a click (with `openOnClick`) or another tooltip showing.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Shows the tooltip while `true` - leave it out to let hover and focus
   * show it. A controlled tooltip is left out of the grouping: another one
   * showing does not hide it, and it does not shorten their `delay`.
   */
  open?: boolean;
  /** Toggle the tooltip on click/tap as well, so it works without a pointer. */
  openOnClick?: boolean;
  /**
   * Side of the trigger the tooltip appears on - `start` / `end` are the
   * left and the right side, the other way round right to left; `end` by
   * default.
   */
  position?: FloatingSide;
  /** Content of the tooltip. */
  title?: React.ReactNode;
}

const GAP = 8;

const isSamePlacement = (a: Placement, b: Placement) =>
  a.arrow === b.arrow &&
  a.hidden === b.hidden &&
  a.left === b.left &&
  a.side === b.side &&
  a.top === b.top;

// Grace period for the pointer to travel across GAP between the trigger and
// the tooltip (either way) without the tooltip closing underneath it.
const HIDE_DELAY = 150;

// Where a tooltip goes when neither its side nor the opposite one has the
// room - on a phone, a tooltip beside a trigger in the middle of the screen
const PERPENDICULAR: Record<Side, [Side, Side]> = {
  bottom: ["right", "left"],
  left: ["bottom", "top"],
  right: ["bottom", "top"],
  top: ["right", "left"],
};

/**
 * Where a tooltip of `width` x `height` goes next to `rect`: on `preferred`,
 * on the opposite side when only that one has the room, else on a side
 * across that has it (below or above a `left` / `right` one) - or, with room
 * nowhere, on the side with the most. It is kept inside `area` - the part
 * of the page that is seen - both ways, over the trigger at last.
 */
function place(
  rect: DOMRect,
  width: number,
  height: number,
  preferred: Side,
  area: AnchorRect,
): Placement {
  const room: Record<Side, number> = {
    bottom: area.bottom - rect.bottom - GAP,
    left: rect.left - area.left - GAP,
    right: area.right - rect.right - GAP,
    top: rect.top - area.top - GAP,
  };
  const needed = (side: Side) =>
    (side === "top" || side === "bottom" ? height : width) + VIEWPORT_MARGIN;
  const fits = (side: Side) => room[side] >= needed(side);

  const candidates: Side[] = [
    preferred,
    OPPOSITE[preferred],
    ...PERPENDICULAR[preferred],
  ];
  const side =
    candidates.find(fits) ??
    // The most room for what it needs - the preferred side on a tie
    candidates.reduce((best, candidate) =>
      room[candidate] - needed(candidate) > room[best] - needed(best)
        ? candidate
        : best,
    );

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const clampLeft = (left: number) =>
    clamp(
      left,
      area.left + VIEWPORT_MARGIN,
      area.right - width - VIEWPORT_MARGIN,
    );
  const clampTop = (top: number) =>
    clamp(
      top,
      area.top + VIEWPORT_MARGIN,
      area.bottom - height - VIEWPORT_MARGIN,
    );

  if (side === "top" || side === "bottom") {
    const left = clampLeft(centerX - width / 2);
    return {
      arrow: clamp(centerX - left, 8, width - 8),
      left,
      side,
      top: clampTop(
        side === "top" ? rect.top - GAP - height : rect.bottom + GAP,
      ),
    };
  }

  const top = clampTop(centerY - height / 2);
  return {
    arrow: clamp(centerY - top, 8, height - 8),
    left: clampLeft(
      side === "left" ? rect.left - GAP - width : rect.right + GAP,
    ),
    side,
    top,
  };
}

/**
 * A short text shown next to its children on hover and keyboard focus (and
 * on click with `openOnClick`), rendered in a portal (into the
 * `portalContainer` of `UIProvider`). Keyboard focus shows it without the
 * `delay`, and a single child element - the button or link it explains - is
 * described by it, so screen readers read it on focus. One tooltip shows at
 * a time. `ref` and the other props go to the wrapper around the children,
 * which has `data-state="open"` or `"closed"`; the tooltip has
 * `data-state="open"` and the `data-side` it is shown on.
 */
export default function Tooltip({
  className,
  delay = 1000,
  children,
  interactive = false,
  nowrap = false,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  onOpenChange,
  open,
  openOnClick = false,
  position = "end",
  ref,
  title,
  ...props
}: TooltipProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  // The element whose keyboard focus opened the tooltip. Pointer events
  // can change :focus-visible without ending that focus.
  const keyboardFocusRef = useRef<Element | null>(null);
  // The ancestors of the trigger that clip it, and its writing direction -
  // read as the tooltip shows
  const clipsRef = useRef<Element[]>([]);
  const rtlRef = useRef(false);
  // The writing direction of the trigger, for the tooltip - a portal - when
  // it differs from the one of the element it is rendered into
  const [direction, setDirection] = useState<"ltr" | "rtl">();
  const tooltipId = useId();
  const ancestors = use(OverlayContext);
  const getPortalContainer = usePortalContainer();
  // False on the server and while a server-rendered page hydrates - its HTML
  // has no portal: a tooltip controlled open shows right after
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const isControlled = open !== undefined;
  const isVisible = isControlled ? open : internalVisible;
  const hasTitle = title != null && title !== "";
  const isShown = isVisible && hasTitle;
  // Whether it is shown as of the last render, and whether by the pointer -
  // for the timers, and for the other tooltips (see `shownTooltips`)
  const visibleRef = useRef(isVisible);
  const byPointerRef = useRef(false);
  // Where the tooltip is rendered, as of the last render - read as it shows
  const portalContainerRef = useRef(getPortalContainer);

  useLayoutEffect(() => {
    visibleRef.current = isVisible;
    portalContainerRef.current = getPortalContainer;
  });

  const setVisible = (next: boolean) => {
    if (visibleRef.current === next) return;
    if (!isControlled) setInternalVisible(next);
    onOpenChange?.(next);
  };

  // In the overlay stack shared with dialogs and popovers - the shown
  // tooltip takes the first Escape, not the Dialog around it. A press on
  // the backdrop of a Sheet around it still closes the Sheet.
  const { id: layerId } = useOverlayLayer(isShown, {
    getElements: () => [tooltipRef.current],
    tooltip: true,
  });

  // The element that has the focus is described by the shown tooltip, so a
  // screen reader reads it along - keyboard focus shows it at once
  const describedChildren =
    isVisible &&
    hasTitle &&
    isValidElement<{ "aria-describedby"?: string }>(children) &&
    children.type !== Fragment
      ? cloneElement(children, {
          "aria-describedby": joinTokens(
            children.props["aria-describedby"],
            tooltipId,
          ),
        })
      : children;

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  // Not over a modal dialog opened meanwhile (by a shortcut, while the
  // pointer rested on the trigger) that the tooltip is not in - it would
  // paint above the backdrop and take the Escape of the dialog
  const show = (byPointer: boolean) => {
    if (isBelowModalOverlay(ancestors)) return;
    byPointerRef.current = byPointer;
    setVisible(true);
  };

  // The events of a popover or menu opened from the trigger reach here
  // through its portal, which is inside the trigger in the React tree - the
  // focus or the pointer in its panel is not on the trigger
  const isOwnEvent = (event: React.SyntheticEvent) =>
    event.target instanceof Node &&
    (!!triggerRef.current?.contains(event.target) ||
      !!tooltipRef.current?.contains(event.target));

  const showTooltip = (event: React.MouseEvent) => {
    if (!isOwnEvent(event)) return;
    clearTimers();

    // Back from the tooltip, or again within the grace period - it stays
    // shown without waiting for the `delay` again
    if (isVisible) return;

    // Right after another one - no waiting between the labels of a toolbar
    if (isDelaySkipped()) {
      show(true);
      return;
    }

    timer.current = setTimeout(() => show(true), delay);
  };

  const hideNow = () => {
    clearTimers();

    setVisible(false);
  };

  // Other tooltips hide this one as they show - with the latest state
  const hideRef = useRef(hideNow);

  useLayoutEffect(() => {
    hideRef.current = hideNow;
  });

  // Leaving the trigger or the tooltip: hidden after the grace period, unless
  // the pointer gets onto the other one (WCAG 1.4.13 hoverable)
  const hideTooltip = (event: React.MouseEvent) => {
    clearTimers();

    // Straight from the tooltip onto the trigger, with no gap between - the
    // portal is inside the trigger in the React tree, so no mouseenter of
    // the trigger would cancel the timer
    const to = event.relatedTarget;
    if (
      to instanceof Node &&
      (triggerRef.current?.contains(to) || tooltipRef.current?.contains(to))
    ) {
      return;
    }

    hideTimer.current = setTimeout(() => {
      // Leaving with the pointer does not end keyboard focus. Interactive
      // content that took the focus stays too, until it loses it. Escape
      // and clicks still dismiss directly through `hideNow`.
      const focused = getActiveElement();
      if (
        focused &&
        (keyboardFocusRef.current === focused ||
          (interactive && tooltipRef.current?.contains(focused)))
      ) {
        return;
      }

      // Left by the pointer - the next trigger it rests on shows its tooltip
      // at once
      if (visibleRef.current && byPointerRef.current) {
        skipDelayUntil = Date.now() + SKIP_DELAY_DURATION;
      }
      setVisible(false);
    }, HIDE_DELAY);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // A click in the tooltip (portals bubble through the React tree) - an
    // interactive one stays open
    if (
      interactive &&
      event.target instanceof Node &&
      tooltipRef.current?.contains(event.target)
    ) {
      onClick?.(event);
      return;
    }

    if (openOnClick) {
      clearTimers();

      if (visibleRef.current) setVisible(false);
      else show(false);
    } else {
      hideNow();
    }

    onClick?.(event);
  };

  // A click on a plain tooltip only hides it - it is not a click on the
  // trigger or on the rows and cards around it (portals bubble through the
  // React tree)
  const handleTooltipClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    hideNow();
  };

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    // Focus from the keyboard shows it right away, while the focused element
    // is announced - not the focus of a click, nor the focus in the panel of
    // a popover or menu the trigger opened
    if (isOwnEvent(event) && event.target.matches(":focus-visible")) {
      keyboardFocusRef.current = event.target;
      clearTimers();
      show(false);
    }
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (keyboardFocusRef.current === event.target) {
      keyboardFocusRef.current = null;
    }
    const tooltip = tooltipRef.current;
    // A click in an interactive tooltip takes the focus from the trigger (to
    // its scrollable list, or to the page) - it stays open under the pointer
    const keepOpen =
      interactive &&
      tooltip != null &&
      ((event.relatedTarget instanceof Node &&
        tooltip.contains(event.relatedTarget)) ||
        tooltip.matches(":hover"));
    if (isOwnEvent(event) && !keepOpen) hideNow();
    onBlur?.(event);
  };

  useEffect(() => clearTimers, []);

  // Escape hides the shown tooltip wherever the focus is (WCAG 1.4.13) - and
  // is used up by it, so a Dialog around stays open. Nothing is consumed
  // while it is hidden, or while an overlay opened later is above it.
  useEffect(() => {
    if (!isShown) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (
        !isEscapeKey(event) ||
        event.defaultPrevented ||
        !isTopmostOverlay(layerId)
      ) {
        return;
      }
      event.preventDefault();
      hideRef.current();
    };

    // Bubble phase, like the popovers and dialogs: after the key handlers of
    // the page - a field that uses up its Escape keeps the tooltip shown
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isShown, layerId]);

  // A modal dialog opened while it is shown - by a shortcut, the pointer
  // resting on the trigger - hides it, unless it is in the dialog: it would
  // paint above the backdrop
  useEffect(() => {
    if (!isShown) return;

    return subscribeToOverlayStack(() => {
      if (isBelowModalOverlay(ancestors)) hideRef.current();
    });
  }, [ancestors, isShown]);

  // One tooltip at a time - the others hide as this one shows, before it is
  // painted. A controlled one is left alone, and leaves the others alone.
  useLayoutEffect(() => {
    if (!isShown || isControlled) return;

    for (const [id, other] of shownTooltips) {
      if (id !== tooltipId) other.hide();
    }
    shownTooltips.set(tooltipId, {
      byPointer: byPointerRef.current,
      hide: () => hideRef.current(),
    });
    return () => {
      shownTooltips.delete(tooltipId);
    };
  }, [isControlled, isShown, tooltipId]);

  // Hidden while the trigger is scrolled out of view - out of the viewport
  // or out of a scrolling container around it
  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const tooltip = tooltipRef.current;
    const rect = trigger.getBoundingClientRect();
    const next = {
      ...place(
        rect,
        tooltip?.offsetWidth ?? 0,
        tooltip?.offsetHeight ?? 0,
        resolveSide(position, rtlRef.current),
        getVisibleArea(),
      ),
      hidden: isOutOfView(rect, clipsRef.current),
    };
    // A scroll that leaves it where it is renders nothing
    setPlacement((current) =>
      current && isSamePlacement(current, next) ? current : next,
    );
  }, [position]);

  // Rendered in a portal (below) so the floating panel escapes any
  // ancestor with overflow-x-auto/hidden instead of being clipped by it.
  // Placed once rendered (it is measured) and again while the page scrolls
  // or resizes - on phones also when the on-screen keyboard or pinch zoom
  // changes the visual viewport.
  useLayoutEffect(() => {
    // Server-rendered open tooltips have no portal until hydration ends.
    // Measure then, with the tooltip's actual dimensions.
    if (!isShown || !isHydrated) return;

    const trigger = triggerRef.current;
    clipsRef.current = trigger ? getClippingAncestors(trigger) : [];
    const own = trigger ? getDirection(trigger) : "ltr";
    rtlRef.current = own === "rtl";
    setDirection(
      own === getDirection(portalContainerRef.current()) ? undefined : own,
    );
    updatePlacement();

    const viewport = window.visualViewport;
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    viewport?.addEventListener("resize", updatePlacement);
    viewport?.addEventListener("scroll", updatePlacement);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
      viewport?.removeEventListener("resize", updatePlacement);
      viewport?.removeEventListener("scroll", updatePlacement);
    };
  }, [isHydrated, isShown, title, updatePlacement]);

  return (
    <div
      {...props}
      className={cn("relative inline-flex", className)}
      data-state={isShown ? "open" : "closed"}
      onBlur={handleBlur}
      onClick={handleClick}
      onFocus={handleFocus}
      onKeyDown={onKeyDown}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      // The tooltip's own ref, and the one given to it
      ref={(element) => {
        triggerRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          triggerRef.current = null;
          detachRef();
        };
      }}
    >
      {/* As wide as the wrapper when a class gives it a width - a child
          with `w-full` then fills it and a long text can be truncated */}
      <span className="flex min-w-0 grow">{describedChildren}</span>

      {isShown &&
        isHydrated &&
        createPortal(
          <ButtonGroupContext value={null}>
            <div
              className={cn(
                // Over the dialogs (50), popovers (50) and toasts (60) - a
                // tooltip can be inside any of them. Forced colors take its
                // background - an outline keeps it apart from the page.
                "fixed z-70 max-w-[calc(100vw-0.5rem)] animate-fade-in rounded bg-neutral-900 px-2 py-1 text-sm font-medium text-white shadow-sm forced-colors:outline",
                nowrap && "whitespace-nowrap",
              )}
              data-side={placement?.side}
              data-state="open"
              dir={direction}
              id={tooltipId}
              onClick={interactive ? undefined : handleTooltipClick}
              // The pointer may move onto the tooltip (WCAG 1.4.13) - it stays
              // shown there and hides after the grace period once left. Not
              // focusable: the focus stays on the trigger it describes.
              onMouseEnter={clearTimers}
              onMouseLeave={hideTooltip}
              ref={tooltipRef}
              role="tooltip"
              style={
                placement
                  ? {
                      left: placement.left,
                      top: placement.top,
                      visibility: placement.hidden ? "hidden" : undefined,
                    }
                  : // Measured before it is placed - hidden meanwhile
                    { left: 0, top: 0, visibility: "hidden" }
              }
            >
              {title}
              {placement && (
                <div
                  className={cn(
                    "absolute h-2 w-2 rotate-45 bg-neutral-900",
                    placement.side === "top" && "-bottom-1 -translate-x-1/2",
                    placement.side === "bottom" && "-top-1 -translate-x-1/2",
                    placement.side === "left" && "-right-1 -translate-y-1/2",
                    placement.side === "right" && "-left-1 -translate-y-1/2",
                  )}
                  style={
                    placement.side === "top" || placement.side === "bottom"
                      ? { left: placement.arrow }
                      : { top: placement.arrow }
                  }
                />
              )}
            </div>
          </ButtonGroupContext>,
          getPortalContainer(),
        )}
    </div>
  );
}
