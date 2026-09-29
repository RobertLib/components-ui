import { useState } from "react";
import { Pagination } from "components-ui";

const TOTAL = 1234;

export default function Pages() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  return (
    <div className="space-y-6">
      <Pagination
        currentPage={page}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSize={pageSize}
        pageSizeOptions={[10, 20, 50, 100]}
        showJumpTo
        total={TOTAL}
        variant="pages"
      />

      {/* More pages around the current one, and at both ends */}
      <Pagination
        aria-label="Search results pages"
        boundaryCount={2}
        currentPage={page}
        onPageChange={setPage}
        pageCount={Math.ceil(TOTAL / pageSize)}
        siblingCount={2}
        variant="pages"
      />
    </div>
  );
}
