import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useRowSelection from "./use-row-selection";

describe("useRowSelection", () => {
  it("selects and deselects many rows in linear time", () => {
    const data = Array.from({ length: 20_000 }, (_, id) => ({ id }));
    const { result } = renderHook(() => useRowSelection(data));
    const start = performance.now();

    act(() => result.current.toggleSelectAll());
    expect(result.current.isAllSelected).toBe(true);
    act(() => result.current.toggleSelectAll());
    expect(result.current.isAllSelected).toBe(false);

    // Comparing every row with every selected one took seconds
    expect(performance.now() - start).toBeLessThan(250);
  });
});
