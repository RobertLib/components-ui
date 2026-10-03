import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable, { type DataTableProps } from ".";
import { createDataTableQuery } from "./query";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "One" },
  { id: 2, name: "Two" },
];
const columns: Column<Row>[] = [{ key: "name", label: "Name" }];

function pendingAction() {
  let finish!: () => void;
  const onClick = vi.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  return { finish: () => finish(), onClick };
}

function content(
  mode: "hidden" | "visible",
  props: Partial<DataTableProps<Row>>,
) {
  return (
    <StrictMode>
      <Activity mode={mode}>
        <DataTable
          autoResetSelectedRows
          columns={columns}
          data={rows}
          {...props}
        />
      </Activity>
    </StrictMode>
  );
}

describe("DataTable group actions with Activity", () => {
  it.each([false, true])(
    "does not report an action's reset after a hidden table unmounts (all matching: %s)",
    async (allMatching) => {
      const user = userEvent.setup();
      const action = pendingAction();
      const onSelectedIdsChange = vi.fn();
      const props = {
        filteredSelection: { total: 10 },
        groupActions: [{ label: "Archive", onClick: action.onClick }],
        onSelectedIdsChange,
        selectedIds: [1, 2],
        total: 10,
      };
      const { rerender, unmount } = render(content("visible", props));
      if (allMatching) {
        await user.click(
          screen.getByRole("button", { name: "Select all 10 rows" }),
        );
      }
      await user.click(screen.getByRole("button", { name: "Archive" }));
      onSelectedIdsChange.mockClear();

      await act(async () => rerender(content("hidden", props)));
      await act(async () => unmount());
      await act(async () => action.finish());

      expect(onSelectedIdsChange).not.toHaveBeenCalled();
    },
  );

  it("leaves a newer controlled selection alone when its action finishes while hidden", async () => {
    const user = userEvent.setup();
    const action = pendingAction();
    const onSelectedIdsChange = vi.fn();
    const props = {
      groupActions: [{ label: "Archive", onClick: action.onClick }],
      onSelectedIdsChange,
      selectedIds: [1],
    };
    const { rerender } = render(content("visible", props));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    await act(async () =>
      rerender(content("hidden", { ...props, selectedIds: [2] })),
    );
    await act(async () => action.finish());

    expect(onSelectedIdsChange).not.toHaveBeenCalled();
    rerender(content("visible", { ...props, selectedIds: [2] }));
    expect(
      screen.getByRole("checkbox", { name: "Select row Two" }),
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
  });

  it.each([false, true])(
    "preserves rows reselected while hidden and resets only continuously selected rows (finish hidden: %s)",
    async (finishHidden) => {
      const user = userEvent.setup();
      const action = pendingAction();
      const onSelectedIdsChange = vi.fn();
      const props = {
        groupActions: [{ label: "Archive", onClick: action.onClick }],
        onSelectedIdsChange,
        selectedIds: [1, 2],
      };
      const { rerender } = render(content("visible", props));
      await user.click(screen.getByRole("button", { name: "Archive" }));

      await act(async () => rerender(content("hidden", props)));
      await act(async () =>
        rerender(content("hidden", { ...props, selectedIds: [2] })),
      );
      await act(async () => rerender(content("hidden", props)));
      if (!finishHidden) rerender(content("visible", props));
      await act(async () => action.finish());

      expect(onSelectedIdsChange).toHaveBeenCalledExactlyOnceWith(
        [1],
        expect.objectContaining({ count: 1, ids: [1], rows: [rows[0]] }),
      );
    },
  );

  it("reports the current rows, query and callback after hidden updates", async () => {
    const user = userEvent.setup();
    const action = pendingAction();
    const previousCallback = vi.fn();
    const latestCallback = vi.fn();
    const props = {
      groupActions: [{ label: "Archive", onClick: action.onClick }],
      onSelectedIdsChange: previousCallback,
      selectedIds: [1],
    };
    const { rerender } = render(content("visible", props));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const updatedRow = { id: 2, name: "Two refreshed" };
    const query = createDataTableQuery({ page: 2 });

    await act(async () =>
      rerender(
        content("hidden", {
          ...props,
          data: [rows[0], updatedRow],
          onSelectedIdsChange: latestCallback,
          query,
          selectedIds: [1, 2],
        }),
      ),
    );
    await act(async () => action.finish());

    expect(previousCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledExactlyOnceWith(
      [2],
      expect.objectContaining({
        count: 1,
        ids: [2],
        query,
        rows: [updatedRow],
      }),
    );
  });

  it("does not reset an all-filtered selection replaced by a new scope while hidden", async () => {
    const user = userEvent.setup();
    const action = pendingAction();
    const onSelectedIdsChange = vi.fn();
    const props = {
      filteredSelection: { scopeKey: "a", total: 10 },
      groupActions: [{ label: "Archive", onClick: action.onClick }],
      onSelectedIdsChange,
      selectedIds: [1, 2],
      total: 10,
    };
    const { rerender } = render(content("visible", props));
    await user.click(
      screen.getByRole("button", { name: "Select all 10 rows" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    onSelectedIdsChange.mockClear();

    await act(async () =>
      rerender(
        content("hidden", {
          ...props,
          filteredSelection: { scopeKey: "b", total: 10 },
        }),
      ),
    );
    await act(async () => action.finish());

    expect(onSelectedIdsChange).not.toHaveBeenCalled();
  });
});
