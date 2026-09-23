import Pagination, {
  type PageInfo,
  type PaginationDirection,
} from "../pagination";
import Select from "../select";
import { resetPagination, type DataTableQuery } from "./query";
import { useMessages } from "../../providers/ui-context";

interface TableFooterProps {
  /** The rows of a requested page are loading - paging waits meanwhile. */
  loading?: boolean;
  /** The page actually shown - may differ from `query.page` client-side. */
  page: number;
  pageInfo?: PageInfo;
  pageSizeOptions: number[];
  query: DataTableQuery;
  total?: number;
  /** Changes the query - builds on the latest one, not on `query`. */
  updateQuery: (update: (current: DataTableQuery) => DataTableQuery) => void;
}

export function TableFooter({
  loading,
  page,
  pageInfo,
  pageSizeOptions,
  query,
  total,
  updateQuery,
}: TableFooterProps) {
  const messages = useMessages();

  const sizes = pageSizeOptions.includes(query.pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, query.pageSize].sort((a, b) => a - b);

  const lastPage =
    total === undefined
      ? undefined
      : Math.max(1, Math.ceil(total / query.pageSize));

  // Relay servers report only the pages ahead in the paging direction - the
  // page the user came from exists even when the connection says otherwise
  const cursorPageInfo = pageInfo && {
    ...pageInfo,
    hasNextPage: pageInfo.hasNextPage || query.before !== null,
    hasPreviousPage:
      query.before !== null
        ? pageInfo.hasPreviousPage
        : pageInfo.hasPreviousPage || query.after !== null,
  };

  // A position reached by a cursor - `pageInfo` without cursors pages by
  // numbers (an offset API without a total)
  const isAtCursor = query.after !== null || query.before !== null;

  const handlePageChange = (
    direction: PaginationDirection,
    cursor?: string,
  ) => {
    const toFirstPage = (current: DataTableQuery) => ({
      ...current,
      after: null,
      before: null,
      page: 1,
    });

    // An empty cursor page has no cursors to continue from
    if (direction !== "last" && pageInfo && !cursor && isAtCursor) {
      updateQuery(toFirstPage);
      return;
    }

    switch (direction) {
      case "first":
        updateQuery(toFirstPage);
        break;
      case "prev":
        updateQuery((current) => ({
          ...current,
          after: null,
          before: cursor ?? null,
          // From past the end straight to the last page
          page: Math.max(1, Math.min(page - 1, lastPage ?? page)),
        }));
        break;
      case "next":
        updateQuery((current) => ({
          ...current,
          after: cursor ?? null,
          before: null,
          page: page + 1,
        }));
        break;
      case "last":
        updateQuery((current) => ({
          ...current,
          after: null,
          before: null,
          page: lastPage ?? 1,
        }));
        break;
    }
  };

  return (
    <footer className="flex flex-wrap items-center justify-end gap-3 rounded-b-lg border border-t-0 border-neutral-200 bg-surface p-2 dark:border-neutral-800 dark:bg-surface-dark">
      <Select
        aria-label={messages.dataTable.rowsPerPage}
        dim="xs"
        onChange={({ target }) =>
          updateQuery((current) =>
            resetPagination(current, { pageSize: Number(target.value) }),
          )
        }
        options={sizes.map((value) => ({
          label: value.toString(),
          value,
        }))}
        value={query.pageSize}
      />

      <Pagination
        currentPage={page}
        loading={loading}
        onChange={handlePageChange}
        pageInfo={cursorPageInfo}
        pageSize={query.pageSize}
        total={total}
      />
    </footer>
  );
}
