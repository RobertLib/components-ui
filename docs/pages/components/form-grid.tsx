import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function FormGridPage() {
  return (
    <DocPage imports={["FormGrid", "FormGridItem"]} title="FormGrid">
      <Example
        description={
          <p>
            <code>columns</code> - 1 to 4 - where the grid is wide enough:{" "}
            <code>2</code> from 36rem of its width, <code>3</code> from 48rem,{" "}
            <code>4</code> two from 36rem and four from 56rem, one column below
            (with the labels beside the fields from 48rem, 64rem, and 48rem and
            72rem). The grid measures itself, not the screen - in a narrow
            dialog or a sidebar the fields stack too. <code>FormGridItem</code>{" "}
            spans a field over more columns, or the whole row with{" "}
            <code>span=&quot;full&quot;</code>.
          </p>
        }
        name="form-grid/columns"
        title="Columns"
      />

      <Example
        description={
          <p>
            <code>labelPosition=&quot;start&quot;</code> puts the label of every
            field in a column of <code>labelWidth</code> (10rem by default) -
            the control, its description and error message beside it, the label
            on the line of the text in the control. A checkbox and a switch,
            labelled beside their box, line up with the controls; a group of
            options floats its legend into the column of the labels. Below 30rem
            of the width of the grid the labels go above the fields again. A
            field with a <code>floating</code> label, or none (an{" "}
            <code>aria-label</code>), stays as it is.
          </p>
        }
        name="form-grid/labels-beside"
        title="Labels beside the fields"
      />

      <Section title="Nested grids">
        <Prose>
          <p>
            A grid inside another one - a <code>FormSection</code> is one too -
            takes its <code>labelPosition</code>, <code>labelWidth</code> and{" "}
            <code>readOnly</code> unless it has its own:{" "}
            <code>labelPosition=&quot;top&quot;</code> puts the labels of a part
            above again, <code>readOnly={"{false}"}</code> leaves a part of a
            read-only form editable.
          </p>
        </Prose>
        <Callout>
          <p>
            The layout is CSS: <code>data-label-position</code> on the grid and
            the classes <code>cui-field</code> and <code>cui-field-label</code>{" "}
            on the fields of the library, laid out by the stylesheet of the
            library - <code>Field</code> gives them to a control of your own.
          </p>
        </Callout>
      </Section>

      <Section title="Props">
        <PropsTable of="FormGrid" />
        <PropsTable of="FormGridItem" />
      </Section>
    </DocPage>
  );
}
