import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column, DataTableColumn } from "./types";

interface Row {
  born: string;
  id: number;
  name: string;
  total: number;
}

const rows: Row[] = [
  { born: "2001-04-02", id: 1, name: "Adam", total: 3 },
  { born: "1999-11-20", id: 2, name: "Běla", total: 5 },
];

describe("DataTable hideBelow", () => {
  it("hides every cell of the column on narrow screens", () => {
    const columns: Column<Row>[] = [
      { key: "name", label: "Name" },
      {
        filter: "input",
        hideBelow: "md",
        key: "born",
        label: "Born",
        summary: "count",
      },
      { key: "total", label: "Total" },
    ];
    render(<DataTable columns={columns} data={rows} />);

    const header = screen.getByRole("columnheader", { name: /Born/ });
    expect(header).toHaveClass("max-md:hidden");
    // Its filter, its cells and its summary go with it
    expect(
      screen.getByRole("searchbox", { name: "Filter Born" }).closest("td"),
    ).toHaveClass("max-md:hidden");
    for (const row of screen.getAllByRole("row").slice(2)) {
      const cells = within(row).getAllByRole("cell");
      expect(cells[1]).toHaveClass("max-md:hidden");
      expect(cells[0]).not.toHaveClass("max-md:hidden");
      expect(cells[2]).not.toHaveClass("max-md:hidden");
    }
  });

  it("keeps a pinned column, whose offsets count on its width", () => {
    const columns: Column<Row>[] = [
      { hideBelow: "lg", key: "name", label: "Name", pinned: "left" },
      { key: "total", label: "Total" },
    ];
    render(<DataTable columns={columns} data={rows} />);

    expect(screen.getByRole("columnheader", { name: /Name/ })).not.toHaveClass(
      "max-lg:hidden",
    );
  });

  it("keeps a pinned column too wide to stick in a narrow view", () => {
    // Header cells measure 220px - a hidden one would measure none
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        observe(target: Element) {
          this.callback(
            [{ target } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        disconnect() {}
        unobserve() {}
      },
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 220,
    } as DOMRect);
    const columns: Column<Row>[] = [
      { hideBelow: "md", key: "name", label: "Name", pinned: "left" },
      { key: "total", label: "Total" },
    ];

    try {
      const { container } = render(<DataTable columns={columns} data={rows} />);
      // A phone - the column scrolls along, more than half of the view
      const scroller = container.querySelector(".overflow-x-auto")!;
      Object.defineProperty(scroller, "clientWidth", { value: 390 });
      act(() => {
        fireEvent.scroll(scroller);
      });

      const header = screen.getByRole("columnheader", { name: /Name/ });
      expect(header).not.toHaveClass("sticky");
      expect(header).not.toHaveClass("max-md:hidden");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hides the cell of an ungrouped column in the row of the column groups", () => {
    const columns: DataTableColumn<Row>[] = [
      { key: "id", label: "Id" },
      { hideBelow: "md", key: "born", label: "Born" },
      {
        children: [
          { key: "name", label: "Name" },
          { key: "total", label: "Total" },
        ],
        key: "person",
        label: "Person",
      },
    ];
    render(<DataTable columns={columns} data={rows} />);

    // The group stays over its columns
    const groupRow = screen.getAllByRole("row")[0];
    const cells = groupRow.querySelectorAll("td, th");
    expect(cells).toHaveLength(3);
    expect(cells[0]).not.toHaveClass("max-md:hidden");
    expect(cells[1]).toHaveClass("max-md:hidden");
    expect(cells[2]).toHaveTextContent("Person");
  });

  it("keeps the columns that must stay - grouped, editable, holding the row links", () => {
    const columns: DataTableColumn<Row>[] = [
      { hideBelow: "sm", key: "name", label: "Name" },
      { editable: true, hideBelow: "md", key: "total", label: "Total" },
      {
        children: [{ hideBelow: "lg", key: "born", label: "Born" }],
        key: "dates",
        label: "Dates",
      },
    ];
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowHref={(row) => `/people/${row.id}`}
        onCellEdit={() => {}}
      />,
    );

    for (const name of [/Name/, /Total/, /Born/]) {
      expect(screen.getByRole("columnheader", { name }).className).not.toMatch(
        /max-\w+:hidden/,
      );
    }
    for (const cell of screen.getAllByRole("cell")) {
      expect(cell.className).not.toMatch(/max-\w+:hidden/);
    }
    // The tab stop of the editable cells is on a cell that shows
    const tabStop = screen
      .getAllByRole("cell")
      .find((cell) => cell.tabIndex === 0);
    expect(tabStop).toHaveAttribute("data-column-key", "total");
    expect(tabStop).not.toHaveClass("max-md:hidden");
  });

  it("keeps a column moved first in a table with row links - it holds them", () => {
    const columns: Column<Row>[] = [
      { key: "name", label: "Name" },
      { hideBelow: "md", key: "born", label: "Born", summary: "count" },
      { key: "total", label: "Total" },
    ];
    render(
      <DataTable
        columnState={{ order: ["born", "name", "total"] }}
        columns={columns}
        data={rows}
        getRowHref={(row) => `/people/${row.id}`}
      />,
    );

    const link = screen.getByRole("link", { name: "2001-04-02" });
    expect(link.closest("td")).not.toHaveClass("max-md:hidden");
    expect(screen.getByRole("columnheader", { name: /Born/ })).not.toHaveClass(
      "max-md:hidden",
    );
    // The summary row goes with the cells
    const summaryCells = within(
      screen.getAllByRole("rowgroup").at(-1)!,
    ).getAllByRole("cell");
    expect(summaryCells[0]).not.toHaveClass("max-md:hidden");
  });
});
