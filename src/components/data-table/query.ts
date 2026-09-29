import { foldSearchText } from "../../utils/remove-diacritics";
import { toIntlLocale } from "../../i18n/format";
import { formatCellValue } from "./format-value";
import { toISODate, toISOTime } from "../../utils/date";
import type { Column } from "./types";
import type { Locale } from "../../i18n/types";

export type SortOrder = "asc" | "desc";

/** One column of the sorting - see `DataTableQuery.sort`. */
export interface DataTableSort {
  /** Key of the sorted column. */
  key: string;
  /** Direction of the column. */
  order: SortOrder;
}

/**
 * The bounds of a range filter, both included - either may be left out: a
 * `from` alone is "at least", a `to` alone "at most". Numbers are written as
 * in JavaScript (`1500.5`), days as `YYYY-MM-DD` - a `to` day includes the
 * whole day - and moments as `YYYY-MM-DDTHH:mm`.
 */
export interface DataTableRangeFilter {
  /** The lowest value that matches. */
  from?: string;
  /** The highest value that matches. */
  to?: string;
}

/**
 * The value of a column filter - one of three operators:
 * - a text: the field of an `input` filter (the cell contains it), of a
 *   `select` (the cell equals it) or of a `date` / `time` / `datetime`
 *   filter (`2026-09-24` matches the whole day),
 * - a list of texts: the cell matches any of them (`multiSelect`),
 * - a range `{ from, to }`: the cell lies between the bounds (`numberRange`,
 *   `dateRange`).
 */
export type DataTableFilterValue = string | string[] | DataTableRangeFilter;

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
  /**
   * Column filters keyed by column key - the values of the filter fields,
   * see `DataTableFilterValue`. Client-side, a key of no column with a
   * `filter` or `filterFn` is ignored.
   */
  filters: Record<string, DataTableFilterValue>;
  /** Direction of `sortBy` - the `order` of the first column of `sort`. */
  order: SortOrder;
  /** 1-based page number. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Term of the global search field (`enableGlobalSearch`). */
  search: string;
  /**
   * The sorting, most significant column first - rows equal in one column
   * are sorted by the next (Shift + click on a header adds a column, see
   * `multiSort`); `[]` for the default order of the data. `sortBy` and
   * `order` are its first column: a query whose `sortBy` / `order` differ
   * from it - changed by code that knows only them - sorts by them alone.
   */
  sort: DataTableSort[];
  /**
   * Key of the sorted column - the first one of `sort` - `null` for the
   * default order of the data.
   */
  sortBy: string | null;
}

export const DEFAULT_PAGE_SIZE = 20;

/** Choices of the "rows per page" select of `DataTable` by default. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 100];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A filter value as the table keeps it - `null` for none: an empty text, a
 * list without texts, a range without bounds, or anything else (a hand-edited
 * URL). Empty items and bounds are left out, a list has each text once and a
 * range its bounds in one order, so that equal filters look the same.
 */
export function normalizeFilterValue(
  value: unknown,
): DataTableFilterValue | null {
  if (typeof value === "string") return value || null;

  if (Array.isArray(value)) {
    const items = [
      ...new Set(
        value.filter(
          (item): item is string => typeof item === "string" && item !== "",
        ),
      ),
    ];
    return items.length ? items : null;
  }

  if (isRecord(value)) {
    const bound = (name: "from" | "to") => {
      const text = value[name];
      return typeof text === "string" && text ? text : undefined;
    };
    const from = bound("from");
    const to = bound("to");
    if (from === undefined && to === undefined) return null;

    const range: DataTableRangeFilter = {};
    if (from !== undefined) range.from = from;
    if (to !== undefined) range.to = to;
    return range;
  }

  return null;
}

/** The filter has a value - a text, a list or a range with something in it. */
export const hasFilterValue = (value: unknown) =>
  normalizeFilterValue(value) !== null;

