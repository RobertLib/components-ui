// The block commands of RichTextEditor - headings, quotes, lists and their
// indentation. The editor's content is read as a sequence of lines, each of
// a type (paragraph, heading, quote, bulleted or numbered item at a level);
// a command changes the types and levels of the selected lines, and the
// blocks around them are built anew from the lines. Their content is moved,
// not copied, so the selection in it stays.
import {
  createBookmark,
  indexOf,
  isBlockNode,
  isElement,
  isEmptyLine,
  isListElement,
  isWhitespace,
  placeCaret,
  resolveBookmark,
  select,
  topLevelOf,
} from "./dom";

export type LineType = "h2" | "h3" | "ol" | "p" | "quote" | "ul";

export interface Line {
  /** Its type or level was changed - it is built anew. */
  changed: boolean;
  /** The element of the line - `null` for text right in the editor or a quote. */
  element: HTMLElement | null;
  /** Nesting of a list item - 0 for the items of a top-level list. */
  level: number;
  /** The inline content of the line. */
  nodes: Node[];
  /** The element the line was built into. */
  output?: HTMLElement;
  /** The selection is in the line. */
  selected: boolean;
  type: LineType;
}

/** A line - or a block the commands leave as it is (a table, a rule). */
type Item = Line | { block: Node };

const isLine = (item: Item): item is Line => "type" in item;

export const isListLine = (line: Line) =>
  line.type === "ul" || line.type === "ol";

// Blocks of text inside a list item - lines of it (pasted `<li><p>`)
const TEXT_IN_ITEM = new Set([
  "BLOCKQUOTE",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "P",
  "PRE",
]);

const createLine = (
  element: HTMLElement | null,
  nodes: Node[],
  type: LineType,
  level: number,
): Line => ({ changed: false, element, level, nodes, selected: false, type });

/** Content that shows - not whitespace between blocks. */
const isContent = (node: Node) => !isWhitespace(node);

/** The inline content of a list item, its blocks of text as lines. */
function flattenItem(nodes: Node[]): Node[] {
  const result: Node[] = [];

  for (const node of nodes) {
    if (isElement(node) && TEXT_IN_ITEM.has(node.tagName)) {
      if (result.some(isContent) && result.at(-1)?.nodeName !== "BR") {
        result.push(node.ownerDocument.createElement("br"));
      }
      result.push(...flattenItem(Array.from(node.childNodes)));
    } else {
      result.push(node);
    }
  }

  return result;
}

function parseList(list: Element, level: number, items: Item[]) {
  const type = list.tagName === "OL" ? "ol" : "ul";

  for (const child of Array.from(list.childNodes)) {
    if (isElement(child) && child.tagName === "LI") {
      const content = Array.from(child.childNodes);
      items.push(
        createLine(
          child,
          flattenItem(content.filter((node) => !isListElement(node))),
          type,
          level,
        ),
      );
      for (const nested of content.filter(isListElement)) {
        parseList(nested, level + 1, items);
      }
    } else if (isListElement(child)) {
      // A list right in a list - Chrome indents so
      parseList(child, level + 1, items);
    } else if (isContent(child)) {
      items.push(createLine(null, [child], type, level));
    }
  }
}

function parseNodes(nodes: Node[], items: Item[], inQuote: boolean) {
  // Text right in the editor or a quote - a line ends with a line break
  let run: Node[] = [];
  const flush = () => {
    if (run.some(isContent)) {
      items.push(createLine(null, run, inQuote ? "quote" : "p", 0));
    }
    run = [];
  };

  for (const node of nodes) {
    if (!isBlockNode(node)) {
      run.push(node);
      if (node.nodeName === "BR") flush();
      continue;
    }
    flush();

    const tag = node.tagName;
    if (tag === "P" || tag === "DIV") {
      // A wrapper of blocks is none
      if (Array.from(node.children).some(isBlockNode)) {
        parseNodes(Array.from(node.childNodes), items, inQuote);
      } else {
        items.push(
          createLine(
            node,
            Array.from(node.childNodes),
            inQuote ? "quote" : "p",
            0,
          ),
        );
      }
    } else if (/^H[1-6]$/.test(tag)) {
      const type = inQuote
        ? "quote"
        : tag === "H1" || tag === "H2"
          ? "h2"
          : "h3";
      items.push(createLine(node, Array.from(node.childNodes), type, 0));
    } else if (tag === "BLOCKQUOTE") {
      parseNodes(Array.from(node.childNodes), items, true);
    } else if (isListElement(node)) {
      parseList(node, 0, items);
    } else {
      items.push({ block: node });
    }
  }
  flush();
}

