import { useEffect, useState } from "react";
import {
  applyDataTableQuery,
  createDataTableQuery,
  DataTable,
  Switch,
  type DataTableQuery,
} from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

const columns = personColumns.slice(0, 5);

// A server that fails while the switch is on - the table shows the error in
// place of the rows. The filters, the sorting and the pagination stay
// usable; "Try again" loads the same query once more.
export default function LoadError() {
  const [query, setQuery] = useState<DataTableQuery>(() =>
    createDataTableQuery({ pageSize: 5 }),
  );
  const [failing, setFailing] = useState(true);
  // Counts the retries - each one is another request
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    error: boolean;
    key: string;
    rows: Person[];
    total: number;
  }>();

  const key = JSON.stringify([query, attempt]);

  useEffect(() => {
    // e.g. fetch(`/api/people?${params}`) - rejected by an outage
    const timer = setTimeout(() => {
      const page = applyDataTableQuery(people, query, columns);
      setResult({
        error: failing,
        key,
        rows: failing ? [] : page.rows,
        total: page.total,
      });
    }, 600);
    return () => clearTimeout(timer);
    // `key` stands for the query and the attempt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="space-y-3">
      <Switch
        checked={failing}
        label="The server is down"
        onChange={({ target }) => setFailing(target.checked)}
      />
      <DataTable
        aria-label="People from a server"
        columns={columns}
        data={result?.rows ?? []}
        error={
          result?.error &&
          "The server did not answer. Check your connection and try again."
        }
        loading={result?.key !== key}
        maxHeight="360px"
        onQueryChange={setQuery}
        onRetry={() => setAttempt((count) => count + 1)}
        query={query}
        total={result?.total ?? 0}
      />
    </div>
  );
}
