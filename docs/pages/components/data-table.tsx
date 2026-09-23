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
            or right, all remembered under <code>tableId</code>. Text matches
            ignore case and diacritics and are highlighted; dates and booleans
            without a <code>render</code> show by the locale (
            <code>24.09.2026</code>, "Yes").
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
            action then gets <code>allFiltered: true</code> and should act on
            the query rather than on the loaded rows. With{" "}
            <code>autoResetSelectedRows</code> only the rows the action got are
            deselected - rows picked while it ran stay selected.
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
            another page size falls back to the default one.
          </p>
        }
        name="data-table/url-state"
        title="State in the URL"
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
            ), so a quick second click does not page from the old cursors.
          </p>
        </Callout>
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
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="DataTable" />
        <PropsTable of="Column" />
        <PropsTable of="GroupAction" />
        <PropsTable of="FilteredSelectionConfig" />
        <PropsTable
          of="UseDataTableQueryOptions"
          title="useDataTableQuery options"
        />
      </Section>
    </DocPage>
  );
}
