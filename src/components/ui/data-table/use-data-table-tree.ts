import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterAndSortRows, type DataTableFilterValue } from "./query";
import { formatPlural } from "../../../i18n/ui/format";
import { getRowKey } from "./row-key";
import logger from "../../../utils/logger";
import useSubRowLoads, { type LoadSubRows } from "./use-sub-row-loads";
import {
  buildTree,
  getLeafRows,
  getShownNodes,
  paginateTree,
  type TreeData,
  type TreeNode,
} from "./tree";
import type { Column, RowId } from "./types";
import type { DataTableSort } from "./query";
import type { Locale } from "../../../i18n/ui/types";
import type { PageInfo } from "../pagination";

/** Where a row shown is in the tree - what `TableRow` shows of it. */
export interface TreeRowState {
  /** The sub rows are shown - `undefined` for a row without any. */
  expanded?: boolean;
  /** Depth of the row - `1` at the top level. */
  level: number;
  /** 1-based place among its siblings - `undefined` when unknown. */
  posInSet?: number;
  /** Number of its siblings - `undefined` when unknown (cursor pages). */
  setSize?: number;
  /** The sub rows are loading, or failed to (`loadSubRows`). */
  status?: "error" | "loading";
}

/**
 * The expansion of an uncontrolled tree: a rule for the rows - expanded up
 * to `defaultExpandDepth`, all (those with sub rows at hand) or none - and
 * the rows the user expanded or collapsed against it, also rows loaded
 * later.
 */
interface ExpansionState {
  base: "all" | "depth" | "none";
  overrides: ReadonlyMap<string, { expanded: boolean; id: RowId }>;
}

const NO_OVERRIDES: ReadonlyMap<string, boolean> = new Map();

// How long an announcement stays in the live region - long enough to be read
const ANNOUNCEMENT_DURATION = 5000;

/** A row that can be expanded - with sub rows, or some to load. */
export const isExpandable = <T>(node: TreeNode<T>) =>
  node.childCount > 0 || node.unloaded;

function isExpandedIn<T>(
  state: ExpansionState,
  node: TreeNode<T>,
  depth: number,
) {
  const override = state.overrides.get(node.key);
  if (override) return override.expanded;
  return state.base === "depth"
    ? node.level <= depth
    : state.base === "all" && node.childCount > 0;
}

/** The id of a row key - for messages. */
const keyToId = (key: string) => (JSON.parse(key) as string[])[1];

interface DataTableTreeOptions<T> {
  clientSide: boolean;
  data: T[];
  defaultExpandDepth: number;
  defaultExpandedIds?: RowId[];
  expandedIds?: RowId[];
  /** Changes with the filters and the search - collapsed matches reopen. */
  filterKey: string;
  filters: Record<string, DataTableFilterValue>;
  getRowId: (row: T) => RowId;
  getSubRows?: (row: T) => T[] | undefined | null;
  /** The table has `groupBy` too - ignored, with a warning. */
  hasGroupBy: boolean;
  hasSubRows?: (row: T) => boolean;
  loadSubRows?: LoadSubRows<T>;
  loadSubRowsKey?: string | number;
  locale: Locale;
  onExpandedIdsChange?: (ids: RowId[]) => void;
  onLoadError?: (error: unknown, row: T) => void;
  page: number;
  pageInfo?: PageInfo;
  pageSize: number;
  pagination: boolean;
  queryColumns: Column<T>[];
  search: string;
  searchColumns: Column<T>[];
  sort: DataTableSort[];
  total?: number;
  /** The column named for the toggles - checked to be one. */
  treeColumn?: string;
}

/**
 * Tree data of a `DataTable` (`getSubRows` / `loadSubRows`): the rows with
 * their sub rows, filtered, sorted and paged by the top-level rows on the
 * client, which of them are expanded, the sub rows being loaded - and the
 * changes of the user. Inert without `getSubRows` and `loadSubRows`.
 */
