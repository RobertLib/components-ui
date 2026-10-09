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

/**
 * Whether a click on a row activates it - the rows of a `DataTable` and a
 * `TableRow` with `href`: not in a portal of the row (a popover), not on a
 * control in it, not at the end of selecting its text.
 */
export function isRowActivation(rowElement: HTMLElement, target: Element) {
  if (!rowElement.contains(target)) return false;

  // The row itself is focusable (a tab stop) - it is no control in itself
  const control = target.closest(ROW_CONTROL);
  if (control && control !== rowElement && rowElement.contains(control)) {
    return false;
  }

  const selection = rowElement.ownerDocument.getSelection();
  return !(
    selection &&
    !selection.isCollapsed &&
    selection.toString().trim() !== "" &&
    (rowElement.contains(selection.anchorNode) ||
      rowElement.contains(selection.focusNode))
  );
}
