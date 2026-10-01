import { computeSummary } from "./summary";
import columnRecord from "./column-record";
import { formatCellValue } from "./format-value";
import {
  compareSortKeys,
  getCollator,
  getColumnValue,
  toSortKey,
  toText,
  type SortOrder,
} from "./query";
import type { Column, ColumnGroup, DataTableColumn } from "./types";
import type { Locale } from "../../i18n/types";

/** The columns of `columns` with the groups of their headers. */
export interface FlatColumns<T> {
  /** The columns - those of a group in its place. */
  columns: Column<T>[];
  /** The key of the group of each column in one, by column key. */
  groupOf: Record<string, string>;
  /** The groups by their key. */
  groups: Record<string, ColumnGroup<T>>;
}

const NO_GROUPS = columnRecord<never>();

const isColumnGroup = <T>(entry: DataTableColumn<T>): entry is ColumnGroup<T> =>
  "children" in entry && !!entry.children;

/**
 * The columns of the entries of `columns` - `entries` itself when none is a
 * group, so that memos of the columns keep.
 */
export function flattenColumns<T>(
  entries: DataTableColumn<T>[],
): FlatColumns<T> {
  if (!entries.some(isColumnGroup)) {
    return {
      columns: entries as Column<T>[],
      groupOf: NO_GROUPS,
      groups: NO_GROUPS,
    };
  }

  const columns: Column<T>[] = [];
  const groupOf = columnRecord<string>();
  const groups = columnRecord<ColumnGroup<T>>();

  for (const entry of entries) {
    if (isColumnGroup(entry)) {
      groups[entry.key] = entry;
      for (const column of entry.children) {
        columns.push(column);
        groupOf[column.key] = entry.key;
      }
    } else {
      columns.push(entry);
    }
  }

  return { columns, groupOf, groups };
}

/** A group of rows of `groupBy`. */
export interface RowGroup<T> {
  /** All rows of the group matching the query - of every page. */
  allRows: T[];
  /** Tells the group apart - the value as text. */
  key: string;
  /** The value as the header shows it - `""` for an empty one. */
  label: string;
  /** The rows of the group on the page, in their order. */
  rows: T[];
}

/**
 * The rows of the page by the value of a column - in the order of the
 * value (`order`), the rows keeping their order within their group. The
 * groups count their rows among `allRows`, all rows matching the query.
 */
export function groupRows<T>(
  rows: T[],
  allRows: T[],
  column: Column<T>,
  order: SortOrder,
  locale: Locale,
): RowGroup<T>[] {
  const groups = new Map<
    string,
    { allRows: T[]; label: string; rows: T[]; value: unknown }
  >();

  const groupOf = (row: T) => {
    const value = getColumnValue(row, column);
    const key = toText(value);
    let group = groups.get(key);

    if (!group) {
      group = {
        allRows: [],
        label: formatCellValue(value, locale) ?? key,
        rows: [],
        value,
      };
      groups.set(key, group);
    }

    return group;
  };

  for (const row of rows) groupOf(row).rows.push(row);
  for (const row of allRows) {
    const key = toText(getColumnValue(row, column));
    // Only groups of the page - the others are not shown
    groups.get(key)?.allRows.push(row);
  }

  const collator = getCollator(locale.code);
  const direction = order === "desc" ? -1 : 1;

  return [...groups.entries()]
    .map(([key, group]) => ({ ...group, key, sortKey: toSortKey(group.value) }))
    .sort((a, b) => compareSortKeys(a.sortKey, b.sortKey, collator, direction))
    .map((group) => ({
      allRows: group.allRows,
      key: group.key,
      label: group.label,
      rows: group.rows,
    }));
}

/**
 * The rows with those of each group together - the groups in the order of
 * their value (`order`, see `groupRows`), the rows keeping their order
 * within them - so that the pagination does not scatter a group.
 */
export const sortByGroups = <T>(
  rows: T[],
  column: Column<T>,
  order: SortOrder,
  locale: Locale,
) => groupRows(rows, [], column, order, locale).flatMap((group) => group.rows);

/** A group as the body renders it - see `TableBody`. */
export interface BodyRowGroup {
  /** The group is collapsed - its rows are not shown. */
  collapsed: boolean;
  /** The number of rows of the group - of every page. */
  count: number;
  /** Tells the group apart. */
  key: string;
  /** The value of the group as text - `""` for an empty one. */
  label: string;
  /** The number of rows of the group the body shows. */
  size: number;
  /** The summary of the rows of the group by column key - `null` for none. */
  summary: Record<string, unknown> | null;
}

/** The summaries of the columns over the rows of a group. */
export function summarizeGroup<T>(columns: Column<T>[], rows: T[]) {
  const values = columnRecord<unknown>();
  let hasValues = false;

  for (const column of columns) {
    if (column.summary !== undefined) {
      values[column.key] = computeSummary(column.summary, column, rows);
      hasValues = true;
    }
  }

  return hasValues ? values : null;
}
