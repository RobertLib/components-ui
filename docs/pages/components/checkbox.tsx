import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CheckboxPage() {
  return (
    <DocPage imports={["Checkbox"]} title="Checkbox">
      <Example
        description={
          <p>
            Controlled with <code>checked</code> + <code>onChange</code>, or
            uncontrolled with <code>defaultChecked</code>.
          </p>
        }
        name="checkbox/basic"
        title="Basic"
      />

      <Section title="Props">
        <PropsTable of="Checkbox" />
      </Section>
    </DocPage>
  );
}
