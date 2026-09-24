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
      <Example
        description={
          <p>
            <code>indeterminate</code> shows a partly checked state - e.g. a
            &quot;select all&quot; of a partly selected list. A click clears it
            like on a native checkbox, and the next render brings it back while
            the prop says so.
          </p>
        }
        name="checkbox/indeterminate"
        title="Indeterminate"
      />

      <Section title="Props">
        <PropsTable of="Checkbox" />
      </Section>
    </DocPage>
  );
}
