import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

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
});
