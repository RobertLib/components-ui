import {
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn from "../utils/cn";
import MenuList from "./menu/menu-list";
import MenuPopup from "./menu/menu-popup";
import { pointRect, type AnchorRect, type Point } from "./menu/position";
import { isSkippedEntry, type DropdownEntry } from "./menu/types";
import {
  getActiveElement,
  getDirection,
  getElementByIdAt,
  getEventTarget,
  getFocusReturnTargetsWithNeighbors,
  isEscapeKey,
  isInOverlayTree,
  isTopmostOverlay,
  noteFocusLoss,
  OverlayContext,
  returnFocus,
  useOverlayLayer,
} from "./overlay-stack";
import { attachRef } from "../hooks/use-form-control";
import { usePortalContainer } from "../providers/ui-context";

export interface ContextMenuProps extends Omit<
  React.ComponentProps<"div">,
  "aria-label" | "children" | "ref"
> {
  /** Accessible name of the menu, e.g. "Actions for report.pdf". */
  "aria-label"?: string;
  /**
   * The element the menu belongs to, e.g. a row. A single element gets the
   * event handlers itself - and `ref`, the `className` and the other props
   * given to the context menu, merged with its own; it must pass them on
   * to the DOM, as native elements and the library's components do.
   * Anything else is wrapped in a `<div>` that gets them. Make it focusable
   * (`tabIndex={0}`) for the keyboard.
   */
  children: React.ReactNode;
  /** The browser's own context menu shows instead. */
  disabled?: boolean;
  /**
   * Menu entries - the same as the items of `Dropdown`. Without any, the
   * browser's own menu shows.
   */
  items: DropdownEntry[];
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The target - the element given as `children` (along with its own ref),
   * or the `<div>` around anything else.
   */
  ref?: React.Ref<HTMLElement>;
}

interface TargetProps {
  className?: string;
  "data-state"?: string;
  onContextMenu?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLElement>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  onPointerUp?: React.PointerEventHandler<HTMLElement>;
  ref?: React.Ref<HTMLElement>;
  style?: React.CSSProperties;
}

/**
 * The props given to the context menu for its target, merged into the own
 * props of a single element: event handlers both run (the element's
 * first), the rest are the context menu's.
 */
function mergeTargetProps(
  own: Record<string, unknown>,
  given: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(given).map(([key, value]) => {
      const ownValue = own[key];
      return /^on[A-Z]/.test(key) &&
        typeof value === "function" &&
        typeof ownValue === "function"
        ? [
            key,
            (...args: unknown[]) => {
              ownValue(...args);
              value(...args);
            },
          ]
        : [key, value];
    }),
  );
}

interface OpenMenu {
  anchor: AnchorRect;
  /** The writing direction of the target - the menu takes it. */
  dir: "ltr" | "rtl";
  /** Space between the anchor and the menu. */
  gap: number;
  /** Opened from the keyboard - with the first item highlighted. */
  highlight: boolean;
  /** Where the focus goes back once the menu closes. */
  returnFocus: HTMLElement | null;
  /**
   * Where the focus in the menu goes once it is gone, best first: to
   * `returnFocus`, or when a pick removed it (a deleted row) to the Tab stop
   * next to it - read while it is still there.
   */
  returnTargets: HTMLElement[];
}

// A touch held this long opens the menu
const LONG_PRESS_DELAY = 500;

// A touch that moves farther is a scroll, not a long press
const LONG_PRESS_TOLERANCE = 10;

// Where the text selection and the callout of a long press on a phone would
// get in the way of the menu
const TOUCH_TARGET_CLASSES =
  "[-webkit-touch-callout:none] pointer-coarse:select-none";

// Pointer events a context menu inside another one has handled - the outer
// one leaves them alone, the innermost menu opens
const handledEvents = new WeakSet<Event>();

/**
 * The click that may follow a long press is no pick in the menu that has
 * just opened under the finger. A click of the keyboard (`detail` 0) goes
 * through; the next touch ends the watch.
 */
