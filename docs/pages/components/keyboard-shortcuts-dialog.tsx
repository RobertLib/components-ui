import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const usage = `// Anywhere in the app - listed while the component is mounted
useHotkeys([
  ["mod+s", save, { allowInFields: true, description: "Save the invoice", group: "Invoice" }],
  ["alt+n", addLine, { description: "Add a line", group: "Invoice" }],
]);

// Once, near the root - ? opens it on every page
<KeyboardShortcutsDialog />`;

export default function KeyboardShortcutsDialogPage() {
  return (
    <DocPage
      imports={["KeyboardShortcutsDialog", "type KeyboardShortcut"]}
      title="KeyboardShortcutsDialog"
    >
      <Example
        description={
          <p>
            A shortcut of <code>useHotkeys</code> with a{" "}
            <code>description</code> is listed in the dialog while its component
            is mounted and the hook enabled - under its <code>group</code>, or
            the localized "General". Press <code>?</code> to open it, and switch
            the invoice off: its shortcuts leave the list. Two shortcuts of one
            action share a line. Keys a component handles itself - the arrows of
            a list - are given by the app in <code>shortcuts</code>.
          </p>
        }
        name="keyboard-shortcuts-dialog/basic"
        title="The shortcuts of the page"
      />

      <Section title="Usage">
        <CodeBlock code={usage} />
        <Prose>
          <ul>
            <li>
              It lists the shortcuts that work now: not those of a page under a
              modal dialog - opened from a <code>Dialog</code>, it lists the
              shortcuts of the dialog. Opened with <code>?</code> over the page,
              it lists the shortcuts of the page under it.
            </li>
            <li>
              <code>shortcut</code> changes the key that opens (and closes) it -{" "}
              <code>null</code> for none, e.g. to open it from a menu item with{" "}
              <code>open</code> / <code>onOpenChange</code>. Its own shortcut is
              listed with the others. A shortcut without a modifier, like{" "}
              <code>?</code>, does not work while typing into a field.
            </li>
            <li>
              The keys are written in the notation of the platform with{" "}
              <code>Kbd</code> - ⌘S on a Mac, Ctrl+S elsewhere (see the{" "}
              <Link to="/components/kbd">shortcut syntax</Link>).
            </li>
            <li>
              Rendered on the server it lists nothing - the shortcuts register
              in the browser.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="KeyboardShortcutsDialog" />
        <PropsTable of="KeyboardShortcut" />
      </Section>
    </DocPage>
  );
}
