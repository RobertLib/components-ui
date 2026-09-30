import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const hookForm = `<Controller
  control={control}
  name="note"
  render={({ field, fieldState }) => (
    <RichTextEditor
      error={fieldState.error?.message}
      label="Note"
      onBlur={field.onBlur}
      onChange={field.onChange}
      ref={field.ref} // focused when the validation fails
      value={field.value}
    />
  )}
  rules={{ required: "Write a note" }}
/>`;

const rendering = `import { sanitizeRichText } from "components-ui";

// Stored HTML is user input - reduce it to the editor's formatting before
// React puts it into the page
function Note({ html }: { html: string }) {
  return (
    <div
      className="rich-text"
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}

// The formatting of an editor with fewer tools
sanitizeRichText(html, { formats: ["bold", "italic", "link"] });

// Images only where they are asked for - with the formats of the editor
sanitizeRichText(html, {
  allowImageDataUrls: true, // if uploadImage gives data: URLs
  formats: ["bold", "italic", "link", "image"],
});`;

const serverRendering = `import { useMemo, useSyncExternalStore } from "react";
import { sanitizeRichText } from "components-ui";

const subscribe = () => () => {};

// The server has no DOMParser - the note is empty there and in the render
// that hydrates the page, and filled in right after
function Note({ html }: { html: string }) {
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const sanitized = useMemo(
    () => (isHydrated ? sanitizeRichText(html) : ""),
    [html, isHydrated],
  );

  return (
    <div className="rich-text" dangerouslySetInnerHTML={{ __html: sanitized }} />
  );
}`;

const upload = `import { RichTextEditor, type RichTextImageUpload } from "components-ui";

// Resolves with the URL of the stored image - the editor shows a placeholder
// until then, and the form cannot be submitted. A rejection tells the user.
const uploadImage: RichTextImageUpload = async (file, { signal }) => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/images", { body, method: "POST", signal });
  if (!response.ok) throw new Error(response.statusText);
  return (await response.json()).url;
};

<RichTextEditor
  label="Post"
  toolbar={["bold", "italic", "link", "|", "image"]}
  uploadImage={uploadImage}
/>;`;

const shortcuts: [typed: string, makes: string, tool: string][] = [
  ["# or ##, then a space", "Heading 2", "heading2"],
  ["###, then a space", "Heading 3", "heading3"],
  ["- or *, then a space", "Bulleted list", "bulletList"],
  ["1. or 1), then a space", "Numbered list", "numberedList"],
  [">, then a space", "Quote", "blockquote"],
  ["---", "Horizontal line", "horizontalRule"],
  ["```", "Code block", "codeBlock"],
  ["`code`", "Inline code - anywhere in a line", "code"],
];

const extendToolbar = `import {
  DEFAULT_RICH_TEXT_TOOLBAR,
  RichTextEditor,
  type RichTextToolbarItem,
} from "components-ui";

// Outside the component - the same array on every render
const TOOLBAR: RichTextToolbarItem[] = [
  ...DEFAULT_RICH_TEXT_TOOLBAR,
  "|",
  "table",
];

<RichTextEditor label="Note" toolbar={TOOLBAR} />;`;

const tools: [tools: string, action: string, shortcut: string][] = [
  ["undo, redo", "Undoes and redoes a change", "Ctrl+Z, Ctrl+Y"],
  ["paragraph", "Makes the selected lines paragraphs", "Ctrl+Alt+0"],
  [
    "heading2, heading3",
    "Makes them headings - pressed again, paragraphs",
    "Ctrl+Alt+2, Ctrl+Alt+3",
  ],
  ["bold, italic, underline", "Formats the selected text", "Ctrl+B, I, U"],
  ["strikethrough", "Strikes the selected text through", "Ctrl+Shift+X"],
  ["code", "Inline code - at a caret, for the text typed next", "Ctrl+E"],
  [
    "codeBlock",
    "Makes the lines a code block of plain text - pressed again, paragraphs",
    "",
  ],
  [
    "bulletList, numberedList",
    "Makes the lines list items - pressed again, paragraphs",
    "Ctrl+Shift+8, Ctrl+Shift+7",
  ],
  [
    "indent, outdent",
    "Nests list items in the item before them, and back",
    "Ctrl+], Ctrl+[",
  ],
  [
    "blockquote",
    "Quotes the lines - pressed again, paragraphs",
    "Ctrl+Shift+9",
  ],
  [
    "link",
    "Links the selection - or edits and removes the link at the caret",
    "Ctrl+K",
  ],
  ["table", "Inserts a table of the size of its form", ""],
  [
    "image",
    "Inserts an image by its URL or uploads one - or edits the selected image",
    "",
  ],
  ["horizontalRule", "Inserts a horizontal line", ""],
  ["clearFormatting", "Removes the marks of the selected text", "Ctrl+\\"],
];

