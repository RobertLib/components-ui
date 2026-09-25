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
  const elements = Array.from(
    element.ownerDocument.body.querySelectorAll<HTMLElement>(TABBABLE),
  );
  const side = backwards
    ? Node.DOCUMENT_POSITION_PRECEDING
    : Node.DOCUMENT_POSITION_FOLLOWING;
  const ordered = backwards ? elements.reverse() : elements;

  return ordered.find((candidate) => {
    if (
      !(element.compareDocumentPosition(candidate) & side) ||
      element.contains(candidate) ||
      skipped?.contains(candidate) ||
      !isTabStopCandidate(candidate)
    ) {
      return false;
    }
    if (!isRadio(candidate)) return true;

    // A radio is a stop for its group - the group is all the check needs
    const group = elements.filter(
      (other) =>
        isRadio(other) &&
        other.name === candidate.name &&
        isTabStopCandidate(other),
    );
    return isRadioTabStop(candidate, group);
  });
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
