import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function PanelPage() {
  return (
    <DocPage imports={["Panel"]} title="Panel">
      <Example
        description={
          <p>
            A card on the <code>surface</code> color with padding, radius and a
            shadow - the base of page sections and of <code>Accordion</code>.
          </p>
        }
        name="panel/variants"
        title="Variants"
      />

      <Section title="Props">
        <PropsTable of="Panel" />
      </Section>
    </DocPage>
  );
}
