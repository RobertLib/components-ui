import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Activity, StrictMode } from "react";
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
  it("acknowledges an accepted clear before a later external search", async () => {
    const onQueryChange = vi.fn();
    const initialQuery = createDataTableQuery();
    const content = (query: DataTableQuery) => (
      <DataTable
        columns={columns}
        data={data}
        defaultSearchOpen
        enableGlobalSearch
        onQueryChange={onQueryChange}
        query={query}
      />
    );
    const { rerender } = render(content(initialQuery));
    const field = screen.getByRole("textbox", { name: "Search" });
    fireEvent.change(field, { target: { value: "Adam" } });
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledTimes(1));
    const firstQuery = onQueryChange.mock.calls[0][0] as DataTableQuery;
    fireEvent.keyDown(field, { key: "Escape" });
    const clearedQuery = onQueryChange.mock.lastCall![0] as DataTableQuery;

    rerender(content(clearedQuery));
    // Once the submitted clear is confirmed, an external search wins.
    rerender(content(firstQuery));
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      createDataTableQuery({ search: "Adam", sortBy: "name" }),
    );
  });

  it.each([false, true])(
    "keeps a cleared search when an earlier query arrives after a loading render, inline=%s",
    async (inline) => {
      const onQueryChange = vi.fn();
      const initialQuery = createDataTableQuery();
      const content = (query = initialQuery, loading = false) => (
        <DataTable
          columns={columns}
          data={data}
          defaultSearchOpen
          enableGlobalSearch
          loading={loading}
          onQueryChange={onQueryChange}
          query={inline ? { ...query } : query}
        />
      );
      const { rerender } = render(content());
      const field = screen.getByRole("textbox", { name: "Search" });

      fireEvent.change(field, { target: { value: "Adam" } });
      await waitFor(() => expect(onQueryChange).toHaveBeenCalledTimes(1));
      const firstQuery = onQueryChange.mock.calls[0][0] as DataTableQuery;
      fireEvent.keyDown(field, { key: "Escape" });
      expect(onQueryChange).toHaveBeenLastCalledWith(initialQuery);

      // Starting a fetch does not confirm the pending clear operation.
      rerender(content(initialQuery, true));
      rerender(content(firstQuery));
      fireEvent.click(screen.getByRole("button", { name: "Name" }));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        createDataTableQuery({ sortBy: "name" }),
      );
    },
  );

  it.each(["filter", "search"] as const)(
    "discards a pending %s after external query changes while hidden",
    async (change) => {
      const onQueryChange = vi.fn();
      const initialQuery = createDataTableQuery();
      const externalQuery = createDataTableQuery({
        filters: { name: "external" },
        search: "external",
      });
      const content = (mode: "hidden" | "visible", query = initialQuery) => (
        <StrictMode>
          <Activity mode={mode}>
            <DataTable
              columns={columns}
              data={data}
              defaultSearchOpen
              enableGlobalSearch
              onQueryChange={onQueryChange}
              query={query}
            />
          </Activity>
        </StrictMode>
      );
      const field = () =>
        change === "filter"
          ? screen.getByRole("searchbox", { name: "Filter Name" })
          : screen.getByRole("textbox", { name: "Search" });
      const { rerender } = render(content("visible"));

      fireEvent.change(field(), { target: { value: "pending" } });
      await waitFor(() => expect(onQueryChange).toHaveBeenCalledTimes(1));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining(
          change === "filter"
            ? { filters: { name: "pending" } }
            : { search: "pending" },
        ),
      );

      await act(async () => rerender(content("hidden")));
      await act(async () => rerender(content("hidden", externalQuery)));
      await act(async () => rerender(content("hidden")));
      rerender(content("visible"));
      expect(field()).toHaveValue("");

      fireEvent.click(screen.getByRole("button", { name: "Name" }));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        createDataTableQuery({ sortBy: "name" }),
      );
    },
  );

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
