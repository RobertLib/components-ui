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
sanitizeRichText(html, { formats: ["bold", "italic", "link"] });`;

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
  ["horizontalRule", "Inserts a horizontal line", ""],
  ["clearFormatting", "Removes the marks of the selected text", "Ctrl+\\"],
];

export default function RichTextEditorPage() {
  return (
    <DocPage
      imports={[
        "RichTextEditor",
        "DEFAULT_RICH_TEXT_TOOLBAR",
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
          of its tools - scripts, styles, images and <code>javascript:</code>{" "}
          links never reach it. A server-side allowlist must allow the elements
          of the tools you use (see below).
        </p>
      </Callout>

      <Section title="Toolbar">
        <Prose>
          <p>
            <code>toolbar</code> lists the tools in their order,{" "}
            <code>"|"</code> dividing them into groups. Left out, it is{" "}
            <code>DEFAULT_RICH_TEXT_TOOLBAR</code> - every tool but inline code,
            tables and horizontal lines. The toolbar wraps on narrow screens.
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
          </ul>
        </Prose>
      </Section>

      <Section title="Rendering the HTML">
        <Prose>
          <p>
            <code>sanitizeRichText(html)</code> is the sanitizer of the editor:
            it keeps paragraphs, headings (<code>h2</code>, <code>h3</code>),
            lists, quotes, tables, horizontal rules, bold, italic, underline,
            strikethrough, inline code and links whose URL passes{" "}
            <code>isSafeHref(href)</code> (<code>http:</code>,{" "}
            <code>https:</code>, <code>mailto:</code>, <code>tel:</code> and
            relative links) - without any attributes but those links, and
            nothing else; other links become their text. Its{" "}
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
            bullets and numbers as text) - and the bold, italic, underlined,
            struck and monospace text of Google Docs and Word, which set it by
            styles, stays too. Without their tools, headings, list items and
            quotes become paragraphs and table rows lines of text (the cells
            separated by tabs). Content pasted into a table cell, a heading or a
            list item becomes its lines (a pasted list gives the item items next
            to it), into a quote its paragraphs - so the editor shows what it
            submits. Blocks that replace the line or table as a whole, from its
            start on (select all), or fill an empty line keep their kinds; text
            of one line stays in the line, like typed text. A table of more than
            50 columns or 10 000 cells arrives without its merged cells, and
            where it is still too big as lines of text - a few kilobytes of{" "}
            <code>colspan</code> cannot grow into millions of cells.
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
            outside starts the undo history anew.
          </p>
          <p>
            Without a visible <code>label</code>, name it with{" "}
            <code>aria-label</code> or <code>aria-labelledby</code>.{" "}
            <code>id</code> goes to the editable element, <code>onBlur</code>{" "}
            fires when the focus leaves the editor (its toolbar is part of it),
            and <code>ref</code> is the editable element - React Hook Form
            focuses it when the validation fails:
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
