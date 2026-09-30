import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column, DataTableColumnState } from "./types";

interface Row {
  city: string;
  id: number;
  name: string;
  team: string;
}

const rows: Row[] = [
  { city: "Brno", id: 1, name: "Adam", team: "A" },
  { city: "Praha", id: 2, name: "Běla", team: "B" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { key: "team", label: "Team" },
  { key: "city", label: "City", visible: false },
];

const headers = () =>
  screen.getAllByRole("columnheader").map((header) => header.textContent);

const openSettings = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Columns" }));

afterEach(() => localStorage.clear());

describe("DataTable column state", () => {
  it("reports every change of the columns", async () => {
    const user = userEvent.setup();
    const onColumnStateChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        onColumnStateChange={onColumnStateChange}
      />,
    );

    await openSettings(user);
    await user.click(screen.getByRole("switch", { name: "City" }));
    expect(onColumnStateChange).toHaveBeenLastCalledWith({
      order: [],
      pinning: {},
      visibility: { city: true },
      widths: {},
    });

    await user.click(
      screen.getByRole("button", { name: "Pin Team to the right" }),
    );
    expect(onColumnStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pinning: { team: "right" } }),
    );

    screen.getByRole("button", { name: "Move Name (arrow keys)" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onColumnStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["team", "name", "city"] }),
    );

    await user.click(screen.getByRole("button", { name: "Reset columns" }));
    expect(onColumnStateChange).toHaveBeenLastCalledWith({
      order: [],
      pinning: {},
      visibility: {},
      widths: {},
    });
  });

  it("shows a controlled state and saves none of it", async () => {
    const user = userEvent.setup();
    const onColumnStateChange = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const state: DataTableColumnState = {
      order: ["city", "team", "name"],
      pinning: { name: "left" },
      visibility: { city: true },
      widths: { team: 140 },
    };
    render(
      <DataTable
        columns={columns}
        columnState={state}
        data={rows}
        onColumnStateChange={onColumnStateChange}
        tableId="controlled"
      />,
    );

    // Pinned to the left first, then the order
    expect(headers()).toEqual(["Name", "City", "Team"]);
    expect(screen.getByRole("columnheader", { name: "Team" }).style.width).toBe(
      "140px",
    );

    await openSettings(user);
    await user.click(screen.getByRole("switch", { name: "Team" }));
    expect(onColumnStateChange).toHaveBeenLastCalledWith({
      ...state,
      visibility: { city: true, team: false },
    });
    // The owner keeps its state - the column stays
    expect(headers()).toEqual(["Name", "City", "Team"]);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem("table-state-controlled")).toBeNull();
  });

  it("builds several changes in a row on each other", async () => {
    const user = userEvent.setup();
    function Table() {
      const [state, setState] = useState<DataTableColumnState>({
        pinning: { team: "left" },
        visibility: { name: false },
      });
      return (
        <DataTable
          columns={columns}
          columnState={state}
          data={rows}
          onColumnStateChange={setState}
        />
      );
    }
    render(<Table />);
    expect(headers()).toEqual(["Team"]);

    // The reset changes the layout and the visibility
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: "Reset columns" }));
    expect(headers()).toEqual(["Name", "Team"]);
  });

  it("keeps successive column choices while the controlled owner is delayed", async () => {
    const user = userEvent.setup();
    const onColumnStateChange = vi.fn();
    const props = { columns, data: rows, onColumnStateChange };
    const { rerender } = render(<DataTable {...props} columnState={{}} />);

    await openSettings(user);
    await user.click(
      screen.getByRole("button", { name: "Pin Name to the left" }),
    );
    rerender(<DataTable {...props} columnState={{}} />);
    await user.click(
      screen.getByRole("button", { name: "Pin Team to the right" }),
    );
    await user.click(screen.getByRole("switch", { name: "City" }));
    await user.click(screen.getByRole("switch", { name: "Team" }));

    const pending = onColumnStateChange.mock.lastCall?.[0];
    expect(pending).toEqual({
      order: [],
      pinning: { name: "left", team: "right" },
      visibility: { city: true, team: false },
      widths: {},
    });
    expect(headers()).toEqual(["Name", "Team"]);

    rerender(<DataTable {...props} columnState={pending} />);
    expect(headers()).toEqual(["Name", "City"]);
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass(
      "sticky",
    );
  });

  it("starts with defaultColumnState until the user changes it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DataTable
        columns={columns}
        data={rows}
        defaultColumnState={{ order: ["team"], visibility: { city: true } }}
        tableId="people"
      />,
    );
    expect(headers()).toEqual(["Team", "Name", "City"]);

    // Reset - the definitions, also after a reload
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: "Reset columns" }));
    expect(headers()).toEqual(["Name", "Team"]);
    unmount();

    render(
      <DataTable
        columns={columns}
        data={rows}
        defaultColumnState={{ order: ["team"], visibility: { city: true } }}
        tableId="people"
      />,
    );
    expect(headers()).toEqual(["Name", "Team"]);
  });

  it("keeps saving under tableId without a controlled state", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} tableId="saved" />);

    await openSettings(user);
    await user.click(screen.getByRole("switch", { name: "Team" }));
    expect(
      JSON.parse(localStorage.getItem("table-state-saved") ?? "{}"),
    ).toMatchObject({ columnVisibility: { team: false } });
  });
});
