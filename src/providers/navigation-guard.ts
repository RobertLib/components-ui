import { browserBack, browserNavigate, type NavigateOptions } from "./router";

/** Where the router is - its `pathname` and `search`. */
export interface RouterLocation {
  pathname: string;
  search: string;
}

/**
 * A form that asks before the page is left - one `useUnsavedChanges`. The
 * hook keeps it up to date.
 */
export interface LeaveGuard {
  /** Asks whether to leave - resolves `true` to leave. */
  ask: () => Promise<boolean>;
  /** The form has unsaved changes. */
  dirty: boolean;
  /**
   * The page may be left without a question until `dirty` changes - the
   * user chose to leave, or the form was saved (`release()`).
   */
  released: boolean;
}

/** The forms of the page, in the order they came - the first one asks. */
const guards = new Set<LeaveGuard>();

/** The question being asked - asked once for all who navigate meanwhile. */
let pendingQuestion: Promise<boolean> | null = null;

const blockingGuards = () =>
  [...guards].filter((guard) => guard.dirty && !guard.released);

/**
 * Whether a form of the page has unsaved changes - a `useUnsavedChanges`
 * with `dirty`, not released. For the blocker of a router: it can tell
 * synchronously whether to block a navigation of the app, then ask with
 * `confirmLeave()`.
 */
export function hasUnsavedChanges(): boolean {
  return blockingGuards().length > 0;
}

/** Lets every form with unsaved changes go - the page is being left. */
function releaseAll() {
  for (const guard of blockingGuards()) guard.released = true;
  syncListeners();
}

/**
 * Asks "Leave without saving?" when a form of the page has unsaved changes
 * - with the `ConfirmProvider` of the first such form, else the browser's
 * `confirm()`. Resolves `true` at once without such a form, and when the
 * user chooses to leave - the forms do not ask again until their `dirty`
 * changes. For the blocker of a router, and before a navigation of your
 * own: `if (await confirmLeave()) router.push("/orders")`.
 */
export function confirmLeave(): Promise<boolean> {
  const [first] = blockingGuards();
  if (!first) return Promise.resolve(true);

  // One question, also for a second navigation while it is asked - one
  // that throws is a "stay"
  pendingQuestion ??= new Promise<boolean>((resolve) => resolve(first.ask()))
    .then(
      (leave) => {
        if (leave) releaseAll();
        return leave;
      },
      () => false,
    )
    .finally(() => {
      pendingQuestion = null;
    });
  return pendingQuestion;
}

/**
 * Whether going to `href` leaves the page of the form: another path or
 * another site. A change of the query or the hash alone - a tab, a filter,
 * a page of a table kept in the URL - stays. `location` is that of the
 * router - its paths may lack the base path of the app; without one, the
 * page's own.
 */
export function leavesPage(href: string, location: RouterLocation | null) {
  try {
    const base = location
      ? new URL(
          `${location.pathname}${location.search}`,
          "http://router.invalid",
        )
      : new URL(window.location.href);
    const target = new URL(href, base);
    return target.origin !== base.origin || target.pathname !== base.pathname;
  } catch {
    return true;
  }
}

/**
 * Runs `proceed` - the navigation to `href` (`null` for back, which goes
 * who knows where) - right away unless it leaves a page with unsaved
 * changes; then only once the user chose to leave.
 */
export function guardNavigation(
  href: string | null,
  location: RouterLocation | null,
  proceed: () => void,
) {
  if (!hasUnsavedChanges() || (href !== null && !leavesPage(href, location))) {
    proceed();
    return;
  }

  void confirmLeave().then((leave) => {
    if (leave) proceed();
  });
}

/** `browserNavigate`, asking first when it leaves unsaved changes. */
export function guardedBrowserNavigate(
  href: string,
  options?: NavigateOptions,
) {
  guardNavigation(href, null, () => browserNavigate(href, options));
}

/** `browserBack`, asking first while there are unsaved changes. */
export function guardedBrowserBack() {
  guardNavigation(null, null, browserBack);
}

const getNavigation = () => (window as { navigation?: Navigation }).navigation;

/**
 * Closing the tab, a reload, a link to another document: the browser asks
 * with its own words - a page may not choose them.
 */
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  // Browsers before the standard ask by the return value (Chrome < 119)
  event.returnValue = true;
}

/**
 * Back and forward between the pages of the app - which its router, not
 * the library, follows. Where the Navigation API lets a page cancel such a
 * traversal within the document (Chrome and Edge, once the user did
 * something on the page), it is asked about, and made again once the user
 * chose to leave. A traversal to another document cannot be canceled
 * (`beforeunload` asks); a push or a replace of the History API is the
 * router's own navigation, which a cancel would leave out of step with the
 * URL - the library asks before its own (`navigate`, the links), a blocker
 * of the router before the app's.
 */
function handleNavigate(event: NavigateEvent) {
  const { destination } = event;
  if (
    event.navigationType !== "traverse" ||
    !event.cancelable ||
    !destination.sameDocument ||
    !hasUnsavedChanges() ||
    !leavesPage(destination.url, null)
  ) {
    return;
  }

  event.preventDefault();
  void confirmLeave().then((leave) => {
    const navigation = getNavigation();
    if (!leave || !navigation) return;
    const { committed, finished } = navigation.traverseTo(destination.key);
    // Another navigation may take its place - nothing to report then
    committed?.catch(() => {});
    finished?.catch(() => {});
  });
}

/**
 * A form submitted to the server leaves the page with its values - that is
 * saving them, no question. Not one whose submit a script handles
 * (`preventDefault()`, as React's form actions do), nor one that opens in
 * another window or closes a dialog.
 */
function handleSubmit(event: SubmitEvent) {
  const form = event.target;
  if (event.defaultPrevented || !(form instanceof HTMLFormElement)) return;

  const submitter = event.submitter;
  const method =
    submitter?.getAttribute("formmethod") ?? form.getAttribute("method");
  const target =
    submitter?.getAttribute("formtarget") ?? form.getAttribute("target");
  if (method?.toLowerCase() === "dialog") return;
  if (target && target.toLowerCase() !== "_self") return;
  releaseAll();
}

/** What the listeners are on - `null` while none listens. */
let listening: { navigation: Navigation | undefined } | null = null;

/**
 * Listens to the browser while a form has unsaved changes - and only then:
 * a `beforeunload` listener keeps the page out of the back-forward cache.
 */
export function syncListeners() {
  const active = hasUnsavedChanges();
  if (active === (listening !== null) || typeof window === "undefined") {
    return;
  }

  if (active) {
    listening = { navigation: getNavigation() };
    window.addEventListener("beforeunload", handleBeforeUnload);
    listening.navigation?.addEventListener("navigate", handleNavigate);
    document.addEventListener("submit", handleSubmit);
  } else {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    listening?.navigation?.removeEventListener("navigate", handleNavigate);
    document.removeEventListener("submit", handleSubmit);
    listening = null;
  }
}

/** Adds a form - returns what removes it. */
export function addLeaveGuard(guard: LeaveGuard) {
  guards.add(guard);
  syncListeners();

  return () => {
    guards.delete(guard);
    syncListeners();
  };
}
