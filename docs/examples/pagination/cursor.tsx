import { useState } from "react";
import { Pagination, type PageInfo } from "components-ui";

// Cursor pagination (GraphQL / Relay): pass the connection's pageInfo -
// onChange gets the cursor to continue from (`after` / `before`)
export default function Cursor() {
  const [page, setPage] = useState(1);
  const [lastRequest, setLastRequest] = useState("first: 20");

  const pageInfo: PageInfo = {
    endCursor: `cursor-${page * 20}`,
    hasNextPage: page < 4,
    hasPreviousPage: page > 1,
    startCursor: `cursor-${page * 20 - 19}`,
  };

  return (
    <div className="space-y-3">
      <Pagination
        currentPage={page}
        onChange={(direction, cursor) => {
          if (direction === "next") {
            setPage(page + 1);
            setLastRequest(`first: 20, after: "${cursor}"`);
          } else if (direction === "prev") {
            setPage(page - 1);
            setLastRequest(`last: 20, before: "${cursor}"`);
          } else {
            setPage(1);
            setLastRequest("first: 20");
          }
        }}
        pageInfo={pageInfo}
        pageSize={20}
        total={80}
      />
      <p className="text-sm">
        Next request: <code>{`people(${lastRequest})`}</code>
      </p>
    </div>
  );
}
