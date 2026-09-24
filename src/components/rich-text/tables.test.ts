import { afterEach, describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  appendRow,
  cellOf,
  createTable,
  deleteColumn,
  deleteRow,
  deleteTable,
  hasHeaderRow,
  insertBlock,
  isAtEdgeOf,
  siblingCell,
  toggleHeaderRow,
} from "./tables";

afterEach(() => {
  document.body.innerHTML = "";
});

function createEditor(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
}

function caretIn(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  return range;
}

const TABLE =
  "<table><thead><tr><th>A</th><th>B</th></tr></thead>" +
  "<tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>";

const cell = (editor: HTMLElement, text: string) =>
  Array.from(editor.querySelectorAll("td, th")).find(
    (candidate) => candidate.textContent === text,
  ) as HTMLTableCellElement;

describe("createTable", () => {
  it("makes rows of empty cells, the first one a header", () => {
    expect(createTable(document, 3, 2, true).outerHTML).toBe(
      "<table><thead><tr><th><br></th><th><br></th></tr></thead>" +
        "<tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table>",
    );
    expect(createTable(document, 1, 1, false).outerHTML).toBe(
      "<table><tbody><tr><td><br></td></tr></tbody></table>",
    );
    // A header and a body row at least
    expect(createTable(document, 1, 1, true).rows).toHaveLength(2);
  });
});

describe("insertBlock", () => {
  it("splits a paragraph at the caret", () => {
    const editor = createEditor("<p>Hel<b>lo</b> world</p>");
    const after = insertBlock(
      editor,
      caretIn(editor.querySelector("b")?.firstChild as Node, 1),
      document.createElement("hr"),
    );

    expect(editor.innerHTML).toBe(
      "<p>Hel<b>l</b></p><hr><p><b>o</b> world</p>",
    );
    expect(after).toBe(editor.lastChild);
  });

  it("puts the block before a line with the caret at its start", () => {
    const editor = createEditor("<p>Text</p>");
    insertBlock(
      editor,
      caretIn(editor.querySelector("p") as Node, 0),
      document.createElement("hr"),
    );

    expect(editor.innerHTML).toBe("<hr><p>Text</p>");
  });

  it("adds a paragraph after the block at the end of a heading", () => {
    const editor = createEditor("<h2>Title</h2>");
    const after = insertBlock(
      editor,
      caretIn(editor.querySelector("h2")?.firstChild as Node, 5),
      createTable(document, 1, 1, false),
    );

    expect(editor.innerHTML).toBe(
      "<h2>Title</h2><table><tbody><tr><td><br></td></tr></tbody></table><p><br></p>",
    );
    expect(after.tagName).toBe("P");
  });

  it("replaces an empty line and keeps one after the block", () => {
    const editor = createEditor("<p><br></p>");
    insertBlock(
      editor,
      caretIn(editor.firstChild as Node, 0),
      document.createElement("hr"),
    );

    expect(editor.innerHTML).toBe("<hr><p><br></p>");
  });

  it("puts the block after a list, and into an empty editor", () => {
    const editor = createEditor("<ul><li>Item</li></ul><p>Next</p>");
    const after = insertBlock(
      editor,
      caretIn(editor.querySelector("li")?.firstChild as Node, 2),
      document.createElement("hr"),
    );
    expect(editor.innerHTML).toBe("<ul><li>Item</li></ul><hr><p>Next</p>");
    expect(after.textContent).toBe("Next");

    const empty = createEditor("");
    insertBlock(empty, caretIn(empty, 0), document.createElement("hr"));
    expect(empty.innerHTML).toBe("<hr><p><br></p>");
  });

  it("makes text right in the editor a paragraph first", () => {
    const editor = createEditor("One<br>Two");
    insertBlock(
      editor,
      caretIn(editor.lastChild as Node, 3),
      document.createElement("hr"),
    );

    expect(editor.innerHTML).toBe("One<br><p>Two</p><hr><p><br></p>");
  });
});