/** Whether two filter values filter the same - `undefined` is no filter. */
export function isSameFilterValue(a: unknown, b: unknown) {
  if (a === b) return true;

  const left = normalizeFilterValue(a);
  const right = normalizeFilterValue(b);
  if (left === null || right === null) return left === right;
  if (typeof left === "string" || typeof right === "string") {
    return left === right;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => item === right[index])
    );
  }

  return left.from === right.from && left.to === right.to;
}

/**
 * The sorting of a query - its `sort`, or `sortBy` / `order` alone when
 * `sort` is missing or says something else (a query changed by code that
 * knows only them).
 */
export function getQuerySort(
  query: Pick<DataTableQuery, "order" | "sortBy"> & {
    sort?: readonly DataTableSort[];
  },
): DataTableSort[] {
  const { order, sort, sortBy } = query;
  const first = sort?.[0];

  if (
    sort &&
    (first ? first.key === sortBy && first.order === order : sortBy === null)
  ) {
    return sort as DataTableSort[];
  }

  return sortBy ? [{ key: sortBy, order }] : [];
}

/** Whether two sortings are the same - the same columns in one order. */
export const isSameSort = (
  a: readonly DataTableSort[],
  b: readonly DataTableSort[],
) =>
  a.length === b.length &&
  a.every(
    (item, index) => item.key === b[index].key && item.order === b[index].order,
  );

/**
 * The fields of `changes` that are set - `{ pageSize: props.pageSize }` with
 * the prop left out must not wipe out the page size.
 */
const definedFields = (changes: Partial<DataTableQuery>) =>
  Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as Partial<DataTableQuery>;

/**
 * `query` with `changes` applied - `sort` and `sortBy` / `order` agreeing
 * again: set alone, `sort` gives `sortBy` / `order`, and `sortBy` / `order`
 * give a `sort` of that column.
 */
function applyChanges(
  query: DataTableQuery,
  changes: Partial<DataTableQuery>,
): DataTableQuery {
  const defined = definedFields(changes);
  const next = { ...query, ...defined };
  const isSortChanged = defined.sort !== undefined;
  const isSortByChanged =
    defined.sortBy !== undefined || defined.order !== undefined;

  const isSortSet = isSortChanged && !isSortByChanged;
  const sort = isSortSet
    ? (defined.sort as DataTableSort[])
    : getQuerySort(next);

  return {
    ...next,
    // No sorting is ascending again, as `toggleSort` has always left it
    order: sort[0]?.order ?? (isSortSet ? "asc" : next.order),
    sort,
    sortBy: sort[0]?.key ?? null,
  };
}

const EMPTY_QUERY: DataTableQuery = {
  after: null,
  before: null,
  filters: {},
  order: "asc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  search: "",
  sort: [],
  sortBy: null,
};

/**
 * A complete query - the defaults with `overrides` applied. Either `sort`
 * or `sortBy` / `order` set the sorting.
 */
export function createDataTableQuery(
  overrides: Partial<DataTableQuery> = {},
): DataTableQuery {
  return applyChanges(EMPTY_QUERY, overrides);
}

/** Whether two sets of filters are equal - in any order of their keys. */
export function isSameFilters(
  a: DataTableQuery["filters"],
  b: DataTableQuery["filters"],
) {
  const aKeys = Object.keys(a).filter((key) => hasFilterValue(a[key]));
  const bKeys = Object.keys(b).filter((key) => hasFilterValue(b[key]));

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => isSameFilterValue(a[key], b[key]))
  );
}

/** Whether two queries ask for the same rows - compared by value. */
export function isSameQuery(a: DataTableQuery, b: DataTableQuery) {
  if (a === b) return true;

  return (
    a.after === b.after &&
    a.before === b.before &&
    a.order === b.order &&
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.search === b.search &&
    a.sortBy === b.sortBy &&
    isSameSort(getQuerySort(a), getQuerySort(b)) &&
    isSameFilters(a.filters, b.filters)
  );
}

