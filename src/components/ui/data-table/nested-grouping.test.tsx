import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { getDataTableGroupKey } from "./grouping";
const columns = [
  { key: "name", label: "Name" },
  { key: "team", label: "Team" },
  { key: "city", label: "City" },
  { key: "amount", label: "Amount", summary: "sum" as const },
];
const rows = [
  { id: 1, name: "Adam", team: "A", city: "Prague", amount: 10 },
  { id: 2, name: "Eva", team: "A", city: "Brno", amount: 20 },
  { id: 3, name: "Robin", team: "B", city: "Prague", amount: 30 },
];

describe("nested and server grouping", () => {
  it("groups at multiple depths and collapses a parent with its descendants", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        groupBy={["team", "city"]}
      />,
    );
    expect(screen.getAllByRole("button", { name: /^City:/ })).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Team: A (2 rows)" }),
    ).toBeInTheDocument();
    const parent = screen.getByRole("button", { name: "Team: A (2 rows)" });
    fireEvent.click(parent);
    expect(screen.getAllByRole("button", { name: /^City:/ })).toHaveLength(1);
    expect(screen.queryByText("Adam")).toBeNull();
    expect(screen.getByText("Robin")).toBeInTheDocument();
    expect(
      within(parent.closest("tbody")!)
        .getAllByRole("row")
        .some((row) => row.textContent === "Sum30"),
    ).toBe(true);
  });
  it("uses server counts and summaries without pretending a loaded page is the complete group", () => {
    render(
      <DataTable
        columns={columns}
        data={[rows[0]]}
        groupBy="team"
        groupMetadata={{
          [getDataTableGroupKey(["A"])]: {
            count: 50,
            summaryValues: { amount: 1250 },
          },
        }}
        total={50}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Team: A (50 rows)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1,250")).toBeInTheDocument();
  });
  it("reports controlled collapse requests and uses collision-free paths", () => {
    const change = vi.fn();
    const key = getDataTableGroupKey(["A", "Prague"]);
    const { rerender } = render(
      <DataTable
        collapsedGroupKeys={[]}
        columns={columns}
        data={rows}
        groupBy={["team", "city"]}
        onCollapsedGroupKeysChange={change}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "City: Prague (1 row)" })[0],
    );
    expect(change).toHaveBeenCalledWith([key]);
    expect(screen.getByText("Adam")).toBeInTheDocument();
    rerender(
      <DataTable
        collapsedGroupKeys={[key]}
        columns={columns}
        data={rows}
        groupBy={["team", "city"]}
        onCollapsedGroupKeysChange={change}
      />,
    );
    expect(screen.queryByText("Adam")).toBeNull();
    expect(getDataTableGroupKey(['["A","Prague"]'])).not.toBe(key);
  });
  it("virtualizes group headers, summaries and rows with consecutive ARIA indexes", () => {
    const data = Array.from({ length: 200 }, (_, id) => ({
      ...rows[0],
      id,
      name: `Person ${id}`,
      team: `Team ${Math.floor(id / 20)}`,
    }));
    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        groupBy="team"
        maxHeight="250px"
        virtualized
      />,
    );
    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("aria-rowcount", "222");
    const rendered = [...container.querySelectorAll("tbody tr[aria-rowindex]")];
    expect(rendered.length).toBeLessThan(50);
    expect(rendered[0]).toHaveAttribute("aria-rowindex", "2");
    fireEvent.click(
      screen.getByRole("button", { name: "Team: Team 0 (20 rows)" }),
    );
    expect(table).toHaveAttribute("aria-rowcount", "202");
    expect(screen.queryByText("Person 0")).toBeNull();
  });
});