export default function RichTextEditorPage() {
  return (
    <DocPage
      imports={[
        "RichTextEditor",
        "DEFAULT_RICH_TEXT_TOOLBAR",
        "type RichTextImageUpload",
        "type RichTextToolbarItem",
      ]}
      title="RichTextEditor"
    >
      <Example
        description={
          <p>
            Headings, lists, quotes, links and the common marks - enough for
            notes, messages and reports, without a heavy editor dependency. The
            output is HTML; render it in an element with the{" "}
            <code>rich-text</code> class, which restores the typography
            Tailwind's preflight removes.
          </p>
        }
        name="rich-text-editor/basic"
        title="Basic"
      />

      <Callout title="Sanitize the HTML" type="warning">
        <p>
          The HTML comes from the user. Sanitize it on the server (or with a
          library such as DOMPurify) before you store it, and again when you
          render it. The editor itself reduces a loaded <code>value</code>,
          pasted or dropped content and the value it reports to the formatting
          of its tools - scripts, styles, event handlers and{" "}
          <code>javascript:</code> links never reach it, images only with the
          image tool and a safe source. A server-side allowlist must allow the
          elements of the tools you use (see below).
        </p>
      </Callout>

      <Section title="Toolbar">
        <Prose>
          <p>
            <code>toolbar</code> lists the tools in their order,{" "}
            <code>"|"</code> dividing them into groups. Left out, it is{" "}
            <code>DEFAULT_RICH_TEXT_TOOLBAR</code> - every tool but inline code,
            code blocks, tables, images and horizontal lines. The toolbar wraps
            on narrow screens.
          </p>
          <p>
            The tools also decide what the value keeps: an editor without{" "}
            <code>"table"</code> turns pasted tables into lines of text, one
            without <code>"heading2"</code> and <code>"heading3"</code> turns
            headings into paragraphs, and one without <code>"underline"</code>{" "}
            ignores Ctrl+U - so the editor never shows formatting its user
            cannot change. <code>toolbar={"{[]}"}</code> leaves out the toolbar;
            paragraphs and line breaks remain.
          </p>
        </Prose>
        <Example
          description={
            <p>
              All the tools. Code, a quote, nested lists - and undo and redo
              with an own history of the editor, which the browser's shared one
              is not: up to 100 steps, fewer of a very long document.
            </p>
          }
          name="rich-text-editor/full-toolbar"
          title="Full toolbar"
        />
        <Example
          description={
            <p>
              A comment box: bold, italic and links. Pasted headings, lists and
              tables arrive as paragraphs.
            </p>
          }
          name="rich-text-editor/minimal"
          title="Minimal toolbar"
        />
        <CodeBlock code={extendToolbar} />
        <Prose>
          <table>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Does</th>
                <th>Shortcut</th>
              </tr>
            </thead>
            <tbody>
              {tools.map(([names, action, shortcut]) => (
                <tr key={names}>
                  <td>
                    {names.split(", ").map((name, index) => (
                      <span key={name}>
                        {index > 0 && ", "}
                        <code>{name}</code>
                      </span>
                    ))}
                  </td>
                  <td>{action}</td>
                  <td className="whitespace-nowrap">{shortcut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Apple devices use ⌘ instead of Ctrl and ⌥ instead of Alt. Each
            button names its shortcut in its tooltip and{" "}
            <code>aria-keyshortcuts</code>; the names of the keys come from the
            locale (<code>richTextEditor.keys</code>). Undo and redo also work
            without their buttons.
          </p>
        </Prose>
      </Section>

      <Section title="Markdown shortcuts">
        <Prose>
          <p>
            Typed at the start of a paragraph, the shortcuts of Markdown format
            it - each only when the toolbar has its tool. Ctrl+Z right after one
            brings back the typed text, so a line that should start with "1. "
            stays as it was typed. <code>autoformat={"{false}"}</code> turns
            them off.
          </p>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Makes</th>
                <th>Tool</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map(([typed, makes, tool]) => (
                <tr key={tool}>
                  <td className="whitespace-nowrap">{typed}</td>
                  <td>{makes}</td>
                  <td>
                    <code>{tool}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Prose>
        <Example
          description={
            <p>
              A code block holds plain text - marks, links and images have no
              place in it. Enter breaks its line; on the empty last line, it
              leaves the block (so do the arrow keys at the end of the content).
              Text pasted into it keeps its lines.
            </p>
          }
          name="rich-text-editor/markdown"
          title="Code blocks and shortcuts"
        />
      </Section>

      <Section title="Images">
        <Example
          description={
            <p>
              With the <code>"image"</code> tool, images go into the text like
              characters - never wider than the text. Its form takes the URL and
              the alternative text of an image, the one selected with a click
              too (a double click opens it); <code>uploadImage</code> adds a
              button that picks files. Pasted and dropped image files are
              uploaded - without <code>uploadImage</code> they are refused, but
              the images of pasted HTML stay. Here the upload makes data URLs,
              which <code>allowImageDataUrls</code> lets through.
            </p>
          }
          name="rich-text-editor/images"
          title="Images and uploads"
        />
        <Prose>
          <p>
            <code>uploadImage(file, {"{ signal }"})</code> resolves with the URL
            of the image - an <code>http(s):</code> or relative one (a{" "}
            <code>data:</code> URL of a PNG, JPEG, GIF, WebP or AVIF image with{" "}
            <code>allowImageDataUrls</code>). Until then a faded preview shows
            where the image goes, screen readers are told of the upload, the
            editor is <code>aria-busy</code> and its form cannot be submitted;
            the value gets the image once its URL is there. A rejection - or a
            URL that is no safe image source - removes the preview and says the
            image could not be uploaded. The <code>signal</code> aborts when the
            editor unmounts or its form resets. A reset discards pending uploads
            and releases their validation state. One undo takes an uploaded
            image out again.
          </p>
          <p>
            An image keeps its <code>src</code>, <code>alt</code>,{" "}
            <code>title</code>, <code>width</code> and <code>height</code> -
            nothing else (no <code>srcset</code>, styles or handlers). Check the
            type and size of uploaded files on the server, and serve them from a
            domain of their own or with <code>Content-Disposition</code>: an SVG
            file opened in a tab could run scripts (the editor never takes SVG
            as a <code>data:</code> URL).
          </p>
        </Prose>
        <CodeBlock code={upload} />
      </Section>

      <Section title="Tables">
        <Example
          description={
            <p>
              The table tool asks for the rows and columns of a new table, with
              a header row or without. The tools of the table - rows and columns
              added and removed, the header row, the whole table deleted - show
              under the toolbar while the content has a table, and act on the
              table of the caret. Tab moves to the next cell and adds a row
              after the last one; Shift+Tab moves back. Enter breaks the line of
              a cell, and the arrow keys leave a table at the start or end of
              the content into a new paragraph. Backspace at the start of the
              line after a table moves the caret into its last cell - it does
              not pull the line into it.
            </p>
          }
          name="rich-text-editor/table"
          title="Table"
        />
      </Section>

      <Section title="Size and character count">
        <Example
          description={
            <p>
              <code>minRows</code> sets the room of the empty editor (8 lines by
              default), <code>maxRows</code> the most it grows to - past it the
              text scrolls under the toolbar. <code>resize</code> adds a handle
              to drag it taller. <code>showCount</code> counts the characters of
              the text as it shows (line breaks and images count none) and, with{" "}
              <code>maxLength</code>, tells screen readers how many are left
              near the limit - like <code>Textarea</code>.
            </p>
          }
          name="rich-text-editor/size"
          title="Size and count"
        />
        <Prose>
          <p>
            <code>maxLength</code> works as in a native field: typing, pasting
            and dropping stop at the limit (pasted content is cut, an IME
            composition cut back when it ends). A longer value from outside
            stays and is counted over the limit; once the user edits it, it
            keeps its form from being submitted until it is short enough.
          </p>
        </Prose>
      </Section>

      <Section title="Read-only">
        <Example
          description={
            <p>
              <code>readOnly</code> shows the content - selectable, copyable and
              focusable, its links working - without the toolbar. Unlike{" "}
              <code>disabled</code>, it is submitted with its form and not
              greyed out; like a read-only native field, it is not validated.
              The editor has <code>aria-readonly</code> and{" "}
              <code>data-readonly</code>.
            </p>
          }
          name="rich-text-editor/read-only"
          title="Read-only editor"
        />
      </Section>

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              The toolbar is one stop of Tab: the arrow keys, Home and End move
              in it, and Alt+F10 gets there from the text. Tools with nothing to
              act on (an outdent outside of a list) stay focusable, marked with{" "}
              <code>aria-disabled</code>; toggles say their state with{" "}
              <code>aria-pressed</code>.
            </li>
            <li>
              Tab indents a list item and Shift+Tab outdents a nested one -
              where there is nothing to indent (the first item), Tab leaves the
              editor as usual. Enter in an empty list item leaves the list (or
              its level), in an empty quoted line the quote.
            </li>
            <li>
              The formatting shortcuts of the browser and the system menus (iOS
              offers bold, italic and underline) go through the tools too:
              without the tool, they do nothing.
            </li>
            <li>
              Right to left, the arrow keys follow the text: the left one moves
              to the next tool, and leaves a table or code block forward. The
              lists, quotes and tables of the content indent from the right.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Rendering the HTML">
        <Prose>
          <p>
            <code>sanitizeRichText(html)</code> is the sanitizer of the editor:
            it keeps paragraphs, headings (<code>h2</code>, <code>h3</code>),
            lists, quotes, code blocks (<code>pre</code> of <code>code</code>),
            tables, horizontal rules, bold, italic, underline, strikethrough,
            inline code and links whose URL passes <code>isSafeHref(href)</code>{" "}
            (<code>http:</code>, <code>https:</code>, <code>mailto:</code>,{" "}
            <code>tel:</code> and relative links) - without any attributes but
            those links, and nothing else; other links become their text. Images
            it keeps only where its <code>formats</code> list{" "}
            <code>"image"</code>, as an image loads from wherever it points:
            those whose source passes <code>isSafeImageSrc(src)</code> (
            <code>http:</code>, <code>https:</code> and relative; base64{" "}
            <code>data:</code> URLs of raster images with{" "}
            <code>allowImageDataUrls</code>), with their <code>alt</code>,{" "}
            <code>title</code>, <code>width</code> and <code>height</code>. Its{" "}
            <code>formats</code> keep less, like an editor with fewer tools.
            Render stored HTML through it, inside an element with the{" "}
            <code>rich-text</code> class:
          </p>
        </Prose>
        <CodeBlock code={rendering} />
        <Prose>
          <p>
            Its output is the same when sanitized again, so HTML stored from the
            editor and rendered through it keeps what it showed.
          </p>
        </Prose>
        <Callout title="Server rendering">
          <p>
            <code>sanitizeRichText</code> needs <code>DOMParser</code> - and
            nothing else of a DOM. It runs in the browser, and on a server with
            a global <code>DOMParser</code>, e.g. that of jsdom:{" "}
            <code>globalThis.DOMParser = new JSDOM().window.DOMParser</code>. On
            a server without one it throws - importing it is safe anywhere. A
            page rendered on such a server calls it once it is hydrated, as
            below, or sanitizes the HTML on the server with a library of its
            own.
          </p>
          <p>
            One jsdom window serves any number of calls. Limit the size of the
            HTML before you sanitize it there - to what the longest document of
            your editor needs, e.g. 100 KB: the parser of jsdom slows down with
            the square of the nesting of the tags, so a few hundred kilobytes of
            deeply nested tags would keep the server busy for minutes (a browser
            stops nesting at 512 levels).
          </p>
        </Callout>
        <CodeBlock code={serverRendering} />
      </Section>

      <Section title="Pasted content">
        <Prose>
          <p>
            Pasted and dropped content keeps its shape as far as the tools
            allow: headings, lists, quotes and tables stay - <code>h1</code>{" "}
            becomes <code>h2</code>, <code>h4</code> - <code>h6</code> become{" "}
            <code>h3</code>, merged table cells are split so the columns stay in
            line, the list paragraphs of Word become lists (without their
            bullets and numbers as text), <code>pre</code> becomes a code block
            and images keep their safe source (with the image tool) - and the
            bold, italic, underlined, struck and monospace text of Google Docs
            and Word, which set it by styles, stays too. Without their tools,
            headings, list items and quotes become paragraphs and table rows
            lines of text (the cells separated by tabs). Content pasted into a
            table cell, a heading or a list item becomes its lines (a pasted
            list gives the item items next to it), into a quote its paragraphs -
            so the editor shows what it submits. Blocks that replace the line or
            table as a whole, from its start on (select all), or fill an empty
            line keep their kinds; text of one line stays in the line, like
            typed text. A table of more than 50 columns or 10 000 cells arrives
            without its merged cells, and where it is still too big as lines of
            text - a few kilobytes of <code>colspan</code> cannot grow into
            millions of cells.
          </p>
          <p>
            The link tool takes web addresses (<code>example.com</code>,{" "}
            <code>localhost:3000</code>, <code>192.168.1.1</code> get{" "}
            <code>https://</code>), e-mail addresses (<code>mailto:</code>) and
            phone numbers (<code>tel:</code>, also typed with it). With the
            caret in a link it edits the address or removes the link.
          </p>
        </Prose>
      </Section>

      <Section title="Forms">
        <Prose>
          <p>
            With a <code>name</code> the HTML is submitted in a hidden input, so
            the editor works in a plain <code>&lt;form&gt;</code>. It can be
            uncontrolled (<code>defaultValue</code>) or controlled (
            <code>value</code> + <code>onChange</code>) - a controlled one shows
            its <code>value</code>, so an input the parent does not take is
            undone. An uncontrolled editor follows its <code>defaultValue</code>{" "}
            until the user edits, so the value of an edit form may arrive after
            the first render. An editor without text reports an empty string,
            which <code>required</code> does not let through. A form reset
            brings back the <code>defaultValue</code>, and content set from
            outside starts the undo history anew. A <code>readOnly</code> editor
            is submitted, a <code>disabled</code> one is not.
          </p>
          <p>
            The <code>label</code> may hold more than text - it names the editor
            and its toolbar. Without a visible <code>label</code>, name it with{" "}
            <code>aria-label</code> or <code>aria-labelledby</code>.{" "}
            <code>id</code> goes to the editable element, <code>onBlur</code>{" "}
            fires when the focus leaves the editor (its toolbar is part of it),
            and <code>ref</code> - with the other attributes of a{" "}
            <code>div</code> - is the editable element: React Hook Form focuses
            it when the validation fails:
          </p>
        </Prose>
        <CodeBlock code={hookForm} />
        <Callout>
          <p>
            Rendered on the server, the editor is empty until it hydrates - it
            needs the browser to sanitize its value, and it never sends the
            unsanitized HTML in its hidden input.
          </p>
        </Callout>
      </Section>

      <Section title="Props">
        <PropsTable of="RichTextEditor" />
        <PropsTable
          of="SanitizeRichTextOptions"
          title="sanitizeRichText options"
        />
      </Section>
    </DocPage>
  );
}