/** The boundary points around a line. */
function lineBounds(line: Line): [Node, number, Node, number] {
  const first = line.nodes.find((node) => node.parentNode);
  const last = line.nodes.findLast((node) => node.parentNode);

  if (!first || !last) {
    const element = line.element as HTMLElement;
    return [element, 0, element, element.childNodes.length];
  }

  const lastParent = last.parentNode as Node;
  return [
    first.parentNode as Node,
    indexOf(first),
    lastParent,
    indexOf(last) + 1,
  ];
}

/**
 * Whether the selection is in a line. A selection that only touches it -
 * ends at its very start, as a triple click does, or starts at its very
 * end - is not.
 */
function isLineSelected(line: Line, range: Range) {
  const [startNode, startOffset, endNode, endOffset] = lineBounds(line);

  if (
    range.comparePoint(endNode, endOffset) < 0 ||
    range.comparePoint(startNode, startOffset) > 0
  ) {
    return false;
  }
  if (range.collapsed) return true;

  const shared = document.createRange();
  shared.setStart(startNode, startOffset);
  shared.setEnd(endNode, endOffset);
  if (range.compareBoundaryPoints(Range.START_TO_START, shared) > 0) {
    shared.setStart(range.startContainer, range.startOffset);
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, shared) < 0) {
    shared.setEnd(range.endContainer, range.endOffset);
  }

  const hasText = line.nodes.some((node) => node.textContent?.trim());
  return shared.toString() !== "" || !hasText;
}

const isMergeable = (node: Node | undefined) =>
  isElement(node) &&
  (node.tagName === "UL" ||
    node.tagName === "OL" ||
    node.tagName === "BLOCKQUOTE");

/** The index of the child of `editor` a boundary point is in. */
function childIndexAt(
  editor: HTMLElement,
  children: Node[],
  container: Node,
  offset: number,
  isEnd: boolean,
) {
  if (container === editor) {
    const index = isEnd ? offset - 1 : offset;
    return Math.min(Math.max(index, 0), children.length - 1);
  }

  const top = topLevelOf(editor, container);
  return top ? children.indexOf(top) : -1;
}

/**
 * The children of the editor a command on `range` builds anew: those the
 * selection is in, the whole run of text right in the editor around them,
 * and the lists and quotes next to them - new items and quoted lines join
 * those.
 */
function regionOf(editor: HTMLElement, range: Range): Node[] {
  const children = Array.from(editor.childNodes);
  if (children.length === 0) return [];

  let first = childIndexAt(
    editor,
    children,
    range.startContainer,
    range.startOffset,
    false,
  );
  let last = childIndexAt(
    editor,
    children,
    range.endContainer,
    range.endOffset,
    true,
  );
  if (first === -1 || last === -1) return [];

  while (
    first > 0 &&
    !isBlockNode(children[first]) &&
    !isBlockNode(children[first - 1])
  ) {
    first -= 1;
  }
  while (
    last < children.length - 1 &&
    !isBlockNode(children[last]) &&
    !isBlockNode(children[last + 1])
  ) {
    last += 1;
  }

  let before = first - 1;
  while (before >= 0 && isWhitespace(children[before])) before -= 1;
  if (isMergeable(children[before])) first = before;

  let after = last + 1;
  while (after < children.length && isWhitespace(children[after])) after += 1;
  if (isMergeable(children[after])) last = after;

  return children.slice(first, last + 1);
}

