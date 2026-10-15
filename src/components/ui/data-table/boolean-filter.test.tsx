import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import {
  applyDataTableQuery,
  createDataTableQuery,
  readQueryFromSearch,
  setFilter,
  toFilterParams,
  writeQueryToSearch,
} from "./query";
import type { Column } from "./types";

interface Row {
  active: unknown;
  id: number;
  name: string;
}

const rows: Row[] = [
  { active: true, id: 1, name: "Adam" },
  { active: false, id: 2, name: "Běla" },
  { active: null, id: 3, name: "Cyril" },
  { active: "true", id: 4, name: "Dana" },
  { active: 0, id: 5, name: "Emil" },
  { active: 1, id: 6, name: "Fanny" },
  { active: "no", id: 7, name: "Gustav" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { filter: "boolean", key: "active", label: "Active" },
];

const names = (filter: string) =>
  applyDataTableQuery(
    rows,
    createDataTableQuery({ filters: { active: filter } }),
    columns,
  ).rows.map((row) => row.name);

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("DataTable boolean filter", () => {
  it("matches the rows that are yes or no - an empty value is no", () => {
    expect(names("true")).toEqual(["Adam", "Dana", "Fanny"]);
    expect(names("false")).toEqual(["Běla", "Cyril", "Emil", "Gustav"]);
  });

  it("filters nothing out for a value it does not offer", () => {
    expect(names("maybe")).toHaveLength(rows.length);
  });

  it("offers any, yes and no - and filters the rows of a clientSide table", async () => {
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

    const field = screen.getByRole("combobox", { name: "Filter Active" });
    expect(
      within(field)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Any", "Yes", "No"]);
    expect(field).toHaveValue("");

    await user.selectOptions(field, "No");
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { active: "false" }, page: 1 }),
    );
    expect(bodyNames()).toEqual(["Běla", "Cyril", "Emil", "Gustav"]);

    await user.selectOptions(field, "Any");
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {} }),
    );
    expect(bodyNames()).toHaveLength(rows.length);
  });

  it("names its choices in Czech", () => {
    render(
      <UIProvider locale={cs}>
        <DataTable columns={columns} data={rows} />
      </UIProvider>,
    );

    expect(
      within(screen.getByRole("combobox", { name: "Filtr Active" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Vše", "Ano", "Ne"]);
  });

  it("goes to a server as a text, and through the URL and back", () => {
    const query = setFilter(createDataTableQuery(), "active", "true");

    expect(toFilterParams(query.filters)).toEqual([["active", "true"]]);
    expect(toFilterParams(query.filters, { prefix: "filter" })).toEqual([
      ["filter[active]", "true"],
    ]);

    const search = writeQueryToSearch("", query);
    expect(new URLSearchParams(search).get("filters")).toBe(
      '{"active":"true"}',
    );
    expect(readQueryFromSearch(search).filters).toEqual({ active: "true" });
  });
});