describe("rows and columns", () => {
  it("adds rows above and below, a row below the header in the body", () => {
    const editor = createEditor(TABLE);

    const below = addRow(cell(editor, "B"), true);
    expect(below.tagName).toBe("TD");
    expect(below.cellIndex).toBe(1);
    expect(editor.querySelector("tbody tr")?.textContent).toBe("");

    const above = addRow(cell(editor, "A"), false);
    expect(above.tagName).toBe("TH");
    expect(editor.querySelectorAll("thead tr")).toHaveLength(2);

    addRow(cell(editor, "4"), true);
    expect(editor.querySelector("tbody")?.lastElementChild?.textContent).toBe(
      "",
    );
  });

  it("adds columns left and right, header cells in the header", () => {
    const editor = createEditor(TABLE);

    const added = addColumn(cell(editor, "1"), false);
    expect(added.cellIndex).toBe(0);
    expect(added.parentElement).toBe(cell(editor, "1").parentElement);
    expect(editor.querySelector("thead tr")?.children[0].tagName).toBe("TH");

    addColumn(cell(editor, "B"), true);
    expect(
      Array.from(editor.querySelectorAll("tr"), (row) => row.children.length),
    ).toEqual([4, 4, 4]);
  });

  it("removes rows and columns - the table with the last of them", () => {
    const editor = createEditor(`<p>Before</p>${TABLE}`);

    const next = deleteRow(editor, cell(editor, "1")) as HTMLElement;
    expect(next.textContent).toBe("3");
    expect(editor.querySelectorAll("tr")).toHaveLength(2);

    // The header row gone, the header goes too
    deleteRow(editor, cell(editor, "A"));
    expect(editor.querySelector("thead")).toBeNull();

    const nextCell = deleteColumn(editor, cell(editor, "3")) as HTMLElement;
    expect(nextCell.textContent).toBe("4");

    const target = deleteColumn(editor, cell(editor, "4"));
    expect(editor.querySelector("table")).toBeNull();
    expect(target?.textContent).toBe("Before");
  });

  it("leaves a paragraph when the table was all the content", () => {
    const editor = createEditor(TABLE);
    const target = deleteTable(
      editor,
      editor.querySelector("table") as HTMLTableElement,
    );

    expect(editor.innerHTML).toBe("<p><br></p>");
    expect(target).toBe(editor.firstChild);
  });

  it("switches the header row", () => {
    const editor = createEditor(TABLE);
    const table = editor.querySelector("table") as HTMLTableElement;

    toggleHeaderRow(table);
    expect(hasHeaderRow(table)).toBe(false);
    expect(table.innerHTML).toBe(
      "<tbody><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody>",
    );

    toggleHeaderRow(table);
    expect(hasHeaderRow(table)).toBe(true);
    expect(table.innerHTML).toBe(TABLE.replace(/^<table>|<\/table>$/g, ""));
  });
});

describe("the size of a table", () => {
  it("stops at the columns and cells the value of the editor keeps", () => {
    const wide = createEditor("");
    wide.append(createTable(document, 2, 50, false));
    const last = wide.querySelector("td:last-child") as HTMLTableCellElement;

    // A column more would make the value lines of text
    expect(addColumn(last, true)).toBe(last);
    expect(wide.querySelector("tr")?.cells).toHaveLength(50);
    expect(addRow(last, true).parentElement).not.toBe(last.parentElement);

    const full = createEditor("");
    const table = createTable(document, 200, 50, false);
    full.append(table);
    const corner = table.rows[199].cells[49];

    expect(appendRow(table)).toBe(corner);
    expect(addRow(corner, false)).toBe(corner);
    expect(table.rows).toHaveLength(200);
  });
});

describe("moving between cells", () => {
  it("goes through the cells in reading order", () => {
    const editor = createEditor(TABLE);

    expect(siblingCell(cell(editor, "B"), false)?.textContent).toBe("1");
    expect(siblingCell(cell(editor, "1"), true)?.textContent).toBe("B");
    expect(siblingCell(cell(editor, "A"), true)).toBeNull();
    expect(siblingCell(cell(editor, "4"), false)).toBeNull();
  });

  it("adds a row at the end of the body", () => {
    const editor = createEditor(TABLE);
    const first = appendRow(editor.querySelector("table") as HTMLTableElement);

    expect(first.cellIndex).toBe(0);
    expect(first.parentElement).toBe(editor.querySelector("tbody")?.lastChild);
    expect(first.parentElement?.children).toHaveLength(2);
  });

  it("finds the cell of a node and tells the edges of its content", () => {
    const editor = createEditor(TABLE);
    const text = cell(editor, "1").firstChild as Node;

    expect(cellOf(editor, text)).toBe(cell(editor, "1"));
    expect(cellOf(editor, editor)).toBeNull();
    expect(isAtEdgeOf(cell(editor, "1"), caretIn(text, 1), true)).toBe(true);
    expect(isAtEdgeOf(cell(editor, "1"), caretIn(text, 0), true)).toBe(false);
    expect(isAtEdgeOf(cell(editor, "1"), caretIn(text, 0), false)).toBe(true);
  });
});
