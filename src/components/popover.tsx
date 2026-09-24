import { createPortal } from "react-dom";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cn from "../utils/cn";
import {
  isEscapeKey,
  isInOverlayTree,
  isTopmostOverlay,
  noteFocusLoss,
  OverlayContext,
  useOverlayLayer,
} from "./overlay-stack";
import { getNextTabbable, getTabbableElements } from "../utils/tabbable";
import useIsMobile from "../hooks/use-is-mobile";
import { ButtonGroupContext } from "./button-group-context";

/**
 * What the panel is for assistive technology - see `PopoverProps.popupRole`.
 */
export type PopoverPopupRole = "dialog" | "menu" | "listbox" | "none";

// Space kept between the panel and the edges of the viewport
const VIEWPORT_MARGIN = 8;

// Space between the panel and its trigger (`mt-2` and the like)
const PANEL_GAP = 8;

// The panel in its place - shared, so resetting it renders nothing anew
const NO_SHIFT = { x: 0, y: 0 };

const OPPOSITE_SIDE = {
  bottom: "top",
  left: "right",
  right: "left",
  top: "bottom",
} as const;

/** Calls the consumer's handler, then the internal one unless prevented. */
function callHandlers<E extends React.SyntheticEvent>(
  event: E,
  consumer: ((event: E) => void) | undefined,
  internal: ((event: E) => void) | undefined,
) {
  consumer?.(event);
  if (!event.defaultPrevented) internal?.(event);
}

// Controls in a trigger that handle Enter and Space themselves, e.g. the
// clear button of a date picker
const NESTED_CONTROL =
  "a[href], button, input:not([readonly]), select, textarea, [role=button]";

/** The `aria-*` props of `props` - an `undefined` one does not count. */
const pickAriaProps = (props: object) =>
  Object.fromEntries(
    Object.entries(props).filter(
      ([key, value]) => key.startsWith("aria-") && value !== undefined,
    ),
  );

/**
 * Rendered in the panel. When the panel goes away with the focus in it -
 * closed by the parent after a pick, a submitted form - the focus goes to
 * the trigger instead of the page. The cleanup of a component in the panel
 * runs while the panel is still in the page; whether the panel really went
 * away (and not only its effects, as StrictMode does on mount) and the
 * focus with it is clear once the commit is done.
 */
function FocusRescue({
  onRescue,
  panelId,
}: {
  /**
   * Gives the focus to the trigger - left out when the trigger has a control
   * of its own that manages the focus.
   */
  onRescue?: () => void;
  /** Id of the panel. */
  panelId: string;
}) {
  const onRescueRef = useRef(onRescue);

  useLayoutEffect(() => {
    onRescueRef.current = onRescue;
  });

  useLayoutEffect(
    () => () => {
      const panel = document.getElementById(panelId);
      const active = document.activeElement;
      if (!active || !panel?.contains(active)) return;

      // A Dialog opened in the same commit - by the pick that closed the
      // panel - finds the focus on the page body; it gives it back to where
      // this focus would go (the trigger) once it closes
      noteFocusLoss(active);

      queueMicrotask(() => {
        const active = document.activeElement;
        if (!panel.isConnected && (!active || active === document.body)) {
          onRescueRef.current?.();
        }
      });
    },
    [panelId],
  );

  return null;
}

export interface PopoverProps extends Omit<
  React.ComponentProps<"div">,
  "content"
