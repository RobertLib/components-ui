import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Minus,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table,
  TextQuote,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Button from "./button";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import sanitizeRichText, {
  isSafeHref,
  sanitizeEditorContent,
  sanitizeRichTextLines,
  sanitizeRichTextParagraphs,
  type RichTextFormat,
} from "../utils/sanitize-rich-text";
import { useFormReset } from "../hooks/use-form-control";
import useIsApplePlatform from "../hooks/use-is-apple-platform";
import { useMessages } from "../providers/ui-context";
import {
  applyLineCommand,
  getBlockState,
  isInEmptyItem,
  setLineType,
  shiftLevels,
  toggleList,
  type Line,
} from "./rich-text/blocks";
import {
  changeTag,
  closestIn,
  createBookmark,
  createEmptyParagraph,
  isBlockNode,
  isListElement,
  isWhitespace,
  lineOf,
  placeCaret,
  resolveBookmark,
  select,
  selectContents,
  topLevelOf,
} from "./rich-text/dom";
import {
  EditHistory,
  restoreSelection,
  saveSelection,
  type ChangeKind,
  type Snapshot,
} from "./rich-text/history";
import {
  ColumnLeftIcon,
  ColumnRightIcon,
  DeleteColumnIcon,
  DeleteRowIcon,
  DeleteTableIcon,
  HeaderRowIcon,
  RowAboveIcon,
  RowBelowIcon,
} from "./rich-text/icons";
import {
  clearFormatting,
  hasLink,
  insertTextWithCode,
  isAllIn,
  linkAt,
  removeLink,
  toggleCode,
  toggleUnderline,
} from "./rich-text/inline";
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
  lastCellOf,
  MAX_TABLE_SIZE,
  siblingCell,
  tableBefore,
  toggleHeaderRow,
} from "./rich-text/tables";
import {
  ariaShortcut,
  DEFAULT_RICH_TEXT_TOOLBAR,
  formatShortcut,
  formatsByKey,
  formatsOf,
  isShortcut,
  REDO_SHORTCUT,
  SHORTCUTS,
  UNDO_SHORTCUT,
  type RichTextTool,
  type RichTextToolbarItem,
} from "./rich-text/tools";

export type { RichTextTool, RichTextToolbarItem } from "./rich-text/tools";

