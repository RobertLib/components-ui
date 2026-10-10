import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataTable, { type DataTableProps } from ".";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
  note: string;
  team: string;
}

const rows: Row[] = [
  { id: 1, name: "Adam", note: "First", team: "A" },
  { id: 2, name: "Běla", note: "Second", team: "B" },
  { id: 3, name: "Cyril", note: "Third", team: "A" },
  { id: 4, name: "Dana", note: "Fourth", team: "B" },
];

/** How many times each row rendered its cells - by the row id. */
const renders = new Map<number, number>();
const renderedRows = () => Object.fromEntries(renders);

const columns: Column<Row>[] = [
  {
    filter: "input",
    key: "name",
    label: "Name",
    pinned: "left",
    render: (row) => {
      renders.set(row.id, (renders.get(row.id) ?? 0) + 1);
      return row.name;
    },
  },
  { editable: true, key: "note", label: "Note", sortable: true },
  { key: "team", label: "Team" },
];

const actions = (row: Row) => <button type="button">Edit {row.name}</button>;
const getRowHref = (row: Row) => `/people/${row.id}`;
const onCellEdit = () => {};
const onRowClick = () => {};
const renderSubRow = (row: Row) => <p>Detail of {row.name}</p>;

/**
 * A parent that is not memoized - not by the React Compiler either - and
 * renders the table again with the same columns and rows, as a page does
 * on a navigation or a state change of its own.
 */
function Parent(props: Partial<DataTableProps<Row>>) {
  "use no memo";
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount(count + 1)} type="button">
        Rendered {count} times again
      </button>
      <DataTable columns={columns} data={rows} {...props} />
    </>
  );
}

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("DataTable row rendering", () => {
  beforeEach(() => renders.clear());

  it.each<[string, Partial<DataTableProps<Row>>]>([
    ["plain rows", {}],
    [
      "rows to select, edit, expand and click",
      {
        actions,
        onCellEdit,
        onRowClick,
        renderSubRow,
        selectionMode: "multiple",
      },
    ],
    ["grouped rows with links", { getRowHref, groupBy: "team" }],
    ["virtualized rows", { selectionMode: "multiple", virtualized: true }],
  ])("renders no row again when its parent renders again - %s", (_, props) => {
    render(<Parent {...props} />);
    expect(renderedRows()).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1 });
    renders.clear();

    const button = screen.getByRole("button", { name: /Rendered/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveTextContent("Rendered 2 times again");
    expect(renderedRows()).toEqual({});
  });

  it("renders again only the rows whose selection or detail changes", async () => {
    const user = userEvent.setup();
    render(<Parent renderSubRow={renderSubRow} selectionMode="multiple" />);
    renders.clear();

    const checkbox = (index: number) =>
      within(bodyRows()[index]).getByRole("checkbox");

    await user.click(checkbox(1));
    expect(renderedRows()).toEqual({ 2: 1 });
    renders.clear();

    // Shift selects from the row checked before - also in a row that did
    // not render since then
    await user.keyboard("{Shift>}");
    await user.click(checkbox(3));
    await user.keyboard("{/Shift}");
    expect(renderedRows()).toEqual({ 3: 1, 4: 1 });
    expect(
      within(screen.getAllByRole("rowgroup")[1])
        .getAllByRole("checkbox")
        .map((element) => (element as HTMLInputElement).checked),
    ).toEqual([false, true, true, true]);
    renders.clear();

    await user.click(
      within(bodyRows()[0]).getByRole("button", { name: /Expand/ }),
    );
    expect(renderedRows()).toEqual({ 1: 1 });
    expect(screen.getByText("Detail of Adam")).toBeInTheDocument();
  });

  it("renders again the rows of new data and new columns", () => {
    const { rerender } = render(<DataTable columns={columns} data={rows} />);

    // A new row object - the others stay the same
    const renamed = [
      rows[0],
      { ...rows[1], name: "Běla Nová" },
      ...rows.slice(2),
    ];
    rerender(<DataTable columns={columns} data={renamed} />);
    expect(within(bodyRows()[1]).getByText("Běla Nová")).toBeInTheDocument();

    rerender(
      <DataTable
        columns={[
          { ...columns[0], render: (row) => row.name.toUpperCase() },
          ...columns.slice(1),
        ]}
        data={renamed}
      />,
    );
    expect(within(bodyRows()[0]).getByText("ADAM")).toBeInTheDocument();
    expect(within(bodyRows()[1]).getByText("BĚLA NOVÁ")).toBeInTheDocument();
  });

  it("calls the latest callbacks from the rows that did not render again", async () => {
    const user = userEvent.setup();
    const firstClick = vi.fn();
    const firstEdit = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={rows}
        onCellEdit={firstEdit}
        onRowClick={firstClick}
      />,
    );
    renders.clear();

    // New callbacks of a parent rendered again
    const latestClick = vi.fn();
    const latestEdit = vi.fn();
    rerender(
      <DataTable
        columns={columns}
        data={rows}
        onCellEdit={latestEdit}
        onRowClick={latestClick}
      />,
    );
    expect(renderedRows()).toEqual({});

    await user.click(screen.getByText("Cyril"));
    expect(latestClick).toHaveBeenCalledWith(
      rows[2],
      expect.objectContaining({ type: "click" }),
    );

    // The arrow keys move between the cells, Enter edits one
    within(bodyRows()[0]).getByText("First").closest("td")!.focus();
    await user.keyboard("{ArrowDown}");
    expect(
      within(bodyRows()[1]).getByText("Second").closest("td"),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Control>}a{/Control}Changed{Enter}");
    expect(latestEdit).toHaveBeenCalledWith(rows[1], "note", "Changed");

    expect(firstClick).not.toHaveBeenCalled();
    expect(firstEdit).not.toHaveBeenCalled();
  });
});
