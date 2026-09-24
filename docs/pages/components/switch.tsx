import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SwitchPage() {
  return (
    <DocPage imports={["Switch"]} title="Switch">
      <Example
        description={
          <p>
            <code>description</code> puts secondary text under the label and
            describes the switch with it for screen readers.
          </p>
        }
        name="switch/basic"
        title="Basic"
      />

      <Section title="Notes">
        <Prose>
          <p>
            Underneath is a checkbox with <code>role="switch"</code>, so it
            works in forms and with <code>checked</code>,{" "}
            <code>defaultChecked</code> and <code>onChange</code> like one.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Switch" />
      </Section>
    </DocPage>
  );
}
