import { useCallback, useMemo, useState, type SetStateAction } from "react";
import type { RowId } from "./types";

interface RowSelectionOptions {
  /**
   * The rows are loading - they may be a placeholder (none, or the previous
   * page), so the selection is not narrowed down to them meanwhile.
   */
  loading?: boolean;
  /** The selection is dropped whenever it changes (other filters). */
  resetKey?: string;
}

/**
 * The selected rows among `data`. A row that leaves `data` (another page, a
 * refetch without it) leaves the selection for good - the others stay
 * selected. Everything is dropped when `resetKey` changes.
 */
export default function useRowSelection<T extends { id: RowId }>(
  data: T[],
  { loading = false, resetKey = "default" }: RowSelectionOptions = {},
) {
  const rowIds = useMemo(() => data.map((row) => row.id), [data]);
  // The ids of the rows by value - a refetch of the same rows keeps it
  const idsKey = useMemo(() => JSON.stringify(rowIds), [rowIds]);

  const [selection, setSelection] = useState<{
    idsKey: string;
    key: string;
    rows: T[];
  }>({ idsKey, key: resetKey, rows: [] });

  if (selection.key !== resetKey) {
    // Dropped for good - coming back to the same filters starts unselected
    setSelection({ idsKey, key: resetKey, rows: [] });
  } else if (!loading && selection.idsKey !== idsKey) {
    // Other rows came - a selected row that is gone stays unselected when
    // it comes back (a return to its page)
    const present = new Set(rowIds);
    setSelection({
      idsKey,
      key: resetKey,
      rows: selection.rows.filter((row) => present.has(row.id)),
    });
  }

  const selectedIds = useMemo(
    () =>
      new Set(
        selection.key === resetKey ? selection.rows.map((row) => row.id) : [],
      ),
    [resetKey, selection],
  );

  // The rows as they are now - a refetch with the same ids brings new
  // objects, which a group action must get instead of the stale ones
  const selectedRows = useMemo(() => {
    if (selection.key !== resetKey) return [];

    const currentRows = new Map(data.map((row) => [row.id, row]));
    return selection.rows.flatMap((row) => {
      const current = currentRows.get(row.id);
      return current ? [current] : [];
    });
  }, [data, resetKey, selection]);

  const setSelectedRows = useCallback(
    (value: SetStateAction<T[]>) => {
      setSelection((previous) => {
        // Meant for the selection of other filters - it is gone already
        if (previous.key !== resetKey) return previous;

        return {
          ...previous,
          rows: typeof value === "function" ? value(previous.rows) : value,
        };
      });
    },
    [resetKey],
  );

  const toggleRowSelection = useCallback(
    (row: T) => {
      setSelectedRows((prev) =>
        prev.some((r) => r.id === row.id)
          ? prev.filter((r) => r.id !== row.id)
          : [...prev, row],
      );
    },
    [setSelectedRows],
  );

  // Ids in a set - comparing every row with every selected one grew with
  // the square of the rows (a fifth of a second for 10 000)
  const isAllSelected =
    rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const selected = new Set(prev.map((row) => row.id));
      return rowIds.every((id) => selected.has(id)) ? [] : [...data];
    });
  }, [data, rowIds, setSelectedRows]);

  const resetSelection = useCallback(() => {
    setSelectedRows([]);
  }, [setSelectedRows]);

  return {
    isAllSelected,
    resetSelection,
    selectedIds,
    selectedRows,
    setSelectedRows,
    toggleRowSelection,
    toggleSelectAll,
  };
}
