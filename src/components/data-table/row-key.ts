import type { RowId } from "./types";

/** A row's identity as text, keeping number and string ids distinct. */
export const getRowKey = (id: RowId) => JSON.stringify([typeof id, String(id)]);
