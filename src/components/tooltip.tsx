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
} from "react";
import { createPortal } from "react-dom";
import cn, { joinTokens } from "../utils/cn";
import {
  isBelowModalOverlay,
  isEscapeKey,
  isTopmostOverlay,
  OverlayContext,
  subscribeToOverlayStack,
  useOverlayLayer,
} from "./overlay-stack";
import { ButtonGroupContext } from "./button-group-context";

type Side = "top" | "bottom" | "left" | "right";

interface Placement {
  /** Offset of the arrow along the edge it is on, in pixels. */
  arrow: number;
  left: number;
  side: Side;
  top: number;
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

export interface TooltipProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** Hover time in milliseconds before the tooltip appears. */
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
  /** Toggle the tooltip on click/tap as well, so it works without a pointer. */
  openOnClick?: boolean;
  /** Side of the trigger the tooltip appears on. */
  position?: "top" | "bottom" | "left" | "right";
  /** Content of the tooltip. */
  title?: React.ReactNode;
}

const GAP = 8;

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
 * nowhere, on the side with the most. It is kept inside the viewport both
 * ways, over the trigger at last.
 */
function place(
  rect: DOMRect,
  width: number,
  height: number,
  preferred: Side,
): Placement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const room: Record<Side, number> = {
    bottom: viewportHeight - rect.bottom - GAP,
    left: rect.left - GAP,
    right: viewportWidth - rect.right - GAP,
    top: rect.top - GAP,
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
    clamp(left, VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
  const clampTop = (top: number) =>
    clamp(top, VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN);

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
 * on click with `openOnClick`), rendered in a portal. Keyboard focus shows
 * it without the `delay`, and a single child element - the button or link it
 * explains - is described by it, so screen readers read it on focus.
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
  openOnClick = false,
  position = "right",
  title,
  ...props
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const ancestors = use(OverlayContext);
  const hasTitle = title != null && title !== "";
  const isShown = isVisible && hasTitle;

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
  const show = () => {
    if (!isBelowModalOverlay(ancestors)) setIsVisible(true);
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

    timer.current = setTimeout(show, delay);
  };

  const hideNow = () => {
    clearTimers();

    setIsVisible(false);
  };

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
      setIsVisible(false);
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

      setIsVisible((visible) => !visible);
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
      clearTimers();
      show();
    }
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
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
      hideNow();
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
      if (isBelowModalOverlay(ancestors)) hideNow();
    });
  }, [ancestors, isShown]);

  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const tooltip = tooltipRef.current;
    setPlacement(
      place(
        trigger.getBoundingClientRect(),
        tooltip?.offsetWidth ?? 0,
        tooltip?.offsetHeight ?? 0,
        position,
      ),
    );
  }, [position]);

  // Rendered in a portal (below) so the floating panel escapes any
  // ancestor with overflow-x-auto/hidden instead of being clipped by it.
  // Placed once rendered (it is measured) and again while the page scrolls
  // or resizes.
  useLayoutEffect(() => {
    if (!isShown) return;

    updatePlacement();

    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isShown, title, updatePlacement]);

  return (
    <div
      {...props}
      className={cn("relative inline-flex", className)}
      onBlur={handleBlur}
      onClick={handleClick}
      onFocus={handleFocus}
      onKeyDown={onKeyDown}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      ref={triggerRef}
    >
      {/* As wide as the wrapper when a class gives it a width - a child
          with `w-full` then fills it and a long text can be truncated */}
      <span className="flex min-w-0 grow">{describedChildren}</span>

      {isShown &&
        createPortal(
          <ButtonGroupContext value={null}>
            <div
              className={cn(
                // Over the dialogs (50), popovers (50) and toasts (60) - a
                // tooltip can be inside any of them
                "fixed z-70 max-w-[calc(100vw-0.5rem)] animate-fade-in rounded bg-neutral-900 px-2 py-1 text-sm font-medium text-white shadow-sm",
                nowrap && "whitespace-nowrap",
              )}
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
                  ? { left: placement.left, top: placement.top }
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
          document.body,
        )}
    </div>
  );
}
