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
      <Example
        description={
          <p>
            <code>dim</code> sizes the track and the label; the switch has{" "}
            <code>data-state=&quot;checked&quot;</code> or{" "}
            <code>&quot;unchecked&quot;</code>, and in forced colors (Windows
            High Contrast) an outlined track in the highlight color when on.{" "}
            <code>labelPosition="start"</code> puts the label before the track,
            as in a list of settings - <code>className</code> of{" "}
            <code>flex justify-between</code> spreads the two over the row.{" "}
            <code>readOnly</code> shows the state and keeps the focus, but a
            click or Space changes nothing; unlike a disabled switch, it is
            submitted with the form.
          </p>
        }
        name="switch/options"
        title="Sizes, label position and read-only"
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
