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
            change. The form submits the picked value under <code>name</code> -
            without one the options still form a group, but are not submitted.
          </p>
        }
        name="radio-group/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            An option takes a <code>description</code> - it describes the radio
            for screen readers, and a click on it picks the option - and{" "}
            <code>disabled</code>, which the arrow keys skip. The{" "}
            <code>description</code> of the group goes under the options and
            describes the group.
          </p>
        }
        name="radio-group/options"
        title="Described and disabled options"
      />
      <Example
        description={
          <p>
            <code>orientation="horizontal"</code> puts the options in a row that
            wraps on narrow screens. The arrow keys move through the options in
            either orientation, as in any radio group.
          </p>
        }
        name="radio-group/horizontal"
        title="Horizontal"
      />

      <Section title="Props">
        <PropsTable of="RadioGroup" />
        <PropsTable of="RadioOption" />
      </Section>
    </DocPage>
  );
}
