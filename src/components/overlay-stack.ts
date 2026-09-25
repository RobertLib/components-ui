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
import {
  getNextTabbable,
  getPreviousTabbable,
  getTabbableElements,
} from "../utils/tabbable";

/**
 * One open overlay - a Dialog, the slid-in Drawer, a Popover panel, a
 * Tooltip or one of your own (`useOverlay`). The stack decides which of
 * them gets Escape (the topmost) and which modal one traps the focus (the
 * topmost modal one).
 */
interface OverlayEntry {
  /**
   * Ids of the overlays this one is rendered in, outermost first - and, for
   * a modal one, those it was opened from (see `withOpeners`).
   */
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
  if (firstDescendant === -1) stack.push(withOpeners(entry, stack));
  else {
    stack.splice(
      firstDescendant,
      0,
      withOpeners(entry, stack.slice(0, firstDescendant)),
    );
  }
  syncBackground();
};

const unregister = (id: string) => {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  stack.splice(index, 1);
  syncBackground();
};

/**
 * A modal overlay opened on top of the one in use belongs to it, also when
 * it is rendered elsewhere - the ConfirmDialog of `useConfirm()` asked from
 * a button in a popover, which the provider renders at the root of the app.
 * The popover stays open under it: the focus and the presses in the dialog
 * are not outside the popover.
 */
function withOpeners(entry: OverlayEntry, below: OverlayEntry[]): OverlayEntry {
  if (!entry.modal) return entry;

  // Not a tooltip, which shows only while its trigger is pointed at
  const opener = below.findLast((other) => !other.tooltip);
  if (!opener || entry.ancestors.includes(opener.id)) return entry;

  return {
    ...entry,
    ancestors: [
      ...new Set([...opener.ancestors, opener.id, ...entry.ancestors]),
    ],
  };
}

/** Whether the overlay `entry` is `id` or rendered in it - or opened from it. */
function belongsTo(entry: OverlayEntry, id: string, depth = 0): boolean {
  if (entry.id === id || entry.ancestors.includes(id)) return true;
  // An overlay rendered in a dialog opened from `id` - a guard against
  // cycles, which the stack does not make
  return (
    depth < stack.length &&
    entry.ancestors.some((ancestor) => {
      const parent = stack.find((other) => other.id === ancestor);
      return !!parent && belongsTo(parent, id, depth + 1);
    })
  );
}

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
 * a button in a Popover), which are portals outside its elements - also in
 * a modal one opened from it (the ConfirmDialog of `useConfirm()`).
 */
export const isInOverlayTree = (id: string, node: Node | null | undefined) =>
  !!node &&
  stack.some((entry) => belongsTo(entry, id) && containsNode(entry, node));

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
 * The Tab stops next to `element` in the page, the next one first - where
 * the focus goes once `element` is gone too, e.g. the delete button of a
 * row the dialog it opened has deleted: to the row after it, else to the
 * one before.
 */
function getNeighborStops(element: HTMLElement) {
  return [getNextTabbable(element), getPreviousTabbable(element)].filter(
    (stop) => stop !== undefined,
  );
}

/**
 * `getFocusReturnTargets` of the focused element - or, when the focus has
 * just gone away with a closing overlay (see `noteFocusLoss`), of the
 * element that had it - followed by the Tab stops next to the last of them,
 * for when all of them are gone by the time the overlay closes.
 */
export function getActiveFocusReturnTargets() {
  const active = document.activeElement;
  const targets =
    (!active || active === document.body) && lostFocusTargets
      ? lostFocusTargets
      : getFocusReturnTargets(active);
  const outermost = targets.at(-1);

  return outermost
    ? [...new Set([...targets, ...getNeighborStops(outermost)])]
    : targets;
}

/**
 * The writing direction of `element` - `rtl` in a right-to-left page, or in
 * a part of one with `dir="rtl"`. Menus open their submenus towards it, and
 * a portal in the body takes it from the element it belongs to.
 */
export const getDirection = (element: Element): "ltr" | "rtl" =>
  getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";

/**
 * Whether `event` is an Escape that closes an overlay - not one that ends
 * the composition of an input method (IME), which belongs to the field.
 */
