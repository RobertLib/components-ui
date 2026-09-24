import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DataTable from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
import type { Column } from "./types";

interface Row {
  id: number;
  joined: Date;
  name: string;
  salary: number;
  team: string;
}

const rows: Row[] = [
  {
    id: 1,
    joined: new Date(2024, 2, 1),
    name: "Cecilie",
    salary: 1500,
    team: "B",
  },
  {
    id: 2,
    joined: new Date(2023, 0, 9),
    name: "Adam",
    salary: 1000,
    team: "A",
  },
  {
    id: 3,
    joined: new Date(2025, 5, 30),
    name: "Běla",
    salary: 2000,
    team: "A",
  },
];

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", summary: "count" },
  {
    filter: "select",
    filterSelectOptions: [
      { label: "A", value: "A" },
      { label: "B", value: "B" },
    ],
    key: "team",
    label: "Team",
    summary: (teamRows) =>
      `${new Set(teamRows.map((row) => row.team)).size} teams`,
  },
  { key: "joined", label: "Joined", summary: "min" },
  { key: "salary", label: "Salary", summary: "sum" },
];

/** The texts of the cells of the summary row. */
const summaryCells = () =>
  within(screen.getAllByRole("rowgroup")[2])
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

describe("DataTable summary row", () => {
  it("sums up every matching row of a clientSide table, not just the page", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 1 }}
      />,
    );

    expect(summaryCells()).toEqual([
      "Count3",
      "2 teams",
      "Min01/09/2023",
      "Sum4,500",
    ]);
  });

  it("follows the filters", async () => {
    const user = userEvent.setup();
    render(<DataTable clientSide columns={columns} data={rows} />);

    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "bel",
    );

    await waitFor(() =>
      expect(summaryCells()).toEqual([
        "Count1",
        "1 teams",
        "Min06/30/2025",
        "Sum2,000",
      ]),
    );
  });

  it("is a footer that sticks to the bottom of the table", () => {
    render(<DataTable clientSide columns={columns} data={rows} />);

    const footer = screen.getAllByRole("rowgroup")[2];
    expect(footer.tagName).toBe("TFOOT");
    expect(footer).toHaveClass("sticky", "bottom-0");
  });

  it("averages with two decimals at most and writes numbers by the language", () => {
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={[
            { key: "salary", label: "Plat", summary: "avg" },
            { key: "id", label: "Id", summary: "max" },
          ]}
          data={[...rows, { ...rows[0], id: 4, salary: 1001 }]}
        />
      </UIProvider>,
    );

    expect(summaryCells().map((text) => text?.replace(/\s/g, " "))).toEqual([
      "Průměr1 375,25",
      "Max.4",
    ]);
  });

  it("shows a dash for an average of no numbers", () => {
    render(
      <DataTable
        clientSide
        columns={[{ key: "name", label: "Name", summary: "avg" }]}
        data={rows}
      />,
    );

    expect(summaryCells()).toEqual(["Average–"]);
  });

  it("takes the values of a server and sums the loaded rows without them", () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        summaryValues={{ salary: 123456, team: <i>many</i> }}
        total={40}
      />,
    );

    // The server's total - still labeled by the column's aggregate
    expect(summaryCells()).toEqual([
      "Count2",
      "many",
      "Min01/09/2023",
      "Sum123,456",
    ]);

    rerender(
      <DataTable columns={columns} data={rows.slice(0, 2)} total={40} />,
    );

    expect(summaryCells()[3]).toBe("Sum2,500");
  });

  it("covers only the visible columns and is left out without rows", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DataTable
        actions={() => "Edit"}
        clientSide
        columns={columns}
        data={rows}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );

    // Empty cells under the selection and actions columns
    expect(summaryCells()).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Team" }));
    expect(summaryCells()).toHaveLength(5);

    rerender(<DataTable clientSide columns={columns} data={[]} />);
    expect(screen.getAllByRole("rowgroup")).toHaveLength(2);
  });

  it("is left out when no column has a summary", () => {
    render(
      <DataTable
        clientSide
        columns={[{ key: "name", label: "Name" }]}
        data={rows}
        summaryValues={{ other: 1 }}
      />,
    );

    expect(screen.getAllByRole("rowgroup")).toHaveLength(2);
  });
});
