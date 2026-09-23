const TABBABLE =
  "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]";

/**
 * The elements Tab stops at inside `container`, in order. Left out are those
 * the selector also matches but Tab skips: `tabindex="-1"`, disabled,
 * aria-hidden and unrendered ones - such as the validation inputs of the
 * pickers and the file input of `FileUpload`.
 */
export const getTabbableElements = (container: ParentNode | null | undefined) =>
  Array.from(container?.querySelectorAll<HTMLElement>(TABBABLE) ?? []).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest("[aria-hidden='true'], [inert]") &&
      // Older browsers (and jsdom) lack it - the element counts as visible
      element.checkVisibility?.({ visibilityProperty: true }) !== false,
  );

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
