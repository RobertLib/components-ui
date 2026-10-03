// DOM helpers of RichTextEditor - the editing commands build on them

// Elements that are blocks or hold them - anything else is inline content
const BLOCK_ELEMENTS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "CAPTION",
  "CENTER",
  "DD",
  "DETAILS",
  "DIALOG",
  "DIR",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HGROUP",
  "HR",
  "LI",
  "LISTING",
  "MAIN",
  "MENU",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SEARCH",
  "SECTION",
  "SUMMARY",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

/** The line elements a table or rule can be put after by splitting them. */
export const TEXT_BLOCKS = new Set([
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "P",
]);

export const isElement = (node: Node | null | undefined): node is HTMLElement =>
  !!node && node.nodeType === Node.ELEMENT_NODE;

export const isBlockNode = (
  node: Node | null | undefined,
): node is HTMLElement => isElement(node) && BLOCK_ELEMENTS.has(node.tagName);

export const isListElement = (
  node: Node | null | undefined,
): node is HTMLElement =>
  isElement(node) && (node.tagName === "UL" || node.tagName === "OL");

/** Text of whitespace only - source formatting between blocks. */
export const isWhitespace = (node: Node | null | undefined) =>
  !!node && node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();

/** The index of `node` among the children of its parent. */
export const indexOf = (node: Node) =>
  node.parentNode
    ? Array.prototype.indexOf.call(node.parentNode.childNodes, node)
    : -1;

/**
 * The closest element around `node` (or `node` itself) in `editor` that
 * matches `selector` - never the editor itself or anything outside it.
 */
export function closestIn(
  editor: HTMLElement,
  node: Node | null | undefined,
  selector: string,
): HTMLElement | null {
  const element =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null);
  const match = element?.closest<HTMLElement>(selector) ?? null;

  return match && match !== editor && editor.contains(match) ? match : null;
}

/** The child of `editor` that holds `node`. */
export function topLevelOf(editor: HTMLElement, node: Node): Node | null {
  let current: Node | null = node;
  while (current && current.parentNode !== editor) current = current.parentNode;
  return current;
}

/**
 * The element whose inline content holds `node` - a paragraph, heading,
 * list item, cell or quote - or the editor, for text right in it.
 */
export function lineOf(editor: HTMLElement, node: Node): HTMLElement {
  let current = node.parentElement;
  while (
    current &&
    current !== editor &&
    !BLOCK_ELEMENTS.has(current.tagName)
  ) {
    current = current.parentElement;
  }
  return current ?? editor;
}

/** Whether an element shows nothing - no text, line break or rule. */
export function isEmptyLine(element: Node) {
  return (
    !element.textContent?.replace(/\u200B/g, "").trim() &&
    !(isElement(element) && element.querySelector("br, hr, img"))
  );
}

/** Makes `range` the selection - the place a command acts on. */
export function select(range: Range | null) {
  const selection = document.getSelection();
  if (!range || !selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

/** Puts the caret at the start (or the end) of `element`'s content. */
export function placeCaret(element: Node, atEnd = false) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(!atEnd);
  select(range);
  return range;
}

/** Selects the content of `element` - e.g. of a table cell. */
export function selectContents(element: Node) {
  const range = document.createRange();
  range.selectNodeContents(element);
  select(range);
  return range;
}

/**
 * A point of the selection that survives moving the nodes around it: it
 * refers to a text node, to the leaf element it is before or after (a line
 * break), or to the empty element it is in - the containers of a line may
 * be replaced, its content is only moved.
 */
interface Anchor {
  kind: "after" | "before" | "inside" | "text";
  node: Node;
  offset: number;
}

export interface Bookmark {
  end: Anchor;
  start: Anchor;
}

/** The first (or last) leaf position in `node`. */
function edgeAnchor(node: Node, atEnd: boolean): Anchor {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      kind: "text",
      node,
      offset: atEnd ? (node.textContent?.length ?? 0) : 0,
    };
  }

  const child = atEnd ? node.lastChild : node.firstChild;
  if (child) return edgeAnchor(child, atEnd);

  // A leaf - a line break - or an empty element
  return isElement(node) && !["BR", "HR", "IMG"].includes(node.tagName)
    ? { kind: "inside", node, offset: 0 }
    : { kind: atEnd ? "after" : "before", node, offset: 0 };
}

function toAnchor(container: Node, offset: number, isEnd: boolean): Anchor {
  if (container.nodeType === Node.TEXT_NODE) {
    return { kind: "text", node: container, offset };
  }

  const { childNodes } = container;
  if (childNodes.length === 0) {
    return { kind: "inside", node: container, offset: 0 };
  }

  // The end of a selection belongs to what is before it, its start to what
  // is after it
  const after = childNodes[offset];
  const before = childNodes[offset - 1];

  if (after && (!isEnd || !before)) return edgeAnchor(after, false);
  return edgeAnchor(before ?? after, true);
}

export function createBookmark(range: Range): Bookmark {
  const start = toAnchor(range.startContainer, range.startOffset, false);

  return {
    // A caret is one point - its two anchors must not tell apart
    end: range.collapsed
      ? start
      : toAnchor(range.endContainer, range.endOffset, true),
    start,
  };
}

function fromAnchor(anchor: Anchor, root: HTMLElement): [Node, number] | null {
  const { kind, node, offset } = anchor;
  if (!root.contains(node)) return null;

  if (kind === "text") {
    return [node, Math.min(offset, node.textContent?.length ?? 0)];
  }
  if (kind === "inside") return [node, 0];

  const parent = node.parentNode;
  if (!parent) return null;
  return [parent, indexOf(node) + (kind === "after" ? 1 : 0)];
}

/** The range of a bookmark - `null` when its nodes are gone. */
export function resolveBookmark(bookmark: Bookmark, root: HTMLElement) {
  const start = fromAnchor(bookmark.start, root);
  const end = fromAnchor(bookmark.end, root);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range;
}

/**
 * Splits the inline elements around a point up to `line`, so the point is
 * between two children of `line` - returns the index of that position.
 */
export function splitAt(line: Node, node: Node, offset: number): number {
  let container: Node = node;
  let index = offset;

  if (container.nodeType === Node.TEXT_NODE) {
    const text = container as Text;
    if (index > 0 && index < text.length) text.splitText(index);
    index = indexOf(text) + (index > 0 ? 1 : 0);
    container = text.parentNode as Node;
  }

  while (container !== line && container.parentNode) {
    const parent: Node = container.parentNode;

    if (index > 0 && index < container.childNodes.length) {
      // The children after the point go into a copy of the element
      const copy = container.cloneNode(false);
      while (container.childNodes.length > index) {
        copy.insertBefore(container.lastChild as Node, copy.firstChild);
      }
      parent.insertBefore(copy, container.nextSibling);
      index = indexOf(container) + 1;
    } else {
      index = indexOf(container) + (index > 0 ? 1 : 0);
    }
    container = parent;
  }

  return index;
}

/** Replaces an element with its children. */
export function unwrap(element: Element) {
  element.replaceWith(...Array.from(element.childNodes));
}

/**
 * Replaces an element with a new one of another tag, keeping its children
 * (moved, so a selection in them stays).
 */
export function changeTag(element: Element, tag: string) {
  const replacement = element.ownerDocument.createElement(tag);
  replacement.append(...Array.from(element.childNodes));
  element.replaceWith(replacement);
  return replacement;
}

/** A new empty line - a paragraph with a line break, so it has a height. */
export function createEmptyParagraph(document: Document) {
  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  return paragraph;
}
