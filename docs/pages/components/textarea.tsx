import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TextareaPage() {
  return (
    <DocPage imports={["Textarea"]} title="Textarea">
      <Example
        description={
          <p>
            The same API as <code>Input</code> - <code>label</code>,{" "}
            <code>floating</code>, <code>description</code>, <code>error</code>,{" "}
            <code>dim</code>, controlled or uncontrolled.
          </p>
        }
        name="textarea/basic"
        title="Basic, floating and with an error"
      />
      <Example
        description={
          <p>
            <code>autosize</code> makes the field grow and shrink with its text,
            from <code>minRows</code> up to <code>maxRows</code> lines - more
            text scrolls. Browsers with <code>field-sizing: content</code> size
            it by CSS, the others by measuring the text. Without{" "}
            <code>minRows</code> the empty field is as high as one without{" "}
            <code>autosize</code>.
          </p>
        }
        name="textarea/autosize"
        title="Growing with the text"
      />
      <Example
        description={
          <p>
            <code>showCount</code> counts the characters under the field - with{" "}
            <code>maxLength</code> as &quot;25 / 120&quot;, next to the
            description. Near the limit (the last tenth, or the last 10
            characters) screen readers are told how many characters are left
            once the typing pauses. The browser stops typing at{" "}
            <code>maxLength</code>; a longer value set by the page shows the
            counter in red.
          </p>
        }
        name="textarea/count"
        title="Character counter"
      />

      <Section title="Props">
        <PropsTable of="Textarea" />
      </Section>
    </DocPage>
  );
}
