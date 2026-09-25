// The table and rule commands of RichTextEditor - tables are edited as they
// are in the page: rows and cells are added, removed and moved directly
import {
  MAX_TABLE_CELLS,
  MAX_TABLE_COLUMNS,
} from "../../utils/sanitize-rich-text";
import {
  changeTag,
  closestIn,
  createEmptyParagraph,
  isBlockNode,
  isElement,
  isEmptyLine,
  isWhitespace,
  TEXT_BLOCKS,
  topLevelOf,
} from "./dom";

/** The most rows and columns the insert form takes. */
export const MAX_TABLE_SIZE = 20;

function createCell(doc: Document, tag: string) {
  const cell = doc.createElement(tag);
  // An empty cell keeps its height and takes the caret
  cell.append(doc.createElement("br"));
  return cell;
}

function createRow(doc: Document, tags: string[]) {
  const row = doc.createElement("tr");
  row.append(...tags.map((tag) => createCell(doc, tag)));
  return row;
}

/**
 * A new table of `rows` rows (the header row included) and `columns`
 * columns - a body row at least.
 */
export function createTable(
  doc: Document,
  rows: number,
  columns: number,
  header: boolean,
) {
  const table = doc.createElement("table");

  if (header) {
    const head = doc.createElement("thead");
    head.append(createRow(doc, Array<string>(columns).fill("th")));
    table.append(head);
  }

  const body = doc.createElement("tbody");
  const bodyRows = Math.max(1, header ? rows - 1 : rows);
  for (let index = 0; index < bodyRows; index += 1) {
    body.append(createRow(doc, Array<string>(columns).fill("td")));
  }
  table.append(body);

  return table as HTMLTableElement;
}

/** The line after `block` - a paragraph added when there is none. */
function lineAfter(block: Element) {
  let next = block.nextSibling;
  while (isWhitespace(next)) next = next?.nextSibling ?? null;

  if (isElement(next) && TEXT_BLOCKS.has(next.tagName)) return next;

  const paragraph = createEmptyParagraph(block.ownerDocument);
  block.after(paragraph);
  return paragraph;
}

/** The text right in the editor around `node`, up to line breaks and blocks, in a paragraph. */
function wrapTextLine(editor: HTMLElement, node: Node) {
  const nodes = [node];

  let previous = node.previousSibling;
  while (previous && !isBlockNode(previous) && previous.nodeName !== "BR") {
    nodes.unshift(previous);
    previous = previous.previousSibling;
  }
  let next: ChildNode | null = node.nodeName === "BR" ? null : node.nextSibling;
  while (next && !isBlockNode(next)) {
    nodes.push(next);
    if (next.nodeName === "BR") break;
    next = next.nextSibling;
  }

  const paragraph = editor.ownerDocument.createElement("p");
  editor.insertBefore(paragraph, nodes[0]);
  paragraph.append(...nodes);
  return paragraph;
}

/**
 * Puts a block - a table, a rule - where the selection ends: a paragraph or
 * heading is split there, and after a list, quote or table the block goes
 * after it. Returns the line after the block (added when there is none),
 * where the caret can go on.
 */
export function insertBlock(
  editor: HTMLElement,
  range: Range,
  block: HTMLElement,
): HTMLElement {
  const doc = editor.ownerDocument;
  const container = range.endContainer;
  let top =
    container === editor
      ? (editor.childNodes[range.endOffset - 1] ??
        editor.childNodes[range.endOffset] ??
        null)
      : topLevelOf(editor, container);

  if (!top) {
    editor.append(block);
    return lineAfter(block);
  }

  // Text right in the editor becomes a paragraph first
  if (!isBlockNode(top)) top = wrapTextLine(editor, top);

  if (
    !isElement(top) ||
    !TEXT_BLOCKS.has(top.tagName) ||
    container === editor
  ) {
    (top as ChildNode).after(block);
    return lineAfter(block);
  }

  // The content after the point moves to a line of its own after the block
  const tail = doc.createRange();
  tail.setStart(range.endContainer, range.endOffset);
  tail.setEnd(top, top.childNodes.length);

  let after: HTMLElement = doc.createElement(top.tagName);
  after.append(tail.extractContents());
  top.after(after);

  if (isEmptyLine(after)) {
    // An empty line after a heading is a paragraph
    if (after.tagName !== "P" && after.tagName !== "DIV") {
      after = changeTag(after, "p") as HTMLElement;
    }
    after.replaceChildren(doc.createElement("br"));
  }

  if (isEmptyLine(top)) top.replaceWith(block);
  else top.after(block);

  return after;
}