export const isEscapeKey = (event: KeyboardEvent) =>
  event.key === "Escape" && !event.isComposing && event.keyCode !== 229;

/**
 * Gives the focus to the first of `targets` that takes it - still in the
 * page, and not disabled or hidden meanwhile. Those in `leaving` (the
 * overlay animating out) do not count.
 */
export const returnFocus = (targets: HTMLElement[], leaving?: Element | null) =>
  targets.some((target) => {
    if (!target.isConnected || leaving?.contains(target)) return false;
    target.focus();
    return target.ownerDocument.activeElement === target;
  });

// The modal overlays whose focus trap is on - the page behind the topmost
// of them is hidden from assistive technology
const activeTraps = new Set<string>();

// What `syncBackground` has hidden, with the `aria-hidden` it had before
const hiddenBackground = new Map<Element, string | null>();

// Nothing to hide - not rendered, or hidden already
const NOT_HIDDEN = "script, style, link, meta, template, noscript";

const isElement = (element: Element | null | undefined): element is Element =>
  !!element?.isConnected;

/**
 * The elements the page behind the modal overlay `index` of the stack is
 * hidden with: the siblings of everything on the way from the overlay up to
 * the body - but not of the way up from the overlays above it (a popover
 * opened in a dialog) and the exempt regions (the toasts), which stay. Of
 * what follows the overlay in the body - the portals opened from it, of
 * this library or others - only the overlays under it are hidden.
 */
