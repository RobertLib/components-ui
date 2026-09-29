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
            <code>variant="pages"</code> shows numbered pages between the
            previous and the next button: the first and the last one (
            <code>boundaryCount</code>), the ones beside the current page (
            <code>siblingCount</code>) and "…" for the gaps - always as many
            items, so the buttons do not jump around. The current page is{" "}
            <code>aria-current="page"</code>, and a pressed number keeps the
            focus. It needs the number of pages - a <code>total</code>, or a{" "}
            <code>pageCount</code> for an API that reports pages; in cursor mode
            it stays compact. <code>onPageChange</code> gets the number of the
            page to show, from every button (in the compact variant too).{" "}
            <code>pageSizeOptions</code> adds a select of the page size (
            <code>onPageSizeChange</code>), <code>showJumpTo</code> a field that
            goes to the page typed in - in the landmark, and submitting no form
            around it.
          </p>
        }
        name="pagination/pages"
        title="Numbered pages, page size and jump"
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
            from the old cursors twice. Pass <code>loading</code> too: its end
            also ends the wait after a failed load, which leaves the old{" "}
            <code>pageInfo</code> - without it the buttons wait 10 seconds.
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
