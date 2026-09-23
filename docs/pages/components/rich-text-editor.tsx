import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function RichTextEditorPage() {
  return (
    <DocPage imports={["RichTextEditor"]} title="RichTextEditor">
      <Example
        description={
          <p>
            Bold, italic, paragraphs and links - enough for notes and messages,
            without a heavy editor dependency. The output is HTML; render it in
            an element with the <code>rich-text</code> class, which restores the
            typography Tailwind's preflight removes.
          </p>
        }
        name="rich-text-editor/basic"
        title="Basic"
      />

      <Callout title="Sanitize the HTML" type="warning">
        <p>
          The HTML comes from the user. Sanitize it on the server (or with a
          library such as DOMPurify) before you store or render it anywhere. The
          editor itself reduces a loaded <code>value</code>, pasted or dropped
          content and the value it reports to its own formatting - scripts,
          styles, images and <code>javascript:</code> links never reach it, and
          the link button accepts only web, e-mail and phone links.
        </p>
      </Callout>

      <Section title="Forms">
        <Prose>
          <p>
            With a <code>name</code> the HTML is submitted in a hidden input, so
            the editor works in a plain <code>&lt;form&gt;</code>. It can be
            uncontrolled (<code>defaultValue</code>) or controlled (
            <code>value</code> + <code>onChange</code>). An editor without text
            reports an empty string, which <code>required</code> does not let
            through. A form reset brings back the <code>defaultValue</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="RichTextEditor" />
      </Section>
    </DocPage>
  );
}
