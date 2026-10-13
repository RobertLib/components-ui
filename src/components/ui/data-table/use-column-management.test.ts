import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Column, DataTableColumnState } from "./types";
import useColumnManagement from "./use-column-management";

const columns: Column<{ id: number }>[] = [
  { key: "name", label: "Name" },
  { key: "team", label: "Team" },
  { key: "city", label: "City", visible: false },
];

function controlledColumns(
  definitions = columns,
  columnState: DataTableColumnState = {},
  groupOf?: Readonly<Record<string, string>>,
) {
  const onColumnStateChange = vi.fn<(state: DataTableColumnState) => void>();
  const view = renderHook(
    ({ state }) =>
      useColumnManagement(definitions, undefined, {
        columnState: state,
        groupOf,
        onColumnStateChange,
      }),
    { initialProps: { state: columnState } },
  );
  return {
    ...view,
    lastChange: () => onColumnStateChange.mock.lastCall![0],
  };
}

describe("useColumnManagement with a delayed controlled owner", () => {
  it.each([false, true])(
    "confirms a coalesced return after normalizing the submitted column state, normalized=%s",
    (normalized) => {
      const initial = normalized
        ? { order: [], pinning: {}, visibility: {}, widths: {} }
        : {};
      const { lastChange, rerender, result } = controlledColumns(
        columns,
        initial,
      );
      act(() => result.current.handlePinColumn("name", "left"));
      const first = lastChange();
      act(() => result.current.handlePinColumn("name", "left"));
      const cleared = lastChange();

      // Returning that exact callback object confirms the final clear,
      // even though internal normalization produces another TableState.
      rerender({ state: cleared });
      // The owner has caught up: the old pin is now an external choice.
      rerender({ state: first });
      expect(result.current.pinnedColumns).toEqual({
        left: ["name"],
        right: [],
      });
      act(() => result.current.handlePinColumn("name", "left"));
      expect(lastChange().pinning).toEqual({});
    },
  );

  it.each([false, true])(
    "keeps a pending clear through an unrelated render before a delayed pin, cloned=%s",
    (cloned) => {
      const initial = {};
      const { lastChange, rerender, result } = controlledColumns(
        columns,
        initial,
      );
      act(() => result.current.handlePinColumn("name", "left"));
      const first = lastChange();
      act(() => result.current.handlePinColumn("name", "left"));
      const cleared = lastChange();

      // An equal copy is no acknowledgement of the clear operation.
      rerender({ state: cloned ? { ...cleared } : initial });
      rerender({ state: first });
      act(() => result.current.handlePinColumn("team", "right"));
      expect(lastChange().pinning).toEqual({ team: "right" });
    },
  );

  it.each(["name", "constructor", "toString", "__proto__"])(
    "preserves other pins and toggles %s from its pending position",
    (key) => {
      const { lastChange, rerender, result } = controlledColumns([
        { key, label: "Name", pinned: "left" },
        columns[1],
      ]);

      act(() => result.current.handlePinColumn(key, "right"));
      const first = lastChange();
      // An unrelated render still carries the original controlled value.
      rerender({ state: {} });
      act(() => result.current.handlePinColumn("team", "left"));
      expect(lastChange().pinning).toEqual({ [key]: "right", team: "left" });

      // Acknowledging the first change must not discard the second one.
      rerender({ state: first });
      act(() => result.current.handlePinColumn(key, "right"));
      expect(lastChange().pinning).toEqual({ [key]: false, team: "left" });
      act(() => result.current.handlePinColumn(key, "left"));
      expect(lastChange().pinning).toEqual({ team: "left" });
      act(() => result.current.handlePinColumn("team", "left"));
      expect(lastChange().pinning).toEqual({});

      rerender({ state: lastChange() });
      expect(result.current.pinnedColumns).toEqual({ left: [key], right: [] });
      expect(result.current.hasCustomSettings).toBe(false);
    },
  );

  it("preserves pending widths when resizing or restoring another column", () => {
    const { lastChange, rerender, result } = controlledColumns();
    act(() => result.current.setColumnWidth("name", 150));
    rerender({ state: {} });
    act(() => result.current.setColumnWidth("team", 200));
    expect(lastChange().widths).toEqual({ name: 150, team: 200 });

    act(() => result.current.setColumnWidth("name", null));
    expect(lastChange().widths).toEqual({ team: 200 });
    rerender({ state: lastChange() });
    expect(result.current.columnWidths).toEqual({ team: 200 });
  });

  it("preserves pending columns when the locally owned density changes", () => {
    const { lastChange, rerender, result } = controlledColumns();
    act(() => result.current.handlePinColumn("name", "left"));
    act(() => result.current.setDensity("compact"));
    expect(result.current.density).toBe("compact");

    act(() => result.current.setColumnWidth("team", 120));
    expect(lastChange().pinning).toEqual({ name: "left" });
    expect(lastChange().widths).toEqual({ team: 120 });
    rerender({ state: lastChange() });
    expect(result.current.pinnedColumns).toEqual({ left: ["name"], right: [] });
    expect(result.current.density).toBe("compact");
  });

  it("confirms a coalesced column return after a local density change", () => {
    const { lastChange, rerender, result } = controlledColumns();
    act(() => result.current.handlePinColumn("name", "left"));
    const first = lastChange();
    act(() => result.current.handlePinColumn("name", "left"));
    const cleared = lastChange();
    act(() => result.current.setDensity("comfortable"));

    // The density change cannot replace the token of the submitted clear.
    rerender({ state: cleared });
    rerender({ state: first });
    act(() => result.current.setColumnWidth("team", 120));
    expect(lastChange().pinning).toEqual({ name: "left" });
    expect(result.current.density).toBe("comfortable");
  });

  it("retains uncontrolled density and restores only the column layout", () => {
    const { result } = renderHook(() => useColumnManagement(columns));
    act(() => result.current.setDensity("compact"));
    act(() => result.current.handlePinColumn("name", "left"));
    act(() => result.current.setColumnWidth("team", 120));
    expect(result.current.pinnedColumns).toEqual({ left: ["name"], right: [] });
    expect(result.current.columnWidths).toEqual({ team: 120 });

    act(() => result.current.resetColumnLayout());
    expect(result.current.pinnedColumns).toEqual({ left: [], right: [] });
    expect(result.current.columnWidths).toEqual({});
    expect(result.current.density).toBe("compact");
    act(() => result.current.setDensity(null));
    expect(result.current.density).toBeNull();
  });

  it("resolves functional visibility updates against pending choices and defaults", () => {
    const { lastChange, rerender, result } = controlledColumns();
    act(() =>
      result.current.setColumnVisibility((previous) => ({
        ...previous,
        city: !previous.city,
      })),
    );
    const first = lastChange();
    rerender({ state: {} });
    act(() =>
      result.current.setColumnVisibility((previous) => ({
        ...previous,
        name: !previous.name,
      })),
    );
    expect(lastChange().visibility).toEqual({ city: true, name: false });

    rerender({ state: first });
    act(() =>
      result.current.setColumnVisibility((previous) => ({
        ...previous,
        city: !previous.city,
      })),
    );
    expect(lastChange().visibility).toEqual({ name: false });
    rerender({ state: lastChange() });
    expect(result.current.columnVisibility).toEqual({
      city: false,
      name: false,
      team: true,
    });
  });

  it("moves from the pending order, keeping missing columns and groups together", () => {
    const initial = { order: ["team", "removed", "name"] };
    const { lastChange, rerender, result } = controlledColumns(
      [...columns, { key: "id", label: "Id" }],
      initial,
      { city: "details", team: "details" },
    );
    expect(result.current.columnOrder).toEqual(["team", "city", "name", "id"]);

    act(() => result.current.moveColumn("id", -1));
    expect(lastChange().order).toEqual(["team", "city", "id", "name"]);
    rerender({ state: initial });
    act(() => result.current.moveColumn("id", -1));
    expect(lastChange().order).toEqual(["id", "team", "city", "name"]);

    act(() => result.current.moveColumn("team", 1));
    expect(lastChange().order).toEqual(["id", "city", "team", "name"]);
    act(() => result.current.moveColumn("team", 1));
    expect(lastChange().order).toEqual(["id", "city", "team", "name"]);
    rerender({ state: lastChange() });
    expect(result.current.columnOrder).toEqual(["id", "city", "team", "name"]);
  });

  it("drops a column of no group past a group as a whole, and keeps grouped ones in theirs", () => {
    const drop = (columnKey: string) =>
      ({
        dataTransfer: { getData: () => columnKey },
        preventDefault: () => {},
      }) as unknown as React.DragEvent<HTMLElement>;
    const { lastChange, rerender, result } = controlledColumns(
      [...columns, { key: "id", label: "Id" }],
      {},
      { city: "details", team: "details" },
    );
    expect(result.current.columnOrder).toEqual(["name", "team", "city", "id"]);

    // Moving on, after the group - also dropped on its first column
    act(() => result.current.handleDrop(drop("name"), "team"));
    expect(lastChange().order).toEqual(["team", "city", "name", "id"]);
    rerender({ state: lastChange() });
    // Moving back, before it - also dropped on its last column
    act(() => result.current.handleDrop(drop("id"), "city"));
    expect(lastChange().order).toEqual(["id", "team", "city", "name"]);
    rerender({ state: lastChange() });

    // A column of the group stays in it
    const calls = lastChange();
    act(() => result.current.handleDrop(drop("team"), "name"));
    expect(lastChange()).toBe(calls);
  });

  it("builds later edits on a pending reset", () => {
    const { lastChange, rerender, result } = controlledColumns(columns, {
      order: ["city", "team", "name"],
      pinning: { team: "left" },
      widths: { team: 200 },
    });
    act(() => result.current.resetColumnLayout());
    act(() => result.current.handlePinColumn("name", "right"));
    act(() => result.current.setColumnWidth("name", 150));
    act(() => result.current.moveColumn("name", 1));
    expect(lastChange()).toEqual({
      order: ["team", "name", "city"],
      pinning: { name: "right" },
      visibility: {},
      widths: { name: 150 },
    });
    rerender({ state: lastChange() });
    expect(result.current.columnWidths).toEqual({ name: 150 });
    expect(result.current.pinnedColumns).toEqual({ left: [], right: ["name"] });
  });
});
