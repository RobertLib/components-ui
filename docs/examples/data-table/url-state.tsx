import { DataTable, useDataTableQuery } from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

// The query lives in the URL - page, sort a column or filter and look at
// the address bar, then reload the page or use the back button
// The URL may ask only for these - pass them to the hook and the table
const pageSizeOptions = [5, 10, 25];

export default function UrlState() {
  const [query, setQuery] = useDataTableQuery({
    defaults: { pageSize: 5 },
    pageSizeOptions,
    syncWithUrl: true,
    urlPrefix: "people_",
  });

  return (
    <div className="space-y-3">
      <DataTable
        clientSide
        columns={personColumns.slice(0, 4)}
        data={people}
        maxHeight="420px"
        onQueryChange={setQuery}
        pageSizeOptions={pageSizeOptions}
        query={query}
      />
      <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify(query, null, 2)}
      </pre>
    </div>
  );
}
