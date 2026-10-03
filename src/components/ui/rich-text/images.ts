// The images of RichTextEditor - inline in the lines of text, like a
// character. An image being uploaded is a placeholder until its URL comes:
// an `<img>` marked with the id of its upload, showing a preview of the
// file (or an empty box) - the value never has it, as the sanitizer keeps
// no image without a safe `src` (a `blob:` URL is none).
import { closestIn, indexOf, isElement, select } from "./dom";

/** The attribute of the placeholder of an image being uploaded - its id. */
export const UPLOAD_ATTRIBUTE = "data-upload";

/** The placeholders of the uploads in `root`. */
export const uploadPlaceholdersIn = (root: ParentNode) =>
  Array.from(
    root.querySelectorAll<HTMLImageElement>(`img[${UPLOAD_ATTRIBUTE}]`),
  );

/**
 * The image the selection is - a selection of one image and no text, as a
 * click on an image makes it. Not a placeholder of an upload.
 */
export function imageAt(editor: HTMLElement, range: Range) {
  if (range.collapsed || range.toString().trim() !== "") return null;

  const images = Array.from(editor.getElementsByTagName("img")).filter(
    (image) => range.intersectsNode(image),
  );
  const [image] = images;
  return images.length === 1 && !image.hasAttribute(UPLOAD_ATTRIBUTE)
    ? image
    : null;
}

/** Selects an image - as a click selects text, for the image tool. */
export function selectImage(image: HTMLImageElement) {
  const range = document.createRange();
  range.selectNode(image);
  select(range);
  return range;
}

// The elements whose content is lines, other blocks or table rows - an
// image at a point right in them gets a paragraph of its own
const LINE_HOLDERS = new Set(["BLOCKQUOTE"]);

/**
 * Puts a node - an image - where the selection is, in place of selected
 * content. Between blocks (right in the editor or a quote) it gets a
 * paragraph. The caret goes right after it; returns that point.
 */
export function insertInline(editor: HTMLElement, range: Range, node: Node) {
  const doc = editor.ownerDocument;
  if (!range.collapsed) range.deleteContents();

  const container = range.startContainer;
  if (
    container === editor ||
    (isElement(container) && LINE_HOLDERS.has(container.tagName))
  ) {
    const paragraph = doc.createElement("p");
    range.insertNode(paragraph);
    paragraph.append(node);
  } else {
    range.insertNode(node);
  }

  // The line break that held an empty line open is no longer needed
  const next = node.nextSibling;
  if (
    next?.nodeName === "BR" &&
    !next.nextSibling &&
    node.previousSibling?.nodeName !== "BR" &&
    !closestIn(editor, node, "td, th, pre")
  ) {
    next.remove();
  }

  const caret = doc.createRange();
  const parent = node.parentNode as Node;
  caret.setStart(parent, indexOf(node) + 1);
  select(caret);
  return caret;
}

/** Whether a file is an image - by its type, as the browser tells it. */
export const isImageFile = (file: File) => file.type.startsWith("image/");

/** The image files of a paste or a drop. */
export const imageFilesOf = (data: DataTransfer | null | undefined) =>
  Array.from(data?.files ?? []).filter(isImageFile);

// A scheme - but not the port of a host (`localhost:3000/a.png`)
const HAS_SCHEME = /^[a-z][a-z\d+\-.]*:(?!\d+(?:[/?#]|$))/i;
// A host - `cdn.example.com`, `localhost:3000` - before the first slash
const HOST = /^(?:localhost|[^\s./?#:]+(?:\.[^\s./?#:]+)+)(?::\d+)?$/i;

/**
 * The source of what the user typed into the image field - an address
 * without a scheme whose start is a host (`cdn.example.com/a.png`) gets
 * `https://`; a path (`/uploads/a.png`, `a.png`) stays relative.
 */
export function toImageSrc(text: string) {
  if (HAS_SCHEME.test(text) || /^[/.?#]/.test(text)) return text;

  const slash = text.indexOf("/");
  return slash > 0 && HOST.test(text.slice(0, slash))
    ? `https://${text}`
    : text;
}