/** The table cell `node` is in. */
export const cellOf = (editor: HTMLElement, node: Node | null) =>
  closestIn(editor, node, "td, th") as HTMLTableCellElement | null;

const tableOf = (cell: Element) => cell.closest("table") as HTMLTableElement;

/** The cells of a table in reading order - not those of a nested table. */
function cellsOf(table: HTMLTableElement) {
  return Array.from(table.rows).flatMap((row) => Array.from(row.cells));
}

/** The cell before or after `cell` in reading order. */
export function siblingCell(cell: HTMLTableCellElement, backwards: boolean) {
  const cells = cellsOf(tableOf(cell));
  return cells[cells.indexOf(cell) + (backwards ? -1 : 1)] ?? null;
}

/** The number of columns of a table - the cells of its widest row. */
function columnCount(table: HTMLTableElement) {
  let columns = 0;
  for (const row of Array.from(table.rows)) {
    columns = Math.max(columns, row.cells.length);
  }
  return columns;
}

/**
 * Whether a table has room for another row or column - its value would be
 * lines of text beyond the limits of `sanitizeRichText`.
 */
function hasRoom(table: HTMLTableElement, rows: number, columns: number) {
  const width = columnCount(table) + columns;
  return (
    width <= MAX_TABLE_COLUMNS &&
    (table.rows.length + rows) * width <= MAX_TABLE_CELLS
  );
}

/**
 * Adds a row at the end of the body - returns its first cell, or the last
 * cell of the table when it has no room for another row.
 */
export function appendRow(table: HTMLTableElement) {
  const doc = table.ownerDocument;
  const last = table.rows[table.rows.length - 1];
  if (last && !hasRoom(table, 1, 0)) return last.cells[last.cells.length - 1];

  const tags = last ? Array.from(last.cells, () => "td") : ["td"];
  const body =
    table.tBodies[0] ?? table.appendChild(doc.createElement("tbody"));

  const row = createRow(doc, tags);
  body.append(row);
  return row.cells[0];
}

/**
 * Adds a row above or below the row of `cell` - returns its cell in the
 * column of `cell` (`cell` itself when the table has no room for another
 * row). A row below the header is the first row of the body.
 */
export function addRow(cell: HTMLTableCellElement, below: boolean) {
  const row = cell.parentElement as HTMLTableRowElement;
  const table = tableOf(cell);
  const doc = table.ownerDocument;
  if (!hasRoom(table, 1, 0)) return cell;
  const inHead = row.parentElement?.tagName === "THEAD";

  let added: HTMLTableRowElement;
  if (below && inHead && !row.nextElementSibling) {
    const body =
      table.tBodies[0] ?? table.appendChild(doc.createElement("tbody"));
    added = createRow(
      doc,
      Array.from(row.cells, () => "td"),
    );
    body.prepend(added);
  } else {
    // Header cells in the header, the kinds of the row's cells elsewhere
    added = createRow(
      doc,
      Array.from(row.cells, (rowCell) =>
        inHead ? "th" : rowCell.tagName.toLowerCase(),
      ),
    );
    if (below) row.after(added);
    else row.before(added);
  }

  return added.cells[Math.min(cell.cellIndex, added.cells.length - 1)];
}

/**
 * Adds a column left or right of the column of `cell` - returns its cell in
 * the row of `cell` (`cell` itself when the table has no room for another
 * column).
 */
export function addColumn(cell: HTMLTableCellElement, right: boolean) {
  const table = tableOf(cell);
  const doc = table.ownerDocument;
  const index = cell.cellIndex;
  if (!hasRoom(table, 0, 1)) return cell;
  let result: HTMLTableCellElement | null = null;

  for (const row of Array.from(table.rows)) {
    const inHead = row.parentElement?.tagName === "THEAD";
    const added = createCell(doc, inHead ? "th" : "td");
    const reference = row.cells[Math.min(index, row.cells.length - 1)];

    if (!reference) row.append(added);
    else if (right) reference.after(added);
    else reference.before(added);

    if (row === cell.parentElement) result = added as HTMLTableCellElement;
  }

  return result as HTMLTableCellElement;
}

/**
 * Removes a table - returns the line the caret goes to: the one after it,
 * before it, or a new paragraph when it was all the content.
 */
