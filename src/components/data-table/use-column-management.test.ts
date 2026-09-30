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
