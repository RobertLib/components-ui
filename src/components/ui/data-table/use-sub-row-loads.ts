import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useRef,
  useState,
} from "react";
import logger from "../../../utils/logger";

/** Loads the sub rows of a row - `signal` aborts when they are not wanted. */
export type LoadSubRows<T> = (
  row: T,
  options: { signal: AbortSignal },
) => Promise<T[]>;

/**
 * The sub rows `loadSubRows` brought for a row, or the state of loading
 * them. `rows` are those shown meanwhile - loaded before, under another
 * `loadSubRowsKey`, or kept while a reload failed.
 */
export interface SubRowLoad<T> {
  rows?: readonly T[];
  /**
   * `stale` - loaded under another `loadSubRowsKey`, to be loaded again
   * once shown.
   */
  status: "error" | "loaded" | "loading" | "stale";
}

/** Calls `loadSubRows` - a synchronous throw becomes a rejection. */
const callLoadSubRows = <T>(
  load: LoadSubRows<T>,
  row: T,
  signal: AbortSignal,
) => new Promise<T[]>((resolve) => resolve(load(row, { signal })));

/**
 * What is left of a load that is no longer wanted - its rows to load again
 * when they are wanted again, nothing without rows.
 */
const toStale = <T>(load: SubRowLoad<T>): SubRowLoad<T> | null =>
  load.rows ? { rows: load.rows, status: "stale" } : null;

interface SubRowLoadsOptions<T> {
  /** Changing it loads again the sub rows shown; the others are dropped. */
  loadKey?: string | number;
  /** A load failed - after it is logged. */
  onError?: (error: unknown, row: T) => void;
  /** The sub rows of the row of `key` arrived. */
  onLoaded?: (key: string, rows: readonly T[]) => void;
}

/**
 * The sub rows `loadSubRows` brought for the rows of a `DataTable`, by the
 * key of their row, and whether they are loading or failed. Each row loads
 * once - `retry` tries a failed one again - and keeps its rows while it is
 * not shown. `release` aborts the loads no longer wanted, and so does
 * unmounting.
 */
export default function useSubRowLoads<T>(
  loadSubRows: LoadSubRows<T> | undefined,
  { loadKey, onError, onLoaded }: SubRowLoadsOptions<T> = {},
) {
  const [loads, setLoads] = useState<ReadonlyMap<string, SubRowLoad<T>>>(
    () => new Map(),
  );

  // Another key - the rows loaded so far are loaded again when shown
  const [previousKey, setPreviousKey] = useState(loadKey);
  if (loadKey !== previousKey) {
    setPreviousKey(loadKey);
    const next = new Map<string, SubRowLoad<T>>();
    for (const [key, load] of loads) {
      const stale = toStale(load);
      if (stale) next.set(key, stale);
    }
    setLoads(next);
  }

  // The latest callbacks for the loads on their way
  const callbacks = useRef({ loadSubRows, onError, onLoaded });
  useInsertionEffect(() => {
    callbacks.current = { loadSubRows, onError, onLoaded };
  });

  // The loads on their way by key - aborted with another `loadKey` and on
  // unmount (also when Activity hides the table; shown again, the loads
  // still wanted start again)
  const running = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const controllers = running.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, [loadKey]);

  /** Starts loading the sub rows of `row`, unless they are on their way. */
  const load = useCallback((key: string, row: T) => {
    const loader = callbacks.current.loadSubRows;
    if (!loader || running.current.has(key)) return;

    const controller = new AbortController();
    running.current.set(key, controller);
    setLoads((previous) =>
      new Map(previous).set(key, {
        rows: previous.get(key)?.rows,
        status: "loading",
      }),
    );

    callLoadSubRows(loader, row, controller.signal).then(
      (rows) => {
        if (controller.signal.aborted) return;
        running.current.delete(key);
        const subRows = Array.isArray(rows) ? rows : [];
        setLoads((previous) =>
          new Map(previous).set(key, { rows: subRows, status: "loaded" }),
        );
        callbacks.current.onLoaded?.(key, subRows);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        running.current.delete(key);
        logger.error("DataTable: loadSubRows failed", error);
        setLoads((previous) =>
          new Map(previous).set(key, {
            rows: previous.get(key)?.rows,
            status: "error",
          }),
        );
        callbacks.current.onError?.(error, row);
      },
    );
  }, []);

  /**
   * Aborts the loads of rows that are not in `wanted` - collapsed, gone
   * from the page - and forgets all but their loaded rows: a failure, so
   * that expanding the row again tries again, and the rows of another
   * `loadKey`, which would be loaded again.
   */
  const release = useCallback((wanted: ReadonlySet<string>) => {
    for (const [key, controller] of running.current) {
      if (!wanted.has(key)) {
        controller.abort();
        running.current.delete(key);
      }
    }

    setLoads((previous) => {
      let next: Map<string, SubRowLoad<T>> | null = null;
      for (const [key, load] of previous) {
        if (wanted.has(key) || load.status === "loaded") continue;
        if (!next) next = new Map(previous);
        next.delete(key);
      }
      return next ?? previous;
    });
  }, []);

  /** Tries a failed load again - once its row is still wanted. */
  const retry = useCallback(
    (key: string) =>
      setLoads((previous) => {
        const load = previous.get(key);
        if (load?.status !== "error") return previous;
        const next = new Map(previous);
        const stale = toStale(load);
        if (stale) next.set(key, stale);
        else next.delete(key);
        return next;
      }),
    [],
  );

  return { load, loads, release, retry };
}