> {
  /** Horizontal alignment to the trigger for `top` / `bottom` positions. */
  align?: "left" | "right";
  /**
   * `click` only: `trigger` is a button itself - a `Button`, an
   * `IconButton`, a `<button>`. The popover's button semantics
   * (`aria-expanded`, `aria-haspopup`, `aria-controls` and the `aria-*`
   * props given to the popover) and the focus go onto it, instead of a
   * `div role="button"` wrapped around it - no button nested in another,
   * one tab stop. The element must pass these props on to the button it
   * renders, as `Button` and `IconButton` do.
   */
  buttonTrigger?: boolean;
  /** Classes of the floating panel. */
  contentClassName?: string;
  /**
   * Accessible name of the panel when `popupRole` is `dialog`. Without it,
   * the trigger names the panel - its text, for a hover trigger (give an
   * icon-only one a `contentLabel`).
   */
  contentLabel?: string;
  /** Ref to the floating panel, e.g. to listen to its scrolling. */
  contentRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * `click` only: the trigger contains the control that carries the ARIA
   * state (e.g. the input of a combobox). The wrapper then gets no button
   * role and no tab stop, so no interactive element is nested in another,
   * and leaves Enter and Space to the control.
   */
  interactiveTrigger?: boolean;
  /** Called when the popover opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Controls the open state; leave out to let the popover manage it. */
  open?: boolean;
  /**
   * What the panel is for assistive technology, and so the `aria-haspopup`
   * of a click trigger:
   * - `dialog` (default) - the panel is a `role="dialog"`.
   * - `menu` / `listbox` - the panel is a plain wrapper around the element
   *   with that role you render in it (pass its id as `aria-controls`).
   * - `none` - the panel has no role and the trigger no `aria-haspopup`.
   */
  popupRole?: PopoverPopupRole;
  /**
   * Side of the trigger the panel opens on. It opens on the other side when
   * it does not fit and there is more room there; a panel that fits on
   * neither side is made as tall as the room and scrolls.
   */
  position?: "top" | "bottom" | "left" | "right";
  /** The element the panel is attached to. */
  trigger?: React.ReactNode;
  /** Open on hover, or toggle on click / Enter / Space. */
  triggerType?: "hover" | "click";
  /** Minimum width of the panel (any CSS length). */
  width?: string;
}

/**
 * A floating panel attached to a trigger, opened on hover or click. It is
 * rendered in a portal, so no `overflow` container clips it. Tab moves from
 * a click trigger into the open panel and out of it to what follows the
 * trigger; Escape closes it and gives the focus back to the trigger.
 */
