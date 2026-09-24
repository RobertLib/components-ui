import { useState } from "react";
import type { Column } from "./types";

/**
 * The same columns for client-side filtering, searching and sorting - equal
 * keys, filter types and functions they read the values with.
 */
const isSameForQuery = <T>(a: Column<T>[], b: Column<T>[]) =>
  a.length === b.length &&
  a.every((column, index) => {
    const other = b[index];

    return (
      column.key === other.key &&
      column.filter === other.filter &&
      column.filterFn === other.filterFn &&
      column.getValue === other.getValue
    );
  });

/**
 * `columns` as the rows are filtered and sorted by - the previous array while
 * a new one filters and sorts the same way, e.g. an inline
 * `columns.slice(0, 4)` or columns with an inline `render`. Keeps the
 * client-side filtering from running again on every render of the parent;
 * the array is meant for that only, the other fields may be out of date.
 */
export default function useQueryColumns<T>(columns: Column<T>[]) {
  const [previous, setPrevious] = useState(columns);
  const isSame = previous === columns || isSameForQuery(previous, columns);

  if (!isSame) setPrevious(columns);

  return isSame ? previous : columns;
}
