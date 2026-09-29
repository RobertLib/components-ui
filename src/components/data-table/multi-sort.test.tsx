import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  age: number;
  id: number;
  name: string;
  team: string;
}

const rows: Row[] = [
  { age: 30, id: 1, name: "Adam", team: "B" },
  { age: 25, id: 2, name: "Běla", team: "A" },
  { age: 41, id: 3, name: "Cyril", team: "B" },
  { age: 25, id: 4, name: "Dana", team: "A" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "team", label: "Team", sortable: true },
  { key: "age", label: "Age", sortable: true },
];

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

const header = (name: string) => screen.getByRole("columnheader", { name });

const sortButton = (label: string) => within(header(label)).getByRole("button");

describe("DataTable sorting by several columns", () => {
  it("adds a column with Shift + click and shows the places", async () => {
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

    await user.click(sortButton("Team"));
    await user.keyboard("{Shift>}");
    await user.click(sortButton("Age"));
    await user.click(sortButton("Age"));
    await user.keyboard("{/Shift}");

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        order: "asc",
        sort: [
          { key: "team", order: "asc" },
          { key: "age", order: "desc" },
        ],
        sortBy: "team",
      }),
    );
    expect(bodyNames()).toEqual(["Běla", "Dana", "Cyril", "Adam"]);

    // One header has `aria-sort`, the others tell their place in words
    expect(header("Team")).toHaveAttribute("aria-sort", "ascending");
    expect(header("Age")).not.toHaveAttribute("aria-sort");
    expect(header("Name")).toHaveAttribute("aria-sort", "none");
    expect(sortButton("Team")).toHaveAccessibleName(
      "Team sorted 1 of 2, ascending",
    );
    expect(sortButton("Age")).toHaveAccessibleName(
      "Age sorted 2 of 2, descending",
    );

    // A plain click sorts by the column alone
    await user.click(sortButton("Name"));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: [{ key: "name", order: "asc" }] }),
    );
    expect(sortButton("Name")).toHaveAccessibleName("Name");
  });

  it("adds a column with Shift + Enter and Shift + Space", async () => {
    const user = userEvent.setup();
    render(<DataTable clientSide columns={columns} data={rows} />);

    sortButton("Team").focus();
    await user.keyboard("{Enter}");
    sortButton("Name").focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(bodyNames()).toEqual(["Běla", "Dana", "Adam", "Cyril"]);

    await user.keyboard("{Shift>} {/Shift}");
    expect(bodyNames()).toEqual(["Dana", "Běla", "Cyril", "Adam"]);
    expect(sortButton("Name")).toHaveAccessibleName(
      "Name sorted 2 of 2, descending",
    );

    // A third Shift + Enter drops the column from the sorting
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(header("Name")).toHaveAttribute("aria-sort", "none");
    expect(header("Team")).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts by one column with Shift + click without multiSort", () => {
    const onQueryChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        defaultQuery={{ sortBy: "team" }}
        onQueryChange={onQueryChange}
      />,
    );

    expect(sortButton("Age")).toHaveAttribute("title", "Sort by Age");
    fireEvent.click(sortButton("Age"), { shiftKey: true });
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: [{ key: "age", order: "asc" }] }),
    );
  });

  it("drops a hidden column from the sorting", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{
          sort: [
            { key: "team", order: "asc" },
            { key: "age", order: "asc" },
          ],
        }}
        onQueryChange={onQueryChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Age" }));

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: [{ key: "team", order: "asc" }] }),
    );
    expect(sortButton("Team")).toHaveAccessibleName("Team");
  });

  it("sorts by the sortable columns the user sees only", () => {
    render(
      <DataTable
        clientSide
        columns={[
          { key: "name", label: "Name", sortable: true },
          { key: "team", label: "Team" },
          { key: "age", label: "Age", sortable: true, visible: false },
        ]}
        data={rows}
        defaultQuery={{
          sort: [
            { key: "team", order: "desc" },
            { key: "age", order: "desc" },
            { key: "name", order: "desc" },
          ],
        }}
      />,
    );

    expect(bodyNames()).toEqual(["Dana", "Cyril", "Běla", "Adam"]);
    // The one sorted column shows no place
    expect(header("Name")).toHaveAttribute("aria-sort", "descending");
    expect(sortButton("Name")).toHaveAccessibleName("Name");
  });
});
