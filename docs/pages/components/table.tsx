import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TablePage() {
  return (
    <DocPage
      imports={[
        "Table",
        "TableHead",
        "TableBody",
        "TableFoot",
        "TableRow",
        "TableCell",
      ]}
      title="Table"
    >
      <Example
        description={
          <p>
            The parts are those of an HTML table. A <code>TableCell</code> in{" "}
            <code>TableHead</code> is a column header (
            <code>{'<th scope="col">'}</code>); with <code>header</code> in the
            body it is the header of its row. <code>align="end"</code> lines up
            numbers - the end is on the left in a right-to-left page. The{" "}
            <code>caption</code> is the title of the table and its accessible
            name; without one, name it with <code>aria-label</code>. The other
            props of a cell - <code>colSpan</code>, <code>className</code> - go
            to it.
          </p>
        }
        name="table/basic"
        title="A static table"
      />
      <Example
        description={
          <p>
            <code>striped</code> tints every other row of the body,{" "}
            <code>hover</code> highlights the row under the pointer,{" "}
            <code>bordered</code> draws lines between the columns too, and{" "}
            <code>density</code> sets the padding of the cells - the densities
            of <code>DataTable</code>.
          </p>
        }
        name="table/options"
        title="Striped, hover, bordered and density"
      />
      <Example
        description={
          <p>
            A <code>TableRow</code> with <code>href</code> opens the detail of
            its record on a click anywhere on it - not on a control in it, and
            not at the end of selecting its text. It follows the link of the row
            (<code>data-row-link</code>, or the one to the same{" "}
            <code>href</code>) as a click on it would, so Ctrl + click opens a
            new tab. That link is what the keyboard and screen readers use - put
            it in the cell that names the row.
          </p>
        }
        name="table/row-links"
        title="Rows that open a detail"
      />
      <Example
        description={
          <p>
            A table wider than its frame scrolls sideways - on a phone, say.
            With <code>maxHeight</code> a long one scrolls in its frame, and{" "}
            <code>stickyHeader</code> keeps the header row in sight. A frame
            that scrolls is a Tab stop, named by the caption, so that the
            keyboard can scroll it too.
          </p>
        }
        name="table/sticky"
        title="Sticky header and scrolling"
      />

      <Section title="Notes">
        <Prose>
          <p>
            <code>Table</code> shows data you have at hand - a price list, a
            summary, the rows of a document. Rows that are sorted, filtered,
            paged, selected or edited belong in a{" "}
            <Link to="/components/data-table">DataTable</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Table" />
        <PropsTable of="TableRow" />
        <PropsTable of="TableCell" />
      </Section>
    </DocPage>
  );
}
