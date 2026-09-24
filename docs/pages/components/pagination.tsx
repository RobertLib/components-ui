import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function PaginationPage() {
  return (
    <DocPage imports={["Pagination", "type PageInfo"]} title="Pagination">
      <Prose>
        <p>
          <code>DataTable</code> renders it for you; use it on its own for other
          paged lists. It supports both ways APIs page their results. Other
          props (<code>className</code>, <code>id</code>, an{" "}
          <code>aria-label</code> replacing the default one) go to its{" "}
          <code>&lt;nav&gt;</code> landmark.
        </p>
        <p>
          The range is written as the language writes numbers (
          <code>1–20 of 1,234</code>, <code>1–20 z 1 234</code>). A button that
          becomes unavailable while it has the focus - Last page, or Next onto
          the last page - keeps the focus, announced as unavailable, until the
          focus moves on; the others are disabled.
        </p>
      </Prose>
      <Example
        description={
          <p>
            Without <code>pageInfo</code> the buttons are derived from{" "}
            <code>currentPage</code>, <code>pageSize</code> and{" "}
            <code>total</code>, and there is a "last page" button.
          </p>
        }
        name="pagination/offset"
        title="Offset pagination (REST)"
      />
      <Example
        description={
          <p>
            Pass the <code>pageInfo</code> of a Relay connection. A cursor
            connection cannot jump to its end, so there is no "last page"
            button. Many servers report <code>hasPreviousPage: false</code>{" "}
            while paging forward - pass <code>currentPage</code> too, and the
            previous button stays enabled after the first page. After a move the
            buttons wait for the next <code>pageInfo</code> (and while{" "}
            <code>loading</code>), so a double click does not request a page
            from the old cursors twice.
          </p>
        }
        name="pagination/cursor"
        title="Cursor pagination (GraphQL)"
      />

      <Section title="Props">
        <PropsTable of="Pagination" />
        <PropsTable of="PageInfo" />
      </Section>
    </DocPage>
  );
}
