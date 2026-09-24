import {
  createContext,
  use,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { getTabbableElements } from "../utils/tabbable";

/**
 * One open overlay - a Dialog, the slid-in Drawer, a Popover panel, a
 * Tooltip or one of your own (`useOverlay`). The stack decides which of
 * them gets Escape (the topmost) and which modal one traps the focus (the
 * topmost modal one).
 */
interface OverlayEntry {
  /** Ids of the overlays this one is rendered in, outermost first. */
  ancestors: string[];
  /** The elements of the overlay, e.g. a portaled panel. */
  getElements: () => (Element | null | undefined)[];
  /**
   * Where the focus goes instead of an element of the overlay that is gone
   * by the time the focus should come back to it - the trigger of a
   * popover whose panel has closed.
   */
  getFocusFallback?: () => HTMLElement | null | undefined;
  /** The `useId` of the overlay. */
  id: string;
  /** Traps the focus (Dialog, slid-in Drawer). */
  modal: boolean;
  /**
   * A tooltip - it takes Escape, but no press: a press outside of it is for
   * the overlay under it (the backdrop of a Sheet closes the Sheet).
   */
  tooltip: boolean;
}

// The open overlays, the topmost last - shared by all overlay components
const stack: OverlayEntry[] = [];

/**
 * Regions that stay reachable while a modal overlay traps the focus, like
 * the toasts of `SnackbarProvider`.
 */
export const FOCUS_TRAP_EXEMPT_ATTRIBUTE = "data-focus-trap-exempt";

/** The ids of the overlays around a component, outermost first. */
export const OverlayContext = createContext<string[]>([]);

// Effects run children first, so a Popover opened in the same commit as the
// Dialog it is in registers before it. An overlay goes below the first one
// rendered inside it - the stack follows nesting, then the order of opening.
const register = (entry: OverlayEntry) => {
  const firstDescendant = stack.findIndex((other) =>
    other.ancestors.includes(entry.id),
  );
  if (firstDescendant === -1) stack.push(entry);
  else stack.splice(firstDescendant, 0, entry);
};

const unregister = (id: string) => {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index !== -1) stack.splice(index, 1);
};

const containsNode = (entry: OverlayEntry, node: Node) =>
  entry.getElements().some((element) => !!element?.contains(node));

/** Ids of the open overlays, the topmost last - for tests. */
export const getOverlayStack = () => stack.map((entry) => entry.id);

/**
 * Whether `id` is the topmost open overlay - of all of them, with `modal` of
 * the modal ones, with `press` of those a press outside of them is for:
 * not the tooltips, which stay while their trigger keeps the focus.
 */
export const isTopmostOverlay = (
  id: string,
  { modal = false, press = false } = {},
) =>
  stack
    .filter((entry) => (modal ? entry.modal : !(press && entry.tooltip)))
    .at(-1)?.id === id;

/**
 * Whether a modal overlay is open - a Dialog or Sheet (not while it animates
 * out), the slid-in Drawer, a full-screen DataTable.
 */
export const hasModalOverlay = () => stack.some((entry) => entry.modal);

/**
 * Whether `node` is in the overlay `id` or in an overlay rendered inside it
 * (e.g. the list of an Autocomplete in a Popover, or a Dialog opened from
 * a button in a Popover), which are portals outside its elements.
 */
export const isInOverlayTree = (id: string, node: Node | null | undefined) =>
  !!node &&
  stack.some(
    (entry) =>
      (entry.id === id || entry.ancestors.includes(id)) &&
      containsNode(entry, node),
  );

/**
 * Where the focus goes back to once an overlay that took it from `element`
 * closes, best first: `element` itself, then - for when it is gone by then,
 * like a button in a popover panel that closed as the focus left it - the
 * trigger of the overlay it was in, and so on outwards. Read them when the
 * overlay opens and give the focus to the first one still in the page.
 */
export function getFocusReturnTargets(element: Element | null) {
  const targets: HTMLElement[] = [];
  let current = element;

  while (
    current instanceof HTMLElement &&
    current !== current.ownerDocument.body &&
    !targets.includes(current)
  ) {
    targets.push(current);
    const node: Node = current;
    current =
      stack
        .findLast((entry) => containsNode(entry, node))
        ?.getFocusFallback?.() ?? null;
  }

  return targets;
}

// Where the focus that went away with the elements of a closing overlay
// would have gone back to - for an overlay opened in the same commit
let lostFocusTargets: HTMLElement[] | null = null;

