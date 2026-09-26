import Pagination, {
  type PageInfo,
  type PaginationDirection,
} from "../pagination";
import Select from "../select";
import { formatMessage } from "../../i18n/format";
import { isSameFilters, resetPagination, type DataTableQuery } from "./query";
import { useId } from "react";
import { useMessages } from "../../providers/ui-context";

interface TableFooterProps {
  /** Name of the table - the pagination is named after it. */
  label?: string;
  /** Id of the element naming the table - instead of `label`. */
  labelledBy?: string;
  /** The rows of a requested page are loading - paging waits meanwhile. */
  loading?: boolean;
  /** The page actually shown - may differ from `query.page` client-side. */
  page: number;
  /** Cursor pagination: the `pageInfo` of the connection. */
  pageInfo?: PageInfo;
  /** Choices of the "rows per page" select. */
  pageSizeOptions: number[];
  /** The current query - its page size and cursors. */
  query: DataTableQuery;
  /** Number of rows matching the query (offset pagination). */
  total?: number;
  /** Changes the query - builds on the latest one, not on `query`. */
  updateQuery: (update: (current: DataTableQuery) => DataTableQuery) => void;
}

export function TableFooter({
  label,
  labelledBy,
  loading,
  page,
  pageInfo,
  pageSizeOptions,
  query,
  total,
  updateQuery,
}: TableFooterProps) {
  const messages = useMessages();
  const paginationWordId = useId();

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

  // The pagination of a named table has its name - several tables of a
  // page have several paginations. Unnamed, it keeps its own name.
  const navNameProps = label
    ? {
        "aria-label": formatMessage(messages.dataTable.paginationLabel, {
          label,
        }),
      }
    : labelledBy
      ? { "aria-labelledby": `${paginationWordId} ${labelledBy}` }
      : {};

  const handlePageChange = (
    direction: PaginationDirection,
    cursor?: string,
  ) => {
    // Where a move starts from - the latest query, which a slow router or a
    // filter change on the way may not show yet. The shown `page` while that
    // is the page of `query` (client-side it is clamped to the rows), and
    // always for a cursor, which continues from the shown page. `total`
    // bounds the latest query only while it counts the same rows.
    const startOf = (current: DataTableQuery) => ({
      from: cursor || current.page === query.page ? page : current.page,
      last:
        cursor ||
        (current.pageSize === query.pageSize &&
          current.search === query.search &&
          isSameFilters(current.filters, query.filters))
          ? lastPage
          : undefined,
    });

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
        updateQuery((current) => {
          const { from, last } = startOf(current);

          return {
            ...current,
            after: null,
            before: cursor ?? null,
            // From past the end straight to the last page
            page: Math.max(1, Math.min(from - 1, last ?? from)),
          };
        });
        break;
      case "next":
        updateQuery((current) => {
          const { from, last } = startOf(current);

          return {
            ...current,
            after: cursor ?? null,
            before: null,
            // Not past the end - a cursor goes where `pageInfo` says
            page:
              cursor || last === undefined
                ? from + 1
                : Math.min(from + 1, last),
          };
        });
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

      {!label && labelledBy && (
        <span hidden id={paginationWordId}>
          {messages.pagination.label}
        </span>
      )}
      <Pagination
        {...navNameProps}
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
