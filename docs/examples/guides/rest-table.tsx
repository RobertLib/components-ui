import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  toOffsetParams,
  useDataTableQuery,
  type DataTableQuery,
} from "components-ui";
import type { Person } from "../../mocks/data";
import { personColumns } from "../data-table/columns";

interface PeoplePage {
  items: Person[];
  /** Totals of all matching rows, computed by the server. */
  summary: { salary: number };
  total: number;
}

// The summary row shows the server's total of the salaries
const columns = personColumns.map((column) =>
  column.key === "salary" ? { ...column, summary: "sum" as const } : column,
);

// GET /api/people?page=1&pageSize=10&sortBy=name&order=asc&q=…&department=…
async function fetchPeople(query: DataTableQuery, signal?: AbortSignal) {
  const { filters, order, page, pageSize, search, sortBy } =
    toOffsetParams(query);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) params.set("q", search);
  if (sortBy && order) {
    params.set("sortBy", sortBy);
    params.set("order", order);
  }
  // The column filters under their keys - a column keyed like one of the
  // parameters above must not replace it (an API reading `filter[key]`
  // keeps them apart for good)
  for (const [key, value] of Object.entries(filters)) {
    if (!params.has(key)) params.set(key, value);
  }

  const response = await fetch(`/api/people?${params}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as PeoplePage;
}

// The CSV export - every row of the query, not just the page: page after
// page, as many as there are
async function fetchAllPeople(query: DataTableQuery) {
  const all: Person[] = [];

  for (let page = 1; ; page++) {
    const { items, total } = await fetchPeople({
      ...query,
      page,
      pageSize: 1000,
    });
    all.push(...items);
    if (items.length === 0 || all.length >= total) return all;
  }
}

export default function RestTable() {
  const [query, setQuery] = useDataTableQuery({ defaults: { pageSize: 10 } });
  // The response to a query - its page, or why there is none
  const [result, setResult] = useState<{
    error?: string;
    key: string;
    page?: PeoplePage;
  }>();
  const [attempt, setAttempt] = useState(0);

  // A new request whenever the query changes (or on "Try again"); the
  // previous one is aborted
  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    const requested = JSON.stringify(query);

    fetchPeople(query, controller.signal)
      .then((page) => setResult({ key: requested, page }))
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
        columns={columns}
        data={result?.page?.items ?? []}
        emptyMessage={result?.error ? "Nothing loaded" : undefined}
        enableGlobalSearch
        exportFilename="people"
        loading={result?.key !== key}
        maxHeight="480px"
        onExport={fetchAllPeople}
        onQueryChange={setQuery}
        query={query}
        summaryValues={result?.page?.summary}
        total={result?.page?.total}
      />
    </div>
  );
}
