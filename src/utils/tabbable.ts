const TABBABLE =
  "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]";

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
 * The elements Tab stops at inside `container`, in order. Left out are those
 * the selector also matches but Tab skips: `tabindex="-1"`, disabled,
 * aria-hidden and unrendered ones - such as the validation inputs of the
 * pickers and the file input of `FileUpload` - and all but one radio of a
 * group.
 */
export const getTabbableElements = (
  container: ParentNode | null | undefined,
) => {
  const candidates = Array.from(
    container?.querySelectorAll<HTMLElement>(TABBABLE) ?? [],
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest("[aria-hidden='true'], [inert]") &&
      // Older browsers (and jsdom) lack it - the element counts as visible
      element.checkVisibility?.({ visibilityProperty: true }) !== false,
  );

  return candidates.filter(
    (element) => !isRadio(element) || isRadioTabStop(element, candidates),
  );
};

/**
 * The element Tab moves to from `element` - the first one after it in the
 * page that is outside of it and of `skipped` (e.g. the panel of a popover,
 * which is a portal at the end of the page).
 */
export const getNextTabbable = (
  element: Element,
  skipped?: Element | null,
): HTMLElement | undefined =>
  getTabbableElements(element.ownerDocument.body).find(
    (candidate) =>
      !element.contains(candidate) &&
      !skipped?.contains(candidate) &&
      !!(
        element.compareDocumentPosition(candidate) &
        Node.DOCUMENT_POSITION_FOLLOWING
      ),
  );
