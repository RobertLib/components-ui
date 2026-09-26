import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const serverSide = `const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });

// REST: /api/people?page=2&pageSize=20&sortBy=name&order=asc&…
const { page, pageSize, sortBy, order, search, filters } = toOffsetParams(query);

// GraphQL: people(first: 20, after: "…") or people(last: 20, before: "…")
const variables = toRelayVariables(query);

<DataTable
  columns={columns}
  data={rows}              // the current page
  loading={loading}
  onQueryChange={setQuery}
  pageInfo={pageInfo}      // GraphQL: the connection's pageInfo
  query={query}
  total={total}            // REST: the number of matching rows
/>`;

const queryShape = `interface DataTableQuery {
  page: number;                     // 1-based
  pageSize: number;
  sortBy: string | null;            // column key
  order: "asc" | "desc";
  search: string;                   // the global search field
  filters: Record<string, string>;  // column filters by column key
  after: string | null;             // cursor pagination
  before: string | null;
}`;

export default function DataTablePage() {
  return (
    <DocPage
      imports={["DataTable", "useDataTableQuery", "type Column"]}
      title="DataTable"
    >
      <Section title="How it works">
        <Prose>
          <p>
            The table does not load anything. It shows the rows it is given and
            reports what the user wants to see - the page, sorting, search and
            filters - as a <code>DataTableQuery</code>. Turning the query into a
            request is up to you, so any data source works:
          </p>
          <ul>
            <li>
              <strong>In the browser</strong> - pass all rows with{" "}
              <code>clientSide</code> and the table does everything itself.
            </li>
            <li>
              <strong>REST</strong> - read the query with{" "}
              <code>toOffsetParams()</code>, pass the page of rows and the{" "}
              <code>total</code>.
            </li>
            <li>
              <strong>GraphQL</strong> - read it with{" "}
              <code>toRelayVariables()</code>, pass the page of rows and the
              connection's <code>pageInfo</code>.
            </li>
          </ul>
          <p>
            Live REST and GraphQL tables are on the{" "}
            <Link to="/guides/data-fetching">REST &amp; GraphQL</Link> page.
          </p>
        </Prose>
      </Section>

      <Example
        collapsed
        description={
          <p>
            Sorting, column filters (text, select, date), the global search,
            paging, an actions column and the column settings - reorder by
            dragging or with the arrow keys on a handle, hide, pin to the left
            or right, all remembered under <code>tableId</code> like the column
            widths (drag the edge of a header) and the row density (the rows
            icon in the toolbar). Text matches ignore case and diacritics and
            are highlighted; dates and booleans without a <code>render</code>{" "}
            show by the locale (<code>24.09.2026</code>, "Yes"), lists as{" "}
            <code>alpha, beta</code>. Numbers stored as strings (
            <code>"-3.50"</code>) sort by their value. The full screen button
            covers the page - Escape or the button leave it, and Tab stays in
            the table meanwhile.
          </p>
        }
        name="data-table/client-side"
        title="All rows in the browser"
      />
      <Example
        collapsed
        description={
          <p>
            <code>groupActions</code> adds a checkbox column and buttons acting
            on the selected rows. With <code>filteredSelection</code>, selecting
            a whole page offers selecting every row matching the filters - the
            action then gets <code>allFiltered: true</code>: a{" "}
            <code>clientSide</code> table gives it all the matching rows, with
            server data it should act on the <code>query</code> it gets rather
            than on the loaded rows. Rows unchecked after that stay out of it -
            "24 matching rows are selected" - and the action gets them as{" "}
            <code>excludedRows</code> (act on all rows of the <code>query</code>{" "}
            but these). With <code>autoResetSelectedRows</code> only the rows
            the action got are deselected - rows picked while it ran stay
            selected. A refetch keeps the selected rows that are still there; a
            row selected on its own leaves the selection with its page. A group
            action whose button has the focus keeps it when the action drops the
            selection, and "Clear selection" - or an action removing every row -
            gives it to the "select all" checkbox.
          </p>
        }
        name="data-table/selection"
        title="Selection and group actions"
      />
      <Example
        collapsed
        description={
          <p>
            <code>renderSubRow</code> makes rows expandable,{" "}
            <code>getRowBackgroundColor</code> / <code>getRowClassName</code>{" "}
            style rows, and a <code>custom</code> filter renders any field -
            client-side it is matched by the column's <code>filterFn</code>.
          </p>
        }
        name="data-table/expandable"
        title="Expandable rows, row colors and a custom filter"
      />
      <Example
        collapsed
        description={
          <p>
            <code>useDataTableQuery({"{ syncWithUrl: true }"})</code> keeps the
            query in the URL through the router of <code>UIProvider</code>: a
            reload keeps the page and filters, a link can be shared and the back
            button steps through the changes. <code>urlPrefix</code> separates
            several tables of one page. Pass the table's{" "}
            <code>pageSizeOptions</code> to the hook too - a URL asking for
            another page size falls back to the default one. The query stays the
            same object while only other parameters of the URL change (another
            table&apos;s, your app&apos;s), so an effect fetching on{" "}
            <code>[query]</code> runs for a new query only.
          </p>
        }
        name="data-table/url-state"
        title="State in the URL"
      />
      <Example
        collapsed
        description={
          <p>
            Drag the edge of a column header to resize the column - also by
            touch - or focus the handle and use the arrow keys (Shift for bigger
            steps), Home and End for the limits; a double-click or Enter brings
            back the column&apos;s own <code>width</code>. <code>minWidth</code>{" "}
            / <code>maxWidth</code> limit the resizing,{" "}
            <code>resizable: false</code> turns it off for a column and{" "}
            <code>resizableColumns={"{false}"}</code> for the table.{" "}
            <code>pinned: "left"</code> or <code>"right"</code> sticks a column
            to an edge while the table scrolls sideways, and users pin and unpin
            columns in the column menu. Pinned columns stick after the
            selection, expand and actions columns and cast a shadow over the
            columns scrolled under them; on a narrow screen, where they would
            cover more than half of the table, they scroll along - a pinned
            column is resized only as far as they still stick. Widths and pins
            are remembered under <code>tableId</code> - "Reset columns" forgets
            them.
          </p>
        }
        name="data-table/column-layout"
        title="Column widths and pinning"
      />
      <Example
        collapsed
        description={
          <p>
            <code>density</code> sets the height of the rows -{" "}
            <code>compact</code>, <code>normal</code> (the default) or{" "}
            <code>comfortable</code>. Users switch it with the rows icon in the
            toolbar, and the choice is remembered under <code>tableId</code>;{" "}
            <code>densityControl={"{false}"}</code> leaves the control out.
          </p>
        }
        name="data-table/density"
        title="Row density"
      />
      <Example
        collapsed
        description={
          <p>
            The cells of <code>editable</code> columns are edited in place - all
            of them, or those of the rows a function accepts. The field follows
            the value: a text field, a number field, a select for columns with{" "}
            <code>editorOptions</code> (or a <code>select</code> filter), a date
            picker for dates and a checkbox for booleans - <code>editor</code>{" "}
            picks one, <code>renderEditor</code> builds your own.{" "}
            <code>validate</code> keeps an invalid value in the field with its
            message. <code>onCellEdit(row, columnKey, value)</code> saves the
            value: while its promise is pending the cell shows the new value
            with a spinner, and when it rejects the cell shows its old value
            with the message of the error - try a name with "error" in it, also
            after an optimistic update of <code>data</code>. The message is
            announced once and stays while the cell holds the refused value or
            the one before it - until the cell is saved again, a refetch brings
            another value (another user&apos;s change) or the rows no longer
            have its row (with server data: another page). Update{" "}
            <code>data</code> with the saved value. While a cell is edited the
            rows keep their places: sort by name and rename a person - the row
            moves once the editing ends, not while its next cell is edited.
            Another page, sorting or filter ends the editing. A field left as it
            was saves nothing - also when a refetch changed the cell meanwhile,
            so another user&apos;s change is not overwritten. A number field
            refuses text that is no number instead of emptying the cell. An
            empty cell is edited in the field the other values of its column
            need; set <code>editor</code> for a column that may be all empty.
          </p>
        }
        name="data-table/inline-editing"
        title="Inline editing"
      />
      <Callout title="Keyboard and screen readers">
        <p>
          The editable cells are one tab stop, described as editable - the cell
          edited last, or the first one in view. The arrow keys move between
          them (up and down in the column, skipping cells that cannot be
          edited), Home / End to the first / last one of the row and Ctrl + Home
          / End to the first / last one of the table. Enter or F2 - or a
          double-click, on a touch screen a tap on the focused cell - starts
          editing, Enter saves, Escape cancels, Tab saves and edits the next
          editable cell (Shift + Tab the previous one), and moving the focus
          elsewhere saves too. Enter and Escape in an open date picker are the
          picker&apos;s. Messages of validation and of failed saves are
          announced. Column resize handles are separators with their width in
          pixels: the arrow keys resize, Home / End go to the limits, Enter
          brings back the column&apos;s width. The focus moving into the
          toolbar, a sort button or a filter field does not scroll the rows, and
          another page, sorting or filter shows them from the top. Escape
          empties a text filter - in an empty one it leaves the full screen. The
          info icon of a header (<code>labelInfo</code>) is a Tab stop that
          opens its text on focus. The number of selected rows is announced.
          "Clear filters", "Reset columns", the group actions and the paging
          buttons keep the focus when pressing them leaves nothing more to do.
          Give each table of a page a name with <code>aria-label</code> (or{" "}
          <code>aria-labelledby</code>) - the region, the table and its
          pagination ("People pagination") take it, so screen readers tell them
          apart.
        </p>
      </Callout>
      <Example
        collapsed
        description={
          <p>
            <code>summary</code> adds a column to the summary row:{" "}
            <code>sum</code>, <code>avg</code>, <code>min</code> and{" "}
            <code>max</code> of the numbers (<code>min</code> / <code>max</code>{" "}
            also of dates - <code>Date</code>s or ISO texts like{" "}
            <code>2026-09-24</code>, shown as the cells show them),{" "}
            <code>count</code> of the rows, or a function of the rows rendering
            anything. A <code>clientSide</code> table sums up all rows matching
            the filters, not just the page. With server data pass the
            server&apos;s values in <code>summaryValues</code>, as the{" "}
            <Link to="/guides/data-fetching">REST &amp; GraphQL</Link> tables do
            - without them the loaded rows are summed up. Numbers and dates are
            written by the locale, and the row sticks to the bottom of a table
            that scrolls.
          </p>
        }
        name="data-table/summary"
        title="Summary row"
      />
      <Example
        collapsed
        description={
          <p>
            <code>enableCsvExport</code> adds a download button to the toolbar.
            It exports every page of what the user sees: the rows matching the
            filters in their order, the visible columns in theirs, the values as
            the cells show them without a <code>render</code> - dates and
            booleans by the locale; <code>exportValue</code> gives a column
            another value, e.g. the text of a chip. The file is UTF-8 with a BOM
            and separated by <code>;</code> for languages writing a decimal
            comma, so that a Czech Excel opens it in columns, and by{" "}
            <code>,</code> otherwise (<code>csvSeparator</code>). Texts with
            either separator are quoted, and a text a spreadsheet would take for
            a formula (also after spaces) gets a leading <code>&apos;</code>.
            With server data <code>onExport(query)</code> returns all rows of
            the query (see the REST &amp; GraphQL tables) - the button shows a
            spinner meanwhile. <code>createCsv</code> and{" "}
            <code>downloadCsv</code> export rows of your choice - here the
            selected ones.
          </p>
        }
        name="data-table/csv-export"
        title="CSV export"
      />
      <Example
        collapsed
        description={
          <p>
            <code>virtualized</code> renders only the rows in view of the
            scrolling table (<code>maxHeight</code>) and some above and below
            them - here 10 000 rows without pagination. Rows are measured, so
            expanded details may have any height; the header and the summary row
            stick, selection, sorting, the filters and the search cover all
            rows, the row with the focus stays rendered while it is scrolled
            away, and screen readers learn the number and position of the rows (
            <code>aria-rowcount</code>, <code>aria-rowindex</code>). The columns
            take their widths from the rows shown first and keep them while the
            table scrolls - resize a column whose values do not fit. Another
            density or a resized column measures the rows again. Rows above the
            view taking another room than estimated - measured again, or for the
            first time as you scroll up - leave the first row under the header
            (or detail) where it is, and Tab in an edited cell reaches the next
            editable cell however far down it is.
          </p>
        }
        name="data-table/virtualized"
        title="10 000 rows"
      />

      <Section title="Server-side data">
        <CodeBlock code={serverSide} />
        <Callout title="Pagination modes">
          <p>
            With <code>pageInfo</code> the table pages by cursors (the next page
            is requested with <code>after</code>, the previous one with{" "}
            <code>before</code>). Without it, it pages by numbers and needs{" "}
            <code>total</code> to know where the last page is. An offset API
            without a total can pass{" "}
            <code>
              {
                "pageInfo={{ hasNextPage: rows.length === pageSize, hasPreviousPage: page > 1 }}"
              }
            </code>
            . Pass <code>loading</code> while a page loads: the pagination waits
            for it (and in cursor mode for the new <code>pageInfo</code>
            ), so a quick second click does not page from the old cursors. End
            it when a request fails too - the tables on the{" "}
            <Link to="/guides/data-fetching">REST &amp; GraphQL</Link> page show
            the error with a retry.
          </p>
        </Callout>
      </Section>

      <Section title="Dates and server rendering">
        <Prose>
          <p>
            A <code>Date</code> is shown in the time zone of whatever renders it
            - with server rendering first the server&apos;s, then the
            browser&apos;s. In different zones the texts differ (another day
            near midnight, another hour), React reports a hydration mismatch and
            renders the browser&apos;s text. So:
          </p>
          <ul>
            <li>
              A day - a birthday, a due date: build the <code>Date</code> from
              its parts on both sides (
              <code>new Date(year, month - 1, day)</code>, as the examples do in{" "}
              <code>getValue</code>), which is that day in every zone - or keep
              the ISO text <code>2026-09-24</code>, shown, filtered and sorted
              as it is. <code>new Date("2026-09-24")</code> is midnight in UTC,
              the day before west of Greenwich.
            </li>
            <li>
              A moment - a date-time with a zone: render it yourself in a fixed
              zone (<code>render</code> with{" "}
              <code>toLocaleString(…, {"{ timeZone }"})</code>) when the server
              renders the table, or render the table in the browser only. The
              date filters of a <code>clientSide</code> table read ISO texts
              with a zone in the local time too.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Filters the user can see">
        <Prose>
          <p>
            Rows must not go missing, or come in an order, because of a filter
            or a sorting the user cannot see:
          </p>
          <ul>
            <li>
              Hiding a column in the column settings clears the filter of its
              field.
            </li>
            <li>
              A filter of a column that is hidden anyway - from the URL,{" "}
              <code>defaultQuery</code> or the saved settings - is cleared by
              "Clear filters", which then shows even without a visible filter
              field.
            </li>
            <li>
              Without <code>enableGlobalSearch</code> a <code>clientSide</code>{" "}
              table ignores <code>query.search</code>. A server applies it all
              the same, so "Clear filters" clears it there.
            </li>
            <li>
              A <code>sortBy</code> of a column that is not{" "}
              <code>sortable</code> or hidden (a hand-edited URL) sorts nothing
              client-side and marks no header; hiding the sorted column in the
              column settings drops the sorting.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="The query">
        <CodeBlock code={queryShape} />
        <Prose>
          <p>Helpers exported next to the table:</p>
          <ul>
            <li>
              <code>toOffsetParams(query)</code> -{" "}
              <code>
                {
                  "{ page, pageSize, offset, limit, sortBy, order, search, filters }"
                }
              </code>
            </li>
            <li>
              <code>toRelayVariables(query)</code> -{" "}
              <code>{"{ first, after }"}</code> or{" "}
              <code>{"{ last, before }"}</code> plus sorting, search and filters
            </li>
            <li>
              <code>applyDataTableQuery(rows, query, columns)</code> - what{" "}
              <code>clientSide</code> does, usable on its own (also on a Node
              server)
            </li>
            <li>
              <code>readQueryFromSearch()</code> /{" "}
              <code>writeQueryToSearch()</code> - the URL format of{" "}
              <code>syncWithUrl</code>
            </li>
            <li>
              <code>createDataTableQuery(overrides)</code> - a complete query
              with defaults
            </li>
            <li>
              <code>setFilter(query, key, value)</code>,{" "}
              <code>toggleSort(query, key)</code> and{" "}
              <code>resetPagination(query, changes)</code> - the changes the
              table makes, for filters and sorting of your own outside it
            </li>
            <li>
              <code>createCsv(rows, columns, {"{ locale }"})</code> and{" "}
              <code>downloadCsv(csv, filename)</code> - the CSV export, for rows
              of your choice; <code>getCsvSeparator(localeCode)</code> - the
              separator a spreadsheet of the language expects
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="DataTable" />
        <PropsTable of="Column" />
        <PropsTable
          of="CellEditorProps"
          title="CellEditorProps (renderEditor)"
        />
        <PropsTable of="GroupAction" />
        <PropsTable of="GroupActionSelection" />
        <PropsTable of="FilteredSelectionConfig" />
        <PropsTable of="CsvOptions" title="createCsv options" />
        <PropsTable
          of="UseDataTableQueryOptions"
          title="useDataTableQuery options"
        />
      </Section>
    </DocPage>
  );
}
