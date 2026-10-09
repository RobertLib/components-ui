import { Link } from "react-router";
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
            shadow - the base of page sections, of <code>Accordion</code> and of{" "}
            <Link to="/components/card">Card</Link>, which adds a header, a
            footer and a clickable variant. <code>padding</code> sets the room
            inside - <code>responsive</code> is 1rem on phones and 1.5rem from
            the <code>sm</code> breakpoint up.
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