export default function useDataTableTree<T>({
  clientSide,
  data,
  defaultExpandDepth,
  defaultExpandedIds,
  expandedIds,
  filterKey,
  filters,
  getRowId,
  getSubRows,
  hasGroupBy,
  hasSubRows,
  loadSubRows,
  loadSubRowsKey,
  locale,
  onExpandedIdsChange,
  onLoadError,
  page,
  pageInfo,
  pageSize,
  pagination,
  queryColumns,
  search,
  searchColumns,
  sort,
  total,
  treeColumn,
}: DataTableTreeOptions<T>) {
  const enabled = !!getSubRows || !!loadSubRows;
  const canLoad = !!loadSubRows;
  const messages = locale.messages.ui.dataTable.tree;

  // What the tree announces - the sub rows the user waited for, expanding
  // or collapsing all rows. A new node repeats a message.
  const [announcement, setAnnouncement] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const announce = (text: string) =>
    setAnnouncement((current) => ({ id: (current?.id ?? 0) + 1, text }));

  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(
      () => setAnnouncement(null),
      ANNOUNCEMENT_DURATION,
    );
    return () => clearTimeout(timer);
  }, [announcement]);

  // The row the user expanded last to load its sub rows - their arrival
  // or failure is announced; not of the rows expanded by default
  const awaitedKeyRef = useRef<string | null>(null);

  const { load, loads, release, retry } = useSubRowLoads(loadSubRows, {
    loadKey: loadSubRowsKey,
    onError: (error, row) => {
      if (awaitedKeyRef.current === getRowKey(getRowId(row))) {
        awaitedKeyRef.current = null;
        announce(messages.loadFailed);
      }
      onLoadError?.(error, row);
    },
    onLoaded: (key, count) => {
      if (awaitedKeyRef.current !== key) return;
      awaitedKeyRef.current = null;
      announce(formatPlural(locale.code, messages.loaded, count));
    },
  });

  /** Whether the sub rows of a row come from `loadSubRows`. */
  const isLazy = useCallback(
    (row: T) =>
      canLoad &&
      (getSubRows?.(row) ?? null) === null &&
      (hasSubRows?.(row) ?? true),
    [canLoad, getSubRows, hasSubRows],
  );

  /** The known sub rows of a row - `null` while they are still to load. */
  const getChildren = useCallback(
    (row: T): readonly T[] | null => {
      const own = getSubRows?.(row);
      if (own) return own;
      if (!canLoad || !(hasSubRows?.(row) ?? true)) return [];
      return loads.get(getRowKey(getRowId(row)))?.rows ?? null;
    },
    [canLoad, getRowId, getSubRows, hasSubRows, loads],
  );

  // All known rows, as they are given - for lookups and the expanded ids
  const knownTree = useMemo(
    () => (enabled ? buildTree(data, { getChildren, getRowId }) : null),
    [data, enabled, getChildren, getRowId],
  );

  // Client-side: the rows matching the filters and the search with their
  // ancestors and descendants, siblings sorted within their parent
  const tree = useMemo((): { data: TreeData<T>; filtering: boolean } | null => {
    if (!knownTree) return null;
    if (!clientSide) return { data: knownTree, filtering: false };

    const rows = knownTree.nodes.map((node) => node.row);
    const matching = filterAndSortRows(
      rows,
      { filters, order: "asc", search, sort: [], sortBy: null },
      queryColumns,
      { locale, searchColumns },
    );
    // The same rows - no filter or search applies
    const filtering = matching !== rows;
    const sorted = sort.length
      ? filterAndSortRows(
          rows,
          {
            filters: {},
            order: sort[0].order,
            search: "",
            sort,
            sortBy: sort[0].key,
          },
          queryColumns,
          { locale },
        )
      : null;
    if (!filtering && !sorted) return { data: knownTree, filtering };

    return {
      data: buildTree(data, {
        getChildren,
        getRowId,
        matches: filtering ? new Set(matching) : null,
        rank: sorted && new Map(sorted.map((row, index) => [row, index])),
      }),
      filtering,
    };
  }, [
    clientSide,
    data,
    filters,
    getChildren,
    getRowId,
    knownTree,
    locale,
    queryColumns,
    search,
    searchColumns,
    sort,
  ]);
  const filtering = tree?.filtering ?? false;

  // The top-level rows of the page with their branches
  const pageTree = useMemo(() => {
    if (!tree) return null;
    return clientSide && pagination
      ? paginateTree(tree.data, page, pageSize)
      : { nodes: tree.data.nodes, page: clientSide ? 1 : page };
  }, [clientSide, page, pageSize, pagination, tree]);
  const pageNodes = pageTree?.nodes ?? null;

  // Expansion - controlled by `expandedIds`, or a rule with exceptions
  const [expansion, setExpansion] = useState<ExpansionState>(() => ({
    base: defaultExpandedIds ? "none" : "depth",
    overrides: new Map(
      (defaultExpandedIds ?? []).map((id) => [
        getRowKey(id),
        { expanded: true, id },
      ]),
    ),
  }));
  const controlledKeys = useMemo(
    () => (expandedIds ? new Set(expandedIds.map(getRowKey)) : null),
    [expandedIds],
  );

  // While filtering, the ancestors of the matches are expanded - the user
  // may collapse them until the filter changes
  const [filterExpansion, setFilterExpansion] = useState({
    key: filterKey,
    overrides: NO_OVERRIDES,
  });
  const filterOverrides =
    filtering && filterExpansion.key === filterKey
      ? filterExpansion.overrides
      : NO_OVERRIDES;

  const isShownExpanded = useCallback(
    (node: TreeNode<T>) =>
      isExpandable(node) &&
      (filterOverrides.get(node.key) ??
        ((filtering && node.matchAncestor) ||
          (controlledKeys
            ? controlledKeys.has(node.key)
            : isExpandedIn(expansion, node, defaultExpandDepth)))),
    [controlledKeys, defaultExpandDepth, expansion, filterOverrides, filtering],
  );

  /** The rows shown of `nodes` - sub rows of the expanded rows. */
  const getShown = useCallback(
    (nodes: readonly TreeNode<T>[]) => getShownNodes(nodes, isShownExpanded),
    [isShownExpanded],
  );

  const shownNodes = useMemo(
    () => (pageNodes ? getShown(pageNodes) : null),
    [getShown, pageNodes],
  );

  // The expanded rows shown whose sub rows `loadSubRows` brings
  const wanted = useMemo(() => {
    const rows = new Map<string, T>();
    for (const node of shownNodes ?? []) {
      if (isShownExpanded(node) && isLazy(node.row))
        rows.set(node.key, node.row);
    }
    return rows;
  }, [isLazy, isShownExpanded, shownNodes]);

  useEffect(() => {
    if (!enabled) return;
    for (const [key, row] of wanted) {
      const status = loads.get(key)?.status;
      if (status !== "loaded" && status !== "error") load(key, row);
    }
    release(new Set(wanted.keys()));
  }, [enabled, load, loads, release, wanted]);

  // Development hints
  const duplicates = (tree?.data.duplicates ?? []).map(keyToId).join(", ");
  useEffect(() => {
    if (duplicates) {
      logger.warn(
        `DataTable: more than one row of the tree has the id ${duplicates} - getRowId must give every row an id of its own, across all levels.`,
      );
    }
  }, [duplicates]);

  const isLocked = enabled && !!expandedIds && !onExpandedIdsChange;
  const isGrouped = enabled && hasGroupBy;
  const strayColumn =
    enabled &&
    treeColumn !== undefined &&
    !queryColumns.some((column) => column.key === treeColumn)
      ? treeColumn
      : null;
  useEffect(() => {
    if (strayColumn !== null) {
      logger.warn(
        `DataTable: \`treeColumn\` "${strayColumn}" is no column - the toggles of the sub rows go to the first column shown.`,
      );
    }
  }, [strayColumn]);
  useEffect(() => {
    if (isLocked) {
      logger.warn(
        "DataTable: `expandedTreeIds` without `onExpandedTreeIdsChange` cannot be changed by the user - use `defaultExpandedTreeIds` for the initial state.",
      );
    }
    if (isGrouped) {
      logger.warn(
        "DataTable: `groupBy` is ignored with tree data (`getSubRows` / `loadSubRows`) - a row is either in a group or under its parent row.",
      );
    }
  }, [isGrouped, isLocked]);

  const knownNodes = knownTree?.nodes;

  /** The expanded ids of an uncontrolled tree in a state - to report. */
  const getExpandedIds = (state: ExpansionState) => {
    const ids: RowId[] = [];
    const known = new Set<string>();
    for (const node of knownNodes ?? []) {
      known.add(node.key);
      if (isExpandable(node) && isExpandedIn(state, node, defaultExpandDepth)) {
        ids.push(node.id);
      }
    }
    // Rows of other pages, still to come
    for (const [key, override] of state.overrides) {
      if (override.expanded && !known.has(key)) ids.push(override.id);
    }
    return ids;
  };

  /** Expands or collapses the sub rows of a row shown. */
  const toggle = (id: RowId) => {
    const key = getRowKey(id);
    const node = pageNodes?.find((candidate) => candidate.key === key);
    if (!node || !isExpandable(node)) return;
    const expanded = !isShownExpanded(node);

    if (expanded && isLazy(node.row) && loads.get(key)?.status !== "loaded") {
      awaitedKeyRef.current = key;
    }

    if (filtering && (node.matchAncestor || filterOverrides.has(key))) {
      setFilterExpansion({
        key: filterKey,
        overrides: new Map(filterOverrides).set(key, expanded),
      });
      return;
    }

    if (expandedIds) {
      onExpandedIdsChange?.(
        expanded
          ? [...expandedIds, id]
          : expandedIds.filter((item) => getRowKey(item) !== key),
      );
      return;
    }

    const next: ExpansionState = {
      ...expansion,
      overrides: new Map(expansion.overrides).set(key, { expanded, id }),
    };
    setExpansion(next);
    onExpandedIdsChange?.(getExpandedIds(next));
  };

  /** Expands every row whose sub rows are at hand - it loads none. */
  const expandAll = () => {
    setFilterExpansion({ key: filterKey, overrides: NO_OVERRIDES });
    if (expandedIds) {
      const known = new Set(knownNodes?.map((node) => node.key));
      onExpandedIdsChange?.([
        ...expandedIds.filter((id) => !known.has(getRowKey(id))),
        ...(knownNodes ?? [])
          .filter((node) => node.childCount > 0)
          .map((node) => node.id),
      ]);
    } else {
      const next: ExpansionState = { base: "all", overrides: new Map() };
      setExpansion(next);
      onExpandedIdsChange?.(getExpandedIds(next));
    }
    announce(messages.expandedAll);
  };

  /** Collapses every row - also the ancestors of the matches of a filter. */
  const collapseAll = () => {
    setFilterExpansion({
      key: filterKey,
      overrides: new Map(
        (tree?.data.nodes ?? [])
          .filter((node) => node.matchAncestor)
          .map((node) => [node.key, false]),
      ),
    });
    if (!expandedIds) setExpansion({ base: "none", overrides: new Map() });
    onExpandedIdsChange?.([]);
    announce(messages.collapsedAll);
  };

  /** Where the rows of `nodes` are in the tree - by row key. */
  const describe = (nodes: readonly TreeNode<T>[]) => {
    const rows = new Map<string, TreeRowState>();
    // A server's page of top-level rows - their places among all of them,
    // unknown with cursor pages
    const isPaged = !clientSide && pagination;
    const offset =
      isPaged && !pageInfo && total !== undefined ? (page - 1) * pageSize : 0;
    const topLevelSize = isPaged ? (pageInfo ? undefined : total) : undefined;

    for (const node of nodes) {
      const status = loads.get(node.key)?.status;
      const isServerTop = isPaged && node.level === 1;
      const setSize = isServerTop ? topLevelSize : node.setSize;
      rows.set(node.key, {
        expanded: isExpandable(node) ? isShownExpanded(node) : undefined,
        level: node.level,
        posInSet:
          setSize === undefined
            ? undefined
            : node.position + 1 + (isServerTop ? offset : 0),
        setSize,
        status: status === "loading" || status === "error" ? status : undefined,
      });
    }
    return rows;
  };

  /**
   * The rows of a snapshot of `pageNodes` (kept while a cell is edited) as
   * they are now - those gone are left out.
   */
  const refreshNodes = useCallback(
    (frozen: readonly TreeNode<T>[]) => {
      const current = new Map(pageNodes?.map((node) => [node.key, node]));
      const known = new Map(knownNodes?.map((node) => [node.key, node.row]));
      return frozen.flatMap((node) => {
        const now = current.get(node.key);
        if (now) return [now];
        const row = known.get(node.key);
        return row === undefined ? [] : [{ ...node, row }];
      });
    },
    [knownNodes, pageNodes],
  );

  /**
   * The rows of the CSV export, depth first, with their levels - the rows
   * of the table, or those `onExport` gave with their known sub rows.
   */
  const getExport = (exportRows?: T[]) => {
    const nodes = exportRows
      ? buildTree(exportRows, { getChildren, getRowId }).nodes
      : (tree?.data.nodes ?? []);
    return {
      levels: new Map(nodes.map((node) => [node.row, node.level])),
      rows: nodes.map((node) => node.row),
    };
  };

  const knownRows = useMemo(
    () => knownNodes?.map((node) => node.row) ?? null,
    [knownNodes],
  );
  const allNodes = tree?.data.nodes;
  const matchingRows = useMemo(
    () => (clientSide && allNodes ? allNodes.map((node) => node.row) : null),
    [allNodes, clientSide],
  );
  const pageRows = useMemo(
    () => pageNodes?.map((node) => node.row) ?? null,
    [pageNodes],
  );
  // The summaries count the rows at the bottom of the tree - parents
  // holding the totals of their branches would count twice
  const summaryRows = useMemo(
    () => (allNodes ? getLeafRows(allNodes) : null),
    [allNodes],
  );

  return {
    announcement,
    /** Some row shown is expanded - the header button collapses all. */
    anyExpanded: !!shownNodes?.some(isShownExpanded),
    /** Some row of the page can be expanded. */
    canExpand: !!pageNodes?.some(isExpandable),
    collapseAll,
    describe,
    enabled,
    expandAll,
    getExport,
    getShown,
    /** All known rows - the top-level rows with their known sub rows. */
    knownRows,
    /** Client-side: the rows of all pages matching the filters, depth first. */
    matchingRows,
    /** Client-side: the page shown. */
    page: pageTree?.page,
    /** The top-level rows of the page with their branches, depth first. */
    pageNodes,
    pageRows,
    refreshNodes,
    retry: (id: RowId) => retry(getRowKey(id)),
    /** Client-side: the number of top-level rows matching - what pages. */
    rootTotal: clientSide && tree ? tree.data.rootStarts.length - 1 : undefined,
    summaryRows,
    toggle,
  };
}
