import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import Input from "../input";
import type { Column } from "./types";

interface Row {
  born: string;
  id: number;
  name: string;
  salary: number;
  status: string;
}

const rows: Row[] = [
  { born: "1990-05-01", id: 1, name: "Adam", salary: 30_000, status: "active" },
  {
    born: "1985-12-24",
    id: 2,
    name: "Běla",
    salary: 50_000,
    status: "invited",
  },
  {
    born: "2001-07-30",
    id: 3,
    name: "Cyril",
    salary: 70_000,
    status: "active",
  },
  {
    born: "1990-01-15",
    id: 4,
    name: "Dana",
    salary: 90_000,
    status: "suspended",
  },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  {
    filter: "multiSelect",
    filterSelectOptions: [
      { label: "Active", value: "active" },
      { label: "Invited", value: "invited" },
      { label: "Suspended", value: "suspended" },
    ],
    key: "status",
    label: "Status",
  },
  { filter: "numberRange", key: "salary", label: "Salary" },
  { filter: "dateRange", key: "born", label: "Born" },
];

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("DataTable list and range filters", () => {
  it("filters by several options picked in a panel", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        onQueryChange={onQueryChange}
      />,
    );

    const field = screen.getByRole("button", { name: "Filter Status" });
    expect(field).toHaveTextContent("Search Status");
    expect(field).toHaveAttribute("aria-expanded", "false");

    await user.click(field);
    const panel = screen.getByRole("dialog", { name: "Filter Status" });
    await user.click(within(panel).getByRole("checkbox", { name: "Active" }));
    await user.click(
      within(panel).getByRole("checkbox", { name: "Suspended" }),
    );

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: { status: ["active", "suspended"] },
      }),
    );
    expect(bodyNames()).toEqual(["Adam", "Cyril", "Dana"]);
    // The field shows the picked options and is described by them
    expect(field).toHaveTextContent("Active, Suspended");
    expect(field).toHaveAccessibleDescription("Active, Suspended");

    await user.click(within(panel).getByRole("checkbox", { name: "Active" }));
    await user.click(
      within(panel).getByRole("checkbox", { name: "Suspended" }),
    );
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {} }),
    );
    expect(bodyNames()).toHaveLength(4);
  });

  it("filters by a number range once typing pauses", () => {
    vi.useFakeTimers();
    try {
      const onQueryChange = vi.fn();
      render(
        <DataTable
          clientSide
          columns={columns}
          data={rows}
          onQueryChange={onQueryChange}
        />,
      );

      const from = screen.getByRole("spinbutton", { name: "Salary from" });
      const to = screen.getByRole("spinbutton", { name: "Salary to" });

      fireEvent.change(from, { target: { value: "40000" } });
      expect(onQueryChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(400));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { salary: { from: "40000" } } }),
      );
      expect(bodyNames()).toEqual(["Běla", "Cyril", "Dana"]);

      fireEvent.change(to, { target: { value: "70000" } });
      act(() => vi.advanceTimersByTime(400));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filters: { salary: { from: "40000", to: "70000" } },
        }),
      );
      expect(bodyNames()).toEqual(["Běla", "Cyril"]);

      // "Clear filters" empties both fields
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(from).toHaveValue("");
      expect(to).toHaveValue("");
      expect(bodyNames()).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows and clears a range of days", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{
          filters: { born: { from: "1990-01-01", to: "1990-12-31" } },
        }}
        onQueryChange={onQueryChange}
      />,
    );

    expect(bodyNames()).toEqual(["Adam", "Dana"]);
    const field = screen.getByRole("combobox", { name: "Filter Born" });
    expect(field).toHaveValue("01/01/1990 – 12/31/1990");

    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {} }),
    );
    expect(bodyNames()).toHaveLength(4);
  });

  it("lets a custom filter set a list and read it back", () => {
    const customFilter = vi.fn(
      (
        setFilter: (key: string, value: string | string[]) => void,
        text: string,
        value: unknown,
      ) => (
        <Input
          aria-label="Names"
          dim="sm"
          onChange={(event) =>
            setFilter("name", event.target.value.split(" ").filter(Boolean))
          }
          value={Array.isArray(value) ? value.join(" ") : text}
        />
      ),
    );
    render(
      <DataTable
        clientSide
        columns={[
          { customFilter, filter: "custom", key: "name", label: "Name" },
        ]}
        data={rows}
      />,
    );

    const field = screen.getByRole("textbox", { name: "Names" });
    fireEvent.change(field, { target: { value: "a b" } });

    expect(customFilter).toHaveBeenLastCalledWith(expect.any(Function), "", [
      "a",
      "b",
    ]);
    expect(field).toHaveValue("a b");
    // Any of the texts - "a" or "b"
    expect(bodyNames()).toEqual(["Adam", "Běla", "Dana"]);
  });

  it("highlights a text filter but no list", () => {
    render(
      <DataTable
        clientSide
        columns={[
          { filter: "input", key: "name", label: "Name" },
          ...columns.slice(1),
        ]}
        data={rows}
        defaultQuery={{ filters: { name: "da", status: ["suspended"] } }}
      />,
    );

    expect(screen.getByText("Da", { selector: "b" })).toBeInTheDocument();
    expect(document.querySelectorAll("b")).toHaveLength(1);
  });
});
