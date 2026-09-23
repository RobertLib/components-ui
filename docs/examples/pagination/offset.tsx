import { useState } from "react";
import { Pagination } from "components-ui";

const TOTAL = 137;
const PAGE_SIZE = 20;

// Offset pagination (typical REST): the buttons follow page, pageSize and total
export default function Offset() {
  const [page, setPage] = useState(1);
  const lastPage = Math.ceil(TOTAL / PAGE_SIZE);

  return (
    <Pagination
      currentPage={page}
      onChange={(direction) =>
        setPage(
          direction === "first"
            ? 1
            : direction === "prev"
              ? page - 1
              : direction === "next"
                ? page + 1
                : lastPage,
        )
      }
      pageSize={PAGE_SIZE}
      total={TOTAL}
    />
  );
}
