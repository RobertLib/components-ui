import type { RowId } from "./types";

/** Default row identity. Custom data shapes use the table's `getRowId`. */
export function defaultRowId(row: unknown): RowId {
  const id = (row as { id?: unknown } | null)?.id;
  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error("DataTable: a row needs an id or a getRowId callback.");
  }
  return id;
}

/** A row's identity as text, keeping number and string ids distinct. */
export const getRowKey = (id: RowId) => JSON.stringify([typeof id, String(id)]);
