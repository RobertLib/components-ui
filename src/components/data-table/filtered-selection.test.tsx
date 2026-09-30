import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable, { type DataTableProps } from ".";
import ConfirmProvider from "../../providers/confirm-provider";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/cs";
import { useConfirm } from "../../providers/confirm-context";
import type { Column, RowId } from "./types";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `Person ${index + 1}`,
}));

const columns: Column<Row>[] = [{ key: "name", label: "Name" }];

const rowBox = (name: string) =>
  screen.getByRole("checkbox", { name: `Select row ${name}` });

/** The text of the selection bar - its live region. */
const barText = () => document.querySelector("[aria-live]")?.textContent;

describe("DataTable selection of all matching rows", () => {
  it("leaves out the rows unchecked after selecting all matching ones", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 10 }}
        filteredSelection
        groupActions={[{ label: "Archive", onClick }]}
      />,
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });

    await user.click(selectAll);
    await user.click(
      screen.getByRole("button", { name: "Select all 25 rows" }),
    );
    expect(barText()).toBe("All 25 rows are selected. Clear selection");

    // One unchecked - the others of every page stay selected
    await user.click(rowBox("Person 2"));
    expect(rowBox("Person 2")).not.toBeChecked();
    expect(rowBox("Person 3")).toBeChecked();
    expect(barText()).toBe("24 matching rows are selected. Clear selection");
    expect(selectAll).toBePartiallyChecked();

    // The rows of another page are selected too
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(rowBox("Person 11")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    const [actionRows, selection] = onClick.mock.lastCall ?? [];
    expect(actionRows).toHaveLength(24);
    expect(actionRows).not.toContain(rows[1]);
    expect(selection).toEqual(
      expect.objectContaining({
        allFiltered: true,
        count: 24,
        excludedRows: [rows[1]],
      }),
    );

    // Checked again, the row is back in
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await user.click(rowBox("Person 2"));
    expect(barText()).toBe("All 25 rows are selected. Clear selection");
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();

    // The mixed "select all" checks all matching rows again, the checked
    // one unchecks them
    await user.click(rowBox("Person 3"));
    expect(selectAll).toBePartiallyChecked();
    await user.click(selectAll);
    expect(barText()).toBe("All 25 rows are selected. Clear selection");
    expect(rowBox("Person 3")).toBeChecked();
    await user.click(selectAll);
    expect(barText()).toBe("");
    expect(rowBox("Person 3")).not.toBeChecked();
  });

  it("selects nothing once every matching row is unchecked", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows.slice(0, 3)}
        defaultQuery={{ pageSize: 2 }}
        filteredSelection
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 3 rows" }));
    await user.click(rowBox("Person 1"));
    await user.click(rowBox("Person 2"));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(rowBox("Person 3"));

    expect(rowBox("Person 3")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(barText()).toBe("");
  });

  it.each([false, true])(
    "drops exclusions for removed client-side rows (controlled: %s)",
    async (controlled) => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onSelectedIdsChange = vi.fn();
      const originalRows = rows.slice(0, 3);

      function Table({ data }: Pick<DataTableProps<Row>, "data">) {
        const [selectedIds, setSelectedIds] = useState<RowId[]>([]);
        return (
          <DataTable
            clientSide
            columns={columns}
            data={data}
            defaultQuery={{ pageSize: 2 }}
            filteredSelection
            groupActions={[{ label: "Archive", onClick }]}
            onSelectedIdsChange={(ids, selection) => {
              setSelectedIds(ids);
              onSelectedIdsChange(ids, selection);
            }}
            selectedIds={controlled ? selectedIds : undefined}
          />
        );
      }

      const { rerender } = render(<Table data={originalRows} />);
      const selectAll = screen.getByRole("checkbox", {
        name: "Select all rows",
      });
      await user.click(selectAll);
      await user.click(
        screen.getByRole("button", { name: "Select all 3 rows" }),
      );
      await user.click(rowBox("Person 1"));
      await user.click(rowBox("Person 2"));

      rerender(<Table data={[rows[2]]} />);

      expect(rowBox("Person 3")).toBeChecked();
      expect(selectAll).toBeChecked();
      expect(selectAll).not.toBePartiallyChecked();
      expect(barText()).toBe("1 row is selected. Clear selection");
      expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Archive" }));
      expect(onClick).toHaveBeenLastCalledWith(
        [rows[2]],
        expect.objectContaining({
          allFiltered: true,
          count: 1,
          excludedRows: [],
          ids: [3],
          rows: [rows[2]],
        }),
      );

      // Removed exclusions stay gone if the rows are loaded again.
      rerender(<Table data={originalRows} />);
      expect(rowBox("Person 1")).toBeChecked();
      expect(rowBox("Person 2")).toBeChecked();
      expect(barText()).toBe("All 3 rows are selected. Clear selection");

      await user.click(rowBox("Person 1"));
      expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
        [2, 3],
        expect.objectContaining({
          allFiltered: true,
          count: 2,
          excludedRows: [rows[0]],
          ids: [2, 3],
          rows: [rows[1], rows[2]],
        }),
      );
      await user.click(selectAll);
      expect(rowBox("Person 1")).toBeChecked();
      await user.click(selectAll);
      expect(barText()).toBe("");
      expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          allFiltered: false,
          count: 0,
          excludedRows: [],
        }),
      );
    },
  );

  it("reconciles exclusions with refreshed rows matching the client-side filters", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const initialRows = rows.slice(0, 4);
    const props = {
      clientSide: true,
      columns,
      defaultQuery: { pageSize: 2, search: "Person" },
      enableGlobalSearch: true,
      filteredSelection: true,
      groupActions: [{ label: "Archive", onClick }],
    };
    const { rerender } = render(<DataTable {...props} data={initialRows} />);
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 4 rows" }));
    await user.click(rowBox("Person 1"));
    await user.click(rowBox("Person 2"));

    const refreshedRows = [
      { ...rows[0], name: "Outside search" },
      { ...rows[1], name: "Person 2 refreshed" },
      rows[2],
      rows[3],
    ];
    rerender(<DataTable {...props} data={refreshedRows} />);

    expect(rowBox("Person 2 refreshed")).not.toBeChecked();
    expect(barText()).toBe("2 matching rows are selected. Clear selection");
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenLastCalledWith(
      [rows[2], rows[3]],
      expect.objectContaining({
        allFiltered: true,
        count: 2,
        excludedRows: [refreshedRows[1]],
        ids: [3, 4],
      }),
    );

    // Empty data while loading is a placeholder, not a removed exclusion.
    rerender(<DataTable {...props} data={[]} loading />);
    rerender(<DataTable {...props} data={refreshedRows} />);
    expect(rowBox("Person 2 refreshed")).not.toBeChecked();
    expect(barText()).toBe("2 matching rows are selected. Clear selection");
  });

  it("keeps exclusions from other pages with server-side data", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const props = {
      columns,
      defaultQuery: { pageSize: 2 },
      filteredSelection: true,
      groupActions: [{ label: "Archive", onClick }],
      total: 4,
    };
    const { rerender } = render(
      <DataTable {...props} data={rows.slice(0, 2)} />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 4 rows" }));
    await user.click(rowBox("Person 1"));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    rerender(<DataTable {...props} data={rows.slice(2, 4)} />);

    expect(rowBox("Person 3")).toBeChecked();
    expect(barText()).toBe("3 matching rows are selected. Clear selection");
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenLastCalledWith(
      [rows[2], rows[3]],
      expect.objectContaining({ count: 3, excludedRows: [rows[0]] }),
    );

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    rerender(<DataTable {...props} data={rows.slice(0, 2)} />);
    expect(rowBox("Person 1")).not.toBeChecked();
  });

  it("writes the rows left in the language of the table", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={columns}
          data={rows.slice(0, 6)}
          defaultQuery={{ pageSize: 5 }}
          filteredSelection
          groupActions={[{ label: "Archivovat", onClick: () => {} }]}
        />
      </UIProvider>,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Vybrat všechny řádky" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Vybrat všech 6 řádků" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Vybrat řádek Person 1" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Vybrat řádek Person 2" }),
    );

    expect(barText()).toBe("Vybrány 4 odpovídající řádky. Zrušit výběr");
  });
});

