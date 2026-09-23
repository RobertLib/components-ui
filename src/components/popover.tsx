import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import cn from "../utils/cn";
import {
  isInOverlayTree,
  isTopmostOverlay,
  OverlayContext,
  useOverlayLayer,
} from "./overlay-stack";
import { getNextTabbable, getTabbableElements } from "../utils/tabbable";
import useIsMobile from "../hooks/use-is-mobile";

/**
 * What the panel is for assistive technology - see `PopoverProps.popupRole`.
 */
export type PopoverPopupRole = "dialog" | "menu" | "listbox" | "none";

// Space kept between the panel and the edges of the viewport
const VIEWPORT_MARGIN = 8;

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

export interface PopoverProps extends Omit<
  React.ComponentProps<"div">,
  "content"
> {
  /** Horizontal alignment to the trigger for `top` / `bottom` positions. */
  align?: "left" | "right";
  /** Classes of the floating panel. */
  contentClassName?: string;
  /**
   * Accessible name of the panel when `popupRole` is `dialog`. Without it,
   * a click trigger names the panel.
   */
  contentLabel?: string;
  /** Ref to the floating panel, e.g. to listen to its scrolling. */
  contentRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * `click` only: the trigger contains the control that carries the ARIA
   * state (e.g. the input of a combobox). The wrapper then gets no button
   * role and no tab stop, so no interactive element is nested in another.
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
   * Side of the trigger the panel opens on. `top` / `bottom` flip when there
   * is not enough room.
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
  // the left / right)
  const [contentSize, setContentSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  // Correction that keeps the panel inside the viewport
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  const popoverRef = useRef<HTMLDivElement>(null);
  const internalContentRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);
  const mouseDownInContentRef = useRef(false);
  // Hover mode: the pending close after the pointer left the trigger
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive effective position from available space around the trigger.
  // Lists are limited by max-h-60 (240px) - taller panels (date pickers)
  // are measured once they are open.
  const effectivePosition = useMemo(() => {
    if (!triggerRect) return position;

    if (position === "left" || position === "right") {
      // Not measured yet - the `width` prop is a guess (a CSS length)
      const needed = contentSize?.width ?? (parseFloat(width) || 0);
      const spaceRight = window.innerWidth - triggerRect.right;
      const spaceLeft = triggerRect.left;
      if (
        position === "right" &&
        spaceRight < needed &&
        spaceLeft > spaceRight
      ) {
        return "left" as const;
      }
      if (position === "left" && spaceLeft < needed && spaceRight > spaceLeft) {
        return "right" as const;
      }
      return position;
    }

    const needed = Math.max(contentSize?.height ?? 0, 240);
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    if (
      position === "bottom" &&
      spaceBelow < needed &&
      spaceAbove > spaceBelow
    ) {
      return "top" as const;
    }
    if (position === "top" && spaceAbove < needed && spaceBelow > spaceAbove) {
      return "bottom" as const;
    }
    return position;
  }, [contentSize, position, triggerRect, width]);

  const popoverId = useId();
  const generatedTriggerId = useId();
  const triggerId = props.id ?? generatedTriggerId;

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

  // In the overlay stack shared with dialogs, tooltips and the drawer: a
  // Dialog opened later paints above the panel and gets Escape first
  const { childContext, id: layerId } = useOverlayLayer(openState, {
    getElements: () => [
      popoverRef.current,
      contentRef?.current || internalContentRef.current,
    ],
  });

  const updateTriggerRect = useCallback(() => {
    if (popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      setTriggerRect(rect);
    }
  }, []);

  // The panel follows the trigger while the page scrolls or resizes - on
  // phones also when the on-screen keyboard or pinch zoom changes the visual
  // viewport
  useEffect(() => {
    if (!openState) return;

    updateTriggerRect();

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

  // Check if popover overflows the screen on mobile - only once when triggerRect is first set
  const overflowCheckedRef = useRef(false);

  const heightMeasuredRef = useRef(false);

  useEffect(() => {
    // Reset the flags of an opening when the popover closes - also when a
    // controlled `open` closes it (a pick in a list), so that the next
    // opening measures the trigger where it is then
    if (!openState) {
      overflowCheckedRef.current = false;
      heightMeasuredRef.current = false;
      // Use requestAnimationFrame to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setIsOverflowing(false);
        setContentSize(null);
        setShift({ x: 0, y: 0 });
      });
      return;
    }

    // Measure the panel once per opening, for the side it opens on
    if (triggerRect && !heightMeasuredRef.current) {
      heightMeasuredRef.current = true;
      requestAnimationFrame(() => {
        const contentElement =
          contentRef?.current || internalContentRef.current;
        if (contentElement) {
          setContentSize({
            height: contentElement.offsetHeight,
            width: contentElement.offsetWidth,
          });
        }
      });
    }

    // On mobile, check overflow only once after triggerRect is set
    if (openState && isMobile && triggerRect && !overflowCheckedRef.current) {
      overflowCheckedRef.current = true;
      requestAnimationFrame(() => {
        const contentElement =
          contentRef?.current || internalContentRef.current;
        if (contentElement) {
          const rect = contentElement.getBoundingClientRect();
          const overflows = rect.left < 0 || rect.right > window.innerWidth;
          setIsOverflowing(overflows);
        }
      });
    }
  }, [openState, isMobile, contentRef, triggerRect]);

  // Keep the panel inside the viewport - e.g. a date picker opened from a
  // field at the right edge of the page, or a `left` / `right` panel next
  // to a trigger at the bottom
  useEffect(() => {
    if (!openState || !triggerRect) return;

    const frame = requestAnimationFrame(() => {
      const contentElement = contentRef?.current || internalContentRef.current;

      if (!contentElement || (isMobile && isOverflowing)) {
        if (shift.x !== 0 || shift.y !== 0) setShift({ x: 0, y: 0 });
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

        if (!popoverRef.current?.contains(event.target as Node)) {
          const contentElement =
            contentRef?.current || internalContentRef.current;
          const isClickInsideContent = contentElement?.contains(
            event.target as Node,
          );

          if (!isClickInsideContent) {
            handleOpenChange(false);
          }
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
          event.key === "Escape" &&
          !event.defaultPrevented &&
          isTopmostOverlay(layerId)
        ) {
          // Marked as handled, so a surrounding Dialog stays open
          event.preventDefault();

          const contentElement =
            contentRef?.current || internalContentRef.current;
          const hadFocus = !!contentElement?.contains(document.activeElement);
          handleOpenChange(false);

          // The panel goes away - the focus in it goes back to the trigger
          // instead of the page (a trigger with a control of its own, like
          // a picker, does that itself)
          if (hadFocus && triggerType === "click" && !interactiveTrigger) {
            popoverRef.current?.focus();
          }
        }
      };

      // Capture phase: runs before the key handlers of the trigger
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [
    contentRef,
    handleOpenChange,
    interactiveTrigger,
    layerId,
    openState,
    triggerType,
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
      wrapper.focus();
      return;
    }

    // Past the end of the panel - on to what follows the trigger
    if (tabbables.length > 0 && target !== tabbables.at(-1)) return;
    event.preventDefault();
    handleOpenChange(false);
    (getNextTabbable(wrapper, contentElement) ?? wrapper).focus();
  };

  const handleClick: {
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  } =
    triggerType === "click"
      ? {
          // A trigger with a control of its own stays a plain wrapper
          ...(interactiveTrigger
            ? {}
            : {
                "aria-controls": openState ? popoverId : undefined,
                "aria-expanded": openState,
                "aria-haspopup": popupRole === "none" ? undefined : popupRole,
                role: "button",
                tabIndex: 0,
              }),
          onClick: handleToggle,
          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
            // A trigger with a control of its own manages the focus itself
            if (event.key === "Tab") {
              if (!interactiveTrigger) moveTabFocus(event);
              return;
            }

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
      if (triggerType === "hover" && event.target.matches(":focus-visible")) {
        openOnHover();
      }
      onFocus?.(event);
    },
  };

  const handleContentClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  // Named by a click trigger, unless given a name
  const contentAriaProps =
    popupRole !== "dialog"
      ? {}
      : contentLabel
        ? { "aria-label": contentLabel, role: "dialog" }
        : triggerType === "click" && !interactiveTrigger
          ? { "aria-labelledby": triggerId, role: "dialog" }
          : { role: "dialog" };

  return (
    <div
      {...handleClick}
      {...props}
      {...focusEvents}
      id={triggerId}
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
        triggerType === "click" &&
          "cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
        className,
      )}
      ref={popoverRef}
    >
      {trigger || <div className="absolute inset-0" />}

      {openState &&
        triggerRect &&
        createPortal(
          <div
            className="relative inline-flex"
            style={getAbsoluteStyles().content}
          >
            <div
              className={cn(
                "popover-bridge absolute z-10",
                positions[effectivePosition].bridge,
              )}
              onMouseEnter={() => {
                if (triggerType === "hover") openOnHover();
              }}
              ref={bridgeRef}
            />

            <div
              className={cn(
                "absolute z-10 max-h-60 animate-fade-in overflow-y-auto rounded-md border border-neutral-100 bg-surface shadow-md dark:border-neutral-900 dark:bg-surface-dark",
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
              onClick={handleContentClick}
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
                      minWidth: width,
                      translate:
                        shift.x || shift.y
                          ? `${shift.x}px ${shift.y}px`
                          : undefined,
                    }
              }
            >
              <OverlayContext value={childContext}>{children}</OverlayContext>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