/**
 * Call it when `element`, which has the focus, is about to be removed with
 * the elements of an overlay that is still in the stack - the panel of a
 * popover a pick has closed. An overlay opened in the same commit (a
 * ConfirmDialog opened by that pick) finds the focus on the page body by
 * then; it gives the focus back where `element` would have. It counts until
 * the commit is over (a microtask).
 */
export function noteFocusLoss(element: Element) {
  const targets = getFocusReturnTargets(element);
  lostFocusTargets = targets;
  queueMicrotask(() => {
    if (lostFocusTargets === targets) lostFocusTargets = null;
  });
}

/**
 * `getFocusReturnTargets` of the focused element - or, when the focus has
 * just gone away with a closing overlay (see `noteFocusLoss`), of the
 * element that had it.
 */
export function getActiveFocusReturnTargets() {
  const active = document.activeElement;
  if ((!active || active === document.body) && lostFocusTargets) {
    return lostFocusTargets;
  }
  return getFocusReturnTargets(active);
}

/**
 * Whether `event` is an Escape that closes an overlay - not one that ends
 * the composition of an input method (IME), which belongs to the field.
 */
export const isEscapeKey = (event: KeyboardEvent) =>
  event.key === "Escape" && !event.isComposing && event.keyCode !== 229;

/** Gives the focus to the first of `targets` still in the page. */
export const returnFocus = (targets: HTMLElement[]) =>
  targets.find((target) => target.isConnected)?.focus();

/**
 * Whether `node` is where a modal overlay `id` lets the focus go outside of
 * it: an overlay above it, or a region marked with
 * `FOCUS_TRAP_EXEMPT_ATTRIBUTE`.
 */
const isAllowedOutside = (id: string, node: Node) => {
  const index = stack.findIndex((entry) => entry.id === id);
  const element = node instanceof Element ? node : node.parentElement;

  return (
    !!element?.closest(`[${FOCUS_TRAP_EXEMPT_ATTRIBUTE}]`) ||
    stack.slice(index + 1).some((entry) => containsNode(entry, node))
  );
};

/**
 * The Tab stops of the exempt regions outside `container` - the toasts,
 * which Tab reaches after the last control of a modal overlay.
 */
const getExemptTabbables = (container: HTMLElement) => [
  ...new Set(
    Array.from(
      container.ownerDocument.querySelectorAll(
        `[${FOCUS_TRAP_EXEMPT_ATTRIBUTE}]`,
      ),
    )
      .filter((region) => !container.contains(region))
      .flatMap((region) => getTabbableElements(region)),
  ),
];

interface OverlayLayerOptions {
  /** See `OverlayEntry.getElements`. */
  getElements: () => (Element | null | undefined)[];
  /** See `OverlayEntry.getFocusFallback`. */
  getFocusFallback?: () => HTMLElement | null | undefined;
  /** Traps the focus - the caller does that with `useFocusTrap`. */
  modal?: boolean;
  /** See `OverlayEntry.tooltip`. */
  tooltip?: boolean;
}

/**
 * Registers an overlay in the shared stack while `open`. Wrap what the
 * overlay renders in `<OverlayContext value={childContext}>`, so overlays
 * opened inside it are ordered above it and count as part of it.
 */
export function useOverlayLayer(
  open: boolean,
  {
    getElements,
    getFocusFallback,
    modal = false,
    tooltip = false,
  }: OverlayLayerOptions,
) {
  const id = useId();
  const ancestors = use(OverlayContext);
  const optionsRef = useRef({ getElements, getFocusFallback });

  useLayoutEffect(() => {
    optionsRef.current = { getElements, getFocusFallback };
  });

  // Insertion effects run before the layout phase, in which an `autoFocus`
  // field takes the focus - the overlay is in the stack by then
  useInsertionEffect(() => {
    if (!open) return;

    register(createEntry(id, ancestors, { modal, tooltip }, optionsRef));
    return () => unregister(id);
  }, [ancestors, id, modal, open, tooltip]);

  // React keeps insertion effects when <Activity mode="hidden"> hides the
  // overlay, but runs the cleanup of layout effects - a hidden overlay
  // leaves the stack here, and comes back when it is shown again
  useLayoutEffect(() => {
    if (!open) return;

    if (!stack.some((entry) => entry.id === id)) {
      register(createEntry(id, ancestors, { modal, tooltip }, optionsRef));
    }
    return () => unregister(id);
  }, [ancestors, id, modal, open, tooltip]);

  const childContext = useMemo(() => [...ancestors, id], [ancestors, id]);

  return { childContext, id };
}

