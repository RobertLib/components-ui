import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TextareaPage() {
  return (
    <DocPage imports={["Textarea"]} title="Textarea">
      <Example
        name="textarea/basic"
        title="Basic, floating and with an error"
      />

      <Section title="Props">
        <PropsTable of="Textarea" />
      </Section>
    </DocPage>
  );
}
