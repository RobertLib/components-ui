import { useEffect, useState } from "react";
import {
  DataTable,
  toOffsetParams,
  useDataTableQuery,
  type DataTableQuery,
} from "components-ui";
import type { Person } from "../../mocks/data";
import { personColumns } from "../data-table/columns";

interface PeoplePage {
  items: Person[];
  total: number;
}

// GET /api/people?page=1&pageSize=10&sortBy=name&order=asc&q=…&department=…
async function fetchPeople(query: DataTableQuery, signal: AbortSignal) {
  const { filters, order, page, pageSize, search, sortBy } =
    toOffsetParams(query);
  const params = new URLSearchParams({
    ...filters,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) params.set("q", search);
  if (sortBy && order) {
    params.set("sortBy", sortBy);
    params.set("order", order);
  }

  const response = await fetch(`/api/people?${params}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as PeoplePage;
}

export default function RestTable() {
  const [query, setQuery] = useDataTableQuery({ defaults: { pageSize: 10 } });
  const [result, setResult] = useState<{ key: string; page: PeoplePage }>();

  // A new request whenever the query changes; the previous one is aborted
  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    fetchPeople(query, controller.signal)
      .then((page) => setResult({ key, page }))
      .catch(() => {});
    return () => controller.abort();
    // `key` stands for the query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <DataTable
      columns={personColumns}
      data={result?.page.items ?? []}
      enableGlobalSearch
      loading={result?.key !== key}
      maxHeight="480px"
      onQueryChange={setQuery}
      query={query}
      total={result?.page.total}
    />
  );
}
