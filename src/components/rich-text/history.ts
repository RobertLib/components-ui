// The undo history of RichTextEditor. The browser's own history is shared
// by all fields of the page (an undo in one editor can undo a change in
// another) and knows nothing of the changes the editor makes to the page
// itself (tables, lists) - so the editor keeps snapshots of its content.

/** A boundary point as the child indexes from the editor down to it. */
interface SavedPoint {
  offset: number;
  path: number[];
}

export interface SavedSelection {
  end: SavedPoint;
  start: SavedPoint;
}

export interface Snapshot {
  html: string;
  /** Where the caret goes when the snapshot is restored. */
  selection: SavedSelection | null;
}

// Typing within this time of the last change joins it in one undo step
const JOIN_MS = 1000;
const MAX_ENTRIES = 100;

function pathOf(root: Node, node: Node): number[] | null {
  const path: number[] = [];

  for (let current = node; current !== root;) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  return path;
}

function savePoint(root: Node, node: Node, offset: number): SavedPoint | null {
  const path = pathOf(root, node);
  return path ? { offset, path } : null;
}

function resolvePoint(root: Node, { offset, path }: SavedPoint) {
  let node: Node | undefined = root;
  for (const index of path) node = node?.childNodes[index];
  if (!node) return null;

  const length =
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent?.length ?? 0)
      : node.childNodes.length;
  return [node, Math.min(offset, length)] as const;
}

/** The selection as paths from `root` - `null` when it is outside of it. */
export function saveSelection(
  root: Node,
  range: Range | null,
): SavedSelection | null {
  if (!range) return null;

  const start = savePoint(root, range.startContainer, range.startOffset);
  const end = savePoint(root, range.endContainer, range.endOffset);
  return start && end ? { end, start } : null;
}

/** The range of a saved selection - `null` when its nodes are not there. */
export function restoreSelection(root: Node, saved: SavedSelection | null) {
  if (!saved) return null;

  const start = resolvePoint(root, saved.start);
  const end = resolvePoint(root, saved.end);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range;
}

const sameSelection = (a: SavedSelection | null, b: SavedSelection | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The kind of a change - runs of typing or deleting join in one step. */
export type ChangeKind = "delete" | "type" | null;

export class EditHistory {
  private entries: Snapshot[];
  private index = 0;
  private lastKind: ChangeKind = null;
  private lastTime = 0;

  constructor(initial: Snapshot) {
    this.entries = [initial];
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.entries.length - 1;
  }

  /** Starts anew from `snapshot` - the content was replaced from outside. */
  reset(snapshot: Snapshot) {
    this.entries = [snapshot];
    this.index = 0;
    this.lastKind = null;
  }

  /**
   * Notes the selection a change starts from - where undoing it puts the
   * caret back. A caret moved since the last change ends a run of typing.
   */
  beforeChange(selection: SavedSelection | null) {
    const current = this.entries[this.index];
    if (!sameSelection(current.selection, selection)) {
      current.selection = selection;
      this.lastKind = null;
    }
  }

  /** Adds the content after a change - to the step of a run of typing. */
  record(snapshot: Snapshot, kind: ChangeKind, time = Date.now()) {
    const current = this.entries[this.index];
    if (snapshot.html === current.html) return;

    const joins =
      kind !== null &&
      kind === this.lastKind &&
      time - this.lastTime < JOIN_MS &&
      this.index > 0 &&
      this.index === this.entries.length - 1;

    if (joins) {
      this.entries[this.index] = snapshot;
    } else {
      this.entries = [...this.entries.slice(0, this.index + 1), snapshot].slice(
        -MAX_ENTRIES,
      );
      this.index = this.entries.length - 1;
    }
    this.lastKind = kind;
    this.lastTime = time;
  }

  /**
   * Replaces the current content without a step of its own - the editor
   * cleaned it up (a style of the browser removed on blur).
   */
  replaceCurrent(html: string) {
    this.entries[this.index] = { html, selection: null };
  }

  undo(): Snapshot | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    this.lastKind = null;
    return this.entries[this.index];
  }

  redo(): Snapshot | null {
    if (!this.canRedo) return null;
    this.index += 1;
    this.lastKind = null;
    return this.entries[this.index];
  }
}
