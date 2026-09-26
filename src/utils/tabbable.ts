// Everything Tab may stop at - also the summary of a <details>, a frame,
// media with controls and an editing host (`contenteditable`)
const TABBABLE =
  "a[href], button, input:not([type='hidden']), select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable], [tabindex]";

// Tab stops whose `tabIndex` says -1 until a `tabindex` is given
const IMPLICIT_TAB_STOP =
  "[contenteditable]:not([contenteditable='false']), audio[controls], video[controls]";

/**
 * Whether an editable element is inside another editing host - only the
 * host is a Tab stop, not what is editable in it.
 */
const isInsideEditingHost = (element: HTMLElement) => {
  const host = element.parentElement?.closest("[contenteditable]");
  return !!host && host.getAttribute("contenteditable") !== "false";
};

/** The `tabIndex` Tab goes by. */
const tabIndexOf = (element: HTMLElement) =>
  !element.hasAttribute("tabindex") &&
  element.matches(IMPLICIT_TAB_STOP) &&
  !isInsideEditingHost(element)
    ? 0
    : element.tabIndex;

const isRadio = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === "radio";

/**
 * Whether Tab stops at a radio: the radios of a group (one `name` in one
 * form) are a single stop - the focused one while the focus is in the group
 * (the arrow keys move it, and a controlled group may refuse the change),
 * otherwise the checked one, or the first without a checked one.
 */
function isRadioTabStop(radio: HTMLInputElement, candidates: HTMLElement[]) {
  if (!radio.name) return true;

  const group = candidates.filter(
    (candidate): candidate is HTMLInputElement =>
      isRadio(candidate) &&
      candidate.name === radio.name &&
      candidate.form === radio.form,
  );
  const focused = radio.ownerDocument.activeElement;

  return (
    radio ===
    (group.find((candidate) => candidate === focused) ??
      group.find((candidate) => candidate.checked) ??
      group[0])
  );
}

/**
 * The elements Tab stops at inside `container`, in order: controls, links,
 * the summary of a `<details>`, frames, media with controls, editing hosts
 * and elements with a `tabindex`. Left out are those the selector also
 * matches but Tab skips: `tabindex="-1"`, disabled, aria-hidden and
 * unrendered ones - such as the validation inputs of the pickers and the
 * file input of `FileUpload` - and all but one radio of a group.
 */
export const getTabbableElements = (
  container: ParentNode | null | undefined,
) => {
  const candidates = Array.from(
    container?.querySelectorAll<HTMLElement>(TABBABLE) ?? [],
  ).filter(isTabStopCandidate);

  return candidates.filter(
    (element) => !isRadio(element) || isRadioTabStop(element, candidates),
  );
};

/** Whether Tab stops at `element`, leaving aside the radios of a group. */
function isTabStopCandidate(element: HTMLElement) {
  return (
    tabIndexOf(element) >= 0 &&
    !element.matches(":disabled") &&
    !element.closest("[aria-hidden='true'], [inert]") &&
    // Older browsers (and jsdom) lack it - the element counts as visible
    element.checkVisibility?.({ visibilityProperty: true }) !== false
  );
}

/**
 * Whether Tab stops at `candidate`, one of the `elements` of the page - a
 * radio for its group, which is all the check needs.
 */
function isTabStopAmong(candidate: HTMLElement, elements: HTMLElement[]) {
  if (!isTabStopCandidate(candidate)) return false;
  if (!isRadio(candidate)) return true;

  const group = elements.filter(
    (other) =>
      isRadio(other) &&
      other.name === candidate.name &&
      isTabStopCandidate(other),
  );
  return isRadioTabStop(candidate, group);
}

/**
 * The elements Tab may stop at, from `element` on in the page - after it,
 * or before it with `backwards` - with all of them (to find the radios of a
 * group).
 */
function tabCandidatesBeside(element: Element, backwards: boolean) {
  if (!element.isConnected) return { beside: [], elements: [] };

  const elements = Array.from(
    element.ownerDocument.body.querySelectorAll<HTMLElement>(TABBABLE),
  );

  // The first of them after `element` (or in it) - they are in the order of
  // the page, so a few comparisons find it. Each may walk a long row of
  // siblings (the rows of a table), too slow for all of them.
  let after = 0;
  let end = elements.length;
  while (after < end) {
    const middle = (after + end) >> 1;
    const position = element.compareDocumentPosition(elements[middle]);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) end = middle;
    else after = middle + 1;
  }

  const beside = backwards
    ? elements
        .slice(0, after)
        .filter((candidate) => candidate !== element)
        .reverse()
    : elements.slice(after);
  return { beside, elements };
}

/**
 * The first Tab stop after `element` in the page - or before it, with
 * `backwards` - outside of it and of `skipped`. It checks the elements from
 * `element` on only until it finds one: finding the stop next to a button
 * in a long table is no check of every control in the page.
 */
function findTabStopBeside(
  element: Element,
  backwards: boolean,
  skipped?: Element | null,
): HTMLElement | undefined {
  const { beside, elements } = tabCandidatesBeside(element, backwards);

  return beside.find(
    (candidate) =>
      !element.contains(candidate) &&
      !skipped?.contains(candidate) &&
      isTabStopAmong(candidate, elements),
  );
}

/**
 * The Tab stops after `element` in the page - or before it, with
 * `backwards` - one for each of its ancestors, nearest first: the first
 * stop outside `element`, then the first outside its parent, and so on up
 * to the body. When `element` goes away with an ancestor - the row a pick
 * in its menu deleted, with a second button of the row after the menu
 * button - the first of them still in the page is the stop next to that
 * ancestor, the next row.
 */
export function getTabStopsBeside(element: Element, backwards: boolean) {
  const { beside, elements } = tabCandidatesBeside(element, backwards);
  const body = element.ownerDocument.body;
  // `element` and its ancestors below the body, the nearest first
  const scopes: Element[] = [];
  for (
    let current: Element | null = element;
    current && current !== body;
    current = current.parentElement
  ) {
    scopes.push(current);
  }

  const stops: HTMLElement[] = [];
  let level = 0;
  for (const candidate of beside) {
    if (level === scopes.length) break;
    if (
      scopes[level].contains(candidate) ||
      !isTabStopAmong(candidate, elements)
    ) {
      continue;
    }
    stops.push(candidate);
    // The stop next to all the scopes it is outside of
    while (level < scopes.length && !scopes[level].contains(candidate)) {
      level += 1;
    }
  }
  return stops;
}

/**
 * The element Tab moves to from `element` - the first one after it in the
 * page that is outside of it and of `skipped` (e.g. the panel of a popover,
 * which is a portal at the end of the page).
 */
export const getNextTabbable = (
  element: Element,
  skipped?: Element | null,
): HTMLElement | undefined => findTabStopBeside(element, false, skipped);

/** The element Shift+Tab moves to from `element` - see `getNextTabbable`. */
export const getPreviousTabbable = (
  element: Element,
  skipped?: Element | null,
): HTMLElement | undefined => findTabStopBeside(element, true, skipped);
