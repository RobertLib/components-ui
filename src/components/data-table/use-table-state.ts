import { useCallback, useState, useSyncExternalStore } from "react";
import logger from "../../utils/logger";
import type { ColumnPin, DataTableDensity } from "./types";

/**
 * The user's table settings - only what differs from the columns' and the
 * table's own defaults, so a column added or changed later follows its
 * definition.
 */
export interface TableState {
  /** The order the user dragged the columns into, `[]` for the default. */
  columnOrder: string[];
  /** Columns the user pinned (or unpinned - `false`) against their `pinned`. */
  columnPinning: Record<string, ColumnPin | false>;
  /** Columns the user showed or hid against their `visible`. */
  columnVisibility: Record<string, boolean>;
  /** Widths in pixels of the columns the user resized. */
  columnWidths: Record<string, number>;
  /** The row density the user picked - `null` for the `density` of the table. */
  density: DataTableDensity | null;
}

export const EMPTY_TABLE_STATE: TableState = {
  columnOrder: [],
  columnPinning: {},
  columnVisibility: {},
  columnWidths: {},
  density: null,
};

const DENSITIES: readonly string[] = [
  "compact",
  "normal",
  "comfortable",
] satisfies DataTableDensity[];

const storageKey = (tableId: string) => `table-state-${tableId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/** The entries of a saved record whose values `isValid` accepts. */
const pickEntries = <V>(
  value: unknown,
  isValid: (item: unknown) => item is V,
): Record<string, V> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, V] =>
          isValid(entry[1]),
        ),
      )
    : {};

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isPinning = (value: unknown): value is ColumnPin | false =>
  value === "left" || value === "right" || value === false;

const isWidth = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * The pinning of a saved state - also of one saved before columns had a
 * `pinned` default, which listed the pinned columns of each edge.
 */
function parsePinning(saved: Record<string, unknown>) {
  const pinning = pickEntries(saved.columnPinning, isPinning);
  if (isRecord(saved.columnPinning) || !isRecord(saved.pinnedColumns)) {
    return pinning;
  }

  const { left, right } = saved.pinnedColumns;
  for (const key of toStringArray(right)) pinning[key] = "right";
  for (const key of toStringArray(left)) pinning[key] = "left";
  return pinning;
}

/** Reads a saved state, tolerating older or hand-edited values. */
function parseState(saved: unknown): TableState {
  if (!isRecord(saved)) return EMPTY_TABLE_STATE;

  return {
    columnOrder: toStringArray(saved.columnOrder),
    columnPinning: parsePinning(saved),
    columnVisibility: pickEntries(saved.columnVisibility, isBoolean),
    columnWidths: pickEntries(saved.columnWidths, isWidth),
    density:
      typeof saved.density === "string" && DENSITIES.includes(saved.density)
        ? (saved.density as DataTableDensity)
        : null,
  };
}

const isEmptyState = (state: TableState) =>
  state.columnOrder.length === 0 &&
  Object.keys(state.columnPinning).length === 0 &&
  Object.keys(state.columnVisibility).length === 0 &&
  Object.keys(state.columnWidths).length === 0 &&
  state.density === null;

// Read on every render - an unreadable storage is reported once
let isUnreadableReported = false;

/**
 * The text saved under `tableId`. Just reading `localStorage` throws with
 * blocked site data or in a sandboxed iframe - `typeof localStorage` too.
 */
function readSaved(tableId: string) {
  try {
    return typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(storageKey(tableId));
  } catch (error) {
    if (!isUnreadableReported) {
      isUnreadableReported = true;
      logger.error("Failed to load table state from localStorage", error);
    }
    return null;
  }
}

// The parsed settings by table id with the text they were read from - a
// snapshot stays the same object as long as the text does
const snapshots = new Map<
  string,
  { saved: string | null; state: TableState }
>();

// Settings that could not be saved (blocked or full storage) - they last
// until the page is reloaded
const unsaved = new Map<string, TableState>();

const listeners = new Set<() => void>();

/** The settings of a table - those saved, or those that could not be saved. */
function getTableState(tableId: string): TableState {
  const unsavedState = unsaved.get(tableId);
  if (unsavedState) return unsavedState;

  const saved = readSaved(tableId);
  const snapshot = snapshots.get(tableId);
  if (snapshot?.saved === saved) return snapshot.state;

  let state = EMPTY_TABLE_STATE;
  try {
    if (saved) state = parseState(JSON.parse(saved));
  } catch (error) {
    logger.error("Failed to load table state from localStorage", error);
  }

  snapshots.set(tableId, { saved, state });
  return state;
}

function setTableState(tableId: string, state: TableState) {
  try {
    if (isEmptyState(state)) {
      localStorage.removeItem(storageKey(tableId));
    } else {
      localStorage.setItem(storageKey(tableId), JSON.stringify(state));
    }
    unsaved.delete(tableId);
  } catch (error) {
    logger.error("Failed to save table state to localStorage", error);
    unsaved.set(tableId, state);
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab of the app changed the settings
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// The server has no localStorage - it renders the default columns, which is
// also what the page hydrates with before switching to the saved ones
const getServerSnapshot = () => EMPTY_TABLE_STATE;

/**
 * The settings of a table (column order, visibility, pinning and widths,
 * row density), remembered in `localStorage` under `tableId`. Include the
 * user in `tableId` when several people share a browser.
 */
export default function useTableState(
  tableId: string | undefined,
): [TableState, (state: Partial<TableState>) => void] {
  // Without an id the settings last as long as the table
  const [localState, setLocalState] = useState(EMPTY_TABLE_STATE);

  // Read while rendering in the browser, so a client-rendered table shows
  // the saved columns from its first render on
  const storedState = useSyncExternalStore(
    subscribe,
    () => (tableId ? getTableState(tableId) : EMPTY_TABLE_STATE),
    getServerSnapshot,
  );

  const updateState = useCallback(
    (changes: Partial<TableState>) => {
      if (tableId) {
        // On the latest settings - several changes may come in a row
        setTableState(tableId, { ...getTableState(tableId), ...changes });
      } else {
        setLocalState((previous) => ({ ...previous, ...changes }));
      }
    },
    [tableId],
  );

  return [tableId ? storedState : localState, updateState];
}
