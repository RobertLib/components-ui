import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const syntax = `"mod+k"        // ⌘K on a Mac, Ctrl+K elsewhere
"mod+shift+p"  // modifiers first: mod, ctrl, alt (option), shift, meta (cmd)
"ctrl+enter"   // named keys: enter, escape (esc), tab, space, backspace,
"alt+arrowup"  // delete, arrowup (up), home, end, pageup, f1 … f12
"?"            // a symbol matches with or without Shift
"mod+plus"     // the + key (also "mod++")`;

const helpers = `import { formatShortcut, matchesShortcut } from "components-ui";

// Text for a tooltip or a title - "Save (⌘S)" or "Save (Ctrl+S)"
const title = \`Save (\${formatShortcut("mod+s")})\`;

// An own key handler
function handleKeyDown(event: React.KeyboardEvent) {
  if (matchesShortcut(event, "mod+enter")) submit();
}`;

export default function KbdPage() {
  return (
    <DocPage imports={["Kbd"]} title="Kbd">
      <Example
        description={
          <p>
            <code>children</code> is a single key. <code>shortcut</code> writes
            a key combination in the notation of the platform - the server
            renders the Windows notation and the browser switches to the Mac
            symbols after hydration.
          </p>
        }
        name="kbd/basic"
        title="Keys and shortcuts"
      />

      <Section title="Shortcut syntax">
        <Prose>
          <p>
            Shortcuts are strings of keys joined by <code>+</code>, modifiers
            first. The same syntax is used wherever the library shows or handles
            a shortcut: <code>useHotkeys</code> registers them (
            <Link to="/guides/utilities">Hooks &amp; utilities</Link>),{" "}
            <Link to="/components/dropdown">Dropdown</Link> items show them and
            the <Link to="/components/command-palette">CommandPalette</Link>{" "}
            opens on one.
          </p>
        </Prose>
        <CodeBlock code={syntax} plain />
        <Prose>
          <p>
            <code>formatShortcut</code> turns a shortcut into text,{" "}
            <code>matchesShortcut</code> tells whether a keyboard event is it -
            matching letters and digits by their place on the keyboard where the
            layout types another character (a Czech keyboard types{" "}
            <code>ě</code> on the 2 key). A key of its own is not a digit,
            though - the numpad with NumLock off sends the arrows and End - and
            what AltGr types is text, not Ctrl + Alt as Windows reports it (
            <code>@</code> of AltGr + V on a Czech keyboard does not match{" "}
            <code>"ctrl+alt+v"</code>).
          </p>
        </Prose>
        <CodeBlock code={helpers} />
      </Section>

      <Section title="Props">
        <PropsTable of="Kbd" />
      </Section>
    </DocPage>
  );
}
