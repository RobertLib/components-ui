import { isSafeHref } from "../../utils/sanitize-rich-text";
import toAppPath from "../../utils/to-app-path";

// What a click activating a row must not be on: controls, focusable
// elements (an editable cell, the trigger of a popover), the built-in
// expand, selection and actions cells of a `DataTable`
const ROW_CONTROL = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[role=button]",
  "[role=checkbox]",
  "[role=combobox]",
  "[role=link]",
  "[role=menuitem]",
  "[role=option]",
  "[role=switch]",
  "[role=textbox]",
  "[tabindex]",
  "[data-leading-column]",
].join(", ");

// The clicks rows passed on to their links - they bubble back to the row,
// which must not take them for clicks of its own
const passedClicks = new WeakSet<Event>();

// Where the last press on each row began
const presses = new WeakMap<Element, Element>();

/**
 * Whether a click opens a link in a new tab - with Ctrl, Cmd or Shift held
 * (the browser opens a window for Shift, a row a tab).
 */
export const isNewTabClick = (event: React.MouseEvent) =>
  event.ctrlKey || event.metaKey || event.shiftKey;

/**
 * Whether `target` is on `row` itself - not in a portal of it (a popover),
 * not on a control in it.
 */
function isOnRow(row: Element, target: Element) {
  if (!row.contains(target)) return false;

  // The row itself is focusable (a tab stop) - it is no control in itself
  const control = target.closest(ROW_CONTROL);
  return !(control && control !== row && row.contains(control));
}

/**
 * Whether a click on a row activates it - the rows of a `DataTable` and a
 * `TableRow` with `href`: not in a portal of the row (a popover), not on a
 * control in it, not at the end of selecting its text. The row remembers
 * where a press began with `handleRowPress`.
 */
export function isRowActivation(event: React.MouseEvent<HTMLElement>) {
  const rowElement = event.currentTarget;
  if (!isOnRow(rowElement, event.target as Element)) return false;

  // A click of a pointer goes to what holds both its press and its release
  // - the row for a press on a button released on another cell, a click of
  // neither. One of the keyboard (`detail` 0) has no press.
  const press = presses.get(rowElement);
  if (event.detail > 0 && press && !isOnRow(rowElement, press)) return false;

  // Only a plain click ends dragging over text. Shift + click extends a
  // selection into the row, Firefox selects the cell for Ctrl + click, and
  // the middle button may press on text selected before.
  if (event.button !== 0 || isNewTabClick(event)) return true;

  const selection = rowElement.ownerDocument.getSelection();
  return !(
    selection &&
    !selection.isCollapsed &&
    selection.toString().trim() !== "" &&
    (rowElement.contains(selection.anchorNode) ||
      rowElement.contains(selection.focusNode))
  );
}

/**
 * The `onMouseDownCapture` of a row that `isRowActivation` checks the clicks
 * of - it remembers where a press began, also on a control that stops it.
 * A press with Shift (or Firefox's Ctrl) on the row selects no text up to
 * it: the row opens, and the selection would take the next click for the
 * end of selecting.
 */
export function handleRowPress(event: React.MouseEvent<HTMLElement>) {
  const target = event.target as Element;
  presses.set(event.currentTarget, target);
  if (
    event.button === 0 &&
    isNewTabClick(event) &&
    isOnRow(event.currentTarget, target)
  ) {
    event.preventDefault();
  }
}

/**
 * Follows the link of a row for a click on the row, as a click on the link
 * would. With Ctrl, Cmd or Shift it opens the link in a new tab, as the
 * middle button does - none for a disabled link. WebKit ignores the keys of
 * a click the page dispatches: the link would take it for a plain click and
 * leave the page (a router's `Link` leaves such clicks to the browser).
 */
export function followRowLink(
  link: Element,
  href: string,
  event: React.MouseEvent,
) {
  if (isNewTabClick(event)) {
    const url = newTabUrl(link, href);
    if (url !== null) openInNewTab(url);
    return;
  }

  const click = new MouseEvent("click", {
    altKey: event.altKey,
    bubbles: true,
    button: event.button,
    cancelable: true,
  });
  passedClicks.add(click);
  link.dispatchEvent(click);
}

/** Whether a click is one a row passed on to its link - not the user's. */
export const isPassedClick = (event: Event) => passedClicks.has(event);

/**
 * Opens a page in a new tab - only a link, a `javascript:` URL would run in
 * the page.
 */
export function openInNewTab(href: string) {
  if (isSafeHref(href)) window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * The URL a row opens in a new tab - for the middle button, which fires no
 * `click` the link could follow. The one its `<a>` resolves to, with the
 * base path of the router - none for an `<a>` without `href` (a disabled
 * link). Without an `<a>`, only an `href` the browser loads (`https://…`):
 * a path of the app lacks the base path, which only the router's `Link`
 * knows.
 */
export function newTabUrl(
  link: Element | null | undefined,
  href: string,
): string | null {
  const resolved = (link as Partial<HTMLAnchorElement> | null | undefined)
    ?.href;
  if (typeof resolved === "string") return resolved === "" ? null : resolved;

  return toAppPath(href) === null && isSafeHref(href) ? href : null;
}

/**
 * Whether a press of the middle button activates a row - not one on a
 * control in it.
 */
const isMiddleActivation = (event: React.MouseEvent<HTMLElement>) =>
  event.button === 1 && isRowActivation(event);

/**
 * The handlers of the middle button on a row with `href` - it fires no
 * click, it opens the link of the row (found by `findLink`) in a new tab.
 * Its press does not start the scrolling by the pointer then.
 */
export function middleButtonHandlers(
  href: string,
  findLink: (row: HTMLElement) => Element | null | undefined,
) {
  /** The URL a press of the middle button opens - none elsewhere. */
  const urlOf = (event: React.MouseEvent<HTMLElement>) =>
    isMiddleActivation(event)
      ? newTabUrl(findLink(event.currentTarget), href)
      : null;

  return {
    onAuxClick(event: React.MouseEvent<HTMLElement>) {
      const url = urlOf(event);
      if (url !== null) openInNewTab(url);
    },
    onMouseDown(event: React.MouseEvent<HTMLElement>) {
      if (urlOf(event) !== null) event.preventDefault();
    },
  };
}
