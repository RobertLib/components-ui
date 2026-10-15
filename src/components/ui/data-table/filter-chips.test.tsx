import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/ui/cs";
import { en } from "../../../i18n/ui/en";
import UIProvider from "../../../providers/ui-provider";
import { formatFilterChipValue } from "./format-filter-value";
import type { Column } from "./types";

interface Row {
  active: boolean;
  born: string;
  id: number;
  name: string;
  salary: number;
  status: string;
  team: string;
}

const rows: Row[] = [
  {
    active: true,
    born: "1990-05-01",
    id: 1,
    name: "Adam",
    salary: 100,
    status: "active",
    team: "a",
  },
  {
    active: false,
    born: "1985-12-24",
    id: 2,
    name: "Běla",
    salary: 500,
    status: "invited",
    team: "b",
  },
];

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Invited", value: "invited" },
];

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name" },
  {
    filter: "select",
    filterSelectOptions: [
      { label: "Accounting", value: "a" },
      { label: "Brno office", value: "b" },
    ],
    key: "team",
    label: "Team",
  },
  {
    filter: "multiSelect",
    filterSelectOptions: statusOptions,
    key: "status",
    label: "Status",
  },
  { filter: "numberRange", key: "salary", label: "Salary" },
  { filter: "dateRange", key: "born", label: "Born" },
  { filter: "boolean", key: "active", label: "Active" },
];

const chipBar = () => screen.getByRole("group", { name: "Active filters" });
const chipTexts = () =>
  Array.from(chipBar().querySelectorAll("[data-chip]")).map(
    (chip) => chip.textContent,
  );

