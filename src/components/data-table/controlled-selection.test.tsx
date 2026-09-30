import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startTransition, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable, { type DataTableProps } from ".";
import type { Column, RowId } from "./types";

interface Row {
  id: number;
  name: string;
  team: string;
}

const rows: Row[] = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  name: `Person ${index + 1}`,
  team: index % 2 ? "B" : "A",
}));

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  {
    filter: "select",
    filterSelectOptions: [
      { label: "A", value: "A" },
      { label: "B", value: "B" },
    ],
    key: "team",
    label: "Team",
  },
];

const checkbox = (name: string) =>
  screen.getByRole("checkbox", { name: `Select row ${name}` });

const checkedNames = () =>
  screen
    .getAllByRole("checkbox", { checked: true })
    .map((element) => element.getAttribute("aria-labelledby"))
    .filter(Boolean)
    .map(
      (ids) => document.getElementById(ids!.split(" ")[1])?.textContent ?? "",
    );

/** A table whose selection lives in the state of its parent. */
function ControlledTable({
  initial = [],
  onSelectedIdsChange,
  ...props
}: Partial<DataTableProps<Row>> & { initial?: RowId[] }) {
  const [selectedIds, setSelectedIds] = useState(initial);

  return (
    <DataTable
      clientSide
      columns={columns}
      data={rows}
      {...props}
      onSelectedIdsChange={(ids, selection) => {
        setSelectedIds(ids);
        onSelectedIdsChange?.(ids, selection);
      }}
      selectedIds={selectedIds}
    />
  );
}