/** The lines of the content a command on `range` builds anew. */
function readRegion(editor: HTMLElement, range: Range) {
  const region = regionOf(editor, range);
  const items: Item[] = [];
  parseNodes(region, items, false);

  const lines = items.filter(isLine);
  for (const line of lines) line.selected = isLineSelected(line, range);

  return { items, lines, region };
}

/**
 * The element of a line. A line of text right in the editor leaves the
 * line break that ended it behind - the element ends it now.
 */
function buildLine(line: Line, tag: string) {
  // An unchanged paragraph, heading or quoted line keeps its element
  if (!line.changed && line.element && line.element.tagName !== "LI") {
    line.output = line.element;
    return line.element;
  }

  const doc = (line.element ?? line.nodes[0]).ownerDocument as Document;
  const element = doc.createElement(tag);
  const nodes =
    line.element === null &&
    line.nodes.at(-1)?.nodeName === "BR" &&
    line.nodes.slice(0, -1).some(isContent)
      ? line.nodes.slice(0, -1)
      : line.nodes;

  element.append(...nodes);
  // An empty line keeps its height
  if (isEmptyLine(element)) element.append(doc.createElement("br"));

  line.output = element;
  return element;
}

interface OpenList {
  element: HTMLElement;
  item: HTMLElement | null;
  type: "ol" | "ul";
}

/** The blocks of lines - quoted lines in quotes, items in nested lists. */
function buildBlocks(items: Item[], doc: Document): Node[] {
  const output: Node[] = [];
  let quote: HTMLElement | null = null;
  let lists: OpenList[] = [];

  for (const item of items) {
    if (!isLine(item)) {
      quote = null;
      lists = [];
      output.push(item.block);
      continue;
    }

    if (item.type !== "quote") quote = null;
    if (item.type !== "ul" && item.type !== "ol") lists = [];

    if (item.type === "quote") {
      if (!quote) {
        quote = doc.createElement("blockquote");
        output.push(quote);
      }
      quote.append(buildLine(item, "p"));
    } else if (item.type === "ul" || item.type === "ol") {
      // At most one level deeper than the item before
      const level = Math.min(item.level, lists.length);
      lists = lists.slice(0, level + 1);
      if (lists.length === level + 1 && lists[level].type !== item.type) {
        lists = lists.slice(0, level);
      }

      if (lists.length === level) {
        const list = doc.createElement(item.type);
        const parent = lists[level - 1];
        if (!parent) output.push(list);
        else (parent.item as HTMLElement).append(list);
        lists.push({ element: list, item: null, type: item.type });
      }

      const listItem = buildLine(item, "li");
      lists[level].element.append(listItem);
      lists[level].item = listItem;
    } else if (!item.changed && item.element === null) {
      // Unchanged text right in the editor stays so
      output.push(...item.nodes);
    } else {
      output.push(buildLine(item, item.type));
    }
  }

  return output;
}

/**
 * Changes the selected lines by `transform` and builds their blocks anew.
 * `transform` returns whether it changed anything; the selection is kept.
 */
export function applyLineCommand(
  editor: HTMLElement,
  range: Range,
  transform: (lines: Line[]) => boolean,
): boolean {
  const { items, lines, region } = readRegion(editor, range);
  if (region.length === 0 || !transform(lines)) return false;

  const bookmark = createBookmark(range);
  const doc = editor.ownerDocument;
  // Where the new blocks go - the old ones are taken apart on the way
  const placeholder = doc.createTextNode("");
  editor.insertBefore(placeholder, region[0]);

  const blocks = buildBlocks(items, doc);
  const kept = new Set(blocks);
  for (const node of region) {
    if (node.parentNode === editor && !kept.has(node)) {
      (node as ChildNode).remove();
    }
  }
  for (const block of blocks) editor.insertBefore(block, placeholder);
  placeholder.remove();

  const restored = resolveBookmark(bookmark, editor);
  if (restored) {
    select(restored);
  } else {
    const target = lines.find((line) => line.selected)?.output;
    if (target) placeCaret(target);
  }
  return true;
}