/** The query with the pagination reset - after the rows it pages changed. */
export const resetPagination = (
  query: DataTableQuery,
  changes: Partial<DataTableQuery>,
): DataTableQuery => ({
  ...applyChanges(query, changes),
  after: null,
  before: null,
  page: 1,
});

export interface ToggleSortOptions {
  /**
   * Adds the column to the sorting, or changes or drops it there, instead of
   * sorting by it alone - what Shift + click on a header does.
   */
  multi?: boolean;
}

/**
 * Sorting cycles through ascending, descending and no sorting. The column
 * becomes the only one sorted - ascending unless it is the first one
 * already, which goes on in its cycle. With `multi` it is added to the
 * sorting (as its last column), or goes on in its cycle in its place there.
 */
export function toggleSort(
  query: DataTableQuery,
  key: string,
  { multi = false }: ToggleSortOptions = {},
): DataTableQuery {
  const sort = getQuerySort(query);
  const current = sort.find((item) => item.key === key);

  if (!multi) {
    const first = sort[0];
    return resetPagination(query, {
      sort:
        first?.key !== key
          ? [{ key, order: "asc" }]
          : first.order === "asc"
            ? [{ key, order: "desc" }]
            : [],
    });
  }

  return resetPagination(query, {
    sort: !current
      ? [...sort, { key, order: "asc" }]
      : current.order === "asc"
        ? sort.map((item) =>
            item.key === key ? { key, order: "desc" as const } : item,
          )
        : sort.filter((item) => item.key !== key),
  });
}

/**
 * Sets the filter of a column - an empty value (`""`, `[]`, a range without
 * bounds) removes it. An unchanged filter returns the query itself.
 */