function getBackground(index: number) {
  const modal = stack[index];
  const own = modal.getElements().filter(isElement);
  const body = own[0]?.ownerDocument.body;
  if (!body) return [];

  const below = stack
    .slice(0, index)
    .flatMap((entry) => entry.getElements())
    .filter(isElement);
  const kept = [
    ...own,
    ...stack.slice(index + 1).flatMap((entry) => entry.getElements()),
    ...body.querySelectorAll(`[${FOCUS_TRAP_EXEMPT_ATTRIBUTE}]`),
  ].filter(isElement);

  // The elements on the way up from a kept one - never hidden
  const onPath = new Set<Element>();
  for (const element of kept) {
    for (
      let current: Element | null = element;
      current && current !== body;
      current = current.parentElement
    ) {
      onPath.add(current);
    }
  }

  // The child of the body the overlay is in
  let branch: Element = own[0];
  while (branch.parentElement && branch.parentElement !== body) {
    branch = branch.parentElement;
  }

  const background = new Set<Element>();
  for (const element of onPath) {
    const parent = element.parentElement;
    // Inside the overlay, or inside one above it (a popover in a dialog),
    // nothing is background
    if (!parent || kept.some((other) => other.contains(parent))) continue;

    for (const sibling of parent.children) {
      if (
        onPath.has(sibling) ||
        sibling.matches(NOT_HIDDEN) ||
        (sibling.getAttribute("aria-hidden") === "true" &&
          !hiddenBackground.has(sibling))
      ) {
        continue;
      }
      const isAfterOverlay =
        sibling.parentElement === body &&
        !!(
          branch.compareDocumentPosition(sibling) &
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      if (
        !isAfterOverlay ||
        below.some((element) => sibling.contains(element))
      ) {
        background.add(sibling);
      }
    }
  }
  return [...background];
}

/**
 * Hides the page behind the topmost modal overlay whose focus trap is on
 * from assistive technology (`aria-hidden`), as `aria-modal` alone is not
 * honoured everywhere, and shows it again once the overlay closes. Called
 * whenever the stack or the traps change.
 */
function syncBackground() {
  const index = stack.findLastIndex(
    (entry) => entry.modal && activeTraps.has(entry.id),
  );
  const background = index === -1 ? [] : getBackground(index);

  for (const [element, previous] of hiddenBackground) {
    if (background.includes(element)) continue;
    if (previous === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", previous);
    hiddenBackground.delete(element);
  }
  for (const element of background) {
    if (hiddenBackground.has(element)) continue;
    hiddenBackground.set(element, element.getAttribute("aria-hidden"));
    element.setAttribute("aria-hidden", "true");
  }
}

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
const getExemptTabbables = (container: Element) => [
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

/**
 * Where Tab moves on to from `element`, past `skipped` (the panel of a
 * popover, which is a portal at the end of the page): the next Tab stop in
 * the page - inside the topmost modal overlay when `element` is in it, where
 * Tab goes round past its last stop (to the toasts shown over it, else to
 * its first stop) as its focus trap does.
 */
export function getNextTabStop(element: Element, skipped?: Element | null) {
  const next = getNextTabbable(element, skipped);
  const modal = stack.findLast((entry) => entry.modal);
  const container = modal
    ?.getElements()
    .find((candidate) => !!candidate?.contains(element));
  if (
    !modal ||
    !container ||
    (next && (container.contains(next) || isAllowedOutside(modal.id, next)))
  ) {
    return next;
  }

  return (
    getExemptTabbables(container)[0] ??
    getTabbableElements(container).find((stop) => !skipped?.contains(stop))
  );
}

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
let unlockedStyle: {
  overflow: string;
  paddingRight: string;
  /** The overflow of the root, when the lock set it too. */
  root: { overflowX: string; overflowY: string } | null;
} = { overflow: "", paddingRight: "", root: null };

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
    const root = document.documentElement;
    unlockedStyle = {
      overflow: style.overflow,
      paddingRight: style.paddingRight,
      root: null,
    };

    // The scrollbar goes away with the overflow - its room is kept as
    // padding, so the page does not shift sideways under the overlay
    const scrollbarWidth = getScrollbarWidth();
    if (scrollbarWidth > 0) {
      const padding = parseFloat(getComputedStyle(document.body).paddingRight);
      style.paddingRight = `${(padding || 0) + scrollbarWidth}px`;
    }
    style.overflow = "hidden";
    // A page whose root has an overflow of its own (`html { overflow-y:
    // scroll }`, a scrollbar always shown) scrolls the root, not the body
    if (["auto", "scroll"].includes(getComputedStyle(root).overflowY)) {
      const { overflowX, overflowY } = root.style;
      unlockedStyle.root = { overflowX, overflowY };
      root.style.overflow = "hidden";
    }
  }
  scrollLocks += 1;

  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      document.body.style.overflow = unlockedStyle.overflow;
      document.body.style.paddingRight = unlockedStyle.paddingRight;
      const { root } = unlockedStyle;
      if (root) {
        const { style } = document.documentElement;
        style.overflow = "";
        style.overflowX = root.overflowX;
        style.overflowY = root.overflowY;
      }
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

    // The page behind is hidden from assistive technology meanwhile
    activeTraps.add(id);
    syncBackground();

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

      // On an element in the container that is none of them - one focused
      // by a script (`tabindex="-1"`), or a control the list does not know:
      // Tab moves on from there by itself, to the stop after it (or before
      // it). Past the last one (or the first) it goes round.
      if (
        index === -1 &&
        current &&
        current !== container &&
        container.contains(current)
      ) {
        const onward = event.shiftKey
          ? Node.DOCUMENT_POSITION_PRECEDING
          : Node.DOCUMENT_POSITION_FOLLOWING;
        const hasStopOnward = tabbables.some(
          (stop) => !!(current.compareDocumentPosition(stop) & onward),
        );
        if (!hasStopOnward) {
          moveTo(
            event.shiftKey
              ? (exempt.at(-1) ?? tabbables.at(-1))
              : (exempt[0] ?? tabbables[0]),
          );
        }
        return;
      }

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
      activeTraps.delete(id);
      syncBackground();
    };
  }, [active, containerRef, id]);
}

/** Options of `useOverlay`. */
export interface UseOverlayOptions {
  /**
   * A modal overlay - a dialog, a panel over the page. While open, the
   * focus moves into `ref` and stays there (Tab cycles through it, focus
   * that lands outside comes back), the page behind is hidden from screen
   * readers (`aria-hidden`) and does not scroll, and the focus goes back
   * where it was once it closes. Leave it off for a panel next to
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
    return () => {
      returnFocus(targets, container);
    };
  }, [isModalOpen, ref]);

  return { isTopmost: () => isTopmostOverlay(id), scope: childContext };
}

/**
 * Provides the `scope` of `useOverlay` to the content of your overlay -
 * `<OverlayScope value={scope}>`.
 */
export const OverlayScope = OverlayContext;
