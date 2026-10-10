import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { createDataTableQuery, type DataTableQuery } from "./query";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
  team: string;
}

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  {
    filter: "select",
    filterSelectOptions: [
      { label: "A", value: "A" },
      { label: "B", value: "B" },
    ],
    key: "team",
    label: "Team",
  },
];
const data: Row[] = [{ id: 1, name: "Adam", team: "A" }];

describe("DataTable debounced queries", () => {
  it.each(["filter", "search"] as const)(
    "commits a pending %s through the current handler and query",
    async (change) => {
      const previousHandler = vi.fn();
      const currentHandler = vi.fn();
      const initialQuery = createDataTableQuery({
        filters: { team: "A" },
        page: 3,
      });
      const currentQuery = createDataTableQuery({
        filters: { team: "B" },
        order: "desc",
        page: 2,
        pageSize: 10,
        sortBy: "name",
      });
      const content = (
        query: DataTableQuery,
        onQueryChange: (query: DataTableQuery) => void,
      ) => (
        <DataTable
          columns={columns}
          data={data}
          defaultSearchOpen
          enableGlobalSearch
          onQueryChange={onQueryChange}
          query={query}
          total={40}
        />
      );
      const { rerender } = render(content(initialQuery, previousHandler));

      fireEvent.change(
        change === "filter"
          ? screen.getByRole("searchbox", { name: "Filter Name" })
          : screen.getByRole("textbox", { name: "Search" }),
        { target: { value: "ada" } },
      );
      rerender(content(currentQuery, currentHandler));

      await waitFor(() => expect(currentHandler).toHaveBeenCalledTimes(1));
      expect(previousHandler).not.toHaveBeenCalled();
      expect(currentHandler).toHaveBeenCalledWith(
        createDataTableQuery({
          ...currentQuery,
          filters:
            change === "filter"
              ? { name: "ada", team: "B" }
              : currentQuery.filters,
          page: 1,
          search: change === "search" ? "ada" : "",
        }),
      );
    },
  );
});
