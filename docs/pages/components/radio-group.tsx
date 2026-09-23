import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function RadioGroupPage() {
  return (
    <DocPage imports={["RadioGroup"]} title="RadioGroup">
      <Example
        description={
          <p>
            With a <code>label</code> the options are wrapped in a{" "}
            <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code>;
            without one, name the <code>radiogroup</code> with{" "}
            <code>aria-label</code> or <code>aria-labelledby</code>. An{" "}
            <code>error</code> marks and describes the whole group. Numeric
            option values are compared as strings, so they stay checked after a
            change.
          </p>
        }
        name="radio-group/basic"
        title="Basic"
      />

      <Section title="Props">
        <PropsTable of="RadioGroup" />
        <PropsTable of="RadioOption" />
      </Section>
    </DocPage>
  );
}