export function setFilter(
  query: DataTableQuery,
  key: string,
  value: DataTableFilterValue,
): DataTableQuery {
  const normalized = normalizeFilterValue(value);

  // An unchanged filter keeps the page
  if (isSameFilterValue(query.filters[key], normalized)) return query;

  const filters = { ...query.filters };

  if (normalized !== null) {
    filters[key] = normalized;
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
 *
 * `sortBy` / `order` are the first column of `sort`, which lists all of
 * them - declare the one your schema takes.
 */
export function toRelayVariables(query: DataTableQuery) {
  const sort = getQuerySort(query);
  const variables = {
    filters: Object.keys(query.filters).length ? query.filters : undefined,
    order: sort[0]?.order,
    search: query.search || undefined,
    sort: sort.length ? sort : undefined,
    sortBy: sort[0]?.key,
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
 * and offset-based APIs - pick the ones yours expects. `search`, `sortBy`
 * and `order` are `undefined` when not set; `sort` lists every sorted
 * column (`[]` for none), `sortBy` / `order` are its first one:
 *
 * ```ts
 * const { page, pageSize, search } = toOffsetParams(query);
 * const params = new URLSearchParams({
 *   page: String(page),
 *   per_page: String(pageSize),
 * });
 * if (search) params.set("q", search);
 * fetch(`/api/users?${params}`);
 * ```
 */
export function toOffsetParams(query: DataTableQuery) {
  const sort = getQuerySort(query);

  return {
    filters: query.filters,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    order: sort[0]?.order,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search || undefined,
    sort,
    sortBy: sort[0]?.key,
  };
}

export interface FilterParamsOptions {
  /**
   * Puts the filters under a name of their own - `filter` gives
   * `filter[status]=active`, keeping them apart from the other parameters.
   */
  prefix?: string;
}

/**
 * The filters as URL parameters of a REST API, `[name, value]` pairs for
 * `URLSearchParams`: a text under its key (`status=active`), each item of a
 * list under it (`status=active&status=invited`) and the bounds of a range
 * under `key[from]` / `key[to]` (`salary[from]=1000`) - the shapes `qs` and
 * most frameworks read back.
 *
 * ```ts
 * const params = new URLSearchParams(toFilterParams(query.filters));
 * ```
 */
export function toFilterParams(
  filters: DataTableQuery["filters"],
  { prefix }: FilterParamsOptions = {},
): [string, string][] {
  const params: [string, string][] = [];

  for (const key of Object.keys(filters).sort()) {
    const value = normalizeFilterValue(filters[key]);
    const name = prefix ? `${prefix}[${key}]` : key;

    if (typeof value === "string") {
      params.push([name, value]);
    } else if (Array.isArray(value)) {
      for (const item of value) params.push([name, item]);
    } else if (value) {
      if (value.from !== undefined) params.push([`${name}[from]`, value.from]);
      if (value.to !== undefined) params.push([`${name}[to]`, value.to]);
    }
  }

  return params;
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

// Digits only - `2abc`, `1e3` or `0x10` are no page of a hand-edited URL
const POSITIVE_INT = /^\d+$/;

/**
 * A whole number from 1 up to the safe integers - larger ones would lose
 * their digits, and a page of `1e23` rows makes an offset no API takes.
 */
const parsePositiveInt = (value: string | null) => {
  if (value === null || !POSITIVE_INT.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
};

/**
 * A column key in the `sort` parameter - `%`, `,` and a leading `-` (a
 * descending column) are escaped, so that any key comes back as it was.
 */
const encodeSortKey = (key: string) =>
  key
    .replace(/[%,]/g, (char) => (char === "%" ? "%25" : "%2C"))
    .replace(/^-/, "%2D");

/** The `sort` parameter - `name,-age`: the keys, descending ones with `-`. */
const encodeSort = (sort: readonly DataTableSort[]) =>
  sort
    .map(
      ({ key, order }) => `${order === "desc" ? "-" : ""}${encodeSortKey(key)}`,
    )
    .join(",");

/** The sorting of a `sort` parameter - `null` when it names no column. */
function decodeSort(value: string): DataTableSort[] | null {
  const sort: DataTableSort[] = [];

  for (const item of value.split(",")) {
    const isDescending = item.startsWith("-");
    let key: string;
    try {
      key = decodeURIComponent(isDescending ? item.slice(1) : item);
    } catch {
      // A hand-edited `%` - no key
      continue;
    }
    // Each column once - the first place counts
    if (key && !sort.some((candidate) => candidate.key === key)) {
      sort.push({ key, order: isDescending ? "desc" : "asc" });
    }
  }

  return sort.length ? sort : null;
}

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
      if (isRecord(parsed)) {
        // Only the values the table writes - texts, lists of texts and
        // ranges; a hand-edited `null` or number would become the filter
        // "null" or "5"
        filters = {};
        for (const [key, value] of Object.entries(parsed)) {
          const normalized = normalizeFilterValue(value);
          if (normalized !== null) filters[key] = normalized;
        }
      }
    } catch {
      // A hand-edited URL - keep the default filters
    }
  }

  const rawSort = param("sort");
  const sortBy = param("sortBy");
  const order = param("order");
  const pageSize = parsePositiveInt(param("pageSize"));
  // Several columns are in `sort`, one in `sortBy` / `order` as before
  const sort = (rawSort && decodeSort(rawSort)) || null;

  return createDataTableQuery({
    after: param("after") || null,
    before: param("before") || null,
    filters,
    page: parsePositiveInt(param("page")) ?? base.page,
    pageSize:
      pageSize !== null && pageSizeOptions.includes(pageSize)
        ? pageSize
        : base.pageSize,
    search: param("search") ?? base.search,
    ...(sort
      ? { sort }
      : sortBy === null && order === null
        ? // The default sorting - also one by several columns
          { order: base.order, sort: base.sort, sortBy: base.sortBy }
        : {
            order: order === "asc" || order === "desc" ? order : base.order,
            // An empty `sortBy` records that the default sorting was turned
            // off
            sortBy: sortBy === null ? base.sortBy : sortBy || null,
          }),
  });
}

/**
 * Writes a query into a URL query string, keeping unrelated parameters and
 * leaving out values equal to the defaults. Returns `"?…"` or `""`. A
 * sorting by one column is written as `sortBy` / `order`, one by several
 * as `sort=name,-age` (`-` for descending).
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

  const sort = getQuerySort(query);
  const baseSort = getQuerySort(base);
  const isDefaultSort = isSameSort(sort, baseSort);
  // `sortBy` / `order` as before - unless the default sorts by several
  // columns, which only `sort` can stand apart from
  const isSingleSort = sort.length < 2 && baseSort.length < 2;
  const [first] = sort;

  write("page", query.page === base.page ? null : String(query.page));
  write(
    "pageSize",
    query.pageSize === base.pageSize ? null : String(query.pageSize),
  );
  write(
    "sort",
    isDefaultSort || isSingleSort || !first ? null : encodeSort(sort),
  );
  write(
    "sortBy",
    isDefaultSort || (!isSingleSort && first)
      ? null
      : first && first.key === base.sortBy
        ? null
        : (first?.key ?? ""),
  );
  write(
    "order",
    !isDefaultSort &&
      isSingleSort &&
      first &&
      (first.key !== base.sortBy || first.order !== base.order)
      ? first.order
      : null,
  );
  write("search", query.search === base.search ? null : query.search);
  // In the order of the keys and normalized, so the same filters make the
  // same URL however they were set
  const filters: Record<string, DataTableFilterValue> = {};
  for (const key of Object.keys(query.filters).sort()) {
    const value = normalizeFilterValue(query.filters[key]);
    if (value !== null) filters[key] = value;
  }
  write(
    "filters",
    isSameFilters(query.filters, base.filters) ? null : JSON.stringify(filters),
  );
  write("after", query.after);
  write("before", query.before);

  const result = params.toString();
  return result ? `?${result}` : "";
}

const normalizeText = foldSearchText;

const toLocalDateTime = (date: Date) =>
  Number.isNaN(date.getTime()) ? "" : `${toISODate(date)}T${toISOTime(date)}`;

// `2026-09-24T22:30:00Z`, `2026-09-24T22:30+02:00` - a moment in another zone
const ZONED_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i;

/** A cell value as text for searching and filtering. */
export function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toLocalDateTime(value);
  // A list, e.g. tags - its items like the cell shows them
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

/**
 * Nothing to show, also an empty list - sorted last in both directions. So
 * are `NaN` and an invalid date (`getValue: (row) => parseFloat(row.price)`
 * of a row without a price): they compare to nothing, and a comparison that
 * gives `NaN` would leave all the rows out of order, not just them.
 */
const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (typeof value === "number" && Number.isNaN(value)) ||
  (value instanceof Date && Number.isNaN(value.getTime())) ||
  (Array.isArray(value) && toText(value) === "");

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

/** The time of a date value - `HH:mm` of `YYYY-MM-DDTHH:mm`, or the value. */
const toTimeText = (value: unknown) => {
  const text = toDateText(value);
  return text.includes("T") ? text.split("T")[1] : text;
};

type FilterType = Column<unknown>["filter"];

const isDateFilter = (filterType: FilterType) =>
  filterType === "date" ||
  filterType === "datetime" ||
  filterType === "dateRange";

/**
 * Whether a text lies within a range of texts - a `to` of fewer characters
 * includes all it starts: `2026-09-30` the whole day, `10:30` the minute.
 */
const isTextInRange = (text: string, { from, to }: DataTableRangeFilter) =>
  (from === undefined || text >= from) &&
  (to === undefined || text.slice(0, to.length) <= to);

/**
 * Whether a cell value lies in a range: numbers by their value (also those
 * stored as strings), dates and times by their local ISO text - a `to` day
 * includes the whole day. An empty value lies in no range.
 */
function matchesRange(
  value: unknown,
  range: DataTableRangeFilter,
  filterType: FilterType,
): boolean {
  // A list matches when one of its items does
  if (Array.isArray(value)) {
    return value.some((item) => matchesRange(item, range, filterType));
  }
  if (isEmptyValue(value)) return false;

  if (filterType === "time") return isTextInRange(toTimeText(value), range);

  const number = toNumber(value);
  if (!isDateFilter(filterType) && number !== null) {
    const from = range.from === undefined ? null : toNumber(range.from);
    const to = range.to === undefined ? null : toNumber(range.to);
    return (from === null || number >= from) && (to === null || number <= to);
  }
  if (filterType === "numberRange") return false;

  return isTextInRange(toDateText(value), range);
}

function matchesFilter(
  value: unknown,
  filterValue: DataTableFilterValue,
  filterType: FilterType,
  locale?: Locale,
): boolean {
  // Any of the items of a list
  if (Array.isArray(filterValue)) {
    return filterValue.some((item) =>
      matchesFilter(value, item, filterType, locale),
    );
  }
  if (typeof filterValue !== "string") {
    return matchesRange(value, filterValue, filterType);
  }

  switch (filterType) {
    case "select":
    case "multiSelect":
      // A list matches when one of its items does
      return Array.isArray(value)
        ? value.some((item) => toText(item) === filterValue)
        : toText(value) === filterValue;
    case "date":
    case "datetime":
    case "dateRange":
      // Values are ISO strings or Dates - `2026-09-24` matches the whole day
      return toDateText(value).startsWith(filterValue);
    case "time":
      return toTimeText(value).startsWith(filterValue);
    case "numberRange": {
      const number = toNumber(value);
      return number !== null && number === toNumber(filterValue);
    }
    default:
      return containsText(value, normalizeText(filterValue), locale);
  }
}

// Numbers an API sends as strings, e.g. money: `-3`, `1.25`, `.5`, `1e3`.
// The `numeric` collation compares only their digits - `1.5` after `1.25`,
// `-3` before `-20`.
const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * The number a value stands for - also one stored as a string - or `null`,
 * also for `NaN`, which stands for no number.
 */
export const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string" && NUMERIC_TEXT.test(value.trim())) {
    return Number(value);
  }
  return null;
};

// One collator per language, shared by all sorts - `localeCompare` with a
// locale sets up the collation on every call, which made sorting thousands
// of rows take hundreds of milliseconds
const collators = new Map<string, Intl.Collator>();

export function getCollator(localeCode = "") {
  let collator = collators.get(localeCode);

  if (!collator) {
    // The collation of the language - Czech sorts "ch" after "h"
    collator = new Intl.Collator(
      localeCode ? toIntlLocale(localeCode) : undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );
    collators.set(localeCode, collator);
  }

  return collator;
}

/** What a value is sorted by - worked out once per row, not per comparison. */
export interface SortKey {
  /** Nothing to show - sorted last in both directions. */
  empty: boolean;
  /** The value of a number, also of one stored as a string. */
  number: number | null;
  /** The value as text, compared by the collation of the language. */
  text: string;
  /** The value itself - dates and booleans are compared as such. */
  value: unknown;
}

export const toSortKey = (value: unknown): SortKey => ({
  empty: isEmptyValue(value),
  number: toNumber(value),
  text: toText(value),
  value,
});

/** The order of two values that are not empty - negative for `a` first. */
function compareValues(a: SortKey, b: SortKey, collator: Intl.Collator) {
  if (a.value instanceof Date && b.value instanceof Date) {
    return a.value.getTime() - b.value.getTime();
  }
  // Equal numbers of different texts - long ids beyond the precision of a
  // number - are told apart by their digits below
  if (a.number !== null && b.number !== null && a.number !== b.number) {
    return a.number - b.number;
  }
  if (typeof a.value === "boolean" && typeof b.value === "boolean") {
    return Number(a.value) - Number(b.value);
  }

  return collator.compare(a.text, b.text);
}

/**
 * The order of two sort keys in a direction - empty values stay at the end
 * in both directions.
 */
export const compareSortKeys = (
  a: SortKey,
  b: SortKey,
  collator: Intl.Collator,
  direction: 1 | -1 = 1,
) =>
  a.empty || b.empty
    ? Number(a.empty) - Number(b.empty)
    : compareValues(a, b, collator) * direction;

export const getColumnValue = <T>(row: T, column: Column<T>): unknown =>
  column.getValue
    ? column.getValue(row)
    : (row as Record<string, unknown>)[column.key];

/** The column filters rows - it has a filter field or a `filterFn`. */
export const isFilterColumn = <T>(column: Column<T>) =>
  !!column.filter || !!column.filterFn;

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
 * The rows matching the filters and the search of `query`, sorted by the
 * columns of its `sort` - rows equal in all of them keep their order. What
 * `applyDataTableQuery` pages.
 */
export function filterAndSortRows<T>(
  rows: T[],
  query: Pick<DataTableQuery, "filters" | "order" | "search" | "sortBy"> & {
    sort?: readonly DataTableSort[];
  },
  columns: Column<T>[],
  {
    locale,
    searchColumns = columns,
  }: Omit<ApplyDataTableQueryOptions<T>, "paginate"> = {},
) {
  let result = rows;

  for (const [key, rawValue] of Object.entries(query.filters)) {
    const filterValue = normalizeFilterValue(rawValue);
    if (filterValue === null) continue;

    // Only filters of the columns - a key of no filterable column (an old
    // bookmark) has no field to see or clear it in
    const column = columns.find((candidate) => candidate.key === key);
    if (!column || !isFilterColumn(column)) continue;

    const { filterFn } = column;
    const text = typeof filterValue === "string" ? filterValue : "";

    result = result.filter((row) =>
      filterFn
        ? filterFn(row, text, filterValue)
        : matchesFilter(
            getColumnValue(row, column),
            filterValue,
            column.filter,
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

  const sortColumns = getQuerySort(query).flatMap(({ key, order }) => {
    const column = columns.find((candidate) => candidate.key === key);
    return column
      ? [{ column, direction: order === "desc" ? (-1 as const) : (1 as const) }]
      : [];
  });

  if (sortColumns.length > 0) {
    const collator = getCollator(locale?.code);
    const keyed = result.map((row) => ({
      keys: sortColumns.map(({ column }) =>
        toSortKey(getColumnValue(row, column)),
      ),
      row,
    }));

    // A stable sort - rows equal in every column keep their order
    keyed.sort((a, b) => {
      for (let index = 0; index < sortColumns.length; index++) {
        const order = compareSortKeys(
          a.keys[index],
          b.keys[index],
          collator,
          sortColumns[index].direction,
        );
        if (order !== 0) return order;
      }
      return 0;
    });
    result = keyed.map(({ row }) => row);
  }

  return result;
}

/**
 * The rows of a 1-based page and the page they are on - the last one for a
 * page past the end, the first one for a page before it. A page between two
 * (`1.5`) counts as the one it starts in.
 */
export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
  const wanted = Number.isFinite(page) ? Math.floor(page) : 1;
  const shown = Math.min(Math.max(1, wanted), lastPage);
  const start = (shown - 1) * pageSize;

  return { page: shown, rows: rows.slice(start, start + pageSize) };
}

/**
 * Filters, searches, sorts and pages rows in the browser - what the
 * `clientSide` prop of `DataTable` does. Returns the rows of the page, the
 * number of matching rows and the page actually shown (the last one when
 * `query.page` is past the end, the first one for a page below 1).
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
  const result = filterAndSortRows(rows, query, columns, {
    locale,
    searchColumns,
  });
  const total = result.length;

  if (!paginate) return { page: 1, rows: result, total };

  return { ...paginateRows(result, query.page, query.pageSize), total };
}