describe("DataTable selection focus", () => {
  it("keeps the focus on the bar's buttons and gives that of Clear selection to Select all", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 10 }}
        filteredSelection
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });

    await user.click(selectAll);
    await user.click(
      screen.getByRole("button", { name: "Select all 25 rows" }),
    );
    // The same button - it says "Clear selection" now
    expect(
      screen.getByRole("button", { name: "Clear selection" }),
    ).toHaveFocus();

    // The bar goes with the selection - not the focus
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(barText()).toBe("");
    expect(selectAll).toHaveFocus();
  });

  it("keeps the focus on a group action that dropped the selection", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <DataTable
          autoResetSelectedRows
          clientSide
          columns={columns}
          data={rows.slice(0, 3)}
          groupActions={[
            { label: "Archive", onClick },
            { label: "Export", onClick: () => {} },
          ]}
        />
        <button type="button">After</button>
      </>,
    );

    await user.click(rowBox("Person 1"));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    // Nothing selected - announced unavailable, but still focused
    const archive = screen.getByRole("button", { name: "Archive" });
    expect(archive).toHaveFocus();
    expect(archive).not.toBeDisabled();
    expect(archive).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);

    // Once the focus moves on, the button is disabled
    await user.tab();
    expect(archive).toBeDisabled();
  });

  it("gives the focus to Select all when a group action removes every row", async () => {
    const user = userEvent.setup();

    function Table() {
      const [data, setData] = useState(rows.slice(0, 3));
      return (
        <DataTable
          autoResetSelectedRows
          clientSide
          columns={columns}
          data={data}
          groupActions={[
            {
              label: "Delete",
              onClick: (selected) =>
                setData((current) =>
                  current.filter((row) => !selected.includes(row)),
                ),
            },
          ]}
        />
      );
    }
    render(<Table />);

    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });
    await user.click(selectAll);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // The bar of the actions went with the last row - not the focus
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(selectAll).toHaveFocus();
  });

  it.each([false, true])(
    "has the focus on the group action after its confirm dialog (slow: %s)",
    async (slow) => {
      const user = userEvent.setup();

      function Table() {
        const confirm = useConfirm();
        return (
          <DataTable
            autoResetSelectedRows
            clientSide
            columns={columns}
            data={rows.slice(0, 3)}
            groupActions={[
              {
                label: "Archive",
                onClick: async () => {
                  const ok = await confirm({
                    confirmLabel: "Archive them",
                    title: "Archive the rows?",
                  });
                  if (slow) await new Promise((r) => setTimeout(r, 50));
                  return ok;
                },
              },
            ]}
          />
        );
      }
      render(
        <ConfirmProvider>
          <Table />
        </ConfirmProvider>,
      );

      await user.click(rowBox("Person 1"));
      const archive = screen.getByRole("button", { name: "Archive" });
      archive.focus();
      await user.keyboard("{Enter}");
      await user.click(
        await screen.findByRole("button", { name: "Archive them" }),
      );
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

      // The selection is gone - the button got the focus back, unavailable
      await waitFor(() => expect(rowBox("Person 1")).not.toBeChecked());
      expect(archive).toHaveFocus();
      expect(archive).not.toBeDisabled();
      expect(archive).toHaveAttribute("aria-disabled", "true");
    },
  );
});

describe("DataTable selection announcements", () => {
  it("has the live region of the count before the first row is selected", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        columns={columns}
        data={rows.slice(0, 3)}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );
    const region = container.querySelector("[aria-live]");

    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent("");

    await user.click(rowBox("Person 1"));
    // The same region - its content changed, which is what is announced
    expect(container.querySelector("[aria-live]")).toBe(region);
    expect(region).toHaveTextContent("1 item selected");
  });

  it("has the live region of the selection bar before the first row is selected", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 10 }}
        filteredSelection
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );
    const region = container.querySelector("[aria-live]");

    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent("");

    await user.click(rowBox("Person 1"));
    expect(container.querySelector("[aria-live]")).toBe(region);
    expect(region).toHaveTextContent("1 row on this page is selected.");
  });
});
