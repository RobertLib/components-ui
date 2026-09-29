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
      <Example
        description={
          <p>
            <code>columns</code> puts several pairs side by side, each term
            above its value - two columns from the <code>sm</code> breakpoint,
            all of them from <code>lg</code>, one on phones. An item with{" "}
            <code>fullWidth</code> takes a whole row, e.g. a long note.{" "}
            <code>bordered</code> draws lines between the rows - also of the
            single column, where the terms keep their column.
          </p>
        }
        name="description-list/columns"
        title="Columns and lines"
      />
      <Section title="Props">
        <PropsTable of="DescriptionList" />
        <PropsTable of="DescriptionListItem" />
      </Section>
    </DocPage>
  );
}
