import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function AccordionPage() {
  return (
    <DocPage imports={["Accordion", "CollapsibleContent"]} title="Accordion">
      <Example
        description={
          <p>
            <code>defaultOpen</code> sets whether the section starts expanded -
            or control it with <code>open</code> and <code>onOpenChange</code>.
            A click anywhere on the header toggles it; from the keyboard, the
            button at its end does.
          </p>
        }
        name="accordion/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>CollapsibleContent</code> is the animation the accordion uses
            - drive it with your own state and trigger.
          </p>
        }
        name="accordion/collapsible"
        title="CollapsibleContent"
      />

      <Section title="Props">
        <PropsTable of="Accordion" />
        <PropsTable of="CollapsibleContent" />
      </Section>
    </DocPage>
  );
}
