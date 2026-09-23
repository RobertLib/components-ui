import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";
import RequestLog from "../../components/request-log";

const autocompleteRest = `// GET /api/users?q=ann&page=2&per_page=50  ->  { data: [...], meta: { total } }
<Autocomplete
  loadOptions={async ({ search, page, pageSize, signal }) => {
    const response = await fetch(
      \`/api/users?q=\${search}&page=\${page}&per_page=\${pageSize}\`,
      { signal },
    );
    const body = await response.json();
    return { items: body.data, total: body.meta.total };
  }}
/>`;

const autocompleteGraphQL = `// users(search: $search, first: $first, after: $after) { nodes, pageInfo }
<Autocomplete
  loadOptions={async ({ search, first, after, signal }) => {
    const { data } = await client.query({
      query: USERS,
      variables: { search, first, after },
      context: { fetchOptions: { signal } },
    });
    return data.users; // the connection as it is
  }}
/>`;

const apolloTable = `import { useQuery } from "@apollo/client";
import { DataTable, toRelayVariables, useDataTableQuery } from "components-ui";

function PeopleTable() {
  const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });
  const { data, previousData, loading } = useQuery(PEOPLE, {
    variables: toRelayVariables(query),
  });
  // Keep showing the previous page while the next one loads
  const people = (data ?? previousData)?.people;

  return (
    <DataTable
      columns={columns}
      data={people?.nodes ?? []}
      loading={loading}
      onQueryChange={setQuery}
      pageInfo={people?.pageInfo}
      query={query}
      total={people?.totalCount}
    />
  );
}`;

const tanstackTable = `import { keepPreviousData, useQuery } from "@tanstack/react-query";

function PeopleTable() {
  const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });
  const { data, isFetching } = useQuery({
    queryKey: ["people", query],
    queryFn: ({ signal }) => fetchPeople(query, signal), // as in the example above
    placeholderData: keepPreviousData,
  });

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      loading={isFetching}
      onQueryChange={setQuery}
      query={query}
      total={data?.total}
    />
  );
}`;

export default function DataFetchingGuide() {
  return (
    <DocPage
      description="The components never fetch anything themselves - you hand them functions and data. That is what makes them work with any backend: REST, GraphQL, or data already in the browser."
      title="REST & GraphQL"
    >
      <Section title="The idea">
        <Prose>
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>You provide</th>
                <th>It gives you</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>Autocomplete</code>
                </td>
                <td>
                  <code>loadOptions(params)</code> returning an array, a page or
                  a connection
                </td>
                <td>search term, page, offset, cursor, abort signal</td>
              </tr>
              <tr>
                <td>
                  <code>DataTable</code>
                </td>
                <td>
                  the rows of the page and <code>total</code> or{" "}
                  <code>pageInfo</code>
                </td>
                <td>
                  a <code>DataTableQuery</code> (page, sorting, filters, search,
                  cursors)
                </td>
              </tr>
              <tr>
                <td>
                  <code>FileUpload</code>
                </td>
                <td>
                  <code>upload(file, {"{ onProgress, signal }"})</code>
                </td>
                <td>the picked file</td>
              </tr>
              <tr>
                <td>
                  <code>Pagination</code>
                </td>
                <td>
                  <code>total</code> or <code>pageInfo</code>
                </td>
                <td>the direction (and the cursor) to go</td>
              </tr>
            </tbody>
          </table>
          <p>
            The examples on this page call real <code>fetch</code> code. The
            docs answer the requests with a small mock API in the browser - a
            REST endpoint <code>/api/people</code> and a GraphQL endpoint{" "}
            <code>/api/graphql</code> - and log them under each example.
          </p>
        </Prose>
      </Section>

      <Section title="Tables">
        <Example
          collapsed
          description={
            <p>
              Numbered pages: <code>toOffsetParams(query)</code> gives{" "}
              <code>page</code>, <code>pageSize</code> (also as{" "}
              <code>offset</code> / <code>limit</code>), sorting, search and
              filters; the response brings the rows and <code>total</code>.
            </p>
          }
          name="guides/rest-table"
          title="REST with offset pagination"
        />
        <RequestLog filter="/api/people" />

        <Example
          collapsed
          description={
            <p>
              A Relay connection: <code>toRelayVariables(query)</code> gives{" "}
              <code>first</code> / <code>after</code> for the next page and{" "}
              <code>last</code> / <code>before</code> for the previous one;
              passing <code>pageInfo</code> switches the table to cursor paging.
            </p>
          }
          name="guides/graphql-table"
          title="GraphQL with cursor pagination"
        />
        <RequestLog filter="/api/graphql" showBody />

        <Callout title="Keep the state in the URL">
          <p>
            Both tables would work the same with{" "}
            <code>useDataTableQuery({"{ syncWithUrl: true }"})</code> - the
            query then survives a reload and the back button (see{" "}
            <Link to="/components/data-table">DataTable</Link>).
          </p>
        </Callout>

        <h3 className="mt-8 mb-2 text-lg font-semibold">With Apollo Client</h3>
        <CodeBlock code={apolloTable} />
        <h3 className="mt-8 mb-2 text-lg font-semibold">With TanStack Query</h3>
        <CodeBlock code={tanstackTable} />
      </Section>

      <Section title="Autocomplete">
        <Prose>
          <p>
            <code>loadOptions</code> describes the requested page in the terms
            of every pagination style at once - use the ones your API has. Live
            REST and GraphQL examples are on the{" "}
            <Link to="/components/autocomplete">Autocomplete</Link> page.
          </p>
        </Prose>
        <CodeBlock code={autocompleteRest} title="Page-based REST" />
        <CodeBlock
          className="mt-4"
          code={autocompleteGraphQL}
          title="GraphQL (Apollo)"
        />
        <PropsTable of="LoadOptionsParams" />
      </Section>

      <Section title="Errors and aborted requests">
        <Prose>
          <ul>
            <li>
              Pass the <code>signal</code> to <code>fetch</code> (or your
              client): a newer search aborts the request of an older one, so a
              slow response can never overwrite a newer list.
            </li>
            <li>
              A rejected <code>loadOptions</code> is logged in development and
              reported to <code>onLoadError</code>; the list shows no results.
            </li>
            <li>
              For forms, <code>getFieldError()</code> reads validation messages
              from both REST and GraphQL errors - see{" "}
              <Link to="/guides/forms">Forms &amp; validation</Link>.
            </li>
          </ul>
        </Prose>
      </Section>
    </DocPage>
  );
}