describe("DataTable filter chips", () => {
  it("shows nothing while no filter is active", () => {
    render(<DataTable clientSide columns={columns} data={rows} />);

    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
  });

  it("lists every active filter as the user reads it, in the order of the columns", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{
          filters: {
            active: "true",
            born: { from: "2024-01-01", to: "2024-06-30" },
            name: "ad",
            salary: { from: "100", to: "50000" },
            status: ["active", "invited"],
            team: "b",
          },
        }}
      />,
    );

    expect(chipTexts()).toEqual([
      "Name: ad",
      "Team: Brno office",
      "Status: Active, Invited",
      "Salary: 100–50,000",
      "Born: 01/01/2024–06/30/2024",
      "Active: Yes",
    ]);
  });

  it("writes open ranges, values of no option and the search", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{
          filters: { salary: { to: "500" }, status: ["gone"] },
          search: "brno",
        }}
        enableGlobalSearch
      />,
    );

    expect(chipTexts()).toEqual([
      "Status: gone",
      "Salary: to 500",
      "Search: brno",
    ]);
  });

  it("formats in Czech", () => {
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={columns}
          data={rows}
          defaultQuery={{
            filters: {
              active: "false",
              born: { from: "2024-01-01" },
              salary: { from: "1500.5", to: "80000" },
            },
            search: "x",
          }}
          enableGlobalSearch
        />
      </UIProvider>,
    );

    const bar = screen.getByRole("group", { name: "Aktivní filtry" });
    expect(
      Array.from(bar.querySelectorAll("[data-chip]")).map(
        (chip) => chip.textContent,
      ),
    ).toEqual([
      "Salary: 1 500,5–80 000",
      "Born: od 01.01.2024",
      "Active: Ne",
      "Hledání: x",
    ]);
    expect(
      within(bar).getByRole("button", { name: "Zrušit vše" }),
    ).toBeInTheDocument();
  });

  it("uses formatFilterValue of a column - also for a custom filter", () => {
    const custom: Column<Row>[] = [
      {
        customFilter: () => null,
        filter: "custom",
        formatFilterValue: (value) =>
          typeof value === "string" ? `over ${value} years` : "",
        key: "age",
        label: "Age",
      },
    ];
    render(
      <DataTable
        columns={custom}
        data={rows}
        defaultQuery={{ filters: { age: "30" } }}
      />,
    );

    expect(chipTexts()).toEqual(["Age: over 30 years"]);
  });

  it("shows filters of hidden columns, and with server data those of no column", () => {
    render(
      <DataTable
        columns={[...columns.slice(0, 1), { ...columns[1], visible: false }]}
        data={rows}
        defaultQuery={{ filters: { owner: "42", team: "a" } }}
      />,
    );

    expect(chipTexts()).toEqual(["Team: Accounting", "owner: 42"]);
  });

  it("leaves out what a clientSide table ignores", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { owner: "42" }, search: "x" }}
      />,
    );

    // A filter of no column and a search without its field filter nothing
    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
  });

  it("removes a filter like clearing its field - from the first page", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{
          filters: { status: ["active"], team: "a" },
          page: 3,
        }}
        onQueryChange={onQueryChange}
      />,
    );

    await user.click(
      within(chipBar()).getByRole("button", {
        name: "Remove Team: Accounting",
      }),
    );

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { status: ["active"] }, page: 1 }),
    );
    expect(chipTexts()).toEqual(["Status: Active"]);
    // The focus moves on to the next chip
    expect(
      within(chipBar()).getByRole("button", { name: "Remove Status: Active" }),
    ).toHaveFocus();
  });

  it("drops what is typed in the field of a removed filter", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { name: "ad" } }}
        onQueryChange={onQueryChange}
      />,
    );

    const field = screen.getByRole("searchbox", { name: "Filter Name" });
    await user.type(field, "a");
    // Removed before typing pauses
    await user.click(screen.getByRole("button", { name: "Remove Name: ad" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));

    expect(field).toHaveValue("");
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {} }),
    );
  });

  it("removes the search - also a term typed meanwhile", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ search: "ad" }}
        enableGlobalSearch
        onQueryChange={onQueryChange}
      />,
    );

    const field = screen.getByRole("textbox", { name: "Search" });
    await user.type(field, "x");
    await user.click(screen.getByRole("button", { name: "Remove Search: ad" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));

    expect(field).toHaveValue("");
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "" }),
    );
  });

  it("clears all filters and the search, keeping the focus on its button", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { team: "a" }, search: "ad" }}
        enableGlobalSearch
        onQueryChange={onQueryChange}
      />,
    );

    const clearAll = within(chipBar()).getByRole("button", {
      name: "Clear all",
    });
    await user.click(clearAll);

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {}, search: "" }),
    );
    expect(chipTexts()).toEqual([]);
    // Nothing left to clear - the button stays while it has the focus
    expect(clearAll).toHaveFocus();
    expect(clearAll).toHaveAttribute("aria-disabled", "true");

    await user.tab();
    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
  });

  it("keeps the focus in the bar when its last chip is removed", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { team: "a" } }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remove Team: Accounting" }),
    );

    expect(screen.getByRole("button", { name: "Clear all" })).toHaveFocus();
  });

  it("is left out with filterChips={false}", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { team: "a" } }}
        filterChips={false}
      />,
    );

    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
  });
});

describe("formatFilterChipValue", () => {
  const time: Column<Row> = { filter: "time", key: "t", label: "T" };
  const datetime: Column<Row> = { filter: "datetime", key: "d", label: "D" };

  it("writes times and moments by the locale", () => {
    expect(formatFilterChipValue(time, "14:30", en)).toBe("2:30 PM");
    expect(formatFilterChipValue(time, "14:30", cs)).toBe("14:30");
    expect(formatFilterChipValue(datetime, "2026-09-24T14:30", cs)).toBe(
      "24.09.2026 14:30",
    );
  });

  it("keeps a text it cannot read", () => {
    expect(formatFilterChipValue(datetime, "soon", en)).toBe("soon");
    expect(formatFilterChipValue(undefined, ["a", "b"], en)).toBe("a, b");
    expect(
      formatFilterChipValue(
        { filter: "boolean", key: "b", label: "B" },
        "maybe",
        en,
      ),
    ).toBe("maybe");
  });
});
