import type {
  Column,
  ColumnPin,
  DataTableColumnState,
  DataTableDensity,
} from "./types";
import { useCallback, useMemo, useState } from "react";
import columnRecord from "./column-record";
import usePendingValue from "./use-pending-value";
import useTableState, {
  EMPTY_TABLE_STATE,
  fromColumnState,
  toColumnState,
  type TableState,
} from "./use-table-state";

/** The record without `key`. */
function withoutKey<V>(record: Record<string, V>, key: string) {
  const result = columnRecord(record);
  delete result[key];
  return result;
}

/** The fields of the settings that are about the columns. */
const COLUMN_FIELDS = [
  "columnOrder",
  "columnPinning",
  "columnVisibility",
  "columnWidths",
] as const;

const isSameState = (a: TableState, b: TableState) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The order with the columns of each group next to each other - where the
 * first of them is. A saved order from before the groups may tear them
 * apart.
 */
function keepGroupsTogether(
  order: string[],
  groupOf: Readonly<Record<string, string>>,
) {
  if (Object.keys(groupOf).length === 0) return order;

  const result: string[] = [];
  const placedGroups = new Set<string>();

  for (const key of order) {
    const group = groupOf[key];
    if (group === undefined) {
      result.push(key);
    } else if (!placedGroups.has(group)) {
      placedGroups.add(group);
      result.push(...order.filter((candidate) => groupOf[candidate] === group));
    }
  }

  return result;
}

function resolveColumnVisibility<T>(
  columns: Column<T>[],
  visibility: TableState["columnVisibility"],
) {
  return Object.fromEntries(
    columns.map((column) => [
      column.key,
      visibility[column.key] ?? column.visible ?? true,
    ]),
  );
}

function resolveColumnOrder<T>(
  columns: Column<T>[],
  order: string[],
  groupOf: Readonly<Record<string, string>>,
) {
  const keys = columns.map((column) => column.key);
  const known = new Set(keys);
  const saved = order.filter((key) => known.has(key));
  const placed = new Set(saved);

  return keepGroupsTogether(
    [...saved, ...keys.filter((key) => !placed.has(key))],
    groupOf,
  );
}

export interface ColumnManagementOptions {
  /** Controlled column settings - see `DataTableProps.columnState`. */
  columnState?: DataTableColumnState;
  /** Initial column settings of an uncontrolled table. */
  defaultColumnState?: DataTableColumnState;
  /** The key of the group of each grouped column - they move within it. */
  groupOf?: Readonly<Record<string, string>>;
  /** Called with the column settings whenever the user changes them. */
  onColumnStateChange?: (state: DataTableColumnState) => void;
}

const NO_GROUPS = /* @__PURE__ */ columnRecord<string>();

