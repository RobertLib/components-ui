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
 * One open overlay - a Dialog, the slid-in Drawer, a Popover panel or a
 * Tooltip. The stack decides which of them gets Escape (the topmost) and
 * which modal one traps the focus (the topmost modal one).
 */
interface OverlayEntry {
  /** Ids of the overlays this one is rendered in, outermost first. */
  ancestors: string[];
  /** The elements of the overlay, e.g. a portaled panel. */
  getElements: () => (Element | null | undefined)[];
  id: string;
  /** Traps the focus (Dialog, slid-in Drawer). */
  modal: boolean;
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
 * Whether `id` is the topmost open overlay - of all of them, or with
 * `modal` of the modal ones.
 */
export const isTopmostOverlay = (id: string, { modal = false } = {}) =>
  (modal ? stack.filter((entry) => entry.modal) : stack).at(-1)?.id === id;

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

interface OverlayLayerOptions {
  getElements: () => (Element | null | undefined)[];
  modal?: boolean;
}

/**
 * Registers an overlay in the shared stack while `open`. Wrap what the
 * overlay renders in `<OverlayContext value={childContext}>`, so overlays
 * opened inside it are ordered above it and count as part of it.
 */
export function useOverlayLayer(
  open: boolean,
  { getElements, modal = false }: OverlayLayerOptions,
) {
  const id = useId();
  const ancestors = use(OverlayContext);
  const getElementsRef = useRef(getElements);

  useLayoutEffect(() => {
    getElementsRef.current = getElements;
  });

  // Insertion effects run before the layout phase, in which an `autoFocus`
  // field takes the focus - the overlay is in the stack by then
  useInsertionEffect(() => {
    if (!open) return;

    register({
      ancestors,
      getElements: () => getElementsRef.current(),
      id,
      modal,
    });
    return () => unregister(id);
  }, [ancestors, id, modal, open]);

  const childContext = useMemo(() => [...ancestors, id], [ancestors, id]);

  return { childContext, id };
}

// One page scroll lock for all modal overlays: the first to open takes it,
// the last to close gives it back. Each restoring what it found would leave
// the page locked when a dialog and its ConfirmDialog close in the same
// commit.
let scrollLocks = 0;
let unlockedOverflow = "";

export const lockPageScroll = () => {
  if (scrollLocks === 0) {
    unlockedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;

  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = unlockedOverflow;
  };
};

/**
 * Keeps the focus in `containerRef` while `active` and `id` is the topmost
 * modal overlay: Tab and Shift+Tab cycle through it, and focus that lands
 * outside - after a click on the backdrop, or a click into the page - is
 * brought back. Overlays above it (a Popover opened in it) and exempt
 * regions (the toasts) stay reachable.
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

      const current = document.activeElement;
      // Tab inside a popover panel or a toast moves on its own
      if (
        current &&
        !container.contains(current) &&
        isAllowedOutside(id, current)
      ) {
        return;
      }

      const tabbables = getTabbableElements(container);

      if (tabbables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const index = tabbables.indexOf(current as HTMLElement);
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];

      // Also when the focus is not on one of them - on the container, the
      // page body after a click on the backdrop, or outside
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (index === -1 || current === last)) {
        event.preventDefault();
        first.focus();
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

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [active, containerRef, id]);
}
