/**
 * The row of `body` an element is in - not a row of a table nested in the
 * detail of a row (master-detail), whose rows are numbered too.
 */
export function findBodyRow(body: Element, element: Element) {
  let row = element.closest("tr[data-row-index]");
  while (row && row.parentElement !== body) {
    row = row.parentElement?.closest("tr[data-row-index]") ?? null;
  }
  return row;
}
