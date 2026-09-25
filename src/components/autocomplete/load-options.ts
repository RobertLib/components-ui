import logger from "../../utils/logger";

/**
 * What `loadOptions` is called with. The same request is described in the
 * terms of every common pagination style - use whichever your API has:
 *
 * - REST with pages: `?q=${search}&page=${page}&per_page=${pageSize}`
 * - REST with offsets: `?q=${search}&offset=${offset}&limit=${pageSize}`
 * - cursor APIs: `?q=${search}&cursor=${cursor}`
 * - GraphQL (Relay): `users(search: $search, first: $first, after: $after)`
 */
export interface LoadOptionsParams {
  /**
   * The typed term without the spaces around it, empty for the unfiltered
   * list.
   */
  search: string;
  /** Aborted once a newer request supersedes this one - pass it to `fetch`. */
  signal: AbortSignal;
  /** Number of options per page (the `pageSize` prop). */
  pageSize: number;
  /** 1-based number of the requested page. */
  page: number;
  /** Number of items loaded before this page (0 on the first page). */
  offset: number;
  /**
   * `nextCursor` (or `pageInfo.endCursor`) returned with the previous page,
   * `null` on the first page.
   */
  cursor: string | null;
  /** Relay name of `pageSize`. */
  first: number;
  /** Relay name of `cursor`. */
  after: string | null;
}

/** One page of a paginated list - the usual shape of a REST response. */
export interface LoadOptionsPage<TItem> {
  /** Items of the page. */
  items: TItem[];
  /**
   * Whether another page exists. When left out it is derived from `total`,
   * or else from `nextCursor` (another page while it is not `null`); with
   * neither, the list is treated as complete.
   */
  hasMore?: boolean;
  /** Cursor of the next page, passed back as `cursor` / `after`. */
  nextCursor?: string | null;
  /** Total number of matching items. */
  total?: number;
}

/** A GraphQL (Relay) connection - with `nodes`, `edges`, or both. */
export interface RelayConnection<TItem> {
  /** Edges of the connection - their `node`s become the options. */
  edges?: ({ node?: TItem | null } | null)[] | null;
  /** Nodes of the connection - they become the options. */
  nodes?: (TItem | null)[] | null;
  /** While `hasNextPage`, the next page is requested after `endCursor`. */
  pageInfo?: {
    endCursor?: string | null;
    hasNextPage: boolean;
  } | null;
}

/**
 * What `loadOptions` may resolve with:
 * - an array - the complete list, no further pages are requested,
 * - a page - `{ items, hasMore?, total?, nextCursor? }`,
 * - a Relay connection - `{ nodes | edges, pageInfo }`, returned as it is.
 *
 * Another shape lists no options - development builds warn about it. Map it
 * to a page, e.g. `{ items: body.results, total: body.count }`.
 */
export type LoadOptionsResult<TItem> =
  TItem[] | LoadOptionsPage<TItem> | RelayConnection<TItem>;

export interface NormalizedPage<TItem> {
  hasMore: boolean;
  items: TItem[];
  nextCursor: string | null;
}

const isPresent = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const formatKeys = (value: object) => {
  const keys = Object.keys(value);
  return keys.length ? keys.map((key) => `\`${key}\``).join(", ") : "no keys";
};

/**
 * Brings every supported result shape to `{ items, hasMore, nextCursor }`.
 * `offset` is the number of items loaded before this page.
 */
export function normalizeLoadOptionsResult<TItem>(
  result: LoadOptionsResult<TItem>,
  offset = 0,
): NormalizedPage<TItem> {
  if (Array.isArray(result)) {
    return { hasMore: false, items: result, nextCursor: null };
  }

  if ("items" in result && Array.isArray(result.items)) {
    const { hasMore, items, nextCursor, total } = result;

    return {
      hasMore:
        hasMore ??
        (typeof total === "number"
          ? offset + items.length < total
          : isPresent(nextCursor)),
      items,
      nextCursor: nextCursor ?? null,
    };
  }

  // Another shape - `{ results }`, `{ data }` - would list nothing without a
  // word: say what the list reads
  if (!("items" in result) && !("nodes" in result) && !("edges" in result)) {
    logger.warn(
      `Autocomplete: loadOptions resolved with an object of neither \`items\`, \`nodes\` nor \`edges\` (it has ${formatKeys(result)}) - the list shows no options. Return an array, a page \`{ items, total | hasMore | nextCursor }\` or a Relay connection \`{ nodes | edges, pageInfo }\`, e.g. \`{ items: body.results, total: body.count }\`.`,
    );
  }

  const connection = result as RelayConnection<TItem>;
  const items = connection.nodes
    ? connection.nodes.filter(isPresent)
    : (connection.edges ?? []).map((edge) => edge?.node).filter(isPresent);

  return {
    hasMore: connection.pageInfo?.hasNextPage ?? false,
    items,
    nextCursor: connection.pageInfo?.endCursor ?? null,
  };
}
