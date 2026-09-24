import { afterEach, describe, expect, it } from "vitest";
import {
  EditHistory,
  restoreSelection,
  saveSelection,
  type SavedSelection,
} from "./history";

afterEach(() => {
  document.body.innerHTML = "";
});

const snapshot = (html: string, selection: SavedSelection | null = null) => ({
  html,
  selection,
});

describe("EditHistory", () => {
  it("undoes and redoes steps", () => {
    const history = new EditHistory(snapshot(""));
    expect(history.canUndo).toBe(false);

    history.record(snapshot("<p>a</p>"), null, 0);
    history.record(snapshot("<h2>a</h2>"), null, 10);
    expect(history.canUndo).toBe(true);

    expect(history.undo()?.html).toBe("<p>a</p>");
    expect(history.canRedo).toBe(true);
    expect(history.undo()?.html).toBe("");
    expect(history.undo()).toBeNull();

    expect(history.redo()?.html).toBe("<p>a</p>");
    // A new step drops what could be redone
    history.record(snapshot("<p>ab</p>"), null, 20);
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.html).toBe("<p>a</p>");
  });

  it("joins a run of typing, but not after a pause or a move of the caret", () => {
    const history = new EditHistory(snapshot(""));
    const caret = (offset: number): SavedSelection => ({
      end: { offset, path: [0, 0] },
      start: { offset, path: [0, 0] },
    });

    history.record(snapshot("<p>a</p>", caret(1)), "type", 0);
    history.beforeChange(caret(1));
    history.record(snapshot("<p>ab</p>", caret(2)), "type", 300);
    expect(history.undo()?.html).toBe("");
    history.redo();

    // A pause
    history.beforeChange(caret(2));
    history.record(snapshot("<p>abc</p>", caret(3)), "type", 2000);
    expect(history.undo()?.html).toBe("<p>ab</p>");
    history.redo();

    // The caret moved - undo puts it back where the change started
    history.beforeChange(caret(0));
    history.record(snapshot("<p>xabc</p>", caret(1)), "type", 2100);
    const undone = history.undo();
    expect(undone?.html).toBe("<p>abc</p>");
    expect(undone?.selection).toEqual(caret(0));
  });

  it("records no step for the same content, and starts anew on a reset", () => {
    const history = new EditHistory(snapshot("<p>a</p>"));

    history.record(snapshot("<p>a</p>"), null, 0);
    expect(history.canUndo).toBe(false);

    history.record(snapshot("<p>b</p>"), null, 0);
    history.reset(snapshot("<p>c</p>"));
    expect(history.canUndo).toBe(false);

    history.replaceCurrent("<p>d</p>");
    history.record(snapshot("<p>e</p>"), null, 0);
    expect(history.undo()?.html).toBe("<p>d</p>");
  });

  it("keeps a hundred steps", () => {
    const history = new EditHistory(snapshot("0"));
    for (let step = 1; step <= 150; step += 1) {
      history.record(snapshot(String(step)), null, step);
    }

    let undone = 0;
    while (history.undo()) undone += 1;
    expect(undone).toBe(99);
  });
});

describe("saveSelection", () => {
  it("restores a selection in the same content", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Hello <b>world</b></p>";
    document.body.append(root);

    const range = document.createRange();
    range.setStart(root.querySelector("p")?.firstChild as Node, 2);
    range.setEnd(root.querySelector("b")?.firstChild as Node, 3);
    const saved = saveSelection(root, range);

    root.innerHTML = "<p>Hello <b>world</b></p>";
    expect(restoreSelection(root, saved)?.toString()).toBe("llo wor");

    // Nothing to restore in other content
    root.innerHTML = "<p>Hi</p>";
    expect(restoreSelection(root, saved)).toBeNull();
    expect(saveSelection(root, null)).toBeNull();
  });
});