export default function useColumnManagement<T>(
  columns: Column<T>[],
  tableId?: string,
  {
    columnState,
    defaultColumnState,
    groupOf = NO_GROUPS,
    onColumnStateChange,
  }: ColumnManagementOptions = {},
) {
  // The first `defaultColumnState` - it is the initial state only
  const [initialState] = useState<TableState>(() =>
    defaultColumnState
      ? { ...fromColumnState(defaultColumnState), density: null }
      : EMPTY_TABLE_STATE,
  );
  const [storedState, updateStoredState] = useTableState(tableId, initialState);

  // A controlled `columnState` wins over the stored columns - the row
  // density stays stored
  const isControlled = columnState !== undefined;
  const controlledKey = isControlled ? JSON.stringify(columnState) : null;
  const state = useMemo<TableState>(
    () =>
      controlledKey === null
        ? storedState
        : {
            ...fromColumnState(
              JSON.parse(controlledKey) as DataTableColumnState,
            ),
            density: storedState.density,
          },
    [controlledKey, storedState],
  );

  // Several changes may come in a row (a reset changes the layout and the
  // visibility) - each builds on the one before, also before the owner of a
  // controlled state shows it
  const latestState = usePendingValue(state, isSameState);

  const updateState = useCallback(
    (
      update:
        Partial<TableState> | ((previous: TableState) => Partial<TableState>),
    ) => {
      const previous = latestState.get();
      const changes = typeof update === "function" ? update(previous) : update;
      const next = { ...previous, ...changes };
      latestState.set(next);

      if (!isControlled) {
        updateStoredState(changes);
      } else if (changes.density !== undefined) {
        updateStoredState({ density: changes.density });
      }

      if (COLUMN_FIELDS.some((field) => field in changes)) {
        onColumnStateChange?.(toColumnState(next));
      }
    },
    [isControlled, latestState, onColumnStateChange, updateStoredState],
  );

  // The user's choices over the columns' defaults
  const columnVisibility = useMemo(
    () => resolveColumnVisibility(columns, state.columnVisibility),
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
  const columnOrder = useMemo(
    () => resolveColumnOrder(columns, state.columnOrder, groupOf),
    [columns, groupOf, state.columnOrder],
  );

  const setColumnOrder = useCallback(
    (newOrder: string[] | ((prev: string[]) => string[])) => {
      updateState((previous) => {
        const order =
          typeof newOrder === "function"
            ? newOrder(
                resolveColumnOrder(columns, previous.columnOrder, groupOf),
              )
            : newOrder;
        const isDefault =
          order.length === columns.length &&
          order.every((key, index) => key === columns[index].key);

        return { columnOrder: isDefault ? [] : order };
      });
    },
    [columns, groupOf, updateState],
  );

  const setColumnVisibility = useCallback(
    (
      newVisibility:
        | Record<string, boolean>
        | ((prev: Record<string, boolean>) => Record<string, boolean>),
    ) => {
      updateState((previous) => {
        const visibility =
          typeof newVisibility === "function"
            ? newVisibility(
                resolveColumnVisibility(columns, previous.columnVisibility),
              )
            : newVisibility;

        // Only what differs from the column's default is remembered
        return {
          columnVisibility: columnRecord(
            Object.fromEntries(
              columns
                .filter(
                  (column) =>
                    visibility[column.key] !== undefined &&
                    visibility[column.key] !== (column.visible ?? true),
                )
                .map((column) => [column.key, visibility[column.key]]),
            ),
          ),
        };
      });
    },
    [columns, updateState],
  );

  /** Pins a column to an edge - or unpins it when it is pinned there. */
  const handlePinColumn = useCallback(
    (columnKey: string, position: ColumnPin) => {
      const column = columns.find((candidate) => candidate.key === columnKey);
      if (!column) return;

      updateState((previous) => {
        const current =
          previous.columnPinning[columnKey] ?? column.pinned ?? false;
        const next = current === position ? false : position;
        // Only what differs from the column's default is remembered
        const pinning = withoutKey(previous.columnPinning, columnKey);
        if (next !== (column.pinned ?? false)) pinning[columnKey] = next;

        return { columnPinning: pinning };
      });
    },
    [columns, updateState],
  );

  /** The widths the user resized the columns to, by column key. */
  const columnWidths = state.columnWidths;

  /** Remembers the width of a column - `null` brings back its own. */
  const setColumnWidth = useCallback(
    (columnKey: string, width: number | null) => {
      updateState((previous) => {
        const widths = withoutKey(previous.columnWidths, columnKey);
        if (width !== null) widths[columnKey] = width;

        return { columnWidths: widths };
      });
    },
    [updateState],
  );

  /** The order, pinning and widths of the columns' definitions. */
  const resetColumnLayout = useCallback(
    () =>
      updateState({
        columnOrder: [],
        columnPinning: columnRecord(),
        columnWidths: columnRecord(),
      }),
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
      const draggedGroup = groupOf[draggedColumnKey];
      const targetGroup = groupOf[targetColumnKey];

      // Something else dropped here - a file, a text, a column of another
      // table - or a column of a group dropped out of it, which it stays in
      if (
        !columnOrder.includes(draggedColumnKey) ||
        (draggedGroup !== undefined && draggedGroup !== targetGroup)
      ) {
        return;
      }

      if (draggedColumnKey !== targetColumnKey) {
        setColumnOrder((prevOrder) => {
          const newOrder = [...prevOrder];
          const draggedIdx = newOrder.indexOf(draggedColumnKey);
          let targetIdx = newOrder.indexOf(targetColumnKey);

          // A column of none dropped on a group goes past it as a whole -
          // after it moving on, before it moving back - as the arrow keys
          // move it
          if (draggedGroup === undefined && targetGroup !== undefined) {
            targetIdx =
              draggedIdx < targetIdx
                ? newOrder.findLastIndex((key) => groupOf[key] === targetGroup)
                : newOrder.findIndex((key) => groupOf[key] === targetGroup);
          }

          newOrder.splice(draggedIdx, 1);
          newOrder.splice(targetIdx, 0, draggedColumnKey);

          return newOrder;
        });
      }
    },
    [columnOrder, groupOf, setColumnOrder],
  );

  /**
   * Moves a column one place up (`-1`) or down (`1`) - the arrow keys. A
   * column of a group stays in it; a column of none steps over a group
   * as a whole.
   */
  const moveColumn = useCallback(
    (columnKey: string, offset: -1 | 1) => {
      setColumnOrder((prevOrder) => {
        const from = prevOrder.indexOf(columnKey);
        let to = from + offset;
        if (from === -1 || to < 0 || to >= prevOrder.length) return prevOrder;

        const group = groupOf[columnKey];
        const passedGroup = groupOf[prevOrder[to]];
        if (group !== undefined && passedGroup !== group) return prevOrder;
        if (group === undefined && passedGroup !== undefined) {
          while (
            to + offset >= 0 &&
            to + offset < prevOrder.length &&
            groupOf[prevOrder[to + offset]] === passedGroup
          ) {
            to += offset;
          }
        }

        const newOrder = [...prevOrder];
        newOrder.splice(from, 1);
        newOrder.splice(to, 0, columnKey);
        return newOrder;
      });
    },
    [groupOf, setColumnOrder],
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
