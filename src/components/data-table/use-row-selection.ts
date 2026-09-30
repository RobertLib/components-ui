import { useCallback, useMemo, useState, type SetStateAction } from "react";
import type { RowId } from "./types";

interface RowSelectionOptions<T> {
  /** Ids of the rows selected at first - of an uncontrolled selection. */
  defaultSelectedIds?: RowId[];
  /**
   * The rows the selected ones are found among - `data` by default; all
   * rows of a client-side table, whose controlled selection may keep rows
   * of other pages.
   */
  lookupRows?: T[];
  /**
   * The rows are loading - they may be a placeholder (none, or the previous
   * page), so the selection is not narrowed down to them meanwhile.
   */
  loading?: boolean;
  /** The selection is dropped whenever it changes (other filters). */
  resetKey?: string;
  /** Controlled ids - the selection is what they are, nothing is dropped. */
  selectedIds?: RowId[];
}

/**
 * The selected rows among `data`. Uncontrolled, a row that leaves `data`
 * (another page, a refetch without it) leaves the selection for good - the
 * others stay selected - and everything is dropped when `resetKey`
 * changes. A controlled `selectedIds` is kept as it is.
 */
export default function useRowSelection<T extends { id: RowId }>(
  data: T[],
  {
    defaultSelectedIds,
    lookupRows = data,
    loading = false,
    resetKey = "default",
    selectedIds: controlledIds,
  }: RowSelectionOptions<T> = {},
) {
  const rowIds = useMemo(() => data.map((row) => row.id), [data]);
  // The ids of the rows by value - a refetch of the same rows keeps it
  const idsKey = useMemo(() => JSON.stringify(rowIds), [rowIds]);
  // Loading rows are placeholders, even when the result has the same ids
  // (including none). Reconcile the selection once the load has ended.
  const settledIdsKey = loading ? null : idsKey;

  const [selection, setSelection] = useState<{
    ids: RowId[];
    /** The last reconciled rows; null while waiting for a load to finish. */
    idsKey: string | null;
    key: string;
  }>(() => {
    // Only rows that are there - unless they are still on their way
    const present = new Set(rowIds);
    const ids = defaultSelectedIds ?? [];

    return {
      ids:
        loading || rowIds.length === 0
          ? ids
          : ids.filter((id) => present.has(id)),
      idsKey: settledIdsKey,
      key: resetKey,
    };
  });

  const isControlled = controlledIds !== undefined;

  if (!isControlled && selection.key !== resetKey) {
    // Dropped for good - coming back to the same filters starts unselected
    setSelection({ ids: [], idsKey: settledIdsKey, key: resetKey });
  } else if (!isControlled && selection.idsKey !== settledIdsKey) {
    // While loading, keep the selection. Once the rows arrive, a selected
    // row that is gone stays unselected when it comes back.
    const present = new Set(rowIds);
    setSelection({
      ids: loading
        ? selection.ids
        : selection.ids.filter((id) => present.has(id)),
      idsKey: settledIdsKey,
      key: resetKey,
    });
  }

  const uncontrolledIds = selection.key === resetKey ? selection.ids : [];
  const ids = controlledIds ?? uncontrolledIds;

  const selectedIds = useMemo(() => new Set(ids), [ids]);

  // The rows as they are now - a refetch with the same ids brings new
  // objects, which a group action must get instead of the stale ones
  const selectedRows = useMemo(() => {
    const currentRows = new Map(lookupRows.map((row) => [row.id, row]));
    return ids.flatMap((id) => currentRows.get(id) ?? []);
  }, [ids, lookupRows]);

  /** Changes an uncontrolled selection - that of the current `resetKey`. */
  const setSelectedIds = useCallback(
    (value: SetStateAction<RowId[]>) => {
      setSelection((previous) => {
        // Meant for the selection of other filters - it is gone already
        if (previous.key !== resetKey) return previous;

        return {
          ...previous,
          ids: typeof value === "function" ? value(previous.ids) : value,
        };
      });
    },
    [resetKey],
  );

  // Ids in a set - comparing every row with every selected one grew with
  // the square of the rows (a fifth of a second for 10 000)
  const isAllSelected =
    rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));

  return { ids, isAllSelected, selectedIds, selectedRows, setSelectedIds };
}