const createEntry = (
  id: string,
  ancestors: string[],
  { modal, tooltip }: Pick<OverlayEntry, "modal" | "tooltip">,
  optionsRef: React.RefObject<
    Pick<OverlayLayerOptions, "getElements" | "getFocusFallback">
  >,
): OverlayEntry => ({
  ancestors,
  getElements: () => optionsRef.current.getElements(),
  getFocusFallback: () => optionsRef.current.getFocusFallback?.(),
  id,
  modal,
  tooltip,
});

// One page scroll lock for all modal overlays: the first to open takes it,
// the last to close gives it back. Each restoring what it found would leave
// the page locked when a dialog and its ConfirmDialog close in the same
// commit.
let scrollLocks = 0;
let unlockedStyle = { overflow: "", paddingRight: "" };

/**
 * The width of the page's scrollbar - 0 for overlay scrollbars, which take
 * no room, and when the page keeps a gutter for it anyway
 * (`scrollbar-gutter: stable`).
 */
const getScrollbarWidth = () => {
  const root = document.documentElement;
  // Nothing is laid out (jsdom)
  if (root.clientWidth === 0) return 0;
  if (getComputedStyle(root).scrollbarGutter?.startsWith("stable")) return 0;
  return window.innerWidth - root.clientWidth;
};

export const lockPageScroll = () => {
  if (scrollLocks === 0) {
    const { style } = document.body;
    unlockedStyle = {
      overflow: style.overflow,
      paddingRight: style.paddingRight,
    };

    // The scrollbar goes away with the overflow - its room is kept as
    // padding, so the page does not shift sideways under the overlay
    const scrollbarWidth = getScrollbarWidth();
    if (scrollbarWidth > 0) {
      const padding = parseFloat(getComputedStyle(document.body).paddingRight);
      style.paddingRight = `${(padding || 0) + scrollbarWidth}px`;
    }
    style.overflow = "hidden";
  }
  scrollLocks += 1;

  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      document.body.style.overflow = unlockedStyle.overflow;
      document.body.style.paddingRight = unlockedStyle.paddingRight;
    }
  };
};

/**
 * Keeps the focus in `containerRef` while `active` and `id` is the topmost
 * modal overlay: Tab and Shift+Tab cycle through it - and through the
 * toasts shown over it - and focus that lands outside, after a click on the
 * backdrop or into the page, is brought back. So is focus that falls to the
 * page because the focused element was removed (a Sheet switching from the
 * details of a record to its form): it goes to the container. Overlays
 * above it (a Popover opened in it) and exempt regions (the toasts) stay
 * reachable.
 */
export function useFocusTrap(
  active: boolean,
  id: string,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;

    // The last element that had the focus in the container
    let lastFocused: HTMLElement | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      // A popover inside has moved the focus itself (into or out of its
      // panel, which is a portal outside the container)
      if (
        event.key !== "Tab" ||
        event.defaultPrevented ||
        !container ||
        !isTopmostOverlay(id, { modal: true })
      ) {
        return;
      }

      const current = document.activeElement as HTMLElement | null;
      const exempt = getExemptTabbables(container);
      const exemptIndex = exempt.indexOf(current as HTMLElement);
      // Tab inside a popover panel moves on its own
      if (
        current &&
        exemptIndex === -1 &&
        !container.contains(current) &&
        isAllowedOutside(id, current)
      ) {
        return;
      }

      const tabbables = getTabbableElements(container);

      if (tabbables.length === 0 && exempt.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const moveTo = (element: HTMLElement | undefined) => {
        event.preventDefault();
        (element ?? container).focus();
      };

      // The toasts come after the last control of the container - one by
      // one, as they are a portal elsewhere in the page
      if (exemptIndex !== -1) {
        if (event.shiftKey) {
          moveTo(exemptIndex > 0 ? exempt[exemptIndex - 1] : tabbables.at(-1));
        } else {
          moveTo(exempt[exemptIndex + 1] ?? tabbables[0] ?? exempt[0]);
        }
        return;
      }

      const index = tabbables.indexOf(current as HTMLElement);

      // Also when the focus is not on one of them - on the container, the
      // page body after a click on the backdrop, or outside
      if (event.shiftKey && index <= 0) {
        moveTo(exempt.at(-1) ?? tabbables.at(-1));
      } else if (
        !event.shiftKey &&
        (index === -1 || index === tabbables.length - 1)
      ) {
        moveTo(
          index === -1
            ? (tabbables[0] ?? exempt[0])
            : (exempt[0] ?? tabbables[0]),
        );
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const container = containerRef.current;
      const target = event.target as Node | null;
      if (!container || !target || !isTopmostOverlay(id, { modal: true })) {
        return;
      }

      if (container.contains(target)) {
        lastFocused = target as HTMLElement;
        return;
      }

      if (isAllowedOutside(id, target)) return;

      const back =
        lastFocused && container.contains(lastFocused)
          ? lastFocused
          : (getTabbableElements(container)[0] ?? container);
      back.focus();
    };

    // The focused element was removed with a change of the content - the
    // focus is on the page body then, and no event tells. Checked after a
    // timer: a popover in the container gives the focus of its closed panel
    // back to its trigger in a microtask, and an `autoFocus` field of the new
    // content has taken it by then.
    let rescueTimer: ReturnType<typeof setTimeout> | undefined;
    const rescueFocus = () => {
      rescueTimer = undefined;
      const container = containerRef.current;
      const focused = document.activeElement;
      if (
        container?.isConnected &&
        (!focused || focused === document.body) &&
        isTopmostOverlay(id, { modal: true })
      ) {
        container.focus();
      }
    };
    const observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            if (rescueTimer === undefined) {
              rescueTimer = setTimeout(rescueFocus);
            }
          });
    if (containerRef.current) {
      observer?.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      observer?.disconnect();
      clearTimeout(rescueTimer);
    };
  }, [active, containerRef, id]);
}

