import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function HeaderPage() {
  return (
    <DocPage imports={["Header"]} title="Header">
      <Example
        description={
          <p>
            The page title with actions on the right. <code>back</code> adds an
            arrow that goes back in the history through the configured router
            (or runs <code>onBack</code>); <code>afterTitle</code> sits right
            next to the heading. While the title loads (<code>null</code> or{" "}
            <code>undefined</code>) a placeholder shows, and screen readers find
            the heading saying "Loading…". The title is the <code>h1</code> of
            the page - a header of a section or a dialog takes a lower{" "}
            <code>headingLevel</code>.
          </p>
        }
        name="header/basic"
        title="Basic"
      />

      <Section title="Props">
        <PropsTable of="Header" />
      </Section>
    </DocPage>
  );
}
