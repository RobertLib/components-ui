import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ChipPage() {
  return (
    <DocPage imports={["Chip"]} title="Chip">
      <Example name="chip/variants" title="Colors and variants" />
      <Section title="Props">
        <PropsTable of="Chip" />
      </Section>
    </DocPage>
  );
}
