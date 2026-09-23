import type { Column } from "./types";
import { useCallback, useMemo } from "react";
import useTableState from "./use-table-state";

export default function useColumnManagement<T>(
  columns: Column<T>[],
  tableId?: string,
) {
  const [state, updateState] = useTableState(tableId);

  const { pinnedColumns } = state;

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

  const setPinnedColumns = useCallback(
    (
      newPinnedColumns:
        | { left: string[]; right: string[] }
        | ((prev: { left: string[]; right: string[] }) => {
            left: string[];
            right: string[];
          }),
    ) => {
      if (typeof newPinnedColumns === "function") {
        updateState({
          pinnedColumns: newPinnedColumns(pinnedColumns),
        });
      } else {
        updateState({ pinnedColumns: newPinnedColumns });
      }
    },
    [pinnedColumns, updateState],
  );

  const handlePinColumn = useCallback(
    (columnKey: string, position: "left" | "right") => {
      setPinnedColumns((prev) => {
        const oppositePosition = position === "left" ? "right" : "left";

        const oppositeFiltered = prev[oppositePosition].filter(
          (key) => key !== columnKey,
        );

        const isCurrentlyPinned = prev[position].includes(columnKey);

        if (isCurrentlyPinned) {
          return {
            ...prev,
            [oppositePosition]: oppositeFiltered,
            [position]: prev[position].filter((key) => key !== columnKey),
          };
        }

        return {
          ...prev,
          [oppositePosition]: oppositeFiltered,
          [position]: [...prev[position], columnKey],
        };
      });
    },
    [setPinnedColumns],
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

  return {
    columnOrder,
    columnVisibility,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handlePinColumn,
    moveColumn,
    pinnedColumns,
    setColumnOrder,
    setColumnVisibility,
    setPinnedColumns,
    sortedVisibleColumns,
    visibleColumns,
  };
}
