import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable, { type DataTableProps } from ".";
import { createDataTableQuery } from "./query";
import type { Column, RowId } from "./types";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "One" },
  { id: 2, name: "Two" },
];
const columns: Column<Row>[] = [{ key: "name", label: "Name" }];
const rowBox = (name: string) =>
  screen.getByRole("checkbox", { name: `Select row ${name}` });
const barText = () => document.querySelector("[aria-live]")?.textContent;

function pendingAction() {
  let finish!: () => void;
  const onClick = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  return { finish: () => finish(), onClick };
}

function Table({
  controlled,
  onSelectedIdsChange,
  scope = "a",
  ...props
}: Partial<DataTableProps<Row>> & { controlled: boolean; scope?: string }) {
  const [selectedIds, setSelectedIds] = useState<RowId[]>([]);
  return (
    <DataTable
      autoResetSelectedRows
      columns={columns}
      data={rows}
      filteredSelection={{ scopeKey: scope, total: 10 }}
      total={10}
      {...props}
      onSelectedIdsChange={(ids, selection) => {
        setSelectedIds(ids);
        onSelectedIdsChange?.(ids, selection);
      }}
      selectedIds={controlled ? selectedIds : undefined}
    />
  );
}

async function selectAllMatching(user: ReturnType<typeof userEvent.setup>) {
  const selectPage = screen.getByRole("checkbox", { name: "Select all rows" });
  if (!(selectPage as HTMLInputElement).checked) await user.click(selectPage);
  await user.click(screen.getByRole("button", { name: "Select all 10 rows" }));
}

describe.each([false, true])(
  "DataTable asynchronous group actions (controlled: %s)",
  (controlled) => {
    it.each([false, true])(
      "preserves a new scope's selection (return to original scope: %s)",
      async (returnToOriginal) => {
        const user = userEvent.setup();
        const action = pendingAction();
        const onSelectedIdsChange = vi.fn();
        const props = {
          controlled,
          groupActions: [{ label: "Archive", onClick: action.onClick }],
          onSelectedIdsChange,
        };
        const { rerender } = render(<Table {...props} scope="a" />);
        await selectAllMatching(user);
        await user.click(screen.getByRole("button", { name: "Archive" }));

        rerender(<Table {...props} scope="b" />);
        if (returnToOriginal) rerender(<Table {...props} scope="a" />);
        await selectAllMatching(user);
        expect(barText()).toBe("All 10 rows are selected. Clear selection");
        onSelectedIdsChange.mockClear();

        await act(async () => action.finish());

        expect(barText()).toBe("All 10 rows are selected. Clear selection");
        expect(rowBox("One")).toBeChecked();
        expect(onSelectedIdsChange).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
      },
    );

    it.each([false, true])(
      "preserves a later all-filtered selection in the same scope (initially all: %s)",
      async (initiallyAll) => {
        const user = userEvent.setup();
        const action = pendingAction();
        const onSelectedIdsChange = vi.fn();
        render(
          <Table
            controlled={controlled}
            groupActions={[{ label: "Archive", onClick: action.onClick }]}
            onSelectedIdsChange={onSelectedIdsChange}
          />,
        );
        if (initiallyAll) await selectAllMatching(user);
        else await user.click(rowBox("One"));
        await user.click(screen.getByRole("button", { name: "Archive" }));

        if (initiallyAll) {
          await user.click(
            screen.getByRole("button", { name: "Clear selection" }),
          );
        }
        await selectAllMatching(user);
        onSelectedIdsChange.mockClear();
        await act(async () => action.finish());

        expect(barText()).toBe("All 10 rows are selected. Clear selection");
        expect(onSelectedIdsChange).not.toHaveBeenCalled();
      },
    );

    it("resets only acted ids and reports the current rows and query", async () => {
      const user = userEvent.setup();
      const action = pendingAction();
      const onSelectedIdsChange = vi.fn();
      const props = {
        controlled,
        groupActions: [{ label: "Archive", onClick: action.onClick }],
        onQueryChange: () => {},
        onSelectedIdsChange,
      };
      const { rerender } = render(
        <Table {...props} query={createDataTableQuery()} />,
      );
      await user.click(rowBox("One"));
      await user.click(screen.getByRole("button", { name: "Archive" }));
      await user.click(rowBox("Two"));

      const updatedRows = [rows[0], { ...rows[1], name: "Two refreshed" }];
      const query = createDataTableQuery({ page: 2 });
      const onCurrentSelection = vi.fn();
      rerender(
        <Table
          {...props}
          data={updatedRows}
          onSelectedIdsChange={onCurrentSelection}
          query={query}
        />,
      );
      onSelectedIdsChange.mockClear();
      await act(async () => action.finish());

      expect(rowBox("One")).not.toBeChecked();
      expect(rowBox("Two refreshed")).toBeChecked();
      expect(onSelectedIdsChange).not.toHaveBeenCalled();
      expect(onCurrentSelection).toHaveBeenCalledExactlyOnceWith(
        [2],
        expect.objectContaining({
          allFiltered: false,
          count: 1,
          ids: [2],
          query,
          rows: [updatedRows[1]],
        }),
      );
    });

    it("still resets the all-filtered selection used by the action", async () => {
      const user = userEvent.setup();
      const action = pendingAction();
      const onSelectedIdsChange = vi.fn();
      render(
        <Table
          controlled={controlled}
          groupActions={[{ label: "Archive", onClick: action.onClick }]}
          onSelectedIdsChange={onSelectedIdsChange}
        />,
      );
      await selectAllMatching(user);
      await user.click(screen.getByRole("button", { name: "Archive" }));
      onSelectedIdsChange.mockClear();
      await act(async () => action.finish());

      expect(barText()).toBe("");
      expect(rowBox("One")).not.toBeChecked();
      expect(onSelectedIdsChange).toHaveBeenCalledExactlyOnceWith(
        [],
        expect.objectContaining({ allFiltered: false, count: 0, rows: [] }),
      );
    });

    it("does not select the rows unchecked from the all-filtered selection", async () => {
      const user = userEvent.setup();
      const action = pendingAction();
      const onSelectedIdsChange = vi.fn();
      render(
        <Table
          controlled={controlled}
          groupActions={[{ label: "Archive", onClick: action.onClick }]}
          onSelectedIdsChange={onSelectedIdsChange}
        />,
      );
      await selectAllMatching(user);
      await user.click(rowBox("One"));
      expect(barText()).toBe("9 matching rows are selected. Clear selection");
      await user.click(screen.getByRole("button", { name: "Archive" }));
      onSelectedIdsChange.mockClear();
      await act(async () => action.finish());

      expect(barText()).toBe("");
      expect(rowBox("One")).not.toBeChecked();
      expect(rowBox("Two")).not.toBeChecked();
      expect(onSelectedIdsChange).toHaveBeenCalledExactlyOnceWith(
        [],
        expect.objectContaining({ allFiltered: false, count: 0, rows: [] }),
      );
    });
  },
);
