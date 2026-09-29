import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useRowSelection from "./use-row-selection";

describe("useRowSelection", () => {
  it("selects and deselects many rows in linear time", () => {
    const data = Array.from({ length: 20_000 }, (_, id) => ({ id }));
    const { result } = renderHook(() => useRowSelection(data));
    const start = performance.now();

    act(() => result.current.setSelectedIds(data.map((row) => row.id)));
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectedRows).toHaveLength(20_000);
    act(() => result.current.setSelectedIds([]));
    expect(result.current.isAllSelected).toBe(false);

    // Comparing every row with every selected one took seconds
    expect(performance.now() - start).toBeLessThan(250);
  });

  it("keeps a controlled selection of rows that are not there", () => {
    const { rerender, result } = renderHook(
      ({ data }) => useRowSelection(data, { selectedIds: [1, 9] }),
      { initialProps: { data: [{ id: 1 }, { id: 2 }] } },
    );
    expect(result.current.selectedRows).toEqual([{ id: 1 }]);

    rerender({ data: [{ id: 3 }] });
    expect(result.current.ids).toEqual([1, 9]);
    expect(result.current.selectedRows).toEqual([]);
  });

  it("drops rows that leave the data from an uncontrolled selection", () => {
    const { rerender, result } = renderHook(
      ({ data }) => useRowSelection(data, { defaultSelectedIds: [1, 2, 9] }),
      { initialProps: { data: [{ id: 1 }, { id: 2 }] } },
    );
    expect(result.current.ids).toEqual([1, 2]);

    rerender({ data: [{ id: 2 }, { id: 3 }] });
    expect(result.current.ids).toEqual([2]);
  });
});