/**
 * Makes the selected lines paragraphs, headings or quoted lines - lines
 * already of that heading or quote become paragraphs again.
 */
export function setLineType(
  lines: Line[],
  type: "h2" | "h3" | "p" | "quote",
): boolean {
  const selected = lines.filter((line) => line.selected);
  if (selected.length === 0) return false;

  const next =
    type !== "p" && selected.every((line) => line.type === type) ? "p" : type;
  let changed = false;

  for (const line of selected) {
    if (line.type !== next || line.level !== 0) {
      line.type = next;
      line.level = 0;
      line.changed = true;
      changed = true;
    }
  }
  return changed;
}

/**
 * Makes the selected lines items of a list of `type` - items of the other
 * kind keep their level - or paragraphs, when all of them are such items.
 */
export function toggleList(lines: Line[], type: "ol" | "ul"): boolean {
  const selected = lines.filter((line) => line.selected);
  if (selected.length === 0) return false;

  const removes = selected.every((line) => line.type === type);

  for (const line of selected) {
    if (removes) {
      line.type = "p";
      line.level = 0;
    } else if (line.type !== type) {
      if (!isListLine(line)) line.level = 0;
      line.type = type;
    }
    line.changed = true;
  }
  return true;
}

/**
 * Whether the selected items can be indented - the first of them has an
 * item before it on its level to be nested in.
 */
export function canIndent(lines: Line[]) {
  const index = lines.findIndex((line) => line.selected && isListLine(line));
  if (index === -1) return false;

  const { level } = lines[index];
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const line = lines[previous];
    if (!isListLine(line) || line.level < level) return false;
    if (line.level === level) return true;
  }
  return false;
}

export const canOutdent = (lines: Line[]) =>
  lines.some((line) => line.selected && isListLine(line));

/**
 * Indents (`1`) or outdents (`-1`) the selected items together with the
 * items nested in them. Outdented from the top level, an item becomes a
 * paragraph; the items after an outdented one become nested in it, so the
 * order stays.
 */
export function shiftLevels(lines: Line[], delta: 1 | -1): boolean {
  if (delta > 0 ? !canIndent(lines) : !canOutdent(lines)) return false;

  // The level of the selected item whose nested items are being shifted
  let subtree: number | null = null;

  for (const line of lines) {
    if (!isListLine(line)) {
      subtree = null;
      continue;
    }
    if (subtree !== null && line.level <= subtree) subtree = null;

    const shifts = line.selected || subtree !== null;
    if (line.selected && subtree === null) subtree = line.level;
    if (!shifts) continue;

    line.changed = true;
    if (line.level + delta < 0) {
      line.type = "p";
      line.level = 0;
    } else {
      line.level += delta;
    }
  }
  return true;
}

/** What the block tools show for the selection. */
export interface BlockState {
  canIndent: boolean;
  canOutdent: boolean;
  /** Whether the selection is in lines at all - not only in a table. */
  hasLines: boolean;
  /** Whether a selected line is a nested list item. */
  nested: boolean;
  /** The type all selected lines are of - `null` when they differ. */
  type: LineType | null;
}

/** The state of the block tools - reads the content, changes nothing. */
export function getBlockState(editor: HTMLElement, range: Range): BlockState {
  const { lines } = readRegion(editor, range);
  const selected = lines.filter((line) => line.selected);
  const type = selected[0]?.type ?? null;

  return {
    canIndent: canIndent(lines),
    canOutdent: canOutdent(lines),
    hasLines: selected.length > 0,
    nested: selected.some((line) => isListLine(line) && line.level > 0),
    type: selected.every((line) => line.type === type) ? type : null,
  };
}

/**
 * Whether a node is in a list item without text - Enter there leaves the
 * list (or its level) instead of adding another empty item.
 */
export function isInEmptyItem(editor: HTMLElement, node: Node) {
  const item = (isElement(node) ? node : node.parentElement)?.closest("li");
  if (!item || !editor.contains(item)) return false;

  return Array.from(item.childNodes).every(
    (child) => isListElement(child) || !child.textContent?.trim(),
  );
}
