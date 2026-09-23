import { useCallback, useEffect, useState } from "react";
import logger from "../../utils/logger";

/**
 * The user's column settings - only what differs from the columns' own
 * defaults, so a column added or changed later follows its definition.
 */
export interface TableState {
  /** The order the user dragged the columns into, `[]` for the default. */
  columnOrder: string[];
  /** Columns the user showed or hid against their `visible`. */
  columnVisibility: Record<string, boolean>;
  pinnedColumns: { left: string[]; right: string[] };
}

export const EMPTY_TABLE_STATE: TableState = {
  columnOrder: [],
  columnVisibility: {},
  pinnedColumns: { left: [], right: [] },
};

const storageKey = (tableId: string) => `table-state-${tableId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/** Reads a saved state, tolerating older or hand-edited values. */
function parseState(saved: unknown): TableState {
  if (!isRecord(saved)) return EMPTY_TABLE_STATE;

  const pinned = isRecord(saved.pinnedColumns) ? saved.pinnedColumns : {};
  const visibility = isRecord(saved.columnVisibility)
    ? saved.columnVisibility
    : {};

  return {
    columnOrder: toStringArray(saved.columnOrder),
    columnVisibility: Object.fromEntries(
      Object.entries(visibility).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    ),
    pinnedColumns: {
      left: toStringArray(pinned.left),
      right: toStringArray(pinned.right),
    },
  };
}

function loadState(tableId: string | undefined): TableState {
  if (!tableId || typeof localStorage === "undefined") {
    return EMPTY_TABLE_STATE;
  }

  try {
    const saved = localStorage.getItem(storageKey(tableId));
    return saved ? parseState(JSON.parse(saved)) : EMPTY_TABLE_STATE;
  } catch (error) {
    logger.error("Failed to load table state from localStorage", error);
    return EMPTY_TABLE_STATE;
  }
}

const isEmptyState = (state: TableState) =>
  state.columnOrder.length === 0 &&
  Object.keys(state.columnVisibility).length === 0 &&
  state.pinnedColumns.left.length === 0 &&
  state.pinnedColumns.right.length === 0;

/**
 * The column settings of a table (order, visibility, pinning), remembered
 * in `localStorage` under `tableId`. Include the user in `tableId` when
 * several people share a browser.
 */
export default function useTableState(
  tableId: string | undefined,
): [TableState, (state: Partial<TableState>) => void] {
  const [state, setState] = useState(() => loadState(tableId));

  // Another table id (e.g. another user) - load its settings
  const [loadedTableId, setLoadedTableId] = useState(tableId);

  if (tableId !== loadedTableId) {
    setLoadedTableId(tableId);
    setState(loadState(tableId));
  }

  useEffect(() => {
    if (!tableId) return;

    try {
      if (isEmptyState(state)) {
        localStorage.removeItem(storageKey(tableId));
      } else {
        localStorage.setItem(storageKey(tableId), JSON.stringify(state));
      }
    } catch (error) {
      logger.error("Failed to save table state to localStorage", error);
    }
  }, [state, tableId]);

  const updateState = useCallback((newState: Partial<TableState>) => {
    setState((prevState) => ({ ...prevState, ...newState }));
  }, []);

  return [state, updateState];
}
