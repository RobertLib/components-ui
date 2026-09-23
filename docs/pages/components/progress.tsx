import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ProgressPage() {
  return (
    <DocPage imports={["Progress"]} title="Progress">
      <Example name="progress/basic" title="Basic" />
      <Section title="Props">
        <PropsTable of="Progress" />
      </Section>
    </DocPage>
  );
}