export default function Popover({
  align = "left",
  buttonTrigger = false,
  className,
  contentClassName,
  contentLabel,
  contentRef,
  children,
  interactiveTrigger = false,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onOpenChange,
  open: controlledOpen,
  popupRole = "dialog",
  position = "right",
  trigger,
  triggerType = "hover",
  width = "200px",
  ...props
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  // Size of the open panel - decides whether it fits below / above (or to
  // the left / right). The height is the one of its content, also while
  // the panel is held to the room on its side.
  const [contentSize, setContentSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  // Correction that keeps the panel inside the viewport
  const [shift, setShift] = useState(NO_SHIFT);
  const isMobile = useIsMobile();

  const popoverRef = useRef<HTMLDivElement>(null);
  const internalContentRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);
  const mouseDownInContentRef = useRef(false);
  // Hover mode: the pending close after the pointer left the trigger
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The popover gives the focus back to its trigger - which does not open a
  // hover popover again
  const returningFocusRef = useRef(false);

  // The side the panel opens on, from the room around the trigger: the
  // other side when it does not fit and there is more room there. A panel
  // that fits on neither side gets a max height - it scrolls instead of
  // reaching out of the viewport. Until the panel is measured, a list is
  // taken to be as tall as its max-h-60 (240px) and a side panel as wide as
  // `width` (a CSS length).
  const placement = useMemo((): {
    maxHeight?: number;
    side: NonNullable<PopoverProps["position"]>;
  } => {
    if (!triggerRect) return { side: position };

    const room = {
      bottom:
        window.innerHeight - triggerRect.bottom - PANEL_GAP - VIEWPORT_MARGIN,
      left: triggerRect.left - PANEL_GAP - VIEWPORT_MARGIN,
      right:
        window.innerWidth - triggerRect.right - PANEL_GAP - VIEWPORT_MARGIN,
      top: triggerRect.top - PANEL_GAP - VIEWPORT_MARGIN,
    };
    const isSide = position === "left" || position === "right";
    const needed = isSide
      ? (contentSize?.width ?? (parseFloat(width) || 0))
      : (contentSize?.height ?? 240);
    const other = OPPOSITE_SIDE[position];
    const side =
      room[position] < needed && room[other] > room[position]
        ? other
        : position;

    // Held to the room once measured - a side panel, which is moved up into
    // the viewport, to the height of the viewport
    const heightRoom = isSide
      ? window.innerHeight - 2 * VIEWPORT_MARGIN
      : room[side];
    return contentSize && contentSize.height > heightRoom
      ? { maxHeight: Math.max(heightRoom, 0), side }
      : { side };
  }, [contentSize, position, triggerRect, width]);
  const effectivePosition = placement.side;

  const popoverId = useId();
  const generatedTriggerId = useId();

  // A button given as the trigger is the trigger itself - with its own id,
  // or the one given to the popover
  const buttonElement =
    buttonTrigger &&
    triggerType === "click" &&
    !interactiveTrigger &&
    isValidElement<{ id?: string }>(trigger)
      ? trigger
      : null;
  const triggerId = buttonElement?.props.id ?? props.id ?? generatedTriggerId;

  const isControlled = controlledOpen !== undefined;
  const openState = isControlled ? controlledOpen : isOpen;

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setIsOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange],
  );

  const isButtonTrigger = !!buttonElement;

  // What has the focus of the trigger: the wrapper when it is the button,
  // otherwise the first control in it - a `buttonTrigger`, or the focusable
  // trigger of a hover popover
  const getTriggerFocusTarget = useCallback(() => {
    const wrapper = popoverRef.current;
    if (!wrapper) return null;
    if (wrapper.hasAttribute("tabindex")) return wrapper;
    if (isButtonTrigger) return wrapper.firstElementChild as HTMLElement | null;
    return getTabbableElements(wrapper)[0] ?? null;
  }, [isButtonTrigger]);

  const focusTrigger = useCallback(() => {
    returningFocusRef.current = true;
    getTriggerFocusTarget()?.focus();
    returningFocusRef.current = false;
  }, [getTriggerFocusTarget]);

  // In the overlay stack shared with dialogs, tooltips and the drawer: a
  // Dialog opened later paints above the panel and gets Escape first. A
  // Dialog opened from a button in the panel gives the focus back to the
  // trigger once that button is gone with the closed panel.
  const { childContext, id: layerId } = useOverlayLayer(openState, {
    getElements: () => [
      popoverRef.current,
      contentRef?.current ||
        internalContentRef.current ||
        // Mounting: something in the panel takes the focus (`autoFocus`, a
        // ref callback) before the ref of the panel is set
        document.getElementById(popoverId),
    ],
    getFocusFallback: getTriggerFocusTarget,
  });

  // The panel is attached to the button given as the trigger - the wrapper
  // around it may be wider (a block) - or to the wrapper
  const updateTriggerRect = useCallback(() => {
    const wrapper = popoverRef.current;
    if (!wrapper) return;

    const anchor = (isButtonTrigger && wrapper.firstElementChild) || wrapper;
    setTriggerRect(anchor.getBoundingClientRect());
  }, [isButtonTrigger]);

  // Check if popover overflows the screen on mobile - only once when triggerRect is first set
  const overflowCheckedRef = useRef(false);

  // The trigger is measured where it is when the popover opens - before the
  // panel is painted, so it never shows a frame where the trigger was at the
  // last opening (the page may have scrolled since). On closing, what was
  // measured for this opening is reset - also when a controlled `open`
  // closes it (a pick in a list).
  useLayoutEffect(() => {
    if (openState) updateTriggerRect();
  }, [openState, updateTriggerRect]);

  // Reset on closing only - not when the trigger changes while it is open
  useLayoutEffect(() => {
    if (!openState) return;

    return () => {
      overflowCheckedRef.current = false;
      setTriggerRect(null);
      setContentSize(null);
      setIsOverflowing(false);
      setShift(NO_SHIFT);
    };
  }, [openState]);

  // The panel follows the trigger while the page scrolls or resizes - on
  // phones also when the on-screen keyboard or pinch zoom changes the visual
  // viewport
  useEffect(() => {
    if (!openState) return;

    const viewport = window.visualViewport;
    window.addEventListener("resize", updateTriggerRect);
    window.addEventListener("scroll", updateTriggerRect, true);
    viewport?.addEventListener("resize", updateTriggerRect);
    viewport?.addEventListener("scroll", updateTriggerRect);

    return () => {
      window.removeEventListener("resize", updateTriggerRect);
      window.removeEventListener("scroll", updateTriggerRect, true);
      viewport?.removeEventListener("resize", updateTriggerRect);
      viewport?.removeEventListener("scroll", updateTriggerRect);
    };
  }, [openState, updateTriggerRect]);

  // The own max height of the panel (max-h-60, or one of `contentClassName`)
  // - read while the panel is not held to the room on its side
  const panelMaxHeightRef = useRef(Infinity);
  const isPanelShown = openState && !!triggerRect;

  // Measure the open panel, and again whenever its size changes - a list
  // that grows as its options load may no longer fit on its side
  useEffect(() => {
    const contentElement = contentRef?.current || internalContentRef.current;
    if (!isPanelShown || !contentElement) return;

    const measure = () => {
      let height = contentElement.offsetHeight;
      if (contentElement.style.maxHeight) {
        // Held to the room - as tall as its content would make it
        const borders =
          contentElement.offsetHeight - contentElement.clientHeight;
        height = Math.min(
          contentElement.scrollHeight + borders,
          panelMaxHeightRef.current,
        );
      } else {
        panelMaxHeightRef.current =
          parseFloat(getComputedStyle(contentElement).maxHeight) || Infinity;
      }
      const width = contentElement.offsetWidth;

      setContentSize((size) =>
        size?.height === height && size.width === width
          ? size
          : { height, width },
      );
    };

    const frame = requestAnimationFrame(measure);
    // Not in every environment (jsdom) - the panel is measured once then
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    // The content too - it may grow while the panel is held to the room
    for (const element of [contentElement, ...contentElement.children]) {
      observer?.observe(element);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [contentRef, isPanelShown]);

  // On mobile, check overflow only once after triggerRect is set
  useEffect(() => {
    if (!isPanelShown || !isMobile || overflowCheckedRef.current) return;

    const frame = requestAnimationFrame(() => {
      overflowCheckedRef.current = true;
      const contentElement = contentRef?.current || internalContentRef.current;
      if (contentElement) {
        const rect = contentElement.getBoundingClientRect();
        const overflows = rect.left < 0 || rect.right > window.innerWidth;
        setIsOverflowing(overflows);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [contentRef, isMobile, isPanelShown]);

  // Keep the panel inside the viewport - e.g. a date picker opened from a
  // field at the right edge of the page, or a `left` / `right` panel next
  // to a trigger at the bottom
  useEffect(() => {
    if (!openState || !triggerRect) return;

    const frame = requestAnimationFrame(() => {
      const contentElement = contentRef?.current || internalContentRef.current;

      if (!contentElement || (isMobile && isOverflowing)) {
        if (shift.x !== 0 || shift.y !== 0) setShift(NO_SHIFT);
        return;
      }

      // Pushes the range [start, end] into [margin, size - margin], its start
      // first when it does not fit
      const fit = (start: number, end: number, size: number) => {
        let next = 0;
        if (end > size - VIEWPORT_MARGIN) next = size - VIEWPORT_MARGIN - end;
        if (start + next < VIEWPORT_MARGIN) next = VIEWPORT_MARGIN - start;
        return next;
      };

      // The measured box includes the current shift - take it out
      const rect = contentElement.getBoundingClientRect();
      const x = fit(
        rect.left - shift.x,
        rect.right - shift.x,
        window.innerWidth,
      );
      // `top` / `bottom` panels flip instead
      const y =
        effectivePosition === "left" || effectivePosition === "right"
          ? fit(rect.top - shift.y, rect.bottom - shift.y, window.innerHeight)
          : 0;

      if (x !== shift.x || y !== shift.y) setShift({ x, y });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    contentSize,
    contentRef,
    effectivePosition,
    isMobile,
    isOverflowing,
    openState,
    shift,
    triggerRect,
  ]);

  useEffect(() => {
    if (triggerType === "click" && openState) {
      const handleClickOutside = (event: MouseEvent) => {
        // A press in the panel - also in a popover nested in it (the list of
        // an Autocomplete), which is a portal of its own outside the panel,
        // but whose events bubble through the panel before reaching here
        if (mouseDownInContentRef.current) return;

        // The path, not the target: in a shadow root the target seen here is
        // its host, outside the trigger
        const path = event.composedPath();
        const contentElement =
          contentRef?.current || internalContentRef.current;
        const isInside = [popoverRef.current, contentElement].some(
          (element) => !!element && path.includes(element),
        );

        if (!isInside) {
          handleOpenChange(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contentRef, handleOpenChange, openState, triggerType]);

  // The press flag lasts until the button is released anywhere - a press in
  // the panel may end outside it (dragging its scrollbar), and a stuck flag
  // would keep the popover open when the focus leaves
  useEffect(() => {
    if (!openState) {
      mouseDownInContentRef.current = false;
      return;
    }

    const handleMouseUp = () => {
      mouseDownInContentRef.current = false;
    };

    document.addEventListener("mouseup", handleMouseUp, true);
    return () => document.removeEventListener("mouseup", handleMouseUp, true);
  }, [openState]);

  useEffect(() => {
    if (openState) {
      const handleKeyDown = (event: KeyboardEvent) => {
        // One Escape closes one overlay - the topmost, e.g. the list of an
        // Autocomplete and not the popover around it, or a Dialog opened
        // from the panel and not the panel - unless another listener has
        // handled this Escape already
        if (
          isEscapeKey(event) &&
          !event.defaultPrevented &&
          isTopmostOverlay(layerId)
        ) {
          // Marked as handled, so a surrounding Dialog stays open
          event.preventDefault();

          // The panel goes away - the focus in it goes back to the trigger
          // first, instead of to the page (a trigger with a control of its
          // own, like a picker, does that itself)
          const contentElement =
            contentRef?.current || internalContentRef.current;
          if (
            !interactiveTrigger &&
            contentElement?.contains(document.activeElement)
          ) {
            focusTrigger();
          }
          handleOpenChange(false);
        }
      };

      // Bubble phase, like the dialogs: after the key handlers of the trigger
      // and the panel - a field that uses up its Escape (calls
      // `preventDefault`), like the link form of a RichTextEditor, keeps the
      // panel open
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [
    contentRef,
    focusTrigger,
    handleOpenChange,
    interactiveTrigger,
    layerId,
    openState,
  ]);

  // A close pending when the popover unmounts must not fire
  useEffect(
    () => () => {
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    },
    [],
  );

  // The z-index of a Dialog: of the two, the one opened later - later in the
  // page - paints above, so a Dialog opened from the panel covers it
  const getAbsoluteStyles = useCallback(() => {
    if (!triggerRect) return {};

    const triggerTop = triggerRect.top;
    const triggerLeft = triggerRect.left;
    const triggerWidth = triggerRect.width;
    const triggerHeight = triggerRect.height;

    // On mobile, position full width only if overflowing
    if (isMobile && isOverflowing) {
      return {
        content: {
          position: "fixed" as const,
          top: triggerTop,
          left: 0,
          right: 0,
          height: triggerHeight,
          zIndex: 50,
        },
        bridge: {
          position: "fixed" as const,
          top: triggerTop,
          left: 0,
          right: 0,
          height: triggerHeight,
          zIndex: 50,
        },
      };
    }

    return {
      content: {
        position: "fixed" as const,
        top: triggerTop,
        left: triggerLeft,
        width: triggerWidth,
        height: triggerHeight,
        zIndex: 50,
      },
      bridge: {
        position: "fixed" as const,
        top: triggerTop,
        left: triggerLeft,
        width: triggerWidth,
        height: triggerHeight,
        zIndex: 50,
      },
    };
  }, [isMobile, isOverflowing, triggerRect]);

  const positions = {
    top: {
      bridge: "h-2 bottom-full left-0 w-full",
      popover: {
        left: "bottom-full left-0",
        right: "bottom-full right-0",
      },
    },
    bottom: {
      bridge: "h-2 top-full left-0 w-full",
      popover: {
        left: "top-full left-0",
        right: "top-full right-0",
      },
    },
    left: {
      bridge: "w-2 right-full top-0 h-full",
      popover: "right-full top-0",
    },
    right: {
      bridge: "w-2 left-full top-0 h-full",
      popover: "left-full top-0",
    },
  };

  const handleToggle = () => {
    handleOpenChange(!openState);
  };

  // Tab moves between the trigger and the panel as if the panel followed the
  // trigger in the page - it is a portal at the end of it
  const moveTabFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const contentElement = contentRef?.current || internalContentRef.current;
    if (!openState || !contentElement) return;

    const wrapper = event.currentTarget;
    const target = event.target as Node;
    const tabbables = getTabbableElements(contentElement);

    if (wrapper.contains(target)) {
      // From the trigger into the panel
      if (event.shiftKey || tabbables.length === 0) return;
      event.preventDefault();
      tabbables[0].focus();
      return;
    }

    // Keys of a popover nested in the panel reach here too
    if (!contentElement.contains(target)) return;

    if (event.shiftKey) {
      // From the start of the panel back to the trigger
      if (tabbables.length > 0 && target !== tabbables[0]) return;
      event.preventDefault();
      focusTrigger();
      return;
    }

    // Past the end of the panel - on to what follows the trigger
    if (tabbables.length > 0 && target !== tabbables.at(-1)) return;
    event.preventDefault();
    handleOpenChange(false);
    const next = getNextTabbable(wrapper, contentElement);
    if (next) next.focus();
    else focusTrigger();
  };

  // The button semantics of a click trigger - on the wrapper, or on the
  // button given as the trigger
  const triggerAriaProps = {
    "aria-controls": openState ? popoverId : undefined,
    "aria-expanded": openState,
    "aria-haspopup": popupRole === "none" ? undefined : popupRole,
  };

  const handleClick: {
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  } =
    triggerType === "click"
      ? {
          // A trigger with a control of its own stays a plain wrapper, and
          // so does the one around a button trigger
          ...(interactiveTrigger || buttonElement
            ? {}
            : { ...triggerAriaProps, role: "button", tabIndex: 0 }),
          onClick: (event: React.MouseEvent<HTMLDivElement>) => {
            // Clicks in the panel reach here through the portal, and next
            // to a button trigger inside the wrapper - only the trigger
            // itself toggles the popover
            const target = event.target as Node;
            const trigger = buttonElement
              ? getTriggerFocusTarget()
              : event.currentTarget;
            if (trigger?.contains(target)) handleToggle();
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
            // A trigger with a control of its own manages the focus itself
            if (event.key === "Tab") {
              if (!interactiveTrigger) moveTabFocus(event);
              return;
            }

            // - and its keys: the wrapper is no button, and Enter in a
            // read-only field in it still submits the form
            if (interactiveTrigger) return;

            const trigger = event.currentTarget;
            const target = event.target as Element;

            // Key presses inside the panel bubble here through the portal -
            // only the trigger itself toggles the popover
            if (!trigger.contains(target)) return;

            // A control inside the trigger handles its own keys - Enter on
            // a clear button clears the value instead of opening the popover
            const control = target.closest(NESTED_CONTROL);
            if (control && control !== trigger && trigger.contains(control)) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleToggle();
            }
          },
        }
      : {};

  // Hover mode. For React's enter / leave events the panel (a portal) is
  // part of the trigger, so moving between the two fires neither - only
  // leaving both closes the popover.
  const cancelHoverClose = () => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  };

  const openOnHover = () => {
    cancelHoverClose();
    handleOpenChange(true);
  };

  const handleMouseEvents: {
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  } =
    triggerType === "hover"
      ? {
          onMouseEnter: openOnHover,
          onMouseLeave: () => {
            cancelHoverClose();
            hoverCloseTimerRef.current = setTimeout(() => {
              hoverCloseTimerRef.current = null;
              const bridgeElement = bridgeRef.current;
              const contentElement =
                contentRef?.current || internalContentRef.current;

              const isHoveringBridge =
                bridgeElement && bridgeElement.matches(":hover");
              const isHoveringContent =
                contentElement && contentElement.matches(":hover");

              if (!isHoveringBridge && !isHoveringContent) {
                handleOpenChange(false);
              }
            }, 50);
          },
        }
      : {};

  // The popover closes once the focus leaves trigger and panel - to the
  // page, not into an overlay opened inside it (the list of an Autocomplete,
  // a Dialog opened from the panel). React delivers the blur of the panel
  // and of such overlays here too, through their portals. A hover popover
  // opens on keyboard focus (make its trigger focusable with `tabIndex`).
  const focusEvents = {
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null;
      const staysInside =
        !!next &&
        (event.currentTarget.contains(next) || isInOverlayTree(layerId, next));

      // Safari doesn't focus <button> on click, so relatedTarget is null.
      // If mousedown happened inside the portal content, ignore this blur.
      if (openState && !staysInside && !mouseDownInContentRef.current) {
        handleOpenChange(false);
      }
      onBlur?.(event);
    },
    onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
      if (
        triggerType === "hover" &&
        !returningFocusRef.current &&
        event.target.matches(":focus-visible")
      ) {
        openOnHover();
      }
      onFocus?.(event);
    },
  };

  // Named by the trigger, unless given a name - a hover trigger by its text,
  // as the wrapper with the id is not a button then. Not by a trigger with
  // a control of its own, whose text would be its value.
  const contentAriaProps =
    popupRole !== "dialog"
      ? {}
      : contentLabel
        ? { "aria-label": contentLabel, role: "dialog" }
        : !interactiveTrigger
          ? { "aria-labelledby": triggerId, role: "dialog" }
          : { role: "dialog" };

  // A button trigger takes the `aria-*` props given to the popover - they
  // win over its own, which win over the popover's state (`aria-controls`
  // of a menu inside) - and the id; the wrapper keeps the rest
  const ariaProps = buttonElement ? pickAriaProps(props) : {};
  const wrapperProps = buttonElement
    ? Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => !key.startsWith("aria-") && key !== "id",
        ),
      )
    : props;

  return (
    <div
      {...handleClick}
      {...wrapperProps}
      {...focusEvents}
      // A button trigger with an id of its own leaves the popover's to it
      id={
        buttonElement
          ? buttonElement.props.id
            ? props.id
            : undefined
          : triggerId
      }
      onClick={(event) => callHandlers(event, onClick, handleClick.onClick)}
      onKeyDown={(event) =>
        callHandlers(event, onKeyDown, handleClick.onKeyDown)
      }
      onMouseEnter={(event) =>
        callHandlers(event, onMouseEnter, handleMouseEvents.onMouseEnter)
      }
      onMouseLeave={(event) =>
        callHandlers(event, onMouseLeave, handleMouseEvents.onMouseLeave)
      }
      className={cn(
        "popover relative",
        // Not around a button trigger - it has its own look, and the rest
        // of the wrapper (a block) toggles nothing
        triggerType === "click" &&
          !buttonElement &&
          "cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        className,
      )}
      ref={popoverRef}
    >
      {buttonElement
        ? cloneElement(buttonElement, {
            ...triggerAriaProps,
            ...pickAriaProps(buttonElement.props),
            ...ariaProps,
            id: triggerId,
          })
        : trigger || <div className="absolute inset-0" />}

      {openState &&
        triggerRect &&
        createPortal(
          <ButtonGroupContext value={null}>
            {/* Fixed over the trigger, as big as it - the pointer goes
                through to the trigger, only the panel and the bridge take it */}
            <div
              className="pointer-events-none relative inline-flex"
              style={getAbsoluteStyles().content}
            >
              <div
                className={cn(
                  "popover-bridge pointer-events-auto absolute z-10",
                  positions[effectivePosition].bridge,
                )}
                onMouseEnter={() => {
                  if (triggerType === "hover") openOnHover();
                }}
                ref={bridgeRef}
              />

              <div
                className={cn(
                  "pointer-events-auto absolute z-10 max-h-60 animate-fade-in overflow-y-auto rounded-md border border-neutral-100 bg-surface shadow-md dark:border-neutral-900 dark:bg-surface-dark",
                  effectivePosition === "top" || effectivePosition === "bottom"
                    ? positions[effectivePosition].popover[align]
                    : positions[effectivePosition].popover,
                  effectivePosition === "top" && "mb-2",
                  effectivePosition === "bottom" && "mt-2",
                  effectivePosition === "left" && "mr-2",
                  effectivePosition === "right" && "ml-2",
                  isMobile && isOverflowing && "right-0 left-0 mx-2 w-auto",
                  contentClassName,
                )}
                id={popoverId}
                // A click in the panel stays in it - through the portal it would
                // reach the parents of the popover, and a pick in a menu must not
                // also run the `onClick` of a clickable row or card around it (or
                // the `onClick` of the popover). Bubbling `document` listeners
                // miss it too; a capture listener sees it.
                onClick={(event) => event.stopPropagation()}
                onMouseDown={() => {
                  mouseDownInContentRef.current = true;
                }}
                onMouseEnter={() => {
                  if (triggerType === "hover") openOnHover();
                }}
                ref={contentRef || internalContentRef}
                {...contentAriaProps}
                style={
                  isMobile && isOverflowing
                    ? undefined
                    : {
                        maxHeight: placement.maxHeight,
                        minWidth: width,
                        translate:
                          shift.x || shift.y
                            ? `${shift.x}px ${shift.y}px`
                            : undefined,
                      }
                }
              >
                <OverlayContext value={childContext}>{children}</OverlayContext>
                <FocusRescue
                  onRescue={interactiveTrigger ? undefined : focusTrigger}
                  panelId={popoverId}
                />
              </div>
            </div>
          </ButtonGroupContext>,
          document.body,
        )}
    </div>
  );
}
