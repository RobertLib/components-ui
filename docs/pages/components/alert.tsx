import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function AlertPage() {
  return (
    <DocPage imports={["Alert"]} title="Alert">
      <Example name="alert/types" title="Types" />
      <Example
        description={
          <p>
            An alert without children renders nothing, so an error message can
            be placed unconditionally:{" "}
            <code>{'<Alert type="danger">{error}</Alert>'}</code>.
          </p>
        }
        name="alert/title"
        title="Title, no icon and conditional content"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            <code>danger</code> and <code>warning</code> alerts have{" "}
            <code>role="alert"</code> (danger is announced assertively), the
            others <code>role="status"</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Alert" />
      </Section>
    </DocPage>
  );
}
