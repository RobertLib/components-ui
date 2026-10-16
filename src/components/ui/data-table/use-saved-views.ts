import { useState } from "react";
import columnRecord from "./column-record";
import useLocalStorage from "../../../hooks/use-local-storage";
import { fromColumnState, toColumnState } from "./use-table-state";
import {
  getQuerySort,
  isSameFilters,
  isSameSort,
  normalizeFilterValue,
  type DataTableFilterValue,
  type DataTableQuery,
  type DataTableSort,
} from "./query";
import type {
  DataTableColumnState,
  DataTableView,
  DataTableViewQuery,
} from "./types";

const STORAGE_PREFIX = "table-views-";

const NO_VIEWS: DataTableView[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSort = (value: unknown): value is DataTableSort =>
  isRecord(value) &&
  typeof value.key === "string" &&
  (value.order === "asc" || value.order === "desc");

/** The query of a stored view - with the values it can use only. */
function parseViewQuery(value: unknown): DataTableViewQuery {
  const query: DataTableViewQuery = {};
  if (!isRecord(value)) return query;

  if (isRecord(value.filters)) {
    const filters = columnRecord<DataTableFilterValue>();
    for (const [key, filter] of Object.entries(value.filters)) {
      const normalized = normalizeFilterValue(filter);
      if (normalized !== null) filters[key] = normalized;
    }
    query.filters = filters;
  }
  if (typeof value.search === "string") query.search = value.search;
  if (
    typeof value.pageSize === "number" &&
    Number.isSafeInteger(value.pageSize) &&
    value.pageSize > 0
  ) {
    query.pageSize = value.pageSize;
  }
  if (Array.isArray(value.sort)) {
    query.sort = value.sort
      .filter(isSort)
      .map(({ key, order }) => ({ key, order }));
  }

  return query;
}

/** A stored view - `null` for anything that is none. */
function parseView(value: unknown): DataTableView | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string"
  ) {
    return null;
  }

  const view: DataTableView = {
    id: value.id,
    name: value.name,
    query: parseViewQuery(value.query),
  };
  if (isRecord(value.columnState)) {
    view.columnState = toColumnState({
      ...fromColumnState(value.columnState as DataTableColumnState),
      density: null,
    });
  }
  return view;
}

/**
 * Reads the views stored under a table - tolerating hand-edited or older
 * values; text that is no list of views throws, which counts as none.
 */
export function parseViews(text: string): DataTableView[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("The views are not a list.");

  // Each id once - the first one counts
  const ids = new Set<string>();
  return parsed.flatMap((item) => {
    const view = parseView(item);
    if (!view || ids.has(view.id)) return [];
    ids.add(view.id);
    return [view];
  });
}

/**
 * What a view keeps of a query - its filters (normalized, in the order of
 * their keys), search, sorting and page size.
 */
export function getViewQuery(query: DataTableQuery): DataTableViewQuery {
  const filters = columnRecord<DataTableFilterValue>();
  for (const key of Object.keys(query.filters).sort()) {
    const value = normalizeFilterValue(query.filters[key]);
    if (value !== null) filters[key] = value;
  }

  return {
    filters,
    pageSize: query.pageSize,
    search: query.search,
    sort: getQuerySort(query),
  };
}

/**
 * Whether the table shows other settings than a view - other filters,
 * search or sorting, and another page size or other column settings when
 * the view has them. `isSameColumnState` compares the columns as they are
 * shown: a view may name their defaults, which the table leaves out.
 */
export function isViewModified(
  view: DataTableView,
  query: DataTableQuery,
  columnState: DataTableColumnState,
  isSameColumnState: (
    a: DataTableColumnState,
    b: DataTableColumnState,
  ) => boolean,
) {
  const { filters = {}, pageSize, search = "", sort = [] } = view.query;

  return (
    !isSameFilters(query.filters, filters) ||
    query.search !== search ||
    !isSameSort(getQuerySort(query), sort) ||
    (pageSize !== undefined && pageSize !== query.pageSize) ||
    (view.columnState !== undefined &&
      !isSameColumnState(view.columnState, columnState))
  );
}

/** A new id of a view - unique also among the views of other tabs. */
export function createViewId() {
  // Only in a secure context - not on an intranet served over plain http
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The views the user saved - `views` when controlled; otherwise remembered
 * in `localStorage` under `tableId` (shared by the tabs of the browser), or
 * kept as long as the table without one. `setViews` reports them to
 * `onViewsChange` either way.
 */
export default function useSavedViews(
  tableId: string | undefined,
  views: DataTableView[] | undefined,
  onViewsChange: ((views: DataTableView[]) => void) | undefined,
) {
  const [localViews, setLocalViews] = useState(NO_VIEWS);
  // Read under an id of no table too - hooks cannot be called conditionally,
  // and nothing is written there
  const [storedViews, setStoredViews, removeStoredViews] = useLocalStorage(
    `${STORAGE_PREFIX}${tableId ?? ""}`,
    NO_VIEWS,
    { deserialize: parseViews },
  );

  const currentViews = views ?? (tableId ? storedViews : localViews);

  const setViews = (next: DataTableView[]) => {
    if (views === undefined) {
      if (!tableId) setLocalViews(next);
      else if (next.length > 0) setStoredViews(next);
      else removeStoredViews();
    }
    onViewsChange?.(next);
  };

  return [currentViews, setViews] as const;
}
