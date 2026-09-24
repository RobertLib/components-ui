import type { Column, ColumnPin, DataTableDensity } from "./types";
import { useCallback, useMemo } from "react";
import useTableState from "./use-table-state";

/** The record without `key`. */
function withoutKey<V>(record: Record<string, V>, key: string) {
  const result = { ...record };
  delete result[key];
  return result;
}

export default function useColumnManagement<T>(
  columns: Column<T>[],
  tableId?: string,
) {
  const [state, updateState] = useTableState(tableId);

  // The user's choices over the columns' defaults
  const columnVisibility = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          state.columnVisibility[column.key] ?? column.visible ?? true,
        ]),
      ),
    [columns, state.columnVisibility],
  );

  // The edge each column sticks to - the user's choice, or the column's
  const pinnedColumns = useMemo(() => {
    const pinned: Record<ColumnPin, string[]> = { left: [], right: [] };

    for (const column of columns) {
      const pin = state.columnPinning[column.key] ?? column.pinned ?? false;
      if (pin) pinned[pin].push(column.key);
    }

    return pinned;
  }, [columns, state.columnPinning]);

  // Columns added since the order was saved go last
  const columnOrder = useMemo(() => {
    const keys = columns.map((column) => column.key);
    const known = new Set(keys);
    const saved = state.columnOrder.filter((key) => known.has(key));
    const placed = new Set(saved);

    return [...saved, ...keys.filter((key) => !placed.has(key))];
  }, [columns, state.columnOrder]);

  const setColumnOrder = useCallback(
    (newOrder: string[] | ((prev: string[]) => string[])) => {
      const order =
        typeof newOrder === "function" ? newOrder(columnOrder) : newOrder;
      const isDefault =
        order.length === columns.length &&
        order.every((key, index) => key === columns[index].key);

      updateState({ columnOrder: isDefault ? [] : order });
    },
    [columnOrder, columns, updateState],
  );

  const setColumnVisibility = useCallback(
    (
      newVisibility:
        | Record<string, boolean>
        | ((prev: Record<string, boolean>) => Record<string, boolean>),
    ) => {
      const visibility =
        typeof newVisibility === "function"
          ? newVisibility(columnVisibility)
          : newVisibility;

      // Only what differs from the column's default is remembered
      updateState({
        columnVisibility: Object.fromEntries(
          columns
            .filter(
              (column) =>
                visibility[column.key] !== undefined &&
                visibility[column.key] !== (column.visible ?? true),
            )
            .map((column) => [column.key, visibility[column.key]]),
        ),
      });
    },
    [columnVisibility, columns, updateState],
  );

  /** Pins a column to an edge - or unpins it when it is pinned there. */
  const handlePinColumn = useCallback(
    (columnKey: string, position: ColumnPin) => {
      const column = columns.find((candidate) => candidate.key === columnKey);
      if (!column) return;

      const current = pinnedColumns.left.includes(columnKey)
        ? "left"
        : pinnedColumns.right.includes(columnKey)
          ? "right"
          : false;
      const next = current === position ? false : position;
      // Only what differs from the column's default is remembered
      const others = withoutKey(state.columnPinning, columnKey);

      updateState({
        columnPinning:
          next === (column.pinned ?? false)
            ? others
            : { ...others, [columnKey]: next },
      });
    },
    [columns, pinnedColumns, state.columnPinning, updateState],
  );

  /** The widths the user resized the columns to, by column key. */
  const columnWidths = state.columnWidths;

  /** Remembers the width of a column - `null` brings back its own. */
  const setColumnWidth = useCallback(
    (columnKey: string, width: number | null) => {
      const others = withoutKey(state.columnWidths, columnKey);

      updateState({
        columnWidths:
          width === null ? others : { ...others, [columnKey]: width },
      });
    },
    [state.columnWidths, updateState],
  );

  /** The order, pinning and widths of the columns' definitions. */
  const resetColumnLayout = useCallback(
    () => updateState({ columnOrder: [], columnPinning: {}, columnWidths: {} }),
    [updateState],
  );

  const setDensity = useCallback(
    (density: DataTableDensity | null) => updateState({ density }),
    [updateState],
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, columnKey: string) => {
      event.dataTransfer.setData("columnKey", columnKey);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, targetColumnKey: string) => {
      event.preventDefault();

      const draggedColumnKey = event.dataTransfer.getData("columnKey");

      // Something else dropped here - a file, a text, a column of another table
      if (!columnOrder.includes(draggedColumnKey)) return;

      if (draggedColumnKey !== targetColumnKey) {
        setColumnOrder((prevOrder) => {
          const newOrder = [...prevOrder];
          const draggedIdx = newOrder.indexOf(draggedColumnKey);
          const targetIdx = newOrder.indexOf(targetColumnKey);

          newOrder.splice(draggedIdx, 1);
          newOrder.splice(targetIdx, 0, draggedColumnKey);

          return newOrder;
        });
      }
    },
    [columnOrder, setColumnOrder],
  );

  /** Moves a column one place up (`-1`) or down (`1`) - the arrow keys. */
  const moveColumn = useCallback(
    (columnKey: string, offset: -1 | 1) => {
      setColumnOrder((prevOrder) => {
        const from = prevOrder.indexOf(columnKey);
        const to = from + offset;
        if (from === -1 || to < 0 || to >= prevOrder.length) return prevOrder;

        const newOrder = [...prevOrder];
        newOrder.splice(from, 1);
        newOrder.splice(to, 0, columnKey);
        return newOrder;
      });
    },
    [setColumnOrder],
  );

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[column.key]);
  }, [columns, columnVisibility]);

  const sortedVisibleColumns = useMemo(() => {
    return [...visibleColumns].sort((a, b) => {
      if (
        pinnedColumns.left.includes(a.key) &&
        !pinnedColumns.left.includes(b.key)
      ) {
        return -1;
      }
      if (
        !pinnedColumns.left.includes(a.key) &&
        pinnedColumns.left.includes(b.key)
      ) {
        return 1;
      }
      if (
        pinnedColumns.right.includes(a.key) &&
        !pinnedColumns.right.includes(b.key)
      ) {
        return 1;
      }
      if (
        !pinnedColumns.right.includes(a.key) &&
        pinnedColumns.right.includes(b.key)
      ) {
        return -1;
      }

      return columnOrder.indexOf(a.key) - columnOrder.indexOf(b.key);
    });
  }, [columnOrder, pinnedColumns.left, pinnedColumns.right, visibleColumns]);

  // Anything "Reset columns" would change - the default order, visibility,
  // pinning and widths of the columns
  const hasCustomSettings =
    columnOrder.some((key, index) => key !== columns[index]?.key) ||
    columns.some(
      (column) =>
        columnVisibility[column.key] !== (column.visible ?? true) ||
        (state.columnPinning[column.key] ?? column.pinned ?? false) !==
          (column.pinned ?? false) ||
        columnWidths[column.key] !== undefined,
    );

  return {
    columnOrder,
    columnVisibility,
    columnWidths,
    density: state.density,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handlePinColumn,
    hasCustomSettings,
    moveColumn,
    pinnedColumns,
    resetColumnLayout,
    setColumnOrder,
    setColumnVisibility,
    setColumnWidth,
    setDensity,
    sortedVisibleColumns,
    visibleColumns,
  };
}
