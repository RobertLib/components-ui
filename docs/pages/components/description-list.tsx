import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function DescriptionListPage() {
  return (
    <DocPage imports={["DescriptionList"]} title="DescriptionList">
      <Example
        description={
          <p>
            The detail of a record. <code>termInfo</code> adds an explanation
            behind an info button - shown on hover, on keyboard focus and on a
            tap; long values wrap inside their cell.
          </p>
        }
        name="description-list/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>loading</code> shows placeholders instead of the values;{" "}
            <code>termWidth</code> fixes the width of the term column.
          </p>
        }
        name="description-list/loading"
        title="Loading and a fixed term width"
      />
      <Section title="Props">
        <PropsTable of="DescriptionList" />
        <PropsTable of="DescriptionListItem" />
      </Section>
    </DocPage>
  );
}