// A scheme - but not the port of a host (`localhost:3000`, `example.com:8080/a`);
// `tel:` and `mailto:` have no host, their digits are no port
const HAS_SCHEME =
  /^((?:mailto|tel):|[a-z][a-z\d+\-.]*:(?!\d+(?:[/?#]|$))|\/\/)/i;
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/;
const PHONE = /^\+?[\d\s().-]+$/;
// An IPv4 address - the host of a device in the network, not a phone
// number written with dots
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * The link of what the user typed into the link field - an e-mail address
 * links with `mailto:`, a phone number with `tel:` (also one typed with
 * it), and an address without a scheme gets `https://` (the browser would
 * resolve it against the app, which gives a dead route) - also an IP
 * address, whose digits and dots are no phone number.
 */
function toHref(text: string) {
  if (EMAIL.test(text)) return `mailto:${text}`;

  const phone = text.replace(/^tel:/i, "");
  if (
    !IPV4.test(text) &&
    PHONE.test(phone) &&
    phone.replace(/\D/g, "").length >= 6
  ) {
    return `tel:${phone.replace(/[^\d+]/g, "")}`;
  }

  return HAS_SCHEME.test(text) ? text : `https://${text}`;
}

// Formatting from the keyboard, or the menus of the browser and the system
// (iOS offers bold, italic and underline) - the value keeps it only when
// the toolbar has its tool. Other formatting (alignment, colors, fonts)
// never gets into the editor.
const INPUT_FORMATS: Record<string, RichTextFormat> = {
  formatBold: "bold",
  formatItalic: "italic",
  formatStrikeThrough: "strikethrough",
  formatUnderline: "underline",
  insertLink: "link",
};

// Elements bold by themselves - the bold tool has nothing to add there
const BOLD_BLOCKS = "h1, h2, h3, h4, h5, h6, th";

// The tools that are toggled - `aria-pressed`
const TOGGLES = new Set<RichTextTool>([
  "blockquote",
  "bold",
  "bulletList",
  "code",
  "heading2",
  "heading3",
  "italic",
  "numberedList",
  "paragraph",
  "strikethrough",
  "underline",
]);

const TOOL_ICONS: Record<RichTextTool, LucideIcon> = {
  blockquote: TextQuote,
  bold: Bold,
  bulletList: List,
  clearFormatting: RemoveFormatting,
  code: Code,
  heading2: Heading2,
  heading3: Heading3,
  horizontalRule: Minus,
  indent: ListIndentIncrease,
  italic: Italic,
  link: LinkIcon,
  numberedList: ListOrdered,
  outdent: ListIndentDecrease,
  paragraph: Pilcrow,
  redo: Redo2,
  strikethrough: Strikethrough,
  table: Table,
  underline: Underline,
  undo: Undo2,
};

type TableTool =
  | "addColumnLeft"
  | "addColumnRight"
  | "addRowAbove"
  | "addRowBelow"
  | "deleteColumn"
  | "deleteRow"
  | "deleteTable"
  | "headerRow";

// The tools of the table at the caret - their names are their texts
const TABLE_TOOLS: (
  "|" | { icon: (props: { size?: number }) => React.ReactNode; id: TableTool }
)[] = [
  { icon: RowAboveIcon, id: "addRowAbove" },
  { icon: RowBelowIcon, id: "addRowBelow" },
  { icon: DeleteRowIcon, id: "deleteRow" },
  "|",
  { icon: ColumnLeftIcon, id: "addColumnLeft" },
  { icon: ColumnRightIcon, id: "addColumnRight" },
  { icon: DeleteColumnIcon, id: "deleteColumn" },
  "|",
  { icon: HeaderRowIcon, id: "headerRow" },
  { icon: DeleteTableIcon, id: "deleteTable" },
];

/** The items of a toolbar in groups - `"|"` divides them. */
function splitGroups<T>(items: readonly (T | "|")[]): T[][] {
  const groups: T[][] = [[]];
  for (const item of items) {
    if (item === "|") groups.push([]);
    else groups[groups.length - 1].push(item);
  }
  return groups.filter((group) => group.length > 0);
}

/**
 * Groups of tools, which wrap as a whole on narrow screens. The divider of
 * a group is left of it - where a group starts a line, the divider falls
 * outside of the clipped box, so no line starts or ends with one.
 */
function ToolGroups({ groups }: { groups: React.ReactNode[][] }) {
  return (
    // The padding keeps the focus rings of the tools inside the clip
    <div className="overflow-hidden p-[3px]">
      <div className="-ml-[9px] flex flex-wrap items-center gap-y-1">
        {groups.map((group, index) => (
          <div
            className="relative ml-1 flex items-center gap-0.5 pl-[5px] before:absolute before:top-1/2 before:left-0 before:h-5 before:w-px before:-translate-y-1/2 before:bg-neutral-300 dark:before:bg-neutral-700"
            key={index}
          >
            {group}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The toolbar without unknown or repeated tools and stray dividers. */
function toolbarItemsOf(toolbar: readonly RichTextToolbarItem[]) {
  const items: RichTextToolbarItem[] = [];

  for (const item of toolbar) {
    if (item === "|") {
      if (items.length > 0 && items.at(-1) !== "|") items.push(item);
    } else if (item in TOOL_ICONS && !items.includes(item)) {
      items.push(item);
    }
  }
  if (items.at(-1) === "|") items.pop();

  return items;
}

/**
 * Whether a command is on at the caret - `undefined` where the browser
 * cannot tell (or throws instead).
 */
function queryCommandState(command: string): boolean | undefined {
  try {
    return typeof document.queryCommandState === "function"
      ? document.queryCommandState(command)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Runs a command of the browser - some browsers lack it or throw. */
function execCommand(command: string, value?: string) {
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

/**
 * The editing of every browser the same: Enter makes paragraphs (not
 * `<div>`s), and bold or italic are elements, not styles.
 */
function configureEditing() {
  execCommand("defaultParagraphSeparator", "p");
  execCommand("styleWithCSS", "false");
}

/** A collapsed range at the point of the page - where a drop lands. */
function caretRangeAt(x: number, y: number): Range | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (!position) return null;

    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    return range;
  }

  // Older Chrome and Safari have only the non-standard variant
  return document.caretRangeFromPoint?.(x, y) ?? null;
}

/** The selection, if it lies in `editor`. */
function rangeIn(editor: HTMLElement) {
  const selection = document.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

  return range && editor.contains(range.commonAncestorContainer) ? range : null;
}

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

/**
 * Whether a selection takes an element along as a whole - it starts at the
 * start of its text and has text after it too.
 */
function isReplacedWhole(element: Element, range: Range) {
  if (range.collapsed || !isAtEdgeOf(element, range, false)) return false;

  const after = document.createRange();
  after.setStartAfter(element);
  after.setEnd(range.endContainer, range.endOffset);
  return after.toString().trim() !== "";
}

// The data type marking a drag of the editor's own content - its drop is a
// move the browser does
const OWN_DRAG_TYPE = "application/x-components-ui-rich-text";

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

/**
 * The value of HTML in the editor - reduced to the formatting of its tools
 * (typing and the toolbar leave `<span style>` and `<font>` behind in some
 * browsers), and empty without text, whatever `<p><br></p>` it still holds.
 * The inline styles of a value from outside are read like those of pasted
 * content; those of the editor's own content are the browser's (`isOwn`).
 */
function normalize(
  html: string,
  formats: readonly RichTextFormat[],
  isOwn: boolean,
) {
  // Nothing to sanitize with on the server - and nothing unsanitized goes out
  if (!html || typeof document === "undefined") return "";

  const content = sanitizeEditorContent(html, formats, !isOwn);
  return content.hasText ? content.html : "";
}

/**
 * Whether the editor shows nothing but where the placeholder goes - no text
 * and at most one empty paragraph or heading. An empty list item, quote,
 * table or rule has no text either, but the placeholder would cover it.
 */
function isBlank(editor: HTMLElement) {
  if (editor.textContent?.trim()) return false;

  const nodes = Array.from(editor.childNodes).filter(
    (node) => !isWhitespace(node),
  );
  if (nodes.length > 1) return false;

  const [line] = nodes;
  return (
    !line ||
    line.nodeName === "BR" ||
    (/^(P|DIV|H[1-6])$/.test(line.nodeName) &&
      !Array.from((line as Element).querySelectorAll("*")).some(
        (element) => isBlockNode(element) || element.tagName === "IMG",
      ))
  );
}

/**
 * The kind of sanitized content - a line of text (inline content, or one
 * paragraph of it), a single list, or blocks.
 */
function contentKind(html: string): "blocks" | "line" | "list" {
  const template = document.createElement("template");
  template.innerHTML = html;
  const nodes = Array.from(template.content.childNodes);
  const [first] = nodes;

  if (!nodes.some(isBlockNode)) return "line";
  if (nodes.length > 1) return "blocks";
  if (isListElement(first)) return "list";
  return first.nodeName === "P" || first.nodeName === "DIV" ? "line" : "blocks";
}

/**
 * The line of text pasted content lands in - a heading, a list item or a
 * quoted line (cells are asked for before). `null` elsewhere.
 */
function textLineAt(editor: HTMLElement, node: Node) {
  const line =
    closestIn(editor, node, HEADING_SELECTOR) ?? closestIn(editor, node, "li");
  if (line) return { kind: line.tagName === "LI" ? "item" : "heading", line };

  return closestIn(editor, node, "blockquote")
    ? { kind: "quote", line: lineOf(editor, node) }
    : null;
}

/**
 * Makes the line a selection starts in a paragraph - a heading, list item
 * or quoted line, which pasted blocks replace or fill. The selection stays.
 */
function makeParagraphAt(editor: HTMLElement, range: Range) {
  const bookmark = createBookmark(range);
  const start = range.cloneRange();
  start.collapse(true);

  applyLineCommand(editor, start, (lines) => setLineType(lines, "p"));
  select(resolveBookmark(bookmark, editor));
}

const subscribeToNothing = () => () => {};

/**
 * Whether HTML can be sanitized - not on the server, nor while hydrating the
 * server's HTML. The editor is empty there and filled in right after, so the
 * first render in the browser matches the server's.
 */
const useCanSanitize = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

/** The kind of a change by its input type - typing and deleting join. */
function changeKindOf(event: Event): ChangeKind {
  const type = (event as InputEvent).inputType ?? "";
  if (type === "insertText" || type === "insertCompositionText") return "type";
  if (/^delete(Content|Word|Soft|Hard)/.test(type)) return "delete";
  return null;
}

/** Inline code switched on or off at a caret - for the text typed next. */
interface PendingCode {
  node: Node;
  offset: number;
  on: boolean;
}

const isAtPending = (range: Range, pending: PendingCode | null) =>
  !!pending &&
  range.collapsed &&
  range.startContainer === pending.node &&
  range.startOffset === pending.offset;

/** What the toolbar shows for the selection. */
interface ToolState {
  /** Tools shown as on - the formatting of the selection. */
  active: Partial<Record<RichTextTool, boolean>>;
  /** The content has a table - its tools are shown. */
  hasTable: boolean;
  /** The table of the selection has a header row. */
  headerRow: boolean;
  /** The selection is in a table - its tools act on it. */
  inTable: boolean;
  /** Tools that have nothing to act on - an outdent outside of a list. */
  unavailable: Partial<Record<RichTextTool, boolean>>;
}

const NO_SELECTION: ToolState = {
  active: {},
  hasTable: false,
  headerRow: false,
  inTable: false,
  unavailable: { clearFormatting: true, indent: true, outdent: true },
};

const sameToolState = (a: ToolState, b: ToolState) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Whether a mark is on for the selection - the browser's own state (also
 * the style for the text typed next after Ctrl+B at a caret), or the
 * elements around the selected text where the browser cannot tell.
 */
function isMarkActive(
  editor: HTMLElement,
  range: Range,
  command: string,
  selector: string,
) {
  const state = queryCommandState(command);
  if (state !== undefined) return state;

  return range.collapsed
    ? !!closestIn(editor, range.startContainer, selector)
    : isAllIn(editor, range, selector);
}

/** The state of the toolbar for a selection in the editor. */
function readToolState(
  editor: HTMLElement,
  range: Range,
  pending: PendingCode | null,
): ToolState {
  const block = getBlockState(editor, range);
  const table = cellOf(editor, range.startContainer)?.closest("table") ?? null;
  const inTable =
    !!table && cellOf(editor, range.endContainer)?.closest("table") === table;
  const boldBlock = closestIn(editor, range.startContainer, BOLD_BLOCKS);
  // Also a selection across several headings or header cells - the browser
  // would "unbold" them with a style the value does not keep
  const inBoldBlock =
    (!!boldBlock &&
      boldBlock === closestIn(editor, range.endContainer, BOLD_BLOCKS)) ||
    (!range.collapsed && isAllIn(editor, range, BOLD_BLOCKS));
  const inLink = !!linkAt(editor, range);
  const inCode = range.collapsed
    ? !!closestIn(editor, range.startContainer, "code")
    : isAllIn(editor, range, "code");
  const inLines = block.hasLines;

  return {
    active: {
      blockquote: block.type === "quote",
      bold: !inBoldBlock && isMarkActive(editor, range, "bold", "b, strong"),
      bulletList: block.type === "ul",
      code: isAtPending(range, pending) ? pending?.on : inCode,
      heading2: block.type === "h2",
      heading3: block.type === "h3",
      italic: isMarkActive(editor, range, "italic", "i, em"),
      link: inLink,
      numberedList: block.type === "ol",
      paragraph: block.type === "p",
      strikethrough: isMarkActive(editor, range, "strikeThrough", "s"),
      // A link is underlined by its style - the browser tells it underlined
      underline: hasLink(editor, range)
        ? range.collapsed
          ? !!closestIn(editor, range.startContainer, "u")
          : isAllIn(editor, range, "u")
        : isMarkActive(editor, range, "underline", "u"),
    },
    hasTable: !!editor.querySelector("table"),
    headerRow: !!table && hasHeaderRow(table as HTMLTableElement),
    inTable,
    unavailable: {
      blockquote: !inLines,
      bold: inBoldBlock,
      bulletList: !inLines,
      clearFormatting: range.collapsed,
      heading2: !inLines,
      heading3: !inLines,
      horizontalRule: inTable,
      indent: !block.canIndent,
      numberedList: !inLines,
      outdent: !block.canOutdent,
      paragraph: !inLines,
      table: inTable,
    },
  };
}

/**
 * Arrow keys and Home / End move the focus between the buttons of a
 * toolbar - it is one stop of Tab, as the ARIA toolbar pattern has it.
 */
function moveToolbarFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "End", "Home"].includes(event.key)) return;

  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button[data-tool]:not(:disabled)",
    ),
  );
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index === -1) return;

  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
          buttons.length;
  buttons[next].focus();
}

/** A number of rows or columns typed into the table form, within limits. */
const toTableSize = (text: string) =>
  Math.min(Math.max(Number.parseInt(text, 10) || 1, 1), MAX_TABLE_SIZE);

interface ToolButtonProps {
  /** Shown as on - a pressed toggle, an open form, a link at the caret. */
  active: boolean;
  children: React.ReactNode;
  /** The editor is disabled. */
  disabled: boolean;
  expanded?: boolean;
  keyShortcuts?: string;
  label: string;
  onClick: () => void;
  onFocus: () => void;
  pressed?: boolean;
  tabIndex: number;
  title: string;
  tool: string;
  /** Nothing to act on - it stays focusable, as the toolbar pattern has it. */
  unavailable: boolean;
}

function ToolButton({
  active,
  children,
  disabled,
  expanded,
  keyShortcuts,
  label,
  onClick,
  onFocus,
  pressed,
  tabIndex,
  title,
  tool,
  unavailable,
}: ToolButtonProps) {
  const enabled = !disabled && !unavailable;

  return (
    <button
      aria-disabled={unavailable || undefined}
      aria-expanded={expanded}
      aria-keyshortcuts={keyShortcuts}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none dark:text-neutral-300",
        active &&
          "bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200",
        enabled
          ? cn(
              "cursor-pointer",
              !active && "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            )
          : "cursor-not-allowed opacity-40",
      )}
      data-tool={tool}
      disabled={disabled}
      onClick={enabled ? onClick : undefined}
      onFocus={onFocus}
      // Keeps the focus - and the selection - in the editor
      onMouseDown={(event) => event.preventDefault()}
      tabIndex={tabIndex}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

export interface RichTextEditorProps {
  /**
   * Id of the element describing the editor - the error message and the
   * `description` describe it too.
   */
  "aria-describedby"?: string;
  /** Names the editor without a visible `label`. */
  "aria-label"?: string;
  /** Id of the element naming the editor - instead of `label`. */
  "aria-labelledby"?: string;
  /**
   * Classes of the wrapper around the label, the editor, its description and
   * its error message.
   */
  className?: string;
  /**
   * Initial HTML of an uncontrolled editor. It is followed until the user
   * edits, so it may arrive after the first render (loaded data); a reset of
   * the form brings it back.
   */
  defaultValue?: string;
  /** Help text under the editor - it describes the editor for screen readers. */
  description?: React.ReactNode;
  /** Nothing can be edited - and, like a disabled field, nothing is submitted. */
  disabled?: boolean;
  /** Validation message - also marks the editor as invalid. */
  error?: string;
  /**
   * Id of a form elsewhere in the page - the hidden input with the HTML
   * belongs to it, and its reset resets the editor.
   */
  form?: string;
  /** Id of the editable element. */
  id?: string;
  /** Text above the editor - also its accessible name. */
  label?: string;
  /** Submits the HTML in a hidden input of this name. */
  name?: string;
  /**
   * Called when the focus leaves the editor - moving to its toolbar or link
   * field does not count. E.g. `field.onBlur` of React Hook Form.
   */
  onBlur?: (event: React.FocusEvent<HTMLDivElement>) => void;
  /** Called with the HTML after every change. */
  onChange?: (html: string) => void;
  /**
   * Shown while the editor is empty - over an empty line, not over an empty
   * list, table or rule. Screen readers get it as the placeholder
   * (`aria-placeholder`), not as the text of the editor.
   */
  placeholder?: string;
  /**
   * The editable element - e.g. for React Hook Form, which focuses a field
   * that failed validation.
   */
  ref?: React.Ref<HTMLDivElement>;
  /** An empty editor blocks the submit of its form. */
  required?: boolean;
  /**
   * The tools of the toolbar in their order, `"|"` dividing them into groups
   * - `DEFAULT_RICH_TEXT_TOOLBAR` by default. The value keeps only the
   * formatting of these tools: without `"table"`, pasted tables become lines
   * of text; without `"underline"`, Ctrl+U does nothing. `[]` leaves out
   * the toolbar - paragraphs and line breaks remain.
   */
  toolbar?: readonly RichTextToolbarItem[];
  /**
   * HTML content of a controlled editor - an input the parent does not take
   * into it is undone, like in a controlled native field.
   */
  value?: string;
}

/**
 * A WYSIWYG editor producing HTML, without a heavy editor dependency:
 * headings, lists, quotes, tables, links and inline formatting, each tool
 * with a keyboard shortcut, and its own undo history. The toolbar is one
 * stop of Tab (arrow keys move in it, Alt+F10 gets there from the text).
 * Loaded values and pasted or dropped content are reduced to the formatting
 * of its tools. The output is user input - sanitize it on the server, and
 * render stored HTML sanitized again, inside an element with the
 * `rich-text` class: `<div className="rich-text" dangerouslySetInnerHTML={{
 * __html: sanitizeRichText(html) }} />` (on a page rendered on a server
 * without a `DOMParser`, once it is hydrated - `sanitizeRichText` needs one).
 */
export default function RichTextEditor({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  description,
  disabled = false,
  error,
  form,
  id,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  ref,
  required,
  toolbar = DEFAULT_RICH_TEXT_TOOLBAR,
  value,
}: RichTextEditorProps) {
  const messages = useMessages();
  const texts = messages.richTextEditor;
  const labelId = useId();
  const linkInputId = useId();
  const tableLabelId = useId();
  // The ids of the messages derive from the id of the field, like those of
  // the other fields
  const fieldId = id ?? labelId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const canSanitize = useCanSanitize();
  // Shortcuts use ⌘ on Apple devices - the server (and hydration) renders
  // those of Ctrl
  const isApple = useIsApplePlatform();

  const items = toolbarItemsOf(toolbar);
  const tools = items.filter((item): item is RichTextTool => item !== "|");
  // The formats of the tools by a key - a toolbar passed inline is a new
  // array on every render, the key the same for the same tools. A string
  // the React Compiler sees as one, so the content can be memoized by it.
  const formatKey = String(formatsOf(items).join());
  const formats = formatsByKey(formatKey);
  const hasLists =
    tools.includes("bulletList") || tools.includes("numberedList");

  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The URL typed for a link - `null` while the link form is closed
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [isLinkInvalid, setIsLinkInvalid] = useState(false);
  // The form edits the link at the selection - it offers to remove it
  const [isEditingLink, setIsEditingLink] = useState(false);
  // The selection the link is made of - the URL field takes the focus
  const linkRange = useRef<Range | null>(null);
  // The link at the selection when the form opened
  const linkElement = useRef<HTMLAnchorElement | null>(null);
  // The size typed for a new table - `null` while the table form is closed
  const [tableForm, setTableForm] = useState<{
    columns: string;
    header: boolean;
    rows: string;
  } | null>(null);
  // Where the new table goes
  const tableRange = useRef<Range | null>(null);
  // The selection when the focus left the editor - the toolbar acts on it
  // (Firefox puts the caret at the start of a focused editor)
  const savedRange = useRef<Range | null>(null);
  // The mark of a drag started in the editor - it moves its own content.
  // Only the drop tells: the `dragend` of moved content fires on a node
  // already out of the page. Random, so a page dragging content in cannot
  // pass it for this one.
  const ownDrag = useRef<string | null>(null);
  // What the user entered - the value reported last, with the tools it was
  // reduced to. `null` until then, and after a reset: an uncontrolled
  // editor shows `defaultValue`, also one arriving later.
  const [entered, setEntered] = useState<{
    formatKey: string;
    html: string;
  } | null>(null);
  // The formatting and possibilities of the selection
  const [toolState, setToolState] = useState(NO_SELECTION);
  const [historyState, setHistoryState] = useState({
    canRedo: false,
    canUndo: false,
  });
  // The undo history - created with the first content
  const historyRef = useRef<EditHistory | null>(null);
  // Inline code switched at a caret, for the text typed next
  const pendingCode = useRef<PendingCode | null>(null);
  // The tool of each toolbar that Tab stops at - the one used last
  const [focusedTool, setFocusedTool] = useState<RichTextTool | null>(null);
  const [focusedTableTool, setFocusedTableTool] = useState<TableTool | null>(
    null,
  );

  // The submitted value, the `required` check and the placeholder follow the
  // content as the editor shows it - not the raw HTML passed in. What the
  // editor reported for its tools is that already (a controlled `value`
  // that comes back as it was reported); HTML from outside is normalized
  // once, not on every render (a move of the caret renders the toolbar).
  const reported = entered?.formatKey === formatKey ? entered.html : null;
  const isReported =
    value !== undefined ? value === reported : reported !== null;
  const passedHtml = value ?? entered?.html ?? defaultValue ?? "";
  const normalizedHtml = useMemo(
    () =>
      canSanitize && !isReported
        ? normalize(passedHtml, formatsByKey(formatKey), false)
        : "",
    [canSanitize, formatKey, isReported, passedHtml],
  );
  const content = !canSanitize
    ? ""
    : isReported
      ? (reported as string)
      : normalizedHtml;

  // The toolbar commands fire `input` as well - report each change once
  const reportedHtml = useRef(content);
  // The formats of the tools the content is shown with
  const shownFormatKey = useRef(formatKey);
  // The latest handlers, for the listeners added once
  const handleBeforeInputRef = useRef<(event: InputEvent) => void>(() => {});
  const updateToolStateRef = useRef(() => {});
  // Counts the inputs of a controlled editor - an input the parent did not
  // take into its `value` is undone, like in a controlled native field
  const [inputCount, setInputCount] = useState(0);
  // Counts the resets of the form, and the one the content was shown after
  // - a reset shows it anew also when the value stays empty: an empty list
  // or table has no text either
  const [resetCount, setResetCount] = useState(0);
  const shownResetCount = useRef(0);
  // The content of the editor normalized last, and the value it gave - an
  // input normalizes it once, not again for the effect after it
  const normalized = useRef<{
    formatKey: string;
    html: string;
    value: string;
  } | null>(null);
  // An IME composition changes its text until it ends - one step of the
  // undo history
  const isComposing = useRef(false);
  // The editor shows nothing but an empty line - its placeholder shows. An
  // empty list, table or rule has no text either, but it shows.
  const [blank, setBlank] = useState(true);
  const showsPlaceholder = !content && blank;

  useImperativeHandle(ref, () => editorRef.current as HTMLDivElement, []);

  /** The value of the content of the editor - normalized once for each change. */
  const normalizeEditor = (html: string, key: string) => {
    const last = normalized.current;
    if (last?.html === html && last.formatKey === key) return last.value;

    const next = normalize(html, formatsByKey(key), true);
    normalized.current = { formatKey: key, html, value: next };
    return next;
  };

  // Shows `content` - after an input only when the parent changed or
  // refused it, so an accepted input keeps the caret where it is, and when
  // the tools changed (the formatting of a removed tool goes). Content from
  // outside starts the undo history anew, like a native field.
  useEffect(() => {
    reportedHtml.current = content;

    const editor = editorRef.current;
    if (!editor) return;

    const toolsChanged = shownFormatKey.current !== formatKey;
    shownFormatKey.current = formatKey;
    const isReset = shownResetCount.current !== resetCount;
    shownResetCount.current = resetCount;
    const replaces =
      toolsChanged ||
      isReset ||
      content !== normalizeEditor(editor.innerHTML, formatKey);
    if (replaces) {
      editor.innerHTML = content;
      pendingCode.current = null;
      setBlank(isBlank(editor));
    }
    if (replaces || !historyRef.current) {
      historyRef.current = new EditHistory({
        html: editor.innerHTML,
        selection: null,
      });
      setHistoryState((state) =>
        state.canUndo || state.canRedo
          ? { canRedo: false, canUndo: false }
          : state,
      );
      // The tools of a loaded table
      updateToolStateRef.current();
    }
  }, [content, formatKey, inputCount, resetCount]);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue` of an uncontrolled editor, like a native field does
  const formResetRef = useFormReset(() => {
    setEntered(null);
    setResetCount((count) => count + 1);
  }, form);
  const wrapperCallbackRef = useCallback(
    (element: HTMLDivElement | null) => {
      wrapperRef.current = element;
      return formResetRef(element);
    },
    [formResetRef],
  );

  const getHistory = (editor: HTMLElement) => {
    if (!historyRef.current) {
      historyRef.current = new EditHistory({
        html: editor.innerHTML,
        selection: null,
      });
    }
    return historyRef.current;
  };

  const syncHistoryState = (history: EditHistory) => {
    const { canRedo, canUndo } = history;
    setHistoryState((state) =>
      state.canUndo === canUndo && state.canRedo === canRedo
        ? state
        : { canRedo, canUndo },
    );
  };

  const updateToolState = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const range = rangeIn(editor);
    if (!range && wrapperRef.current?.contains(document.activeElement)) {
      // In the toolbar or a form - they act on the editor's selection
      return;
    }
    if (!range || !isAtPending(range, pendingCode.current)) {
      pendingCode.current = null;
    }

    const next = range
      ? readToolState(editor, range, pendingCode.current)
      : { ...NO_SELECTION, hasTable: !!editor.querySelector("table") };
    setToolState((state) => (sameToolState(state, next) ? state : next));
  };

  /**
   * Reports the content after a change - `onChange`, the submitted value,
   * the undo history (unless it comes from the history itself).
   */
  const reportChange = (kind: ChangeKind, record: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Read once - it is the whole content
    const html = editor.innerHTML;
    const history = getHistory(editor);
    // A composition becomes a step of its own when it ends
    if (record && !isComposing.current) {
      history.record(
        { html, selection: saveSelection(editor, rangeIn(editor)) },
        kind,
      );
    }
    syncHistoryState(history);
    setBlank(isBlank(editor));

    const nextHtml = normalizeEditor(html, formatKey);
    setEntered({ formatKey, html: nextHtml });
    if (value !== undefined) setInputCount((count) => count + 1);

    if (nextHtml !== reportedHtml.current) {
      reportedHtml.current = nextHtml;
      onChange?.(nextHtml);
    }
    updateToolState();
  };

  /** Typing into an empty editor starts a paragraph - not text right in it. */
  const openEmptyEditor = (editor: HTMLElement) => {
    if (editor.innerHTML !== "" && editor.innerHTML !== "<br>") return;

    editor.replaceChildren(createEmptyParagraph(editor.ownerDocument));
    placeCaret(editor.firstChild as Node);
    historyRef.current?.replaceCurrent(editor.innerHTML);
  };

  const handleFocus = () => {
    const editor = editorRef.current;
    if (!editor || disabled) return;

    configureEditing();
    openEmptyEditor(editor);
  };

  /**
   * The selection the toolbar acts on - the one in the editor, or the one
   * it had when the focus left it (to the toolbar, by the keyboard).
   */
  const getEditorRange = () => {
    const editor = editorRef.current;
    if (!editor) return null;

    const saved = savedRange.current;
    return (
      rangeIn(editor)?.cloneRange() ??
      (saved && editor.contains(saved.commonAncestorContainer) ? saved : null)
    );
  };

  /**
   * Runs a command on the selection of the editor (or `range`) - with the
   * focus back in the editor. `command` returns whether it changed the
   * content, which is then reported as one step of the undo history.
   */
  const runCommand = (
    command: (editor: HTMLElement, range: Range) => boolean,
    range?: Range | null,
  ) => {
    const editor = editorRef.current;
    if (!editor || disabled) return;

    const target = range ?? getEditorRange();
    editor.focus();
    select(target);

    const current = rangeIn(editor);
    if (!current) return;

    getHistory(editor).beforeChange(saveSelection(editor, current));
    if (command(editor, current)) reportChange(null, true);
    else updateToolState();
  };

  const executeCommand = (command: string, commandValue?: string) =>
    runCommand(() => {
      execCommand(command, commandValue);
      return true;
    });

  const runLineCommand = (transform: (lines: Line[]) => boolean) =>
    runCommand((editor, range) => applyLineCommand(editor, range, transform));

  const restoreSnapshot = (snapshot: Snapshot | null) => {
    const editor = editorRef.current;
    if (!editor || !snapshot || disabled) return;

    editor.focus();
    editor.innerHTML = snapshot.html;
    const range = restoreSelection(editor, snapshot.selection);
    if (range) select(range);
    else placeCaret(editor, true);
    openEmptyEditor(editor);

    pendingCode.current = null;
    reportChange(null, false);
  };

  const undo = () => {
    const editor = editorRef.current;
    if (editor) restoreSnapshot(getHistory(editor).undo());
  };

  const redo = () => {
    const editor = editorRef.current;
    if (editor) restoreSnapshot(getHistory(editor).redo());
  };

  const toggleStrikethrough = () =>
    runCommand((editor) => {
      execCommand("strikeThrough");
      // The value keeps `<s>` - the editor shows it too
      const range = rangeIn(editor);
      const bookmark = range ? createBookmark(range) : null;
      for (const strike of Array.from(editor.querySelectorAll("strike"))) {
        changeTag(strike, "s");
      }
      const restored = bookmark ? resolveBookmark(bookmark, editor) : null;
      if (restored) select(restored);
      return true;
    });

  // Headings and header cells stay bold - of a selection that reaches past
  // them, the browser "unbolds" them with a style the value does not keep
  const toggleBold = () =>
    runCommand((editor) => {
      execCommand("bold");
      for (const element of Array.from(
        editor.querySelectorAll<HTMLElement>(
          `:is(${BOLD_BLOCKS}) [style*="font-weight"]`,
        ),
      )) {
        element.style.removeProperty("font-weight");
      }
      return true;
    });

  // A link is underlined by its style - the browser takes selected link
  // text for underlined and does nothing. Its `<u>` is toggled instead.
  const toggleUnderlineTool = () =>
    runCommand((editor, range) => {
      if (range.collapsed || !hasLink(editor, range)) {
        execCommand("underline");
        return true;
      }
      const changed = toggleUnderline(editor, range);
      if (changed) select(changed);
      return !!changed;
    });

  // At a caret, code is switched for the text typed next
  const toggleCodeTool = () =>
    runCommand((editor, range) => {
      if (!range.collapsed) {
        const changed = toggleCode(editor, range);
        if (changed) select(changed);
        return !!changed;
      }

      const inCode = !!closestIn(editor, range.startContainer, "code");
      const pending = pendingCode.current;
      const isOn = isAtPending(range, pending) ? !!pending?.on : inCode;
      pendingCode.current =
        !isOn === inCode
          ? null
          : {
              node: range.startContainer,
              offset: range.startOffset,
              on: !isOn,
            };
      return false;
    });

  const runClearFormatting = () =>
    runCommand((editor, range) => {
      const changed = clearFormatting(editor, range);
      if (changed) select(changed);
      return !!changed;
    });

  const insertRule = () =>
    runCommand((editor, range) => {
      const after = insertBlock(
        editor,
        range,
        editor.ownerDocument.createElement("hr"),
      );
      placeCaret(after);
      return true;
    });

  const openLinkForm = () => {
    const editor = editorRef.current;
    if (disabled) return;
    const range = getEditorRange();
    const link = editor && range ? linkAt(editor, range) : null;

    linkRange.current = range;
    linkElement.current = link;
    setIsEditingLink(!!link);
    setIsLinkInvalid(false);
    setLinkUrl(link?.getAttribute("href") ?? "");
  };

  const closeLinkForm = () => {
    setLinkUrl(null);
    editorRef.current?.focus();
    select(linkRange.current);
  };

  const addLink = () => {
    const url = linkUrl?.trim();
    if (!url) {
      closeLinkForm();
      return;
    }

    const href = toHref(url);
    if (!isSafeHref(href)) {
      setIsLinkInvalid(true);
      return;
    }

    closeLinkForm();
    const link = linkElement.current;

    if (link && editorRef.current?.contains(link)) {
      runCommand(() => {
        if (link.getAttribute("href") === href) return false;
        link.setAttribute("href", href);
        return true;
      }, linkRange.current);
    } else if (!linkRange.current || linkRange.current.collapsed) {
      // No text selected - what was typed becomes the link text
      const element = document.createElement("a");
      element.href = href;
      element.textContent = url;
      executeCommand("insertHTML", element.outerHTML);
    } else {
      executeCommand("createLink", href);
    }
  };

  const unlink = () => {
    const link = linkElement.current;
    closeLinkForm();
    if (!link) return;

    runCommand((editor) => {
      if (!editor.contains(link)) return false;
      const range = removeLink(link);
      if (range) select(range);
      return true;
    }, linkRange.current);
  };

  const openTableForm = () => {
    if (disabled) return;
    tableRange.current = getEditorRange();
    setTableForm({ columns: "3", header: true, rows: "3" });
  };

  const closeTableForm = () => {
    setTableForm(null);
    editorRef.current?.focus();
    select(tableRange.current);
  };

  const insertTable = () => {
    if (!tableForm) return;

    const rows = toTableSize(tableForm.rows);
    const columns = toTableSize(tableForm.columns);
    const { header } = tableForm;
    setTableForm(null);

    runCommand((editor, range) => {
      const table = createTable(editor.ownerDocument, rows, columns, header);
      insertBlock(editor, range, table);
      placeCaret(table.rows[0].cells[0]);
      return true;
    }, tableRange.current);
  };

  const handleTableFormKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    // The keys of the form - not a submit of the form around, nor the
    // Escape of a dialog
    if (event.key === "Escape") {
      event.preventDefault();
      closeTableForm();
    } else if (
      event.key === "Enter" &&
      (event.target as HTMLElement).tagName === "INPUT"
    ) {
      event.preventDefault();
      insertTable();
    }
  };

  /** Runs a table tool on the cell of the selection. */
  const runTableCommand = (
    command: (editor: HTMLElement, cell: HTMLTableCellElement) => Node | null,
  ) =>
    runCommand((editor, range) => {
      const cell = cellOf(editor, range.startContainer);
      if (!cell) return false;

      const target = command(editor, cell);
      if (target) placeCaret(target);
      return true;
    });

  const runToggleHeaderRow = () =>
    runCommand((editor, range) => {
      const table = cellOf(editor, range.startContainer)?.closest("table");
      if (!table) return false;

      const bookmark = createBookmark(range);
      toggleHeaderRow(table);
      select(resolveBookmark(bookmark, editor));
      return true;
    });

  const runTableTool = (tool: TableTool) => {
    switch (tool) {
      case "addRowAbove":
      case "addRowBelow":
        runTableCommand((_, cell) => addRow(cell, tool === "addRowBelow"));
        break;
      case "addColumnLeft":
      case "addColumnRight":
        runTableCommand((_, cell) =>
          addColumn(cell, tool === "addColumnRight"),
        );
        break;
      case "deleteRow":
        runTableCommand(deleteRow);
        break;
      case "deleteColumn":
        runTableCommand(deleteColumn);
        break;
      case "headerRow":
        runToggleHeaderRow();
        break;
      case "deleteTable":
        runTableCommand((editor, cell) =>
          deleteTable(editor, cell.closest("table") as HTMLTableElement),
        );
        break;
    }
  };

  const runTool = (tool: RichTextTool) => {
    switch (tool) {
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "bold":
        toggleBold();
        break;
      case "italic":
        executeCommand(tool);
        break;
      case "underline":
        toggleUnderlineTool();
        break;
      case "strikethrough":
        toggleStrikethrough();
        break;
      case "code":
        toggleCodeTool();
        break;
      case "paragraph":
        runLineCommand((lines) => setLineType(lines, "p"));
        break;
      case "heading2":
      case "heading3":
        runLineCommand((lines) =>
          setLineType(lines, tool === "heading2" ? "h2" : "h3"),
        );
        break;
      case "blockquote":
        runLineCommand((lines) => setLineType(lines, "quote"));
        break;
      case "bulletList":
      case "numberedList":
        runLineCommand((lines) =>
          toggleList(lines, tool === "bulletList" ? "ul" : "ol"),
        );
        break;
      case "indent":
      case "outdent":
        runLineCommand((lines) =>
          shiftLevels(lines, tool === "indent" ? 1 : -1),
        );
        break;
      case "link":
        if (linkUrl === null) openLinkForm();
        else closeLinkForm();
        break;
      case "horizontalRule":
        insertRule();
        break;
      case "table":
        if (tableForm === null) openTableForm();
        else closeTableForm();
        break;
      case "clearFormatting":
        runClearFormatting();
        break;
    }
  };

  /**
   * Whether a tool has something to act on at the selection as it is now -
   * a key press may come before the `selectionchange` that updates the
   * state of the toolbar.
   */
  const isUnavailable = (tool: RichTextTool) => {
    const editor = editorRef.current;
    const range = getEditorRange();
    const state =
      editor && range
        ? readToolState(editor, range, pendingCode.current)
        : NO_SELECTION;
    return !!state.unavailable[tool];
  };

  /** Whether a tool can act - it is in the toolbar and has something to act on. */
  const canRun = (tool: RichTextTool) => {
    // Indenting belongs to lists - also without its buttons
    const isThere =
      tools.includes(tool) ||
      ((tool === "indent" || tool === "outdent") && hasLists);
    return isThere && !isUnavailable(tool);
  };

  // Tab moves between the cells of a table (a new row after the last one),
  // and indents or outdents a list item - where it has nowhere to go, it
  // leaves the editor as usual
  const handleTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const range = editor && rangeIn(editor);
    if (!editor || !range) return;

    const cell = cellOf(editor, range.startContainer);
    if (cell && cell === cellOf(editor, range.endContainer)) {
      const next = siblingCell(cell, event.shiftKey);
      if (next) {
        event.preventDefault();
        selectContents(next);
      } else if (!event.shiftKey) {
        event.preventDefault();
        runCommand(() => {
          selectContents(appendRow(cell.closest("table") as HTMLTableElement));
          return true;
        });
      }
      return;
    }

    if (!hasLists) return;
    const block = getBlockState(editor, range);
    if (event.shiftKey ? block.nested : block.canIndent) {
      event.preventDefault();
      runLineCommand((lines) => shiftLevels(lines, event.shiftKey ? -1 : 1));
    }
  };

  // The arrow keys leave a table at the start or end of the content - into
  // a new paragraph, as there is nowhere else for the caret
  const leaveTable = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const range = editor && rangeIn(editor);
    const cell = editor && range ? cellOf(editor, range.startContainer) : null;
    if (!editor || !range || !range.collapsed || !cell) return;

    const table = cell.closest("table") as HTMLTableElement;
    const block = topLevelOf(editor, table) as HTMLElement;
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const rows = table.rows;
    const row = cell.parentElement as HTMLTableRowElement;
    const cells = row.cells;

    const atEdge =
      event.key === "ArrowDown" || event.key === "ArrowUp"
        ? row === rows[forward ? rows.length - 1 : 0]
        : cell === cells[forward ? cells.length - 1 : 0] &&
          row === rows[forward ? rows.length - 1 : 0];
    // Whitespace between blocks (of loaded HTML) is nowhere to go either
    let sibling = forward ? block.nextSibling : block.previousSibling;
    while (sibling && isWhitespace(sibling)) {
      sibling = forward ? sibling.nextSibling : sibling.previousSibling;
    }
    if (!atEdge || sibling || !isAtEdgeOf(cell, range, forward)) return;

    event.preventDefault();
    runCommand(() => {
      const paragraph = createEmptyParagraph(editor.ownerDocument);
      if (forward) block.after(paragraph);
      else block.before(paragraph);
      placeCaret(paragraph);
      return true;
    });
  };

  // Backspace at the start of the line after a table - also by a word or
  // a line - would pull the line into the last cell of the table (Chrome).
  // The caret goes there instead, and a line without text goes.
  const handleBackspace = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const range = editor && rangeIn(editor);
    const target = editor && range ? tableBefore(editor, range) : null;
    if (!editor || !target) return;

    // A list or a quote has a Backspace of its own - it lifts the item or
    // the line out of it
    const { block, table } = target;
    if (!/^(?:P|H[1-6])$/.test(block.tagName)) return;

    event.preventDefault();
    const cell = lastCellOf(table);
    // An empty line goes - unless it is the last one, the only place to
    // write after the table
    if (
      block.textContent?.trim() ||
      block.querySelector("hr, img, table") ||
      !block.nextElementSibling
    ) {
      if (cell) placeCaret(cell, true);
      return;
    }

    runCommand(() => {
      block.remove();
      if (cell) placeCaret(cell, true);
      return true;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // A disabled editor takes no commands - it may have the focus of a click
    if (event.nativeEvent.isComposing || disabled) return;

    // To the toolbar - the shortcut of TinyMCE and CKEditor
    if (event.altKey && event.key === "F10") {
      event.preventDefault();
      toolbarRef.current
        ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
        ?.focus();
      return;
    }

    // The editor's own history - also without its buttons
    if (isShortcut(event, UNDO_SHORTCUT, isApple)) {
      event.preventDefault();
      undo();
      return;
    }
    if (
      isShortcut(event, REDO_SHORTCUT, isApple) ||
      (!isApple && isShortcut(event, { key: "y" }, false))
    ) {
      event.preventDefault();
      redo();
      return;
    }

    for (const [tool, shortcut] of Object.entries(SHORTCUTS)) {
      if (!shortcut || !isShortcut(event, shortcut, isApple)) continue;
      // Also when the tool is not there - Ctrl+U underlines in every browser
      event.preventDefault();
      if (canRun(tool as RichTextTool)) runTool(tool as RichTextTool);
      return;
    }

    if (event.key === "Backspace") {
      handleBackspace(event);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Tab") handleTab(event);
    else if (event.key.startsWith("Arrow")) leaveTable(event);
  };

  // The input types the value cannot keep never get into the editor; lists
  // and rules from the menus of the browser are made by the editor's own
  // commands, like those of its toolbar; and every change starts a step of
  // the undo history
  const handleBeforeInput = (event: InputEvent) => {
    const editor = editorRef.current;
    if (!editor) return;
    const type = event.inputType;

    if (type === "historyUndo" || type === "historyRedo") {
      event.preventDefault();
      if (type === "historyUndo") undo();
      else redo();
      return;
    }

    const range = rangeIn(editor);
    // A composition is one step from where it started - its text selected
    // at each of its changes is no new start
    if (!isComposing.current && !event.isComposing) {
      getHistory(editor).beforeChange(saveSelection(editor, range));
    }

    if (type === "insertOrderedList" || type === "insertUnorderedList") {
      event.preventDefault();
      const tool = type === "insertOrderedList" ? "numberedList" : "bulletList";
      if (canRun(tool)) runTool(tool);
      return;
    }
    if (type === "formatIndent" || type === "formatOutdent") {
      event.preventDefault();
      const tool = type === "formatIndent" ? "indent" : "outdent";
      if (canRun(tool)) runTool(tool);
      return;
    }
    if (type === "insertHorizontalRule") {
      event.preventDefault();
      if (canRun("horizontalRule")) insertRule();
      return;
    }
    if (type === "formatRemove") {
      event.preventDefault();
      runClearFormatting();
      return;
    }

    const format = INPUT_FORMATS[type];
    const isFormat = type.startsWith("format") || format !== undefined;
    if (
      isFormat &&
      (!format ||
        !formats.includes(format) ||
        (format === "bold" && isUnavailable("bold")))
    ) {
      event.preventDefault();
      return;
    }

    if (type === "insertParagraph" && range) {
      if (cellOf(editor, range.startContainer)) {
        // A cell holds lines, not paragraphs
        event.preventDefault();
        execCommand("insertLineBreak");
      } else if (
        range.collapsed &&
        isInEmptyItem(editor, range.startContainer)
      ) {
        // Enter in an empty item leaves the list, or its level
        event.preventDefault();
        runLineCommand((lines) => shiftLevels(lines, -1));
      } else {
        const quoted = closestIn(editor, range.startContainer, "blockquote p");
        if (range.collapsed && quoted && !quoted.textContent?.trim()) {
          // Enter in an empty quoted line leaves the quote
          event.preventDefault();
          runLineCommand((lines) => setLineType(lines, "p"));
        }
      }
      return;
    }

    const pending = pendingCode.current;
    if (
      type === "insertText" &&
      event.data &&
      range &&
      isAtPending(range, pending)
    ) {
      event.preventDefault();
      const text = insertTextWithCode(editor, range, event.data, !!pending?.on);
      pendingCode.current = null;
      const caret = document.createRange();
      caret.setStart(text, text.length);
      select(caret);
      reportChange("type", true);
    }
  };

  useLayoutEffect(() => {
    handleBeforeInputRef.current = handleBeforeInput;
    updateToolStateRef.current = updateToolState;
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const beforeInput = (event: InputEvent) =>
      handleBeforeInputRef.current(event);
    editor.addEventListener("beforeinput", beforeInput);
    return () => editor.removeEventListener("beforeinput", beforeInput);
  }, []);

  useEffect(() => {
    const selectionChange = () => updateToolStateRef.current();
    document.addEventListener("selectionchange", selectionChange);
    return () =>
      document.removeEventListener("selectionchange", selectionChange);
  }, []);

  const handleCompositionStart = () => {
    const editor = editorRef.current;
    if (!editor) return;

    getHistory(editor).beforeChange(saveSelection(editor, rangeIn(editor)));
    isComposing.current = true;
  };

  // The composed text is one step - joined with the typing right before
  const handleCompositionEnd = () => {
    isComposing.current = false;
    reportChange("type", true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // The toolbar and the forms are part of the editor
    if (event.currentTarget.contains(event.relatedTarget)) return;

    // Whatever the value does not keep (formatting of a browser menu) leaves
    // the editor too, so it shows what is submitted
    const editor = editorRef.current;
    if (editor && linkUrl === null && tableForm === null) {
      const sanitized = sanitizeEditorContent(editor.innerHTML, formats).html;
      if (sanitized !== editor.innerHTML) {
        editor.innerHTML = sanitized;
        historyRef.current?.replaceCurrent(sanitized);
        setBlank(isBlank(editor));
      }
      pendingCode.current = null;
      const hasTable = !!editor.querySelector("table");
      setToolState((state) =>
        sameToolState(state, { ...NO_SELECTION, hasTable })
          ? state
          : { ...NO_SELECTION, hasTable },
      );
    }

    onBlur?.(event);
  };

  /**
   * Pasted or dropped HTML reduced to what the value keeps where it goes -
   * so the editor shows what it submits. A cell or a heading holds lines of
   * text, a list item too (a pasted list gives it items next to it), a
   * quote paragraphs. But blocks keep their kinds where they replace a
   * heading, list item, quoted line or table as a whole (select all), or
   * fill an empty line: the line becomes a paragraph for them first. Inline
   * content stays in the line, like typed text.
   */
  const sanitizeInserted = (html: string, range: Range | null) => {
    const editor = editorRef.current;
    const blocks = sanitizeRichText(html, { formats });
    if (!editor || !range) return blocks;

    const cell = cellOf(editor, range.startContainer);
    if (cell) {
      const table = cell.closest("table") as HTMLElement;
      return isReplacedWhole(table, range)
        ? blocks
        : sanitizeRichTextLines(html, formats);
    }

    const target = textLineAt(editor, range.startContainer);
    if (!target) return blocks;

    const kind = contentKind(blocks);
    // The browser inserts the items of a list as items of the list
    if (kind === "list" && target.kind === "item") return blocks;

    const { line } = target;
    const replaces =
      kind !== "line" &&
      (!line.textContent?.trim() || isReplacedWhole(line, range));
    if (replaces) {
      makeParagraphAt(editor, range);
      return blocks;
    }

    return target.kind === "quote" && kind !== "line"
      ? sanitizeRichTextParagraphs(html, formats)
      : sanitizeRichTextLines(html, formats);
  };

  // Pasted pages and documents keep only the formatting of the editor, plain
  // text is inserted as text - and images alone have no place in the text
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    event.preventDefault();

    const pastedHtml = event.clipboardData.getData("text/html");
    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedHtml && !pastedText) return;

    const range = rangeIn(editor);
    getHistory(editor).beforeChange(saveSelection(editor, range));

    if (pastedHtml) {
      execCommand("insertHTML", sanitizeInserted(pastedHtml, range));
    } else {
      // Lines replacing a heading, list item or quoted line as a whole are
      // paragraphs, like pasted blocks - the browser would give the first
      // of them its kind. A single line stays in it, like typed text.
      const target = range && textLineAt(editor, range.startContainer);
      if (
        range &&
        target &&
        /[\r\n]/.test(pastedText.trim()) &&
        !cellOf(editor, range.startContainer) &&
        isReplacedWhole(target.line, range)
      ) {
        makeParagraphAt(editor, range);
      }
      execCommand("insertText", pastedText);
    }
    reportChange(null, true);
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    savedRange.current = editor
      ? (rangeIn(editor)?.cloneRange() ?? null)
      : null;
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    ownDrag.current = Math.random().toString(36).slice(2);
    try {
      event.dataTransfer.setData(OWN_DRAG_TYPE, ownDrag.current);
    } catch {
      // Without the mark the drop is reduced like foreign content
    }
  };

  // Dropped content from other pages is reduced like pasted content. Moving
  // text within the editor and dropping plain text are left to the browser.
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const expectedDrag = ownDrag.current;
    ownDrag.current = null;

    // Files have no place in the text
    if (event.dataTransfer.files.length > 0) {
      event.preventDefault();
      return;
    }

    // The mark of this very drag - not one of another editor, nor of an
    // earlier drag that ended outside the editor
    if (
      expectedDrag !== null &&
      event.dataTransfer.getData(OWN_DRAG_TYPE) === expectedDrag
    ) {
      return;
    }

    const droppedHtml = event.dataTransfer.getData("text/html");
    const editor = editorRef.current;
    if (!droppedHtml || !editor || disabled) return;

    event.preventDefault();
    editor.focus();
    const range = caretRangeAt(event.clientX, event.clientY);
    select(range);
    getHistory(editor).beforeChange(saveSelection(editor, range));
    execCommand("insertHTML", sanitizeInserted(droppedHtml, range));
    reportChange(null, true);
  };

  const textboxLabelledBy = ariaLabelledBy ?? (label ? labelId : undefined);
  const keyNames = texts.keys;

  // Tab stops at one tool of a toolbar - the one used last, or the first
  const toolTabStop =
    focusedTool !== null && tools.includes(focusedTool)
      ? focusedTool
      : tools[0];

  const tableToolIds = TABLE_TOOLS.flatMap((tool) =>
    tool === "|" ? [] : [tool.id],
  );
  const tableTabStop =
    focusedTableTool !== null && tableToolIds.includes(focusedTableTool)
      ? focusedTableTool
      : tableToolIds[0];

  return (
    <div
      className={cn("space-y-1.5", className)}
      onBlur={handleBlur}
      ref={wrapperCallbackRef}
    >
      {label && (
        // No labelable element to point at - a click still leads to the text
        <label
          className="block text-sm font-medium"
          id={labelId}
          onClick={() => editorRef.current?.focus()}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {required && (
            <span
              aria-hidden="true"
              className="text-danger-700 dark:text-danger-400"
            >
              *
            </span>
          )}
        </label>
      )}

      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value={content}
        />
      )}

      <div
        className={cn(
          // The ring of a focused field - while the text has the focus, the
          // tools show their own
          "relative form-control has-[.rich-text-editor:focus]:ring-2 has-[.rich-text-editor:focus]:ring-primary-500",
          disabled && "cursor-not-allowed opacity-50",
          error &&
            "border-danger-500! has-[.rich-text-editor:focus]:ring-danger-500!",
        )}
      >
        {/* Lets the browser enforce `required` on the editable element */}
        {required && (
          <input
            aria-hidden="true"
            disabled={disabled}
            form={form}
            onChange={() => {}}
            // The browser focuses an invalid field on submit - the user
            // belongs in the editor (the message still shows)
            onFocus={() => editorRef.current?.focus()}
            required
            style={hiddenValidationStyle}
            tabIndex={-1}
            type="text"
            value={content ? "valid" : ""}
          />
        )}
        {items.length > 0 && (
          <div
            aria-label={label ?? (ariaLabelledBy ? undefined : ariaLabel)}
            aria-labelledby={label ? undefined : ariaLabelledBy}
            className="border-b border-neutral-300 p-[3px] dark:border-neutral-700"
            onKeyDown={moveToolbarFocus}
            ref={toolbarRef}
            role="toolbar"
          >
            <ToolGroups
              groups={splitGroups(items).map((group) =>
                group.map((item) => {
                  const Icon = TOOL_ICONS[item];
                  const shortcut = SHORTCUTS[item];
                  const toolLabel = texts[item];
                  const opensForm = item === "link" || item === "table";
                  const isOpen =
                    item === "link"
                      ? linkUrl !== null
                      : item === "table" && tableForm !== null;

                  return (
                    <ToolButton
                      active={!!toolState.active[item] || isOpen}
                      disabled={disabled}
                      expanded={opensForm ? isOpen : undefined}
                      key={item}
                      keyShortcuts={
                        shortcut ? ariaShortcut(shortcut, isApple) : undefined
                      }
                      label={toolLabel}
                      onClick={() => runTool(item)}
                      onFocus={() => setFocusedTool(item)}
                      pressed={
                        TOGGLES.has(item) ? !!toolState.active[item] : undefined
                      }
                      tabIndex={item === toolTabStop ? 0 : -1}
                      title={
                        shortcut
                          ? `${toolLabel} (${formatShortcut(shortcut, isApple, keyNames)})`
                          : toolLabel
                      }
                      tool={item}
                      unavailable={
                        item === "undo"
                          ? !historyState.canUndo
                          : item === "redo"
                            ? !historyState.canRedo
                            : !!toolState.unavailable[item]
                      }
                    >
                      <Icon aria-hidden="true" size={16} />
                    </ToolButton>
                  );
                }),
              )}
            />
          </div>
        )}

        {toolState.hasTable && tools.includes("table") && (
          <div
            aria-labelledby={tableLabelId}
            className="border-b border-neutral-300 bg-neutral-50 p-[3px] dark:border-neutral-700 dark:bg-neutral-900/50"
            onKeyDown={moveToolbarFocus}
            role="toolbar"
          >
            <ToolGroups
              groups={[
                [
                  <span
                    className="px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400"
                    id={tableLabelId}
                    key="label"
                  >
                    {texts.table}
                  </span>,
                ],
                ...splitGroups(TABLE_TOOLS).map((group) =>
                  group.map((tool) => {
                    const Icon = tool.icon;
                    const isHeaderRow = tool.id === "headerRow";
                    const pressed = toolState.inTable && toolState.headerRow;

                    return (
                      <ToolButton
                        active={isHeaderRow && pressed}
                        disabled={disabled}
                        key={tool.id}
                        label={texts[tool.id]}
                        onClick={() => runTableTool(tool.id)}
                        onFocus={() => setFocusedTableTool(tool.id)}
                        pressed={isHeaderRow ? pressed : undefined}
                        tabIndex={tool.id === tableTabStop ? 0 : -1}
                        title={texts[tool.id]}
                        tool={tool.id}
                        unavailable={!toolState.inTable}
                      >
                        <Icon size={16} />
                      </ToolButton>
                    );
                  }),
                ),
              ]}
            />
          </div>
        )}

        {linkUrl !== null && !disabled && (
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-300 p-2 dark:border-neutral-700">
            <label className="text-sm" htmlFor={linkInputId}>
              {texts.linkPrompt}
            </label>
            <input
              aria-invalid={isLinkInvalid || undefined}
              autoCapitalize="none"
              autoFocus
              className={cn(
                "form-control min-w-40 flex-1 px-2 py-0.5 text-sm",
                isLinkInvalid && "border-danger-500! focus:ring-danger-500!",
              )}
              id={linkInputId}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setIsLinkInvalid(false);
              }}
              onKeyDown={(event) => {
                // The keys of the field - not a submit of the form around,
                // nor the Escape of a dialog
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLink();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  closeLinkForm();
                }
              }}
              spellCheck={false}
              // Also e-mail addresses and phone numbers - no `url` type
              // that would stop the form around with its own validation
              type="text"
              value={linkUrl}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={addLink} size="sm">
                {messages.common.confirm}
              </Button>
              {isEditingLink && (
                <Button
                  color="danger"
                  onClick={unlink}
                  size="sm"
                  variant="outline"
                >
                  {texts.removeLink}
                </Button>
              )}
              <Button onClick={closeLinkForm} size="sm" variant="outline">
                {messages.common.cancel}
              </Button>
            </div>
          </div>
        )}

        {tableForm !== null && !disabled && (
          <div
            aria-label={texts.insertTable}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-300 p-2 dark:border-neutral-700"
            onKeyDown={handleTableFormKeyDown}
            role="group"
          >
            <label className="flex items-center gap-1.5 text-sm">
              {texts.rows}
              <input
                autoFocus
                className="form-control w-16 px-2 py-0.5 text-sm"
                max={MAX_TABLE_SIZE}
                min={1}
                onChange={(event) => {
                  const rows = event.target.value;
                  setTableForm((form) => form && { ...form, rows });
                }}
                type="number"
                value={tableForm.rows}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              {texts.columns}
              <input
                className="form-control w-16 px-2 py-0.5 text-sm"
                max={MAX_TABLE_SIZE}
                min={1}
                onChange={(event) => {
                  const columns = event.target.value;
                  setTableForm((form) => form && { ...form, columns });
                }}
                type="number"
                value={tableForm.columns}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                checked={tableForm.header}
                className="size-4 accent-primary-600"
                onChange={(event) => {
                  const header = event.target.checked;
                  setTableForm((form) => form && { ...form, header });
                }}
                type="checkbox"
              />
              {texts.headerRow}
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={insertTable} size="sm">
                {texts.insertTable}
              </Button>
              <Button onClick={closeTableForm} size="sm" variant="outline">
                {messages.common.cancel}
              </Button>
            </div>
          </div>
        )}

        <div
          aria-describedby={
            joinTokens(errorId, descriptionId, ariaDescribedBy) || undefined
          }
          aria-disabled={disabled || undefined}
          aria-invalid={error ? "true" : undefined}
          aria-label={textboxLabelledBy ? undefined : ariaLabel}
          aria-labelledby={textboxLabelledBy}
          aria-multiline="true"
          // Screen readers get the placeholder here - not from the CSS
          aria-placeholder={showsPlaceholder ? placeholder : undefined}
          aria-required={required || undefined}
          className="rich-text-editor rich-text min-h-50 p-3 text-sm focus:outline-none"
          contentEditable={!disabled}
          data-empty={showsPlaceholder ? "" : undefined}
          data-placeholder={placeholder}
          id={id}
          onBlur={rememberSelection}
          onCompositionEnd={handleCompositionEnd}
          onCompositionStart={handleCompositionStart}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onFocus={handleFocus}
          onInput={(event) =>
            reportChange(changeKindOf(event.nativeEvent), true)
          }
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          ref={editorRef}
          role="textbox"
          suppressContentEditableWarning
          tabIndex={disabled ? -1 : 0}
        />
      </div>

      <FormDescription id={descriptionId}>{description}</FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
