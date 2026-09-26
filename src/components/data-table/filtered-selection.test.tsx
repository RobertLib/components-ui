import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import ConfirmProvider from "../../providers/confirm-provider";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/cs";
import { useConfirm } from "../../providers/confirm-context";
import type { Column } from "./types";

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