export function deleteTable(editor: HTMLElement, table: HTMLTableElement) {
  const block = (topLevelOf(editor, table) ?? table) as Element;
  let target: Node | null = block.nextSibling;
  while (isWhitespace(target)) target = target?.nextSibling ?? null;
  if (!target) {
    target = block.previousSibling;
    while (isWhitespace(target)) target = target?.previousSibling ?? null;
  }

  table.remove();
  if (block !== table && isEmptyLine(block)) block.remove();

  if (!target || !editor.contains(target)) {
    target = createEmptyParagraph(editor.ownerDocument);
    editor.append(target);
  }
  return target;
}

/**
 * Removes the row of `cell` - the whole table when it is its only row.
 * Returns the cell (or line) the caret goes to.
 */
export function deleteRow(editor: HTMLElement, cell: HTMLTableCellElement) {
  const table = tableOf(cell);
  const row = cell.parentElement as HTMLTableRowElement;
  if (table.rows.length === 1) return deleteTable(editor, table);

  const rowIndex = row.rowIndex;
  const section = row.parentElement as HTMLElement;
  row.remove();
  if (section !== table && section.children.length === 0) section.remove();

  const next = table.rows[Math.min(rowIndex, table.rows.length - 1)];
  return next.cells[Math.min(cell.cellIndex, next.cells.length - 1)] ?? next;
}

/**
 * Removes the column of `cell` - the whole table when it is its only
 * column. Returns the cell (or line) the caret goes to.
 */
export function deleteColumn(editor: HTMLElement, cell: HTMLTableCellElement) {
  const table = tableOf(cell);
  const row = cell.parentElement as HTMLTableRowElement;
  const index = cell.cellIndex;
  if (row.cells.length === 1) return deleteTable(editor, table);

  for (const tableRow of Array.from(table.rows)) {
    tableRow.cells[index]?.remove();
  }
  return row.cells[Math.min(index, row.cells.length - 1)];
}

/** Whether the first row of a table is its header. */
export const hasHeaderRow = (table: HTMLTableElement) =>
  !!table.tHead && table.tHead.rows.length > 0;

function changeCells(row: HTMLTableRowElement, tag: "td" | "th") {
  for (const cell of Array.from(row.cells)) {
    if (cell.tagName.toLowerCase() !== tag) changeTag(cell, tag);
  }
}

/**
 * Makes the first row of a table its header of header cells - or, when it
 * has one, the header rows the first rows of the body.
 */
export function toggleHeaderRow(table: HTMLTableElement) {
  const doc = table.ownerDocument;
  const head = table.tHead;

  if (head && head.rows.length > 0) {
    const body =
      table.tBodies[0] ?? table.appendChild(doc.createElement("tbody"));
    for (const row of Array.from(head.rows).reverse()) {
      changeCells(row, "td");
      body.prepend(row);
    }
    head.remove();
    return;
  }

  const first = table.rows[0];
  if (!first) return;

  const section = first.parentElement as HTMLElement;
  const newHead = doc.createElement("thead");
  table.prepend(newHead);
  changeCells(first, "th");
  newHead.append(first);
  if (section !== table && section.children.length === 0) section.remove();
}

/**
 * The table right before the block of a caret at its very start - no text
 * or line break before the caret in the block. Backspace there would pull
 * the block into the last cell of the table.
 */
export function tableBefore(editor: HTMLElement, range: Range) {
  if (!range.collapsed) return null;

  const block = topLevelOf(editor, range.startContainer);
  if (!isElement(block) || block.tagName === "TABLE") return null;

  let previous = block.previousSibling;
  while (isWhitespace(previous)) previous = previous?.previousSibling ?? null;
  if (!isElement(previous) || previous.tagName !== "TABLE") return null;

  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const isAtStart =
    before.toString() === "" &&
    !before.cloneContents().querySelector("br, hr, img");

  return isAtStart ? { block, table: previous as HTMLTableElement } : null;
}

/** The last cell of a table in reading order. */
export function lastCellOf(table: HTMLTableElement) {
  const row = table.rows[table.rows.length - 1];
  return row?.cells[row.cells.length - 1] ?? null;
}

/**
 * Whether a caret is at the start (or end) of the content of `element` -
 * no text before (or after) it in there.
 */
export function isAtEdgeOf(element: Node, range: Range, atEnd: boolean) {
  const probe = document.createRange();
  probe.selectNodeContents(element);
  if (atEnd) probe.setStart(range.endContainer, range.endOffset);
  else probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString() === "";
}
