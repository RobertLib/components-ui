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
  sort: { key: string; order: "asc" | "desc" }[]; // the first column first
  sortBy: string | null;            // the key of sort[0]
  order: "asc" | "desc";            // the order of sort[0]
  search: string;                   // the global search field
  filters: Record<string, DataTableFilterValue>; // by column key
  after: string | null;             // cursor pagination
  before: string | null;
}

// A text: contains (input), equals (select), that day (date) - "2026-09-24"
// A list: any of them (multiSelect)                  - ["active", "invited"]
// A range: between, both included, either side open  - { from: "1000", to: "5000" }
type DataTableFilterValue = string | string[] | { from?: string; to?: string };`;

const restFilters = `const { filters, sort } = toOffsetParams(query);
const params = new URLSearchParams(toFilterParams(filters));
// status=active&status=invited&salary[from]=1000&salary[to]=5000
if (sort.length) {
  params.set("sort", sort.map((s) => (s.order === "desc" ? "-" : "") + s.key).join(","));
}
// sort=department,-salary`;

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
            <code>"-3.50"</code>) sort by their value. Mixed types sort in
            groups: numbers (including numeric strings and bigints),{" "}
            <code>Date</code>s, booleans, then other text in ascending order;
            descending reverses that order. Empty values stay last in both
            directions. The full screen button covers the page - Escape or the
            button leave it, and Tab stays in the table meanwhile.
          </p>
        }
        name="data-table/client-side"
        title="All rows in the browser"
      />
      <Example
        collapsed
        description={
          <p>
            Besides a text (<code>input</code>), an option (<code>select</code>)
            and a day (<code>date</code>), a filter can be a list or a range:{" "}
            <code>multiSelect</code> picks several of the{" "}
            <code>filterSelectOptions</code> in a panel of checkboxes - the
            value is a list, <code>{'["active", "invited"]'}</code>, and a row
            matches any of them. <code>numberRange</code> has two number fields,
            from and to, and <code>dateRange</code> a date range picker - the
            value is a range, <code>{'{ from: "50000", to: "80000" }'}</code>,
            both bounds included and either one left out for &quot;at
            least&quot; / &quot;at most&quot;; a <code>to</code> day includes
            the whole day. The number fields wait for typing to pause, like the
            text filter, and &quot;Clear filters&quot; empties them. The values
            go into the URL, the REST and GraphQL helpers and{" "}
            <code>applyDataTableQuery</code> as they are - a text filter of an
            older URL still reads. A <code>custom</code> filter may set any of
            them (<code>handleFilterChange(key, value)</code>) and gets the
            value as its third argument, a <code>filterFn</code> too.
          </p>
        }
        name="data-table/filters"
        title="Filters: lists and ranges"
      />
      <Example
        collapsed
        description={
          <p>
            A click on a sortable header sorts by that column alone; Shift +
            click - Shift + Enter or Shift + Space on its button - adds it to
            the sorting, turns it and takes it out again. Rows equal in the
            first column are sorted by the next one, rows equal in all of them
            keep their order. While several columns sort, their headers show
            their places, which screen readers hear with the button
            (&quot;sorted 2 of 2, descending&quot;); <code>aria-sort</code> is
            on the first one only. The query has them in <code>sort</code> -{" "}
            <code>sortBy</code> / <code>order</code> stay the first of them, so
            code knowing only those keeps working - and the URL in{" "}
            <code>sort=department,-salary</code> (one column still as{" "}
            <code>sortBy</code> / <code>order</code>). <code>multiSort</code> is
            on for a <code>clientSide</code> table; turn it on for a server that
            reads <code>query.sort</code>, as the REST table on{" "}
            <Link to="/guides/data-fetching">REST &amp; GraphQL</Link> does.
          </p>
        }
        name="data-table/multi-sort"
        title="Sorting by several columns"
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
            the action got and that stayed selected are deselected - rows picked
            or picked again while it ran stay selected, including after a parent
            reset or a refetch that removed them. A selection made after
            changing filters is kept when an older action finishes, even after
            returning to the original filters. A refetch keeps the selected rows
            that are still there; a row selected on its own leaves the selection
            with its page. A group action whose button has the focus keeps it
            when the action drops the selection, and "Clear selection" - or an
            action removing every row - gives it to the "select all" checkbox.
          </p>
        }
        name="data-table/selection"
        title="Selection and group actions"
      />
      <Example
        collapsed
        description={
          <p>
            <code>selectionMode</code> gives the rows checkboxes without group
            actions - <code>multiple</code> (the default with{" "}
            <code>groupActions</code> or a selection prop) or{" "}
            <code>single</code>, where checking a row unchecks the other one.
            Shift + click on a checkbox - or Shift + Space - selects the rows
            from the one checked before in the order they are shown, or unchecks
            them. <code>selectedIds</code> with{" "}
            <code>onSelectedIdsChange(ids, selection)</code> controls the
            selection; a controlled selection stays as it is given - also for
            rows of other pages or filtered out, which an uncontrolled one (
            <code>defaultSelectedIds</code>) drops - so clear it yourself when
            the rows change. With <code>filteredSelection</code>, &quot;select
            all N rows&quot; reports the loaded matching rows with{" "}
            <code>selection.allFiltered</code> (and the rows unchecked since as{" "}
            <code>excludedRows</code>); a <code>selectedIds</code> of other ids
            ends it. Group actions get all the ids as <code>selection.ids</code>
            . The number of selected rows is announced.
          </p>
        }
        name="data-table/controlled-selection"
        title="Controlled selection, one row or a range"
      />
      <Example
        collapsed
        description={
          <p>
            <code>getRowHref(row)</code> makes each row open a page: its first
            column shows its content as a link (<code>useRouter().Link</code>,
            so Tab, Enter, middle and Ctrl + click work as on any link), and a
            click anywhere else on the row follows it too - Ctrl, Cmd or Shift +
            click and the middle button open it in a new tab. Keep controls out
            of the first column - a link cannot hold them.
          </p>
        }
        name="data-table/row-links"
        title="Row links"
      />
      <Example
        collapsed
        description={
          <p>
            <code>onRowClick(row, event)</code> is called for a click on a row -
            not on a control in it (a button, a checkbox, a link, an editable
            cell, the cells of the checkboxes, the expand buttons and the
            actions), nor at the end of selecting text. Without{" "}
            <code>getRowHref</code> the rows are one Tab stop: the arrow keys
            move between them, Home / End to the first / last one, and Enter
            calls <code>onRowClick</code> with the keyboard event. With{" "}
            <code>getRowHref</code> it is called before the link is followed -{" "}
            <code>event.preventDefault()</code> stays on the page.
          </p>
        }
        name="data-table/row-click"
        title="Row clicks"
      />
      <Example
        collapsed
        description={
          <p>
            <code>renderSubRow</code> makes rows expandable,{" "}
            <code>getRowBackgroundColor</code> / <code>getRowClassName</code>{" "}
            style rows, and a <code>custom</code> filter renders any field -
            client-side it is matched by the column's <code>filterFn</code>.{" "}
            <code>emptyMessage</code> takes any content - here an{" "}
            <code>EmptyState</code>.
          </p>
        }
        name="data-table/expandable"
        title="Expandable rows, row colors and a custom filter"
      />
      <Example
        collapsed
        description={
          <p>
            <code>{'groupBy="department"'}</code> groups the rows of a table by
            a column: each group has a header row with its value and number of
            rows - a button that collapses and expands it (
            <code>aria-expanded</code>) - and, when a column has a{" "}
            <code>summary</code>, a row of it over all rows of the group. The
            groups follow the order of the value - the direction of its column
            when that is sorted, an empty value last - and the sorting orders
            the rows within them. The rows of a group come together on the
            pages: a group may go on on the next page, its number counts all its
            rows. Grouping works with <code>virtualized</code>, including
            headers and summary rows.
          </p>
        }
        name="data-table/row-grouping"
        title="Grouped rows"
      />
      <Example
        collapsed
        name="data-table/nested-grouping"
        title="Nested virtualized groups"
        description={
          <p>
            A <code>groupBy</code> array groups at successive levels. Each
            parent retains its full count and summary; collapsing it hides its
            descendants. Use <code>collapsedGroupKeys</code> and{" "}
            <code>onCollapsedGroupKeysChange</code> to control collapse state,
            with <code>getDataTableGroupKey</code> for stable path keys.
          </p>
        }
      />
      <Example
        collapsed
        name="data-table/server-grouping"
        title="Server group metadata"
        description={
          <p>
            Without <code>clientSide</code>, only loaded rows are grouped. Pass{" "}
            <code>groupMetadata</code> keyed by{" "}
            <code>getDataTableGroupKey([groupValue, ...nestedValues])</code> to
            supply full server counts and summary values. Filtering, sorting and
            pagination remain server operations; the server should page
            consistently within its grouping order.
          </p>
        }
      />
      <Example
        collapsed
        description={
          <p>
            An entry of <code>columns</code> with <code>children</code> (
            <code>ColumnGroup</code>) puts its columns under a common header - a
            row above theirs, the group header spanning them (
            <code>scope=&quot;colgroup&quot;</code>). The columns are reordered
            within their group - by dragging or from the column settings, which
            list them under the group&apos;s name; a column of no group steps
            over a group as a whole. Pinned, a column takes its part of the
            group header along - a group split by pinning shows its header over
            each part. Hidden columns leave it; a group with no visible column
            has no header.
          </p>
        }
        name="data-table/column-groups"
        title="Column groups"
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
            them. In a right-to-left page <code>"left"</code> is the start of a
            row - the right edge - and <code>"right"</code> its end: the
            offsets, the shadows, the resize handles and the names of the pin
            buttons follow the direction.
          </p>
        }
        name="data-table/column-layout"
        title="Column widths and pinning"
      />
      <Example
        collapsed
        description={
          <p>
            The column settings - order, visibility, pinning and widths - are a
            value too, <code>DataTableColumnState</code>: only what differs from
            the column definitions, so a column added or changed later follows
            its definition. <code>onColumnStateChange</code> reports every
            change (also of an uncontrolled table), so you can store it on a
            server per user; <code>columnState</code> controls it and{" "}
            <code>defaultColumnState</code> starts an uncontrolled table with it
            - with <code>tableId</code> while nothing is saved under it. With{" "}
            <code>columnState</code>, <code>tableId</code> keeps only the row
            density. &quot;Reset columns&quot; brings back the definitions.
          </p>
        }
        name="data-table/column-state"
        title="Column settings as a value"
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
            <code>data</code> with the saved value. If the server normalizes the
            value, also return <code>{"{ value: savedValue }"}</code> from
            <code> onCellEdit</code>: the confirmed value takes precedence until
            the next replacement of its row in <code>data</code>. This also
            handles normalization back to the original value, which cannot be
            distinguished from a poll still holding old data. The demo trims
            spaces around names when saving. While a cell is edited the rows
            keep their places: sort by name and rename a person - the row moves
            once the editing ends, not while its next cell is edited. Another
            page, sorting or filter ends the editing. A field left as it was
            saves nothing - also when a refetch changed the cell meanwhile, so
            another user&apos;s change is not overwritten. A number field
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
          / End to the first / last one of the table; laid out right to left (
          <code>dir=&quot;rtl&quot;</code>), ArrowLeft goes to the next column.
          Enter or F2 - or a double-click, on a touch screen a tap on the
          focused cell - starts editing, Enter saves, Escape cancels, Tab saves
          and edits the next editable cell (Shift + Tab the previous one), and
          moving the focus elsewhere saves too. Enter and Escape in an open date
          picker are the picker&apos;s. Messages of validation and of failed
          saves are announced. Column resize handles are separators with their
          width in pixels: the arrow keys resize, Home / End go to the limits,
          Enter brings back the column&apos;s width. The focus moving into the
          toolbar, a sort button or a filter field does not scroll the rows, and
          another page, sorting or filter shows them from the top. Escape
          empties a text filter - in an empty one it leaves the full screen. The
          info icon of a header (<code>labelInfo</code>) is a Tab stop that
          opens its text on focus. Shift + Enter on a sort button adds its
          column to the sorting (<code>multiSort</code>); rows of{" "}
          <code>onRowClick</code> without links are one Tab stop with the arrow
          keys and Enter, and Shift + Space on a checkbox selects a range. The
          number of selected rows is announced. "Clear filters", "Reset
          columns", the group actions and the paging buttons keep the focus when
          pressing them leaves nothing more to do. Give each table of a page a
          name with <code>aria-label</code> (or <code>aria-labelledby</code>) -
          the region, the table and its pagination ("People pagination") take
          it, so screen readers tell them apart.
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
            booleans by the locale, numbers with its decimal separator - also
            plain decimal texts (<code>&quot;1234.50&quot;</code>) of a column
            with a <code>numberRange</code> filter, a <code>number</code> editor
            or a <code>sum</code> / <code>avg</code> summary, while other texts
            (<code>&quot;007&quot;</code>, phone numbers) stay as they are;{" "}
            <code>exportValue</code> gives a column another value, e.g. the text
            of a chip. The file is UTF-8 with a BOM and separated by{" "}
            <code>;</code> for languages writing a decimal comma, so that a
            Czech Excel opens it in columns, and by <code>,</code> otherwise (
            <code>csvSeparator</code>). Texts with either separator are quoted,
            and a text a spreadsheet would take for a formula (also after
            spaces) gets a leading <code>&apos;</code>. With server data{" "}
            <code>onExport(query)</code> returns all rows of the query (see the
            REST &amp; GraphQL tables) - the button shows a spinner meanwhile.{" "}
            <code>createCsv</code> and <code>downloadCsv</code> export rows of
            your choice - here the selected ones.
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
        <Prose>
          <p>
            Lists and ranges of the filters and several sorted columns go to a
            REST API as parameters of your choice - <code>toFilterParams</code>{" "}
            writes the filters as <code>qs</code> and most frameworks read them
            back (<code>{'{ prefix: "filter" }'}</code> puts them under{" "}
            <code>filter[…]</code>):
          </p>
        </Prose>
        <CodeBlock code={restFilters} />
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
              with a zone in the local time too, and its sorting orders them by
              their moment, with the dates.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Columns on narrow screens">
        <Prose>
          <p>
            A column with <code>hideBelow</code> - <code>sm</code>,{" "}
            <code>md</code>, <code>lg</code> or <code>xl</code> - is hidden on
            screens narrower than that breakpoint: its header, its filter, its
            cells and its summary. A phone shows the name and the status of a
            member, a computer their birth date and their last exam too. The
            column stays in the column settings and in the CSV export. Some
            columns keep their place anyway: a pinned one - its neighbors are
            placed by its width - a column of a column group, whose header spans
            it, an <code>editable</code> one (with <code>onCellEdit</code>),
            whose cells the keyboard moves between, and the first column of a
            table with <code>getRowHref</code>, which holds the links of the
            rows - also when the user moves a column there.
          </p>
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
              A <code>sortBy</code> or a column of <code>sort</code> that is not{" "}
              <code>sortable</code> or hidden (a hand-edited URL) sorts nothing
              client-side and marks no header; a click on a header sorts by the
              columns the headers show and drops it, and so does hiding a sorted
              column in the column settings.
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
                  "{ page, pageSize, offset, limit, sort, sortBy, order, search, filters }"
                }
              </code>
            </li>
            <li>
              <code>toRelayVariables(query)</code> -{" "}
              <code>{"{ first, after }"}</code> or{" "}
              <code>{"{ last, before }"}</code> plus sorting (<code>sort</code>{" "}
              and its first column as <code>sortBy</code> / <code>order</code>),
              search and filters
            </li>
            <li>
              <code>toFilterParams(filters, {"{ prefix }"})</code> - the filters
              as URL parameters: a text under its key, each item of a list, the
              bounds of a range as <code>key[from]</code> / <code>key[to]</code>
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
              <code>setFilter(query, key, value)</code> (a text, a list or a
              range - an empty one removes the filter),{" "}
              <code>toggleSort(query, key, {"{ multi }"})</code> and{" "}
              <code>resetPagination(query, changes)</code> - the changes the
              table makes, for filters and sorting of your own outside it.
              Change the sorting with them, or set <code>sortBy</code> /{" "}
              <code>order</code> alone: a <code>sort</code> that disagrees with
              them is taken for one of older code and replaced by them.
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

      <Example
        name="data-table/extended-api"
        title="Custom identities, sorting and row permissions"
        description={
          <p>
            <code>getRowId</code> supplies stable string or number identities
            for rows without <code>id</code>. Keep identities unique and stable
            across refreshes. <code>isRowSelectable</code> disables selection of
            ineligible rows, including select-all, Shift ranges and action
            payloads. With server data, selecting all filtered rows also
            requires <code>filteredSelection.total</code> to count eligible
            records. <code>Column.sortFn</code> compares complete rows for
            client sorting; the table applies ascending/descending direction.
            This example sorts names by priority. <code>expandedIds</code> and{" "}
            <code>onExpandedIdsChange</code> control details;{" "}
            <code>defaultExpandedIds</code> initializes an uncontrolled set. A
            row renders again only when what it shows changes - without the
            React Compiler, keep <code>columns</code>, <code>getRowId</code>,{" "}
            <code>renderSubRow</code>, <code>actions</code>,{" "}
            <code>getRowClassName</code> and <code>getRowBackgroundColor</code>{" "}
            the same between renders (outside the component,{" "}
            <code>useMemo</code>, <code>useCallback</code>), or every row
            renders again with the table. <code>onRowClick</code> and the other
            handlers may be inline.
          </p>
        }
      />
      <Prose>
        <p>
          A failed CSV fetch, serialization or download shows a localized alert
          and calls <code>onExportError(error)</code>. The export button becomes
          available for a retry; starting another export clears the previous
          error.
        </p>
      </Prose>
      <Section title="Props">
        <PropsTable of="DataTable" />
        <PropsTable of="DataTableGroupMetadata" />
        <PropsTable of="Column" />
        <PropsTable of="ColumnGroup" />
        <PropsTable of="DataTableColumnState" />
        <PropsTable of="DataTableRangeFilter" />
        <PropsTable of="DataTableSort" />
        <PropsTable
          of="CellEditorProps"
          title="CellEditorProps (renderEditor)"
        />
        <PropsTable of="GroupAction" />
        <PropsTable
          of="GroupActionSelection"
          title="GroupActionSelection (also of onSelectedIdsChange)"
        />
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
