import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  balance: number;
  id: number;
  name: string;
}

const rows: Row[] = [
  { balance: 120, id: 1, name: "Alfa s.r.o." },
  { balance: -40, id: 2, name: "Beta a.s." },
];

describe("DataTable Column.cellClassName", () => {
  it("adds the same classes to every body cell of the column", () => {
    render(
      <DataTable
        columns={[
          {
            cellClassName: "font-mono text-end",
            key: "balance",
            label: "Balance",
          },
          { key: "name", label: "Name" },
        ]}
        data={rows}
      />,
    );

    expect(screen.getByText("120").closest("td")).toHaveClass(
      "font-mono",
      "text-end",
    );
    expect(screen.getByText("-40").closest("td")).toHaveClass("font-mono");
    // Not the header, nor the other columns
    expect(
      screen.getByRole("columnheader", { name: "Balance" }),
    ).not.toHaveClass("font-mono");
    expect(screen.getByText("Beta a.s.").closest("td")).not.toHaveClass(
      "font-mono",
    );
  });

  it("adds classes by the row - wins over the defaults of the cell", () => {
    const columns: Column<Row>[] = [
      {
        cellClassName: (row) =>
          row.balance < 0 ? "px-4 text-danger-700" : undefined,
        key: "balance",
        label: "Balance",
      },
    ];
    render(<DataTable columns={columns} data={rows} />);

    const negative = screen.getByText("-40").closest("td");
    expect(negative).toHaveClass("text-danger-700", "px-4");
    // The padding of the cell gives way
    expect(negative).not.toHaveClass("px-2");
    expect(screen.getByText("120").closest("td")).not.toHaveClass(
      "text-danger-700",
    );
  });
});