/** Options of `useOverlay`. */
export interface UseOverlayOptions {
  /**
   * A modal overlay - a dialog, a panel over the page. While open, the
   * focus moves into `ref` and stays there (Tab cycles through it, focus
   * that lands outside comes back), the page does not scroll, and the focus
   * goes back where it was once it closes. Leave it off for a panel next to
   * the page, like the one of a Popover.
   */
  modal?: boolean;
  /**
   * Called on Escape while the overlay is the topmost open one. That Escape
   * is used up, so the overlays under it stay open.
   */
  onEscape?: () => void;
  /** Whether the overlay is shown - it is in the stack only then. */
  open: boolean;
  /**
   * The element of the overlay. The focus in it, and in overlays opened
   * from it, counts as inside. A modal one takes the focus itself when it
   * has nothing focusable - give it `tabIndex={-1}`.
   */
  ref: React.RefObject<HTMLElement | null>;
}

/** What `useOverlay` returns. */
export interface UseOverlayResult {
  /** Whether the overlay is the topmost open one, e.g. before handling a key. */
  isTopmost: () => boolean;
  /**
   * Render the content of the overlay in `<OverlayScope value={scope}>`, so
   * the popovers and dialogs opened in it stack above it and count as part
   * of it.
   */
  scope: string[];
}

/**
 * Makes an overlay of your own one of the library's: it joins the stack the
 * Dialog, Popover, Tooltip and the slid-in Drawer share. Escape goes to the
 * topmost overlay only, overlays opened later paint and count above it, and
 * a Dialog under it lets the focus into it. With `modal` it traps the focus
 * and locks the page scroll like a Dialog.
 */
export function useOverlay({
  modal = false,
  onEscape,
  open,
  ref,
}: UseOverlayOptions): UseOverlayResult {
  const onEscapeRef = useRef(onEscape);
  const returnFocusRef = useRef<HTMLElement[]>([]);

  useLayoutEffect(() => {
    onEscapeRef.current = onEscape;
  });

  const { childContext, id } = useOverlayLayer(open, {
    getElements: () => [ref.current],
    modal,
  });

  // The topmost overlay closes on Escape - unless an overlay above it, or a
  // control inside it, has handled this Escape already
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isEscapeKey(event) ||
        event.defaultPrevented ||
        !onEscapeRef.current ||
        !isTopmostOverlay(id)
      ) {
        return;
      }
      event.preventDefault();
      onEscapeRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [id, open]);

  const isModalOpen = open && modal;

  // Where the focus was before it opened - before an `autoFocus` field in
  // it takes the focus in the layout phase
  useInsertionEffect(() => {
    if (isModalOpen) {
      returnFocusRef.current = getActiveFocusReturnTargets();
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
    return lockPageScroll();
  }, [isModalOpen]);

  useFocusTrap(isModalOpen, id, ref);

  // In when it opens, unless an `autoFocus` field has the focus already, and
  // back once it closes
  useEffect(() => {
    const container = ref.current;
    if (!isModalOpen || !container) return;

    if (!container.contains(document.activeElement)) {
      (getTabbableElements(container)[0] ?? container).focus();
    }

    const targets = returnFocusRef.current;
    return () => returnFocus(targets);
  }, [isModalOpen, ref]);

  return { isTopmost: () => isTopmostOverlay(id), scope: childContext };
}

/**
 * Provides the `scope` of `useOverlay` to the content of your overlay -
 * `<OverlayScope value={scope}>`.
 */
export const OverlayScope = OverlayContext;
