import removeDiacritics from "../../utils/remove-diacritics";
import { formatCellValue } from "./format-value";
import { toISODate, toISOTime } from "../../utils/date";
import type { Column } from "./types";
import type { Locale } from "../../i18n/types";

export type SortOrder = "asc" | "desc";

/**
 * Everything the rows of a `DataTable` depend on - the page, the sorting,
 * the search and the filters. The table only reports changes of it; turning
 * it into a request is up to the app (see `toOffsetParams` for REST and
 * `toRelayVariables` for GraphQL), or `clientSide` does it in the browser.
 */
export interface DataTableQuery {
  /** Cursor pagination: the page after this cursor (`pageInfo.endCursor`). */
  after: string | null;
  /** Cursor pagination: the page before this cursor (`pageInfo.startCursor`). */
  before: string | null;
  /** Column filters keyed by column key - the raw values of the filter fields. */
  filters: Record<string, string>;
  /** Direction of `sortBy`. */
  order: SortOrder;
  /** 1-based page number. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Term of the global search field (`enableGlobalSearch`). */
  search: string;
  /** Key of the sorted column, `null` for the default order of the data. */
  sortBy: string | null;
}

export const DEFAULT_PAGE_SIZE = 20;

/** Choices of the "rows per page" select of `DataTable` by default. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 100];

/** A complete query - the defaults with `overrides` applied. */
export function createDataTableQuery(
  overrides: Partial<DataTableQuery> = {},
): DataTableQuery {
  return {
    after: null,
    before: null,
    filters: {},
    order: "asc",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    search: "",
    sortBy: null,
    ...overrides,
  };
}

/** Whether two queries ask for the same rows - compared by value. */
export function isSameQuery(a: DataTableQuery, b: DataTableQuery) {
  if (a === b) return true;

  const aFilters = Object.entries(a.filters);

  return (
    a.after === b.after &&
    a.before === b.before &&
    a.order === b.order &&
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.search === b.search &&
    a.sortBy === b.sortBy &&
    aFilters.length === Object.keys(b.filters).length &&
    aFilters.every(([key, value]) => b.filters[key] === value)
  );
}

/** The query with the pagination reset - after the rows it pages changed. */
export const resetPagination = (
  query: DataTableQuery,
  changes: Partial<DataTableQuery>,
): DataTableQuery => ({
  ...query,
  ...changes,
  after: null,
  before: null,
  page: 1,
});

/** Sorting cycles through ascending, descending and no sorting. */
export function toggleSort(query: DataTableQuery, key: string): DataTableQuery {
  if (query.sortBy !== key) {
    return resetPagination(query, { order: "asc", sortBy: key });
  }

  return query.order === "asc"
    ? resetPagination(query, { order: "desc" })
    : resetPagination(query, { order: "asc", sortBy: null });
}

export function setFilter(
  query: DataTableQuery,
  key: string,
  value: string,
): DataTableQuery {
  // An unchanged filter keeps the page
  if ((query.filters[key] ?? "") === value) return query;

  const filters = { ...query.filters };

  if (value) {
    filters[key] = value;
  } else {
    delete filters[key];
  }

  return resetPagination(query, { filters });
}

/**
 * Relay connection arguments of the query - forward paging uses
 * `first` / `after`, going back uses `last` / `before`:
 *
 * ```ts
 * const { data } = useQuery(USERS, { variables: toRelayVariables(query) });
 * ```
 */
export function toRelayVariables(query: DataTableQuery) {
  const variables = {
    filters: Object.keys(query.filters).length ? query.filters : undefined,
    order: query.sortBy ? query.order : undefined,
    search: query.search || undefined,
    sortBy: query.sortBy ?? undefined,
  };

  return query.before
    ? { ...variables, before: query.before, last: query.pageSize }
    : {
        ...variables,
        after: query.after ?? undefined,
        first: query.pageSize,
      };
}

/**
 * Offset pagination parameters of the query, in the naming of both page-
 * and offset-based APIs - pick the ones yours expects:
 *
 * ```ts
 * const { page, pageSize, sortBy, order, search } = toOffsetParams(query);
 * fetch(`/api/users?page=${page}&per_page=${pageSize}&q=${search}`);
 * ```
 */