describe("DataTable row selection", () => {
  it("selects rows without group actions and announces the count", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );

    await user.click(checkbox("Person 2"));
    await user.click(checkbox("Person 4"));

    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [2, 4],
      expect.objectContaining({
        allFiltered: false,
        count: 2,
        ids: [2, 4],
        rows: [rows[1], rows[3]],
      }),
    );
    expect(screen.getByText("2 items selected")).toHaveClass("sr-only");

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1, 2, 3, 4, 5, 6],
      expect.anything(),
    );
  });

  it("reports the rows an uncontrolled selection drops by itself", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 3 }}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );

    await user.click(checkbox("Person 2"));
    expect(onSelectedIdsChange).toHaveBeenCalledTimes(1);

    // Another page - the row leaves the selection
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onSelectedIdsChange).toHaveBeenCalledTimes(2);
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ count: 0, rows: [] }),
    );
  });

  it("starts with defaultSelectedIds", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultSelectedIds={[3, 99]}
        selectionMode="multiple"
      />,
    );

    expect(checkedNames()).toEqual(["Person 3"]);
  });

  it("drops unavailable default ids before running a group action after loading", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    const onClick = vi.fn();
    const data = [rows[0]];
    const props = {
      columns,
      data,
      defaultSelectedIds: [1, 99],
      groupActions: [{ label: "Archive", onClick }],
      onSelectedIdsChange,
    };
    const { rerender } = render(<DataTable {...props} loading />);
    expect(onSelectedIdsChange).not.toHaveBeenCalled();

    rerender(<DataTable {...props} loading={false} />);

    expect(onSelectedIdsChange).toHaveBeenCalledExactlyOnceWith(
      [1],
      expect.objectContaining({ count: 1, ids: [1], rows: data }),
    );
    expect(screen.getByText("1 item selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledExactlyOnceWith(
      data,
      expect.objectContaining({ count: 1, ids: [1], rows: data }),
    );
  });

  it("selects one row at a time in single mode", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        onSelectedIdsChange={onSelectedIdsChange}
        selectionMode="single"
      />,
    );

    expect(
      screen.queryByRole("checkbox", { name: "Select all rows" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Select" }),
    ).toBeInTheDocument();

    await user.click(checkbox("Person 2"));
    await user.click(checkbox("Person 5"));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [5],
      expect.objectContaining({ count: 1 }),
    );
    expect(checkedNames()).toEqual(["Person 5"]);

    // Checked again, nothing is selected
    await user.click(checkbox("Person 5"));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith([], expect.anything());
  });

  it("selects the rows from the one clicked before with Shift", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        selectionMode="multiple"
      />,
    );

    await user.click(checkbox("Person 2"));
    fireEvent.click(checkbox("Person 5"), { shiftKey: true });
    expect(checkedNames()).toEqual([
      "Person 2",
      "Person 3",
      "Person 4",
      "Person 5",
    ]);

    // Unchecked with Shift - the rows back to the one before are too
    fireEvent.click(checkbox("Person 3"), { shiftKey: true });
    expect(checkedNames()).toEqual(["Person 2"]);

    // From the keyboard - Shift + Space
    checkbox("Person 6").focus();
    await user.keyboard("{Shift>} {/Shift}");
    expect(checkedNames()).toEqual([
      "Person 2",
      "Person 3",
      "Person 4",
      "Person 5",
      "Person 6",
    ]);
  });

  it("shows a controlled selection and keeps it across pages", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    render(
      <ControlledTable
        defaultQuery={{ pageSize: 3 }}
        initial={[1, 5]}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );

    expect(checkedNames()).toEqual(["Person 1"]);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(checkedNames()).toEqual(["Person 5"]);

    await user.click(checkbox("Person 4"));
    // Row 1 of the first page stays selected - a controlled selection is
    // not narrowed down to the page
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1, 5, 4],
      expect.objectContaining({
        count: 3,
        rows: [rows[0], rows[4], rows[3]],
      }),
    );

    // "Select all" of the page adds its rows, and takes them away again
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1, 4, 5, 6],
      expect.anything(),
    );
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1],
      expect.anything(),
    );
  });

  it("changes nothing a parent keeps", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        onSelectedIdsChange={onSelectedIdsChange}
        selectedIds={[2]}
      />,
    );

    await user.click(checkbox("Person 3"));
    expect(onSelectedIdsChange).toHaveBeenCalledWith([2, 3], expect.anything());
    expect(checkedNames()).toEqual(["Person 2"]);
  });

  it("reports all matching rows of filteredSelection", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    render(
      <ControlledTable
        defaultQuery={{ filters: { team: "A" }, pageSize: 2 }}
        filteredSelection
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 3 rows" }));

    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1, 3, 5],
      expect.objectContaining({
        allFiltered: true,
        count: 3,
        excludedRows: [],
      }),
    );
    expect(screen.getByText(/rows are selected/)).toHaveTextContent(
      "All 3 rows are selected.",
    );

    await user.click(checkbox("Person 3"));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      [1, 5],
      expect.objectContaining({
        allFiltered: true,
        count: 2,
        excludedRows: [rows[2]],
      }),
    );
    expect(screen.getByText(/matching rows are selected/)).toBeInTheDocument();
  });

  it("ends all matching rows when the parent sets another selection", async () => {
    const user = userEvent.setup();
    function Table() {
      const [selectedIds, setSelectedIds] = useState<RowId[]>([]);
      return (
        <>
          <button onClick={() => setSelectedIds([])} type="button">
            Deselect
          </button>
          <DataTable
            clientSide
            columns={columns}
            data={rows}
            defaultQuery={{ pageSize: 2 }}
            filteredSelection
            onSelectedIdsChange={setSelectedIds}
            selectedIds={selectedIds}
          />
        </>
      );
    }
    render(<Table />);

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 6 rows" }));
    expect(screen.getByText(/All/)).toHaveTextContent(
      "All 6 rows are selected.",
    );

    await user.click(screen.getByRole("button", { name: "Deselect" }));
    expect(screen.queryByText(/All/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(
      0,
    );
  });

  it.each(["transition", "timeout"])(
    "keeps all matching rows while the parent applies the ids late (%s)",
    async (deferral) => {
      const onSelectedIdsChange = vi.fn();
      function Table() {
        const [selectedIds, setSelectedIds] = useState<RowId[]>([]);
        return (
          <DataTable
            clientSide
            columns={columns}
            data={rows}
            defaultQuery={{ pageSize: 2 }}
            filteredSelection
            onSelectedIdsChange={(ids, selection) => {
              onSelectedIdsChange(ids, selection);
              // e.g. the URL of a router, updated after navigating
              if (deferral === "transition") {
                startTransition(() => setSelectedIds(ids));
              } else {
                setTimeout(() => setSelectedIds(ids));
              }
            }}
            selectedIds={selectedIds}
          />
        );
      }
      render(<Table />);
      const settle = () =>
        act(() => new Promise((resolve) => setTimeout(resolve)));

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Select all rows" }),
      );
      await settle();
      // A second change before the parent applied the first
      fireEvent.click(
        screen.getByRole("button", { name: "Select all 6 rows" }),
      );
      fireEvent.click(checkbox("Person 1"));
      await settle();

      expect(screen.getByText(/matching rows are selected/)).toHaveTextContent(
        "5 matching rows are selected.",
      );
      expect(checkbox("Person 1")).not.toBeChecked();
      expect(checkbox("Person 2")).toBeChecked();
      expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
        [2, 3, 4, 5, 6],
        expect.objectContaining({ allFiltered: true, count: 5 }),
      );

      // Applied, another selection of the parent still ends it
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      await settle();
      expect(
        screen.queryByText(/matching rows are selected/),
      ).not.toBeInTheDocument();
      expect(checkbox("Person 2")).not.toBeChecked();
    },
  );

  it("gives group actions the ids of a controlled selection", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn(() => undefined);
    const onSelectedIdsChange = vi.fn();
    render(
      <ControlledTable
        autoResetSelectedRows
        defaultQuery={{ pageSize: 3 }}
        groupActions={[{ label: "Archive", onClick }]}
        initial={[2, 6]}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );

    expect(screen.getByText("2 items selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(onClick).toHaveBeenCalledWith(
      [rows[1], rows[5]],
      expect.objectContaining({ count: 2, ids: [2, 6] }),
    );
    // Deselected once done
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith([], expect.anything());
  });
});
