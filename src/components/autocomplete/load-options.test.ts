import { describe, expect, it, vi } from "vitest";
import { normalizeLoadOptionsResult } from "./load-options";

const items = [{ id: 1 }, { id: 2 }];

describe("normalizeLoadOptionsResult", () => {
  it("treats an array as the complete list", () => {
    expect(normalizeLoadOptionsResult(items)).toEqual({
      hasMore: false,
      items,
      nextCursor: null,
    });
  });

  it("reads a REST page with hasMore, total or a cursor", () => {
    expect(normalizeLoadOptionsResult({ hasMore: true, items }).hasMore).toBe(
      true,
    );
    expect(normalizeLoadOptionsResult({ items, total: 10 }, 0).hasMore).toBe(
      true,
    );
    expect(normalizeLoadOptionsResult({ items, total: 10 }, 8).hasMore).toBe(
      false,
    );
    expect(normalizeLoadOptionsResult({ items }).hasMore).toBe(false);
    expect(
      normalizeLoadOptionsResult({ hasMore: true, items, nextCursor: "abc" })
        .nextCursor,
    ).toBe("abc");
  });

  it("reads a cursor-only REST page as continuing while it has a cursor", () => {
    expect(normalizeLoadOptionsResult({ items, nextCursor: "abc" })).toEqual({
      hasMore: true,
      items,
      nextCursor: "abc",
    });
    expect(
      normalizeLoadOptionsResult({ items, nextCursor: null }).hasMore,
    ).toBe(false);
    // `hasMore` and `total` take precedence over the cursor
    expect(
      normalizeLoadOptionsResult({ hasMore: false, items, nextCursor: "abc" })
        .hasMore,
    ).toBe(false);
    expect(
      normalizeLoadOptionsResult({ items, nextCursor: "abc", total: 2 })
        .hasMore,
    ).toBe(false);
  });

  it("reads a Relay connection with nodes or edges", () => {
    const pageInfo = { endCursor: "c2", hasNextPage: true };
    expect(
      normalizeLoadOptionsResult({ nodes: [...items, null], pageInfo }),
    ).toEqual({
      hasMore: true,
      items,
      nextCursor: "c2",
    });
    expect(
      normalizeLoadOptionsResult({
        edges: items.map((node) => ({ node })),
        pageInfo: { endCursor: null, hasNextPage: false },
      }),
    ).toEqual({ hasMore: false, items, nextCursor: null });
  });

  it("warns about a shape it cannot read, instead of listing nothing silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // A Django REST Framework page
    const result = { count: 2, next: null, results: items };
    expect(
      normalizeLoadOptionsResult(
        result as unknown as Parameters<typeof normalizeLoadOptionsResult>[0],
      ).items,
    ).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("`count`, `next`, `results`");

    // Empty pages and connections are no mistake
    normalizeLoadOptionsResult({ items: [], total: 0 });
    normalizeLoadOptionsResult({ nodes: null, pageInfo: null });
    normalizeLoadOptionsResult({ edges: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