export function toOffsetParams(query: DataTableQuery) {
  return {
    filters: query.filters,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    order: query.sortBy ? query.order : undefined,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search || undefined,
    sortBy: query.sortBy ?? undefined,
  };
}

export interface DataTableUrlOptions {
  /** Values the URL is compared against - defaults are not written to it. */
  defaults?: Partial<DataTableQuery>;
  /**
   * Page sizes a URL may ask for - pass the `pageSizeOptions` of the table.
   * Any other size falls back to the default one, so a hand-edited URL
   * cannot request a million rows. Defaults to `DEFAULT_PAGE_SIZE_OPTIONS`.
   */
  pageSizeOptions?: number[];
  /** Prefix of the parameter names, for several tables on one page. */
  prefix?: string;
}

const parsePositiveInt = (value: string | null) => {
  if (value === null) return null;
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 1 ? null : number;
};

const isStringRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads a query from a URL query string (`?page=2&sortBy=name&…`). Missing
 * or invalid parameters fall back to the defaults.
 */
export function readQueryFromSearch(
  search: string,
  {
    defaults,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    prefix = "",
  }: DataTableUrlOptions = {},
): DataTableQuery {
  const params = new URLSearchParams(search);
  const base = createDataTableQuery(defaults);
  const param = (name: string) => params.get(`${prefix}${name}`);

  let filters = base.filters;
  const rawFilters = param("filters");

  if (rawFilters) {
    try {
      const parsed: unknown = JSON.parse(rawFilters);
      if (isStringRecord(parsed)) {
        filters = Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [key, String(value)]),
        );
      }
    } catch {
      // A hand-edited URL - keep the default filters
    }
  }

  const sortBy = param("sortBy");
  const order = param("order");
  const pageSize = parsePositiveInt(param("pageSize"));

  return {
    after: param("after") || null,
    before: param("before") || null,
    filters,
    order: order === "asc" || order === "desc" ? order : base.order,
    page: parsePositiveInt(param("page")) ?? base.page,
    pageSize:
      pageSize !== null && pageSizeOptions.includes(pageSize)
        ? pageSize
        : base.pageSize,
    search: param("search") ?? base.search,
    // An empty `sortBy` records that the default sorting was turned off
    sortBy: sortBy === null ? base.sortBy : sortBy || null,
  };
}

/**
 * Writes a query into a URL query string, keeping unrelated parameters and
 * leaving out values equal to the defaults. Returns `"?…"` or `""`.
 */
export function writeQueryToSearch(
  currentSearch: string,
  query: DataTableQuery,
  { defaults, prefix = "" }: DataTableUrlOptions = {},
) {
  const params = new URLSearchParams(currentSearch);
  const base = createDataTableQuery(defaults);

  const write = (name: string, value: string | null) => {
    const key = `${prefix}${name}`;
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  };

  write("page", query.page === base.page ? null : String(query.page));
  write(
    "pageSize",
    query.pageSize === base.pageSize ? null : String(query.pageSize),
  );
  write("sortBy", query.sortBy === base.sortBy ? null : (query.sortBy ?? ""));
  write(
    "order",
    query.sortBy && (query.sortBy !== base.sortBy || query.order !== base.order)
      ? query.order
      : null,
  );
  write("search", query.search === base.search ? null : query.search);
  write(
    "filters",
    JSON.stringify(query.filters) === JSON.stringify(base.filters)
      ? null
      : Object.keys(query.filters).length
        ? JSON.stringify(query.filters)
        : "{}",
  );
  write("after", query.after);
  write("before", query.before);

  const result = params.toString();
  return result ? `?${result}` : "";
}

const normalizeText = (text: string) => removeDiacritics(text).toLowerCase();

const toLocalDateTime = (date: Date) =>
  Number.isNaN(date.getTime()) ? "" : `${toISODate(date)}T${toISOTime(date)}`;

// `2026-09-24T22:30:00Z`, `2026-09-24T22:30+02:00` - a moment in another zone
const ZONED_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i;

/** A cell value as text for searching and filtering. */
function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toLocalDateTime(value);
  if (typeof value === "object") return "";
  return String(value);
}

/**
 * Whether a cell value contains `term` (normalized) - in its raw text, or in
 * the text the table shows for it (`24.09.2026` for a date, "Yes" for true).
 */
