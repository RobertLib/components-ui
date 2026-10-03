import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { createDataTableQuery } from "./query";
import type { Column, DataTableColumn } from "./types";

interface Row {
  city: string;
  email: string;
  id: number;
  name: string;
  phone: string;
  salary: number;
  team: string;
}

const rows: Row[] = [
  {
    city: "Brno",
    email: "a@x.cz",
    id: 1,
    name: "Adam",
    phone: "1",
    salary: 100,
    team: "B",
  },
  {
    city: "Praha",
    email: "b@x.cz",
    id: 2,
    name: "Běla",
    phone: "2",
    salary: 200,
    team: "A",
  },
  {
    city: "Brno",
    email: "c@x.cz",
    id: 3,
    name: "Cyril",
    phone: "3",
    salary: 300,
    team: "B",
  },
  {
    city: "Ostrava",
    email: "d@x.cz",
    id: 4,
    name: "Dana",
    phone: "4",
    salary: 400,
    team: "",
  },
];

const grouped: DataTableColumn<Row>[] = [
  { key: "name", label: "Name" },
  {
    children: [
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
    key: "contact",
    label: "Contact",
  },
  { key: "city", label: "City" },
];

const headerRows = () =>
  within(screen.getAllByRole("rowgroup")[0]).getAllByRole("row");

describe("DataTable column groups", () => {
  it("puts the columns of a group under a header of their own", () => {
    render(<DataTable columns={grouped} data={rows} />);

    const [groupRow, columnRow] = headerRows();
    const group = within(groupRow).getByRole("columnheader", {
      name: "Contact",
    });
    expect(group).toHaveAttribute("colspan", "2");
    expect(group).toHaveAttribute("scope", "colgroup");
    // Columns of no group have an empty cell above them
    expect(within(groupRow).getAllByRole("cell")).toHaveLength(2);
    expect(
      within(columnRow)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Name", "Email", "Phone", "City"]);
  });

  it("shows the group over each part split by pinning", () => {
    render(
      <DataTable
        columns={[
          grouped[0],
          {
            ...(grouped[1] as { children: Column<Row>[] }),
            children: [
              { key: "email", label: "Email", pinned: "right" },
              { key: "phone", label: "Phone" },
            ],
            key: "contact",
            label: "Contact",
          },
          grouped[2],
        ]}
        data={rows}
      />,
    );

    const groups = within(headerRows()[0]).getAllByRole("columnheader", {
      name: "Contact",
    });
    expect(groups).toHaveLength(2);
    expect(groups[1]).toHaveClass("sticky");
    expect(groups[1]).toHaveStyle({ insetInlineEnd: "0px" });
  });

  it("moves a column within its group only", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={grouped} data={rows} />);
    await user.click(screen.getByRole("button", { name: "Columns" }));

    const columnHeaders = () =>
      within(headerRows()[1])
        .getAllByRole("columnheader")
        .map((header) => header.textContent);

    screen.getByRole("button", { name: "Move Email (arrow keys)" }).focus();
    await user.keyboard("{ArrowUp}");
    expect(columnHeaders()).toEqual(["Name", "Email", "Phone", "City"]);
    await user.keyboard("{ArrowDown}");
    expect(columnHeaders()).toEqual(["Name", "Phone", "Email", "City"]);

    // A column of no group steps over the whole group - once the handle
    // moved got its focus back
    await act(() => new Promise(requestAnimationFrame));
    screen.getByRole("button", { name: "Move Name (arrow keys)" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(columnHeaders()).toEqual(["Phone", "Email", "Name", "City"]);
    // The settings name the group above its columns
    expect(
      screen.getByText("Contact", { selector: "div" }),
    ).toBeInTheDocument();
  });
});

describe("DataTable row groups", () => {
  const columns: Column<Row>[] = [
    { key: "name", label: "Name", sortable: true },
    { key: "team", label: "Team", sortable: true },
    { key: "salary", label: "Salary", summary: "sum" },
  ];

  const bodyTexts = () =>
    within(screen.getAllByRole("rowgroup")[1])
      .getAllByRole("row")
      .map((row) => row.textContent);

  it("groups the rows by a column with counts and summaries", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ sortBy: "name" }}
        groupBy="team"
      />,
    );

    expect(bodyTexts()).toEqual([
      "Team: A (1 row)",
      "BělaA200",
      "Sum200",
      "Team: B (2 rows)",
      "AdamB100",
      "CyrilB300",
      "Sum400",
      // An empty value last
      "Team: (empty) (1 row)",
      "Dana400",
      "Sum400",
    ]);

    const toggle = screen.getByRole("button", { name: "Team: B (2 rows)" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("data-state", "open");
    expect(toggle.closest("tr")).toHaveAttribute("data-state", "open");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("data-state", "closed");
    expect(toggle.closest("tr")).toHaveAttribute("data-state", "closed");
    expect(bodyTexts()).toEqual([
      "Team: A (1 row)",
      "BělaA200",
      "Sum200",
      "Team: B (2 rows)",
      "Sum400",
      "Team: (empty) (1 row)",
      "Dana400",
      "Sum400",
    ]);
  });

  it("orders the groups in the direction of their sorted column", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows.filter((row) => row.team)}
        defaultQuery={{ order: "desc", sortBy: "team" }}
        groupBy="team"
      />,
    );

    expect(
      screen
        .getAllByRole("button", { name: /^Team:/ })
        .map((b) => b.textContent),
    ).toEqual(["Team: B (2 rows)", "Team: A (1 row)"]);
  });

  it("orders the groups of ISO date-times with a time zone by their moment", () => {
    render(
      <DataTable
        clientSide
        columns={[{ key: "at", label: "At", sortable: true }]}
        data={[
          { at: "2026-09-24T23:30:00Z", id: 1 },
          // Earlier, though its text is later
          { at: "2026-09-25T00:15:00+02:00", id: 2 },
        ]}
        defaultQuery={{ sortBy: "at" }}
        groupBy="at"
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /^At:/ }).map((b) => b.textContent),
    ).toEqual([
      "At: 2026-09-25T00:15:00+02:00 (1 row)",
      "At: 2026-09-24T23:30:00Z (1 row)",
    ]);
  });

  it("counts all rows of a group on a page of it", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2, sortBy: "team" }}
        groupBy="team"
      />,
    );

    // "B" goes on on the next page - its number counts both rows
    expect(
      screen.getByRole("button", { name: "Team: B (2 rows)" }),
    ).toBeInTheDocument();
    expect(bodyTexts()).toHaveLength(6);
  });

  it("keeps the rows of a group together on the pages, sorted within it", () => {
    // Every other row in another group - sorted by the name alone, the pages
    // would show a part of each group
    const people = ["a", "b", "c", "d", "e", "f"].map((name, index) => ({
      ...rows[0],
      id: index + 1,
      name,
      salary: 1,
      team: index % 2 ? "B" : "A",
    }));
    const { rerender } = render(
      <DataTable
        clientSide
        columns={columns}
        data={people}
        groupBy="team"
        query={createDataTableQuery({
          order: "desc",
          pageSize: 2,
          sortBy: "name",
        })}
      />,
    );

    expect(bodyTexts()).toEqual(["Team: A (3 rows)", "eA1", "cA1", "Sum3"]);

    rerender(
      <DataTable
        clientSide
        columns={columns}
        data={people}
        groupBy="team"
        query={createDataTableQuery({
          order: "desc",
          page: 2,
          pageSize: 2,
          sortBy: "name",
        })}
      />,
    );
    expect(bodyTexts()).toEqual([
      "Team: A (3 rows)",
      "aA1",
      "Sum3",
      "Team: B (3 rows)",
      "fB1",
      "Sum3",
    ]);
  });

  it("groups the loaded server page", () => {
    const warn = vi.spyOn(console, "warn");
    render(<DataTable columns={columns} data={rows} groupBy="team" />);

    expect(screen.getAllByRole("button", { name: /^Team:/ })).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });
});
