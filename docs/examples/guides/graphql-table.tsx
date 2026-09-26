import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  toRelayVariables,
  useDataTableQuery,
  type DataTableQuery,
  type PageInfo,
} from "components-ui";
import type { Person } from "../../mocks/data";
import { personColumns } from "../data-table/columns";

const PEOPLE = /* GraphQL */ `
  query People(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $search: String
    $sortBy: String
    $order: String
    $filters: JSON
  ) {
    people(
      first: $first
      after: $after
      last: $last
      before: $before
      search: $search
      sortBy: $sortBy
      order: $order
      filters: $filters
    ) {
      nodes {
        id
        name
        email
        department
        role
        status
        city
        createdAt
        salary
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
      salaryTotal
      totalCount
    }
  }
`;

interface PeopleConnection {
  nodes: Person[];
  pageInfo: PageInfo;
  /** The salaries of all matching people added up by the server. */
  salaryTotal: number;
  totalCount: number;
}

// The summary row shows the server's total of the salaries
const columns = personColumns.map((column) =>
  column.key === "salary" ? { ...column, summary: "sum" as const } : column,
);

async function fetchPeople(query: DataTableQuery, signal?: AbortSignal) {
  const response = await fetch("/api/graphql", {
    body: JSON.stringify({ query: PEOPLE, variables: toRelayVariables(query) }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  const { data, errors } = await response.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data.people as PeopleConnection;
}

// The CSV export - every row of the query, not just the page: the
// connection from its start, page after page (`after: endCursor`) while it
// has a next one
async function fetchAllPeople(query: DataTableQuery) {
  const all: Person[] = [];
  let after: string | null = null;

  for (;;) {
    const { nodes, pageInfo }: PeopleConnection = await fetchPeople({
      ...query,
      after,
      before: null,
      pageSize: 1000,
    });
    all.push(...nodes);
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) return all;
    after = pageInfo.endCursor;
  }
}

export default function GraphQLTable() {
  const [query, setQuery] = useDataTableQuery({ defaults: { pageSize: 10 } });
  // The response to a query - its connection, or why there is none
  const [result, setResult] = useState<{
    error?: string;
    key: string;
    people?: PeopleConnection;
  }>();
  const [attempt, setAttempt] = useState(0);

  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    const requested = JSON.stringify(query);

    fetchPeople(query, controller.signal)
      .then((people) => setResult({ key: requested, people }))
      .catch((error: unknown) => {
        // Aborted for a newer request - its own response follows
        if (controller.signal.aborted) return;
        // Ends the loading, so the table and its pagination do not wait
        // for a response that never comes
        setResult({ error: String(error), key: requested });
      });

    return () => controller.abort();
  }, [attempt, query]);

  return (
    <div className="space-y-3">
      {result?.error && (
        <Alert title="The people could not be loaded" type="danger">
          <p>{result.error}</p>
          <Button
            className="mt-2"
            onClick={() => {
              setResult(undefined);
              setAttempt((count) => count + 1);
            }}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </Alert>
      )}
      <DataTable
        aria-label="People from the GraphQL API"
        columns={columns}
        data={result?.people?.nodes ?? []}
        emptyMessage={result?.error ? "Nothing loaded" : undefined}
        exportFilename="people"
        loading={result?.key !== key}
        maxHeight="480px"
        onExport={fetchAllPeople}
        onQueryChange={setQuery}
        // Cursor pagination: next = `after: endCursor`, previous = `before: startCursor`
        pageInfo={result?.people?.pageInfo}
        query={query}
        summaryValues={result?.people && { salary: result.people.salaryTotal }}
        total={result?.people?.totalCount}
      />
    </div>
  );
}
