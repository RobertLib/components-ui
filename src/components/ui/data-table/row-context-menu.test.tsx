import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import type { DropdownEntry } from "../menu/types";
import type { Column } from "./types";

interface Row {
  id: number;
  locked?: boolean;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "Faktura 2026-001" },
  { id: 2, locked: true, name: "Faktura 2026-002" },
  { id: 3, name: "Faktura 2026-003" },
];

const columns: Column<Row>[] = [{ key: "name", label: "Invoice" }];

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

function renderTable(
  onOpen = vi.fn(),
  props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {},
) {
  render(
    <DataTable
      columns={columns}
      data={rows}
      getRowContextMenu={(row): DropdownEntry[] | null =>
        row.locked
          ? null
          : [
              { label: `Open ${row.name}`, onClick: () => onOpen(row) },
              { danger: true, label: "Delete" },
            ]
      }
      {...props}
    />,
  );
  return onOpen;
}

describe("DataTable row context menu", () => {
  it("opens the entries of the row on a right click", async () => {
    const user = userEvent.setup();
    const onOpen = renderTable();

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Faktura 2026-003"),
    });

    const menu = screen.getByRole("menu", { name: "Row actions" });
    // The row of the menu is highlighted while it is open
    expect(bodyRows()[2]).toHaveClass("bg-neutral-100/80");
    expect(bodyRows()[0]).not.toHaveClass("bg-neutral-100/80");

    await user.click(
      within(menu).getByRole("menuitem", { name: "Open Faktura 2026-003" }),
    );
    expect(onOpen).toHaveBeenCalledWith(rows[2]);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(bodyRows()[2]).not.toHaveClass("bg-neutral-100/80");
  });

  it("leaves the menu of the browser to a row without entries", async () => {
    const user = userEvent.setup();
    renderTable();

    // A row with entries first - the next one must not show them
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Faktura 2026-001"),
    });
    await user.keyboard("{Escape}");

    const locked = screen.getByText("Faktura 2026-002");
    fireEvent.pointerDown(locked, { button: 2 });
    expect(fireEvent.contextMenu(locked)).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("makes the rows one Tab stop and opens on Shift + F10", async () => {
    const user = userEvent.setup();
    const onOpen = renderTable();

    expect(bodyRows().map((row) => row.tabIndex)).toEqual([0, -1, -1]);
    act(() => bodyRows()[0].focus());
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(bodyRows()[2]).toHaveFocus();

    await user.keyboard("{Shift>}{F10}{/Shift}");
    const menu = screen.getByRole("menu", { name: "Row actions" });
    expect(menu).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith(rows[2]);
    // The focus goes back to the row
    expect(bodyRows()[2]).toHaveFocus();
  });

  it("opens from a control in a row - the checkbox", async () => {
    const user = userEvent.setup();
    renderTable(vi.fn(), { selectionMode: "multiple" });

    const checkbox = within(bodyRows()[0]).getByRole("checkbox");
    checkbox.focus();
    await user.keyboard("{ContextMenu}");

    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", {
        name: "Open Faktura 2026-001",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the menu of the browser in the field of an edited cell", async () => {
    const user = userEvent.setup();
    renderTable(vi.fn(), {
      columns: [{ editable: true, key: "name", label: "Invoice" }],
      onCellEdit: () => {},
    });

    await user.dblClick(screen.getByText("Faktura 2026-001"));
    const field = screen.getByRole("textbox", { name: "Invoice" });

    fireEvent.pointerDown(field, { button: 2 });
    expect(fireEvent.contextMenu(field)).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("names the menu in Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          columns={columns}
          data={rows}
          getRowContextMenu={() => [{ label: "Otevřít" }]}
        />
      </UIProvider>,
    );

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Faktura 2026-001"),
    });

    expect(
      screen.getByRole("menu", { name: "Akce řádku" }),
    ).toBeInTheDocument();
  });
});
