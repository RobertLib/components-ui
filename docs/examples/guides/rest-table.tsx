import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  toFilterParams,
  toOffsetParams,
  useDataTableQuery,
  type Column,
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

// Several departments at once, a salary range, and the summary row shows
// the server's total of the salaries
const columns = personColumns.map((column): Column<Person> => {
  if (column.key === "department") return { ...column, filter: "multiSelect" };
  if (column.key === "salary") {
    return { ...column, filter: "numberRange", summary: "sum" };
  }
  return column;
});

// GET /api/people?page=1&pageSize=10&sort=department,-salary&q=…
//   &department=Sales&department=Support&salary[from]=50000
async function fetchPeople(query: DataTableQuery, signal?: AbortSignal) {
  const { filters, page, pageSize, search, sort } = toOffsetParams(query);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) params.set("q", search);
  // Every sorted column, descending ones with a minus
  if (sort.length > 0) {
    params.set(
      "sort",
      sort
        .map(({ key, order }) => `${order === "desc" ? "-" : ""}${key}`)
        .join(","),
    );
  }
  // The column filters under their keys - each value of a list, the bounds
  // of a range as `salary[from]` / `salary[to]`. A column keyed like one of
  // the parameters above must not replace it (`toFilterParams(filters, {
  // prefix: "filter" })` keeps them apart for good).
  const taken = new Set(params.keys());
  for (const [name, value] of toFilterParams(filters)) {
    if (!taken.has(name)) params.append(name, value);
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
        aria-label="People from the REST API"
        columns={columns}
        data={result?.page?.items ?? []}
        emptyMessage={result?.error ? "Nothing loaded" : undefined}
        enableGlobalSearch
        exportFilename="people"
        loading={result?.key !== key}
        maxHeight="480px"
        // The API sorts by several columns - Shift + click on a header
        multiSort
        onExport={fetchAllPeople}
        onQueryChange={setQuery}
        query={query}
        summaryValues={result?.page?.summary}
        total={result?.page?.total}
      />
    </div>
  );
}
