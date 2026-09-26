import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  a: string;
  b: string;
  c: string;
  id: number;
}

const rows: Row[] = Array.from({ length: 10 }, (_, index) => ({
  a: `a${index}`,
  b: `b${index}`,
  c: `c${index}`,
  id: index + 1,
}));

const columns: Column<Row>[] = [
  { editable: true, key: "a", label: "A" },
  { editable: true, key: "b", label: "B" },
  { editable: true, key: "c", label: "C" },
];

const bodyCells = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("cell");

const focused = () => document.activeElement?.textContent;

describe("DataTable editable cells as one tab stop", () => {
  it("has one tab stop for all editable cells", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        onCellEdit={() => {}}
        pagination={false}
      />,
    );
    const cells = bodyCells();

    expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[0]]);
    expect(cells.every((cell) => cell.hasAttribute("tabindex"))).toBe(true);
  });

  it("moves between the editable cells with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DataTable
          columns={columns}
          data={rows}
          densityControl={false}
          onCellEdit={() => {}}
          pagination={false}
        />
        <button type="button">After the table</button>
      </>,
    );

    bodyCells()[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("b0");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(focused()).toBe("b2");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    // The first cell of the row - the focus stays
    expect(focused()).toBe("a2");
    await user.keyboard("{End}");
    expect(focused()).toBe("c2");
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("c2");
    await user.keyboard("{Home}");
    expect(focused()).toBe("a2");
    await user.keyboard("{Control>}{End}{/Control}");
    expect(focused()).toBe("c9");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("c9");
    await user.keyboard("{Control>}{Home}{/Control}");
    expect(focused()).toBe("a0");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("a0");

    // The tab stop follows the focus - Tab leaves the cells, Shift + Tab
    // comes back to the one left
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(focused()).toBe("b1");
    const current = document.activeElement;
    expect(current).toHaveAttribute("tabindex", "0");
    expect(bodyCells().filter((cell) => cell.tabIndex === 0)).toHaveLength(1);

    await user.tab();
    expect(
      screen.getByRole("button", { name: "After the table" }),
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(current);
  });

  it("edits the cell moved to - Enter, Escape and Tab as before", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        onCellEdit={onCellEdit}
        pagination={false}
      />,
    );

    bodyCells()[0].focus();
    await user.keyboard("{ArrowDown}{ArrowRight}{Enter}");
    const field = screen.getByRole("textbox", { name: "B" });
    expect(field).toHaveFocus();
    // The arrow keys of the field are its own
    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(field).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(focused()).toBe("b1");
    expect(document.activeElement).toHaveAttribute("tabindex", "0");

    await user.keyboard("{F2}{Control>}a{/Control}x{Tab}");
    expect(onCellEdit).toHaveBeenCalledWith(rows[1], "b", "x");
    expect(screen.getByRole("textbox", { name: "C" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(focused()).toBe("c1");
  });

  it("skips the cells that cannot be edited", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={[
          { key: "a", label: "A" },
          { editable: (row) => row.id % 2 === 1, key: "b", label: "B" },
          { editable: true, key: "c", label: "C" },
        ]}
        data={rows}
        onCellEdit={() => {}}
        pagination={false}
      />,
    );
    const cells = bodyCells();

    // The first editable cell is the tab stop
    expect(cells.find((cell) => cell.tabIndex === 0)).toHaveTextContent("b0");

    cells[1].focus();
    await user.keyboard("{ArrowDown}");
    // Rows 2, 4, … cannot edit B
    expect(focused()).toBe("b2");
    await user.keyboard("{ArrowLeft}");
    expect(focused()).toBe("b2");
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(focused()).toBe("c3");
    await user.keyboard("{Home}");
    expect(focused()).toBe("c3");
  });

  it("gives the tab stop to another cell when its row is gone", () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={rows}
        onCellEdit={() => {}}
        pagination={false}
      />,
    );

    act(() => bodyCells()[4].focus());
    expect(document.activeElement).toHaveTextContent("b1");
    expect(document.activeElement).toHaveAttribute("tabindex", "0");

    rerender(
      <DataTable
        columns={columns}
        data={rows.slice(3)}
        onCellEdit={() => {}}
        pagination={false}
      />,
    );
    expect(bodyCells().filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
  });

  it("reaches the last rows of a virtualized table", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 500 }, (_, index) => ({
      a: `a${index}`,
      b: `b${index}`,
      c: `c${index}`,
      id: index + 1,
    }));
    render(
      <DataTable
        columns={columns}
        data={many}
        onCellEdit={() => {}}
        pagination={false}
        virtualized
      />,
    );
    expect(screen.queryByText("c499")).toBeNull();

    bodyCells()[0].focus();
    await user.keyboard("{Control>}{End}{/Control}");
    expect(focused()).toBe("c499");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("c498");
  });

  it("edits the next editable cell on Tab also far down a virtualized table", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 500 }, (_, index) => ({
      id: index + 1,
      name: `name${index + 1}`,
    }));
    render(
      <DataTable
        // Only two rows can be edited, far apart
        columns={[
          {
            editable: (row) => row.id === 1 || row.id === 400,
            key: "name",
            label: "Name",
          },
        ]}
        data={many}
        onCellEdit={() => {}}
        pagination={false}
        virtualized
      />,
    );
    expect(screen.queryByText("name400")).toBeNull();

    screen.getByText("name1").closest("td")?.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Tab}");

    // The row edited is rendered, its field has the focus
    const field = screen.getByRole("textbox", { name: "Name" });
    expect(field).toHaveValue("name400");
    expect(field).toHaveFocus();
  });

  it("moves in its own rows past a table nested in a detail", async () => {
    const user = userEvent.setup();
    const items = rows.slice(0, 3);
    render(
      <DataTable
        columns={[{ editable: true, key: "a", label: "A" }]}
        data={rows.slice(0, 3)}
        expandedByDefault
        onCellEdit={() => {}}
        pagination={false}
        // Master-detail - the rows of the nested table are numbered too
        renderSubRow={() => (
          <DataTable
            columns={[{ key: "b", label: "B" }]}
            data={items}
            pagination={false}
          />
        )}
      />,
    );

    const first = screen.getByText("a0").closest("td");
    first?.focus();
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("a1");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("a2");
    await user.keyboard("{Control>}{Home}{/Control}");
    expect(focused()).toBe("a0");
  });

  it("gives the focus of a deleted row to the next one past a nested table", async () => {
    const user = userEvent.setup();

    function MasterDetail() {
      const [data, setData] = useState(rows.slice(0, 3));
      return (
        <DataTable
          actions={(row) => (
            <button
              onClick={() =>
                setData((current) => current.filter((item) => item !== row))
              }
              type="button"
            >
              Delete {row.a}
            </button>
          )}
          columns={[{ key: "a", label: "A" }]}
          data={data}
          expandedByDefault
          pagination={false}
          renderSubRow={() => (
            <DataTable
              actions={(item) => <button type="button">Open {item.b}</button>}
              columns={[{ key: "b", label: "B" }]}
              data={rows.slice(0, 3)}
              pagination={false}
            />
          )}
        />
      );
    }
    render(<MasterDetail />);

    await user.click(screen.getByRole("button", { name: "Delete a1" }));
    // The second row of the outer table - not of the table nested above it
    expect(screen.getByRole("button", { name: "Delete a2" })).toHaveFocus();
  });

  it("leaves tables without editable cells as they are", () => {
    render(<DataTable columns={columns} data={rows} pagination={false} />);

    expect(bodyCells().some((cell) => cell.hasAttribute("tabindex"))).toBe(
      false,
    );
  });
});
