import { useCallback, useMemo, useState, type SetStateAction } from "react";
import type { RowId } from "./types";

/**
 * Selected rows of the current page - dropped whenever `resetKey` changes
 * (another page, other filters).
 */
export default function useRowSelection<T extends { id: RowId }>(
  data: T[],
  resetKey = "default",
) {
  const [selection, setSelection] = useState<{
    key: string;
    rows: T[];
  }>({ key: resetKey, rows: [] });

  // Dropped for good - coming back to the same page starts unselected
  if (selection.key !== resetKey) {
    setSelection({ key: resetKey, rows: [] });
  }

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
        // Meant for the selection of another page - it is gone already
        if (previous.key !== resetKey) return previous;

        const rows = typeof value === "function" ? value(previous.rows) : value;
        return { key: resetKey, rows };
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

  const isAllSelected = useMemo(
    () =>
      data.length > 0 &&
      data.every((row) =>
        selectedRows.some((selected) => selected.id === row.id),
      ),
    [data, selectedRows],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedRows((prev) =>
      data.every((row) => prev.some((selected) => selected.id === row.id))
        ? []
        : [...data],
    );
  }, [data, setSelectedRows]);

  const resetSelection = useCallback(() => {
    setSelectedRows([]);
  }, [setSelectedRows]);

  return {
    isAllSelected,
    resetSelection,
    selectedRows,
    setSelectedRows,
    toggleRowSelection,
    toggleSelectAll,
  };
}
