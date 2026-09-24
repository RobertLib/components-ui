import { useCallback, useEffect, useRef, useState } from "react";
import logger from "../../utils/logger";
import type { LoadState, LoadStates } from "./tree-model";
import type { TreeItem, TreeItemId } from "./types";

/** Loads the children of an item - `signal` aborts when the tree unmounts. */
export type LoadChildren<T> = (
  item: T,
  options: { signal: AbortSignal },
) => Promise<T[]>;

/** Calls `loadChildren` - a synchronous throw becomes a rejection. */
const callLoadChildren = <T>(
  loadChildren: LoadChildren<T>,
  item: T,
  signal: AbortSignal,
) => new Promise<T[]>((resolve) => resolve(loadChildren(item, { signal })));

/**
 * The children `loadChildren` brought for the items of a tree, and whether
 * it is still loading or failed. Each item loads once - until it fails;
 * `forgetError` / `forgetErrors` let expanding it try again.
 */
export default function useLazyChildren<T extends TreeItem>(
  loadChildren: LoadChildren<T> | undefined,
) {
  const [loads, setLoads] = useState<LoadStates<T>>(() => new Map());
  const loadChildrenRef = useRef(loadChildren);
  // The loads on their way - aborted when the tree unmounts
  const running = useRef(new Map<TreeItemId, AbortController>());

  useEffect(() => {
    loadChildrenRef.current = loadChildren;
  });

  useEffect(() => {
    const controllers = running.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const setLoad = useCallback(
    (id: TreeItemId, load: LoadState<T>) =>
      setLoads((previous) => new Map(previous).set(id, load)),
    [],
  );

  /** Starts loading the children of `item`, unless they are on their way. */
  const load = useCallback(
    (item: T) => {
      const loader = loadChildrenRef.current;
      if (!loader || running.current.has(item.id)) return;

      const controller = new AbortController();
      running.current.set(item.id, controller);
      setLoad(item.id, { status: "loading" });

      callLoadChildren(loader, item, controller.signal).then(
        (children) => {
          if (controller.signal.aborted) return;
          running.current.delete(item.id);
          setLoad(item.id, {
            children: Array.isArray(children) ? children : [],
            status: "loaded",
          });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          running.current.delete(item.id);
          logger.error("TreeView: loadChildren failed", error);
          setLoad(item.id, { status: "error" });
        },
      );
    },
    [setLoad],
  );

  /** Forgets a failed load of the children of `id` - the next one tries again. */
  const forgetError = useCallback(
    (id: TreeItemId) =>
      setLoads((previous) => {
        if (previous.get(id)?.status !== "error") return previous;
        const next = new Map(previous);
        next.delete(id);
        return next;
      }),
    [],
  );

  /** Forgets the failed loads of all items but those of `keep`. */
  const forgetErrors = useCallback(
    (keep: ReadonlySet<TreeItemId>) =>
      setLoads((previous) => {
        let next: Map<TreeItemId, LoadState<T>> | null = null;

        for (const [id, load] of previous) {
          if (load.status === "error" && !keep.has(id)) {
            if (!next) next = new Map(previous);
            next.delete(id);
          }
        }

        return next ?? previous;
      }),
    [],
  );

  return { forgetError, forgetErrors, load, loads };
}