const containsText = (value: unknown, term: string, locale?: Locale) =>
  normalizeText(toText(value)).includes(term) ||
  (!!locale &&
    normalizeText(formatCellValue(value, locale) ?? "").includes(term));

/**
 * A date value as local `YYYY-MM-DDTHH:mm` - the format of the date filters.
 * ISO strings with a time zone are converted to the local time first.
 */
const toDateText = (value: unknown) =>
  typeof value === "string" && ZONED_DATE_TIME.test(value)
    ? toLocalDateTime(new Date(value))
    : toText(value);

function matchesFilter(
  value: unknown,
  filterValue: string,
  filterType: Column<unknown>["filter"],
  locale?: Locale,
) {
  switch (filterType) {
    case "select":
      return toText(value) === filterValue;
    case "date":
    case "datetime":
      // Values are ISO strings or Dates - `2026-09-24` matches the whole day
      return toDateText(value).startsWith(filterValue);
    case "time": {
      const text = toDateText(value);
      return (text.includes("T") ? text.split("T")[1] : text).startsWith(
        filterValue,
      );
    }
    default:
      return containsText(value, normalizeText(filterValue), locale);
  }
}

function compareValues(a: unknown, b: unknown, localeCode?: string) {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";

  // Empty values last, whatever the direction
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;

  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  // The collation of the language - Czech sorts "ch" after "h"
  return toText(a).localeCompare(toText(b), localeCode, {
    numeric: true,
    sensitivity: "base",
  });
}

export const getColumnValue = <T>(row: T, column: Column<T>): unknown =>
  column.getValue
    ? column.getValue(row)
    : (row as Record<string, unknown>)[column.key];

export interface ApplyDataTableQueryOptions<T> {
  /**
   * The language of the texts: they are sorted by its rules, and dates and
   * booleans are also found by the text the table shows for them. `DataTable`
   * passes the locale of `UIProvider`.
   */
  locale?: Locale;
  /** Set to `false` to return all matching rows instead of one page. */
  paginate?: boolean;
  /** Columns the global search looks in - all `columns` by default. */
  searchColumns?: Column<T>[];
}

/**
 * Filters, searches, sorts and pages rows in the browser - what the
 * `clientSide` prop of `DataTable` does. Returns the rows of the page, the
 * number of matching rows and the page actually shown (the last one when
 * `query.page` is past the end).
 */
export function applyDataTableQuery<T>(
  rows: T[],
  query: DataTableQuery,
  columns: Column<T>[],
  {
    locale,
    paginate = true,
    searchColumns = columns,
  }: ApplyDataTableQueryOptions<T> = {},
) {
  let result = rows;

  for (const [key, filterValue] of Object.entries(query.filters)) {
    if (!filterValue) continue;

    const column = columns.find((candidate) => candidate.key === key);

    result = result.filter((row) =>
      column?.filterFn
        ? column.filterFn(row, filterValue)
        : matchesFilter(
            column
              ? getColumnValue(row, column)
              : (row as Record<string, unknown>)[key],
            filterValue,
            column?.filter,
            locale,
          ),
    );
  }

  if (query.search) {
    const term = normalizeText(query.search);

    result = result.filter((row) =>
      searchColumns.some((column) =>
        containsText(getColumnValue(row, column), term, locale),
      ),
    );
  }

  if (query.sortBy) {
    const column = columns.find((candidate) => candidate.key === query.sortBy);
    const direction = query.order === "desc" ? -1 : 1;

    if (column) {
      result = [...result].sort((a, b) => {
        const aValue = getColumnValue(a, column);
        const bValue = getColumnValue(b, column);
        const aEmpty = aValue === null || aValue === undefined || aValue === "";
        const bEmpty = bValue === null || bValue === undefined || bValue === "";

        // Keep empty values at the end in both directions
        if (aEmpty || bEmpty) return compareValues(aValue, bValue);

        return compareValues(aValue, bValue, locale?.code) * direction;
      });
    }
  }

  const total = result.length;
  if (!paginate) return { page: 1, rows: result, total };

  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, lastPage);
  const start = (page - 1) * query.pageSize;

  return { page, rows: result.slice(start, start + query.pageSize), total };
}
