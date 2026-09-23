import { Bold, Italic, Link as LinkIcon, Pilcrow } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "./button";
import cn from "../utils/cn";
import FormError from "./form-error";
import sanitizeRichText, { isSafeHref } from "../utils/sanitize-rich-text";
import { useFormReset } from "../hooks/use-form-control";
import { useMessages } from "../providers/ui-context";

const HAS_SCHEME = /^([a-z][a-z\d+\-.]*:|\/\/)/i;

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

/** Puts `range` as the selection - the place a command acts on. */
function select(range: Range | null) {
  const selection = document.getSelection();
  if (!range || !selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

/**
 * The value of HTML in the editor - reduced to its formatting (typing and
 * the toolbar leave `<span style>` and `<font>` behind in some browsers),
 * and empty without text, whatever `<p><br></p>` it still holds.
 */
function normalize(html: string) {
  // Nothing to parse with on the server - the browser takes over
  if (!html || typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = sanitizeRichText(html);

  return template.content.textContent?.trim() ? template.innerHTML : "";
}

export interface RichTextEditorProps {
  className?: string;
  /** Initial HTML of an uncontrolled editor. */
  defaultValue?: string;
  disabled?: boolean;
  /** Validation message - also marks the editor as invalid. */
  error?: string;
  label?: string;
  /** Submits the HTML in a hidden input of this name. */
  name?: string;
  /** Called with the HTML after every change. */
  onChange?: (html: string) => void;
  placeholder?: string;
  required?: boolean;
  /** HTML content of a controlled editor. */
  value?: string;
}

/**
 * A minimal WYSIWYG editor (bold, italic, paragraph, link) producing HTML.
 * Render its output inside an element with the `rich-text` class - and
 * sanitize it on the server, it is user input. Loaded values and pasted or
 * dropped content are reduced to these formats.
 */
export default function RichTextEditor({
  className,
  defaultValue,
  disabled = false,
  error,
  label,
  name,
  onChange,
  placeholder,
  required,
  value,
}: RichTextEditorProps) {
  const messages = useMessages();
  const labelId = useId();
  const linkInputId = useId();
  const errorId = error ? `${labelId}-error` : undefined;

  const editorRef = useRef<HTMLDivElement>(null);
  // The URL typed for a new link - `null` while no link is being added
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [isLinkInvalid, setIsLinkInvalid] = useState(false);
  // The selection the link is made of - the URL field takes the focus
  const linkRange = useRef<Range | null>(null);
  // A drag started in the editor moves its own content
  const isDraggingInside = useRef(false);
  // What the user entered into an uncontrolled editor
  const [html, setHtml] = useState(() => normalize(defaultValue ?? ""));
  // The toolbar commands fire `input` as well - report each change once
  const reportedHtml = useRef(html);
  // Formatting at the caret - the toolbar buttons show it as pressed
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
  });

  // The submitted value, the `required` check and the placeholder follow the
  // content as the editor shows it - not the raw HTML passed in
  const content = useMemo(
    () => (value === undefined ? html : normalize(value)),
    [html, value],
  );

  useEffect(() => {
    reportedHtml.current = content;

    const editor = editorRef.current;
    if (editor && content !== normalize(editor.innerHTML)) {
      editor.innerHTML = content;
    }
  }, [content]);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue` of an uncontrolled editor, like a native field does
  const formResetRef = useFormReset(() => {
    if (value === undefined) setHtml(normalize(defaultValue ?? ""));
  });

  const updateActiveFormats = useCallback(() => {
    const selectionNode = document.getSelection()?.anchorNode ?? null;
    const inEditor = !!editorRef.current?.contains(selectionNode);

    const isActive = (command: string) => {
      try {
        return inEditor && document.queryCommandState(command);
      } catch {
        return false;
      }
    };

    const bold = isActive("bold");
    const italic = isActive("italic");

    setActiveFormats((prev) =>
      prev.bold === bold && prev.italic === italic ? prev : { bold, italic },
    );
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats);
    return () =>
      document.removeEventListener("selectionchange", updateActiveFormats);
  }, [updateActiveFormats]);

  const handleInput = () => {
    if (editorRef.current) {
      const nextHtml = normalize(editorRef.current.innerHTML);
      setHtml(nextHtml);

      if (nextHtml !== reportedHtml.current) {
        reportedHtml.current = nextHtml;
        onChange?.(nextHtml);
      }
    }
    updateActiveFormats();
  };

  // Pasted pages and documents keep only the formatting of the editor, plain
  // text is inserted as text - and images alone have no place in the text
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    const pastedHtml = event.clipboardData.getData("text/html");
    const pastedText = event.clipboardData.getData("text/plain");

    if (pastedHtml) {
      document.execCommand("insertHTML", false, sanitizeRichText(pastedHtml));
    } else if (pastedText) {
      document.execCommand("insertText", false, pastedText);
    } else {
      return;
    }
    handleInput();
  };

  // Dropped content from other pages is reduced like pasted content. Moving
  // text within the editor and dropping plain text are left to the browser.
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDraggingInside.current) return;

    // Files have no place in the text
    if (event.dataTransfer.files.length > 0) {
      event.preventDefault();
      return;
    }

    const droppedHtml = event.dataTransfer.getData("text/html");
    if (!droppedHtml) return;

    event.preventDefault();
    editorRef.current?.focus();
    select(caretRangeAt(event.clientX, event.clientY));
    document.execCommand("insertHTML", false, sanitizeRichText(droppedHtml));
    handleInput();
  };

  const executeCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    handleInput();
  };

  const openLinkForm = () => {
    const selection = document.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    linkRange.current =
      range && editorRef.current?.contains(range.commonAncestorContainer)
        ? range.cloneRange()
        : null;
    setIsLinkInvalid(false);
    setLinkUrl("");
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

    // Without a scheme the browser would build a link relative to
    // the app, which resolves to a dead route.
    const href = HAS_SCHEME.test(url) ? url : `https://${url}`;
    if (!isSafeHref(href)) {
      setIsLinkInvalid(true);
      return;
    }

    closeLinkForm();

    if (!linkRange.current || linkRange.current.collapsed) {
      // No text selected - the URL itself becomes the link text
      const link = document.createElement("a");
      link.href = href;
      link.textContent = url;
      executeCommand("insertHTML", link.outerHTML);
    } else {
      executeCommand("createLink", href);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)} ref={formResetRef}>
      {label && (
        <label className="block text-sm font-medium" id={labelId}>
          {label}: {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      {name && (
        <input disabled={disabled} name={name} type="hidden" value={content} />
      )}

      <div
        className={cn(
          "relative form-control",
          disabled && "cursor-not-allowed opacity-50",
          error && "border-danger-500!",
        )}
      >
        {/* Lets the browser enforce `required` on the editable element */}
        {required && (
          <input
            aria-hidden="true"
            disabled={disabled}
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
        <div
          aria-label={label}
          className="flex gap-1 border-b border-neutral-300 p-2 dark:border-neutral-700"
          role="toolbar"
        >
          <Button
            aria-label={messages.richTextEditor.bold}
            aria-pressed={activeFormats.bold}
            disabled={disabled}
            onClick={() => executeCommand("bold")}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            title={messages.richTextEditor.bold}
            variant={activeFormats.bold ? "solid" : "outline"}
          >
            <Bold size={16} />
          </Button>
          <Button
            aria-label={messages.richTextEditor.italic}
            aria-pressed={activeFormats.italic}
            disabled={disabled}
            onClick={() => executeCommand("italic")}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            title={messages.richTextEditor.italic}
            variant={activeFormats.italic ? "solid" : "outline"}
          >
            <Italic size={16} />
          </Button>
          <Button
            aria-label={messages.richTextEditor.paragraph}
            disabled={disabled}
            onClick={() => executeCommand("formatBlock", "p")}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            title={messages.richTextEditor.paragraph}
            variant="outline"
          >
            <Pilcrow size={16} />
          </Button>
          <Button
            aria-expanded={linkUrl !== null}
            aria-label={messages.richTextEditor.link}
            disabled={disabled}
            onClick={linkUrl === null ? openLinkForm : closeLinkForm}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            title={messages.richTextEditor.link}
            variant={linkUrl === null ? "outline" : "solid"}
          >
            <LinkIcon size={16} />
          </Button>
        </div>

        {linkUrl !== null && (
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-300 p-2 dark:border-neutral-700">
            <label className="text-sm" htmlFor={linkInputId}>
              {messages.richTextEditor.linkPrompt}
            </label>
            <input
              aria-invalid={isLinkInvalid || undefined}
              autoFocus
              className={cn(
                "form-control min-w-40 flex-1 px-2 py-0.5 text-sm",
                isLinkInvalid && "border-danger-500! focus:ring-danger-300!",
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
              type="url"
              value={linkUrl}
            />
            <Button onClick={addLink} size="sm">
              {messages.common.confirm}
            </Button>
            <Button onClick={closeLinkForm} size="sm" variant="outline">
              {messages.common.cancel}
            </Button>
          </div>
        )}

        <div
          aria-describedby={errorId}
          aria-disabled={disabled || undefined}
          aria-invalid={error ? "true" : undefined}
          aria-labelledby={label ? labelId : undefined}
          aria-multiline="true"
          aria-required={required || undefined}
          className="rich-text-editor rich-text min-h-50 p-3 text-sm focus:outline-none"
          contentEditable={!disabled}
          data-empty={content ? undefined : ""}
          data-placeholder={placeholder}
          onDragEnd={() => {
            isDraggingInside.current = false;
          }}
          onDragStart={() => {
            isDraggingInside.current = true;
          }}
          onDrop={handleDrop}
          onInput={handleInput}
          onPaste={handlePaste}
          ref={editorRef}
          role="textbox"
          suppressContentEditableWarning
          tabIndex={disabled ? -1 : 0}
        />
      </div>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