function swallowNextClick() {
  const stop = () => {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", stop, true);
  };
  const swallow = (event: MouseEvent) => {
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
    stop();
  };

  window.addEventListener("click", swallow, true);
  window.addEventListener("pointerdown", stop, true);
}

/**
 * A touch held on the target without moving - a scroll moves the finger.
 * The handlers go on the target; `onLongPress` gets the point of the touch
 * and the target.
 */
function useLongPress(
  enabled: boolean,
  onLongPress: (point: Point, target: Element) => void,
) {
  const pressRef = useRef<{
    id: number;
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  const onLongPressRef = useRef(onLongPress);

  useLayoutEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  const cancel = () => {
    if (pressRef.current) clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };

  // A long press about to open the menu must not outlive the target
  useEffect(() => cancel, []);

  return {
    cancel,
    onPointerDown: (event: React.PointerEvent) => {
      if (
        !enabled ||
        event.pointerType !== "touch" ||
        handledEvents.has(event.nativeEvent)
      ) {
        return;
      }
      handledEvents.add(event.nativeEvent);
      cancel();

      const { clientX: x, clientY: y, currentTarget, pointerId } = event;
      pressRef.current = {
        id: pointerId,
        timer: setTimeout(() => {
          pressRef.current = null;
          onLongPressRef.current({ x, y }, currentTarget);
        }, LONG_PRESS_DELAY),
        x,
        y,
      };
    },
    onPointerEnd: (event: React.PointerEvent) => {
      if (pressRef.current?.id === event.pointerId) cancel();
    },
    onPointerMove: (event: React.PointerEvent) => {
      const press = pressRef.current;
      if (
        press &&
        event.pointerId === press.id &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >
          LONG_PRESS_TOLERANCE
      ) {
        cancel();
      }
    },
  };
}

/**
 * Rendered in the menu. When the menu goes away with the focus in it -
 * after a pick, on a click outside - the focus goes back to where it was
 * before the menu opened (or next to it, when the pick removed it) instead
 * of to the page.
 */
function FocusRescue({
  findPanel,
  targets,
}: {
  /** The panel - its ref is gone by the time it goes away. */
  findPanel: () => HTMLElement | null;
  /** Where the focus goes, best first. */
  targets: HTMLElement[];
}) {
  const callbacksRef = useRef({ findPanel, targets });

  useLayoutEffect(() => {
    callbacksRef.current = { findPanel, targets };
  });

  useLayoutEffect(
    () => () => {
      const panel = callbacksRef.current.findPanel();
      const active = getActiveElement();
      if (!active || !panel?.contains(active)) return;

      // A Dialog opened by the pick that closed the menu finds the focus on
      // the page body - it gives it back to where this focus would go
      noteFocusLoss(active);

      const { targets } = callbacksRef.current;
      queueMicrotask(() => {
        const current = getActiveElement();
        if (!panel.isConnected && (!current || current === document.body)) {
          returnFocus(targets);
        }
      });
    },
    [],
  );

  return null;
}

/**
 * A menu of actions for an element, e.g. a row of a list - opened at the
 * pointer by a right click, by a long press on touch screens, and from the
 * keyboard next to the focused element (Shift + F10 or the context menu
 * key). The items and keys are those of `Dropdown`; it closes on Escape, a
 * click outside, scrolling and resizing. `ref` and the other props go to
 * the target (see `children`), which has `data-state="open"` or `"closed"`;
 * the menu has `data-state="open"`, the `data-side` and `data-align` it is
 * shown at, and the data attributes of the menus on its items.
 */
export default function ContextMenu({
  "aria-label": ariaLabel,
  children,
  className,
  disabled = false,
  items,
  onContextMenu,
  onKeyDown,
  onOpenChange,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ref,
  ...props
}: ContextMenuProps) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const getPortalContainer = usePortalContainer();

  const generatedId = useId();
  const menuId = `context-menu-${generatedId}`;
  const panelId = `${menuId}-panel`;
  // Before its ref is set, and as it goes away - in the document or the
  // shadow root the menu is rendered into
  const findPanel = () => getElementByIdAt(getPortalContainer(), panelId);
  const enabled = !disabled && items.some((entry) => !isSkippedEntry(entry));
  const isOpen = menu !== null && enabled;

  // In the overlay stack shared with dialogs and popovers: Escape goes to
  // the topmost overlay, a Dialog around lets the focus into the menu, and
  // a Dialog opened from the menu gives the focus back to where it was
  // before the menu opened
  const { childContext, id: layerId } = useOverlayLayer(isOpen, {
    getElements: () => [
      // Going away: the panel is still in the page, its ref is not
      panelRef.current ?? findPanel(),
    ],
    getFocusFallback: () => menu?.returnFocus,
  });

  const closeMenu = () => {
    if (!menu) return;
    setMenu(null);
    onOpenChange?.(false);
  };

  const giveFocusBack = () => {
    const target = menu?.returnFocus;
    if (target?.isConnected) target.focus({ preventScroll: true });
  };

  // The listeners below always call the latest of them
  const closeRef = useRef(closeMenu);
  const giveFocusBackRef = useRef(giveFocusBack);

  useLayoutEffect(() => {
    closeRef.current = closeMenu;
    giveFocusBackRef.current = giveFocusBack;
  });

  const openMenu = (
    anchor: AnchorRect,
    gap: number,
    highlight: boolean,
    target: Element,
  ) => {
    // Opened once already - on Android a long press fires `contextmenu` too
    if (menu) return;

    const active = getActiveElement();
    const focused =
      active instanceof HTMLElement && active !== document.body ? active : null;
    setMenu({
      anchor,
      dir: getDirection(target),
      gap,
      highlight,
      returnFocus: focused,
      // Read now: a row a pick deletes leaves the page before the menu
      returnTargets: getFocusReturnTargetsWithNeighbors(focused),
    });
    onOpenChange?.(true);
  };

  // Escape closes the menu once it is the topmost overlay - a submenu goes
  // first - and gives the focus back
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isEscapeKey(event) ||
        event.defaultPrevented ||
        !isTopmostOverlay(layerId)
      ) {
        return;
      }
      event.preventDefault();
      if (isInOverlayTree(layerId, getActiveElement())) {
        giveFocusBackRef.current();
      }
      closeRef.current();
    };

    // Bubble phase, like the other overlays - a control in custom content
    // that uses up its Escape keeps the menu open
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, layerId]);

  // A press outside the menu and its submenus closes it, and so does the
  // page scrolling or resizing under it - not a scroll inside the menu
  useEffect(() => {
    if (!isOpen) return;

    // The path, not the target: in a shadow root the target seen here is
    // its host
    const closeFromOutside = (event: Event) => {
      if (!isInOverlayTree(layerId, getEventTarget(event))) closeRef.current();
    };
    const close = () => closeRef.current();

    document.addEventListener("pointerdown", closeFromOutside, true);
    window.addEventListener("scroll", closeFromOutside, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      window.removeEventListener("scroll", closeFromOutside, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, layerId]);

  // Disabled - or left without items - while open
  useEffect(() => {
    if (menu && !enabled) closeRef.current();
  }, [enabled, menu]);

  // A long press on a touch screen opens the menu at the finger
  const longPress = useLongPress(enabled, (point, target) => {
    swallowNextClick();
    openMenu(pointRect(point), 2, false, target);
  });

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (!enabled || event.defaultPrevented) return;
    event.preventDefault();
    longPress.cancel();

    // A right click or a long press has its point on the target. The
    // context menu key, Shift + F10 and screen readers fire the event at
    // the element or at 0, 0 - the menu goes next to the element then.
    const { clientX: x, clientY: y } = event;
    const rect = event.currentTarget.getBoundingClientRect();
    const atPointer =
      (x !== 0 || y !== 0) &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom;

    if (atPointer) {
      openMenu(pointRect({ x, y }), 2, false, event.currentTarget);
    } else {
      const element =
        event.target instanceof Element ? event.target : event.currentTarget;
      openMenu(element.getBoundingClientRect(), 4, true, element);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!enabled || event.defaultPrevented) return;

    const isMenuKey =
      event.key === "ContextMenu" ||
      (event.key === "F10" &&
        event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey);
    if (!isMenuKey) return;

    // Instead of the browser's menu - also its `contextmenu` event
    event.preventDefault();
    const element =
      event.target instanceof Element ? event.target : event.currentTarget;
    openMenu(element.getBoundingClientRect(), 4, true, element);
  };

  // The keys the menu uses do not reach the page - a list or a table around
  // the target may have its own. Tab leaves the menu as if it were not
  // there: on from where the focus was, Shift + Tab back to it.
  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      const target = menu?.returnFocus;
      if (target?.isConnected) {
        target.focus({ preventScroll: true });
        if (event.shiftKey) event.preventDefault();
      } else {
        event.preventDefault();
      }
      closeMenu();
      return;
    }

    if (event.defaultPrevented && event.key !== "Escape") {
      event.stopPropagation();
    }
  };

  // The consumer's handlers first - those of the element, then those given
  // to the context menu. One that prevents the default keeps the menu
  // closed.
  const targetHandlers = (own: TargetProps) => ({
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      own.onContextMenu?.(event);
      onContextMenu?.(event as React.MouseEvent<HTMLDivElement>);
      handleContextMenu(event);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      own.onKeyDown?.(event);
      onKeyDown?.(event as React.KeyboardEvent<HTMLDivElement>);
      handleKeyDown(event);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
      own.onPointerCancel?.(event);
      onPointerCancel?.(event as React.PointerEvent<HTMLDivElement>);
      longPress.onPointerEnd(event);
    },
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      own.onPointerDown?.(event);
      onPointerDown?.(event as React.PointerEvent<HTMLDivElement>);
      longPress.onPointerDown(event);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      own.onPointerMove?.(event);
      onPointerMove?.(event as React.PointerEvent<HTMLDivElement>);
      longPress.onPointerMove(event);
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      own.onPointerUp?.(event);
      onPointerUp?.(event as React.PointerEvent<HTMLDivElement>);
      longPress.onPointerEnd(event);
    },
  });

  const state = isOpen ? "open" : "closed";
  const touchClasses = enabled && TOUCH_TARGET_CLASSES;

  let target: React.ReactNode;
  if (isValidElement<TargetProps>(children) && children.type !== Fragment) {
    const own = children.props;
    target = cloneElement(children, {
      ...mergeTargetProps(own as Record<string, unknown>, props),
      ...targetHandlers(own),
      className: cn(own.className, className, touchClasses),
      // An own `data-state` of the element stays
      "data-state": own["data-state"] ?? state,
      style: props.style ? { ...own.style, ...props.style } : own.style,
      // Its own ref, and the one given to the context menu
      ref: (element: HTMLElement | null) => {
        const detachOwn = attachRef(own.ref, element);
        const detachGiven = attachRef(ref, element);
        return () => {
          detachOwn();
          detachGiven();
        };
      },
    });
  } else {
    target = (
      <div
        {...props}
        className={cn(touchClasses, className) || undefined}
        data-state={state}
        // Typed for any element the target may be - a div is one
        ref={ref as React.Ref<HTMLDivElement>}
        {...targetHandlers({})}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {target}
      {isOpen && menu && (
        <MenuPopup
          dir={menu.dir}
          gap={menu.gap}
          getAnchor={() => menu.anchor}
          id={panelId}
          onKeyDown={handlePanelKeyDown}
          panelRef={panelRef}
          placement="anchor"
        >
          <OverlayContext value={childContext}>
            <MenuList
              aria-label={ariaLabel}
              entries={items}
              id={menuId}
              initialFocus={menu.highlight ? "first" : "menu"}
              onClose={closeMenu}
            />
          </OverlayContext>
          <FocusRescue findPanel={findPanel} targets={menu.returnTargets} />
        </MenuPopup>
      )}
    </>
  );
}
