import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { createDataTableQuery, type DataTableQuery } from "./query";
import type { Column } from "./types";

type TupleRow = [number, string];

const tupleColumns: Column<TupleRow>[] = [
  { key: "name", label: "Name", getValue: (row) => row[1] },
];
const tupleId = (row: TupleRow) => row[0];
const rowBox = (name: string) =>
  screen.getByRole("checkbox", { name: `Select row ${name}` });

describe("DataTable selection regressions", () => {
  it.each([false, true])(
    "preserves selections and exclusions when multiSelect choices are reordered (all matching: %s)",
    async (filteredSelection) => {
      const user = userEvent.setup();
      const data = Array.from({ length: 6 }, (_, index) => ({
        id: index + 1,
        name: `Person ${index + 1}`,
        status: index % 2 === 0 ? "active" : "invited",
      }));
      const columns: Column<(typeof data)[number]>[] = [
        { key: "name", label: "Name" },
        { key: "status", label: "Status", filter: "multiSelect" },
      ];
      const onSelectedIdsChange = vi.fn();
      const onClick = vi.fn();
      const props = {
        clientSide: true,
        columns,
        data,
        filteredSelection,
        groupActions: [{ label: "Archive", onClick }],
        onSelectedIdsChange,
      };
      const { rerender } = render(
        <DataTable
          {...props}
          query={createDataTableQuery({
            filters: { status: ["active", "invited"] },
            pageSize: 2,
          })}
        />,
      );
      if (filteredSelection) {
        await user.click(
          screen.getByRole("checkbox", { name: "Select all rows" }),
        );
        await user.click(
          screen.getByRole("button", { name: "Select all 6 rows" }),
        );
        await user.click(rowBox("Person 2"));
      } else {
        await user.click(rowBox("Person 1"));
      }
      onSelectedIdsChange.mockClear();

      rerender(
        <DataTable
          {...props}
          query={createDataTableQuery({
            filters: { status: ["invited", "active", "", "invited"] },
            pageSize: 2,
          })}
        />,
      );
      expect(rowBox("Person 1")).toBeChecked();
      expect(rowBox("Person 2")).not.toBeChecked();
      expect(onSelectedIdsChange).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Archive" }));
      const selected = filteredSelection
        ? data.filter((row) => row.id !== 2)
        : [data[0]];
      expect(onClick).toHaveBeenCalledExactlyOnceWith(
        selected,
        expect.objectContaining({
          allFiltered: filteredSelection,
          count: selected.length,
          excludedRows: filteredSelection ? [data[1]] : [],
          rows: selected,
        }),
      );
    },
  );

  it("keeps the order of choices significant for a custom filter", async () => {
    const user = userEvent.setup();
    const data = [
      { id: 1, name: "Jana", status: "active" },
      { id: 2, name: "Petr", status: "invited" },
    ];
    const columns: Column<(typeof data)[number]>[] = [
      { key: "name", label: "Name" },
      {
        key: "status",
        label: "Status",
        filter: "multiSelect",
        filterFn: (row, _text, value) =>
          Array.isArray(value) && row.status === value[0],
      },
    ];
    const props = {
      clientSide: true,
      columns,
      data,
      selectionMode: "multiple" as const,
    };
    const { rerender } = render(
      <DataTable
        {...props}
        query={createDataTableQuery({
          filters: { status: ["active", "invited"] },
        })}
      />,
    );
    await user.click(rowBox("Jana"));
    rerender(
      <DataTable
        {...props}
        query={createDataTableQuery({
          filters: { status: ["invited", "active"] },
        })}
      />,
    );
    expect(screen.queryByText("Jana")).not.toBeInTheDocument();
    expect(rowBox("Petr")).not.toBeChecked();
  });

  it("keeps the scroll position for equivalent filters and resets it for changed filters", () => {
    const data = Array.from({ length: 60 }, (_, id) => ({
      id,
      name: `Person ${id}`,
      city: "Praha",
    }));
    const columns: Column<(typeof data)[number]>[] = [
      { key: "name", label: "Name", filter: "input" },
      { key: "city", label: "City", filter: "select" },
    ];
    const props = { clientSide: true, columns, data, maxHeight: "100px" };
    const { container, rerender } = render(
      <DataTable
        {...props}
        query={createDataTableQuery({
          filters: { name: "Person", city: "Praha" },
        })}
      />,
    );
    const scroller = container.querySelector<HTMLElement>(
      "[data-table-scroll]",
    )!;
    scroller.scrollTop = 50;

    rerender(
      <DataTable
        {...props}
        query={createDataTableQuery({
          filters: { city: "Praha", name: "Person", empty: "" },
        })}
      />,
    );
    expect(scroller.scrollTop).toBe(50);

    rerender(
      <DataTable
        {...props}
        query={createDataTableQuery({
          filters: { city: "Brno", name: "Person" },
        })}
      />,
    );
    expect(scroller.scrollTop).toBe(0);
  });

  it("keeps tuple rows intact in callbacks, group actions and automatic reconciliation", async () => {
    const user = userEvent.setup();
    const data: TupleRow[] = [
      [1, "Jana"],
      [2, "Petr"],
    ];
    const onSelectedIdsChange = vi.fn();
    const onClick = vi.fn();
    const props = {
      columns: tupleColumns,
      getRowId: tupleId,
      groupActions: [{ label: "Archive", onClick }],
      onSelectedIdsChange,
    };
    const { rerender } = render(<DataTable {...props} data={data} />);

    await user.click(rowBox("Jana"));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1],
      expect.objectContaining({ rows: [data[0]] }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledExactlyOnceWith(
      [data[0]],
      expect.objectContaining({ rows: [data[0]] }),
    );

    await user.click(rowBox("Petr"));
    const refreshed: TupleRow[] = [[2, "Petr refreshed"]];
    rerender(<DataTable {...props} data={refreshed} />);
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [2],
      expect.objectContaining({ rows: refreshed }),
    );
  });

  it("retains exclusions and refreshed tuple rows when all matching rows are selected", async () => {
    const user = userEvent.setup();
    const data: TupleRow[] = [
      [1, "Jana"],
      [2, "Petr"],
      [3, "Adam"],
    ];
    const onClick = vi.fn();
    const props = {
      clientSide: true,
      columns: tupleColumns,
      defaultQuery: { pageSize: 2 },
      filteredSelection: true,
      getRowId: tupleId,
      groupActions: [{ label: "Archive", onClick }],
    };
    const { rerender } = render(<DataTable {...props} data={data} />);

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 3 rows" }));
    await user.click(rowBox("Jana"));
    expect(rowBox("Jana")).not.toBeChecked();

    const refreshed: TupleRow[] = [[1, "Jana refreshed"], data[1], data[2]];
    rerender(<DataTable {...props} data={refreshed} />);
    expect(rowBox("Jana refreshed")).not.toBeChecked();
    expect(rowBox("Petr")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledExactlyOnceWith(
      [data[1], data[2]],
      expect.objectContaining({
        allFiltered: true,
        count: 2,
        excludedRows: [refreshed[0]],
        rows: [data[1], data[2]],
      }),
    );
  });

  it.each([false, true])(
    "preserves selection for equivalent filters and resets it for changed filters (all matching: %s)",
    async (filteredSelection) => {
      const user = userEvent.setup();
      const data = Array.from({ length: 6 }, (_, index) => ({
        id: index + 1,
        name: `Person ${index + 1}`,
        city: "Praha",
        age: 20,
      }));
      const columns: Column<(typeof data)[number]>[] = [
        { key: "name", label: "Name", filter: "input" },
        { key: "city", label: "City", filter: "select" },
        { key: "age", label: "Age", filter: "numberRange" },
      ];
      const filters: DataTableQuery["filters"] = {
        name: "Person",
        city: "Praha",
        age: { from: "18", to: "30" },
      };
      const onSelectedIdsChange = vi.fn();
      const onClick = vi.fn();
      const props = {
        clientSide: true,
        columns,
        data,
        filteredSelection,
        groupActions: [{ label: "Archive", onClick }],
        onSelectedIdsChange,
      };
      const { rerender } = render(
        <DataTable
          {...props}
          query={createDataTableQuery({ filters, pageSize: 2 })}
        />,
      );

      if (filteredSelection) {
        await user.click(
          screen.getByRole("checkbox", { name: "Select all rows" }),
        );
        await user.click(
          screen.getByRole("button", { name: "Select all 6 rows" }),
        );
        await user.click(rowBox("Person 2"));
      } else {
        await user.click(rowBox("Person 1"));
      }
      onSelectedIdsChange.mockClear();

      rerender(
        <DataTable
          {...props}
          query={createDataTableQuery({
            filters: {
              age: { to: "30", from: "18" },
              city: "Praha",
              name: "Person",
              empty: "",
              emptyRange: { from: "", to: "" },
              emptyChoices: [],
            },
            pageSize: 2,
          })}
        />,
      );
      expect(rowBox("Person 1")).toBeChecked();
      expect(rowBox("Person 2")).not.toBeChecked();
      expect(onSelectedIdsChange).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Archive" }));
      const selected = filteredSelection
        ? data.filter((row) => row.id !== 2)
        : [data[0]];
      expect(onClick).toHaveBeenCalledExactlyOnceWith(
        selected,
        expect.objectContaining({
          allFiltered: filteredSelection,
          count: selected.length,
          rows: selected,
        }),
      );

      rerender(
        <DataTable
          {...props}
          query={createDataTableQuery({
            filters: { ...filters, name: "Person 1" },
            pageSize: 2,
          })}
        />,
      );
      expect(rowBox("Person 1")).not.toBeChecked();
      const action = screen.getByRole("button", { name: "Archive" });
      expect(action).toHaveAttribute("aria-disabled", "true");
      await user.click(action);
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );
});
