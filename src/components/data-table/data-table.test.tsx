import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { createDataTableQuery, type DataTableQuery } from "./query";
import useDataTableQuery from "./use-data-table-query";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
import type { Column } from "./types";
import type { RouterAdapter } from "../../providers/router";

interface Row {
  id: number;
  name: string;
  team: string;
}

const rows: Row[] = [
  { id: 1, name: "Cecilie", team: "B" },
  { id: 2, name: "Adam", team: "A" },
  { id: 3, name: "Běla", team: "A" },
  { id: 4, name: "<img src=x onerror=alert(1)>", team: "C" },
];

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

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("DataTable in client-side mode", () => {
  it("sorts, pages and reports the query", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2 }}
        onQueryChange={onQueryChange}
      />,
    );

    expect(screen.getByText("1–2 of 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: "asc", page: 1, sortBy: "name" }),
    );
    expect(bodyNames()).toEqual(["<img src=x onerror=alert(1)>", "Adam"]);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(bodyNames()).toEqual(["Běla", "Cecilie"]);
    expect(screen.getByText("3–4 of 4")).toBeInTheDocument();
  });

  it("does not filter and sort again for a new but equal columns array", async () => {
    const user = userEvent.setup();
    const getValue = vi.fn((row: Row) => row.name);
    const filterFn = vi.fn(() => true);
    const counted: Column<Row>[] = [
      { ...columns[0], getValue },
      { ...columns[1], filterFn },
    ];

    function Parent() {
      const [count, setCount] = useState(0);

      return (
        <>
          <button onClick={() => setCount(count + 1)} type="button">
            {`Re-render ${count}`}
          </button>
          <DataTable
            clientSide
            // New arrays of new objects in every render - with a `render`
            // that changes, which the React Compiler cannot keep
            columns={counted.map((column) => ({
              ...column,
              render: (row: Row) => `${row.id} (${count})`,
            }))}
            data={rows}
            defaultQuery={{ filters: { team: "A" }, sortBy: "name" }}
          />
        </>
      );
    }

    render(<Parent />);
    const sorted = getValue.mock.calls.length;
    const filtered = filterFn.mock.calls.length;
    expect(sorted).toBeGreaterThan(0);
    expect(filtered).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Re-render 0" }));

    expect(screen.getByRole("button", { name: "Re-render 1" })).toBeVisible();
    expect(getValue).toHaveBeenCalledTimes(sorted);
    expect(filterFn).toHaveBeenCalledTimes(filtered);
  });

  it("filters with a debounced text filter and highlights the match", async () => {
    const user = userEvent.setup();
    render(<DataTable clientSide columns={columns} data={rows} />);

    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "bel",
    );

    await waitFor(() => expect(bodyNames()).toEqual(["Běla"]));
    expect(screen.getByText("Běl", { selector: "b" })).toBeInTheDocument();
  });

  it("renders cell text as text, never as HTML", () => {
    const { container } = render(
      <DataTable clientSide columns={columns} data={rows} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
  });

  it("runs group actions with the selected rows", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        groupActions={[{ label: "Archive", onClick }]}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox", { name: /^Select row/ });
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    expect(screen.getByText("2 items selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledWith(
      [rows[1], rows[2]],
      expect.objectContaining({ allFiltered: false, count: 2 }),
    );
  });

  it("drops the selection of a page for good when leaving it", async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2 }}
        groupActions={[{ label: "Archive", onClick: vi.fn() }]}
      />,
    );

    await user.click(
      screen.getAllByRole("checkbox", { name: /^Select row/ })[0],
    );
    expect(screen.getByText("1 item selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Previous page" }));

    expect(screen.queryByText("1 item selected")).toBeNull();
    expect(
      screen.getAllByRole("checkbox", { name: /^Select row/ })[0],
    ).not.toBeChecked();
  });

  it("ends a selection of all filtered rows with the filters", async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2 }}
        filteredSelection
        groupActions={[{ label: "Archive", onClick: vi.fn() }]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 4 rows" }));
    expect(screen.getByText(/rows are selected/)).toBeInTheDocument();

    const filter = screen.getByRole("searchbox", { name: "Filter Name" });
    await user.type(filter, "a");
    await waitFor(() =>
      expect(screen.queryByText(/rows are selected/)).toBeNull(),
    );

    await user.clear(filter);
    await waitFor(() =>
      expect(screen.getByText("1–2 of 4")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/rows are selected/)).toBeNull();
  });

  it("shows all rows without pagination", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2 }}
        pagination={false}
      />,
    );

    expect(bodyNames()).toHaveLength(4);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("keeps the page when a filter is typed and erased again", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ page: 2, pageSize: 1 }}
        onQueryChange={onQueryChange}
      />,
    );

    const filter = screen.getByRole("searchbox", { name: "Filter Name" });
    await user.type(filter, "x");
    await user.clear(filter);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(onQueryChange).not.toHaveBeenCalled();
    expect(screen.getByText("2–2 of 4")).toBeInTheDocument();
  });

  it("expands rows loaded after the first render", () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={[]}
        expandedByDefault
        renderSubRow={(row) => `Detail of ${row.name}`}
      />,
    );

    rerender(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        expandedByDefault
        renderSubRow={(row) => `Detail of ${row.name}`}
      />,
    );

    expect(screen.getByText("Detail of Cecilie")).toBeInTheDocument();
    expect(screen.getByText("Detail of Adam")).toBeInTheDocument();
  });

  it("follows column defaults that change and stores only the user's changes", async () => {
    const user = userEvent.setup();
    const withTeam = (visible: boolean) =>
      columns.map((column) =>
        column.key === "team" ? { ...column, visible } : column,
      );

    const { rerender } = render(
      <DataTable
        clientSide
        columns={withTeam(true)}
        data={rows}
        tableId="people"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Team/ })).toBeVisible();
    expect(localStorage.getItem("table-state-people")).toBeNull();

    rerender(
      <DataTable
        clientSide
        columns={withTeam(false)}
        data={rows}
        tableId="people"
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /Team/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Name" }));

    expect(
      JSON.parse(localStorage.getItem("table-state-people") ?? "{}"),
    ).toMatchObject({ columnVisibility: { name: false } });
  });

  it("offsets sticky columns by the widths of the columns in front", () => {
    const widths: Record<string, number> = {
      actions: 80,
      name: 120,
      selection: 30,
      team: 60,
    };
    // Reports every observed cell once, measured by its column key
    class MeasuringObserver {
      private callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [{ target } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", MeasuringObserver);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const key = this.getAttribute("data-column-key") ?? "";
        return { width: widths[key] ?? 0 } as DOMRect;
      },
    );

    // Pinned in the other order than they are shown
    const pin = (columnVisibility: Record<string, boolean>) =>
      localStorage.setItem(
        "table-state-sticky",
        JSON.stringify({
          columnVisibility,
          pinnedColumns: { left: ["team", "name"], right: [] },
        }),
      );
    const table = (tableId: string) => (
      <DataTable
        actions={() => "Edit"}
        clientSide
        columns={[...columns, { key: "id", label: "Id" }]}
        data={rows}
        groupActions={[{ label: "Archive", onClick: vi.fn() }]}
        tableId={tableId}
      />
    );
    const left = (key: string) =>
      document.querySelector<HTMLElement>(`th[data-column-key="${key}"]`)?.style
        .left;

    try {
      pin({});
      const { rerender } = render(table("sticky"));

      expect(left("actions")).toBe("30px");
      expect(left("name")).toBe("110px");
      expect(left("team")).toBe("230px");

      // A hidden pinned column leaves no gap
      pin({ name: false });
      rerender(table("sticky-other"));
      rerender(table("sticky"));
      expect(left("team")).toBe("110px");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("gives an action every matching row after selecting all of them", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { team: "A" }, pageSize: 1 }}
        filteredSelection
        groupActions={[{ label: "Archive", onClick }]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 2 rows" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    // All rows are loaded - the action gets them all, not just the page
    expect(onClick).toHaveBeenCalledWith([rows[1], rows[2]], {
      allFiltered: true,
      count: 2,
      query: expect.objectContaining({
        filters: { team: "A" },
        page: 1,
        pageSize: 1,
      }),
      rows: [rows[1], rows[2]],
    });
  });

  it("takes a defaultQuery with undefined fields", () => {
    const pageSize: number | undefined = undefined;
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize }}
      />,
    );

    expect(screen.getByText("1–4 of 4")).toBeInTheDocument();
  });

  it("does not filter and sort the rows again on a selection click", async () => {
    const user = userEvent.setup();
    // Called by the filtering and sorting only - the cells show `render`
    const getValue = vi.fn((row: Row) => row.name);
    const filterFn = vi.fn((row: Row, value: string) => row.team === value);

    render(
      <DataTable
        clientSide
        columns={[
          { ...columns[0], getValue, render: (row) => row.name },
          { ...columns[1], filterFn },
        ]}
        data={rows}
        defaultQuery={{ filters: { team: "A" }, sortBy: "name" }}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );
    expect(getValue).toHaveBeenCalled();
    expect(filterFn).toHaveBeenCalled();
    getValue.mockClear();
    filterFn.mockClear();

    await user.click(screen.getByRole("checkbox", { name: "Select row Adam" }));

    expect(screen.getByText("1 item selected")).toBeInTheDocument();
    expect(getValue).not.toHaveBeenCalled();
    expect(filterFn).not.toHaveBeenCalled();
  });

  it("opens the search field for a search set from outside", () => {
    const table = (search: string) => (
      <DataTable
        columns={columns}
        data={rows}
        enableGlobalSearch
        query={createDataTableQuery({ search })}
      />
    );

    const { rerender } = render(table(""));
    expect(screen.getByRole("button", { name: "Open search" })).toBeVisible();

    rerender(table("adam"));
    expect(screen.getByRole("button", { name: "Close search" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("adam");
  });
});

describe("DataTable with server data", () => {
  it("pages by cursors when given pageInfo", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        onQueryChange={onQueryChange}
        pageInfo={{
          endCursor: "c2",
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "c1",
        }}
        total={4}
      />,
    );

    expect(screen.queryByRole("button", { name: "Last page" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: "c2", before: null, page: 2 }),
    );
  });

  it("goes back from a forward page even when the server says there is none", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const pageInfo = {
      endCursor: "c4",
      // What graphql-relay and others report when paging with first / after
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: "c3",
    };

    const { rerender } = render(
      <DataTable
        columns={columns}
        data={rows.slice(2)}
        onQueryChange={onQueryChange}
        pageInfo={pageInfo}
        query={createDataTableQuery({ after: "c2", page: 2, pageSize: 2 })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, before: "c3", page: 1 }),
    );

    // Paging backward - the page it came from is ahead
    rerender(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        onQueryChange={onQueryChange}
        pageInfo={{ ...pageInfo, endCursor: "c2", startCursor: "c1" }}
        query={createDataTableQuery({ before: "c3", page: 1, pageSize: 2 })}
      />,
    );
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    // Unavailable - the pressed button keeps the focus until it moves on
    const previous = screen.getByRole("button", { name: "Previous page" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveFocus();
  });

  it("leaves an empty cursor page for the first page", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={[]}
        onQueryChange={onQueryChange}
        pageInfo={{
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: true,
          startCursor: null,
        }}
        query={createDataTableQuery({ after: "c9", page: 5 })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, before: null, page: 1 }),
    );
  });

  it("pages by numbers with a pageInfo without cursors", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    // An offset API without a total, as the docs suggest
    const table = (page: number) => (
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        onQueryChange={onQueryChange}
        pageInfo={{ hasNextPage: true, hasPreviousPage: true }}
        query={createDataTableQuery({ page, pageSize: 2 })}
      />
    );
    const { rerender } = render(table(3));

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, before: null, page: 2 }),
    );
    rerender(table(2));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, before: null, page: 3 }),
    );
  });

  it("returns from a page past the end straight to the last page", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={[]}
        onQueryChange={onQueryChange}
        query={createDataTableQuery({ page: 9, pageSize: 2 })}
        total={4}
      />,
    );

    expect(screen.getByText("0–0 of 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});

describe("useDataTableQuery", () => {
  it("applies several changes made at once to the URL", () => {
    window.history.replaceState(null, "", "/people?tab=all");
    const { result } = renderHook(() =>
      useDataTableQuery({ syncWithUrl: true }),
    );

    act(() => {
      const [, setQuery] = result.current;
      setQuery((query) => ({ ...query, page: 2 }));
      setQuery((query) => ({ ...query, page: 1, search: "ann" }));
    });

    expect(window.location.search).toBe("?tab=all&search=ann");
    expect(result.current[0]).toMatchObject({ page: 1, search: "ann" });

    act(() => {
      const [, setQuery] = result.current;
      setQuery((query) => ({ ...query, page: 3 }));
      setQuery((query) => ({ ...query, page: 1 }));
    });

    expect(window.location.search).toBe("?tab=all&search=ann");
  });
});

describe("DataTable cell values", () => {
  interface Task {
    created: Date;
    done: boolean;
    due: Date;
    id: number;
    title: string;
  }

  const tasks: Task[] = [
    {
      created: new Date(2026, 8, 24, 14, 30),
      done: true,
      due: new Date(2026, 8, 24),
      id: 1,
      title: "Report",
    },
    {
      created: new Date(2026, 8, 25, 9, 5),
      done: false,
      due: new Date(2026, 8, 25),
      id: 2,
      title: "Review",
    },
  ];

  const taskColumns: Column<Task>[] = [
    { key: "title", label: "Title" },
    { key: "due", label: "Due" },
    { key: "created", label: "Created" },
    { key: "done", label: "Done" },
  ];

  it("shows dates and booleans by the locale", () => {
    render(
      <UIProvider locale={cs}>
        <DataTable columns={taskColumns} data={tasks} pagination={false} />
      </UIProvider>,
    );

    const row = screen.getByText("Report").closest("tr") as HTMLElement;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Report", "24.09.2026", "24.09.2026 14:30", "Ano"]);
  });

  it("finds dates and booleans by the text they show", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={taskColumns}
          data={tasks}
          defaultSearchOpen
          enableGlobalSearch
        />
      </UIProvider>,
    );

    await user.type(screen.getByRole("textbox", { name: "Hledat" }), "25.09");
    await waitFor(() => expect(bodyNames()).toEqual(["Review"]));

    await user.clear(screen.getByRole("textbox", { name: "Hledat" }));
    await user.type(screen.getByRole("textbox", { name: "Hledat" }), "ano");
    await waitFor(() => expect(bodyNames()).toEqual(["Report"]));
  });

  it("shows arrays without render as a list", () => {
    const consoleError = vi.spyOn(console, "error");
    render(
      <DataTable
        columns={[
          { key: "tags", label: "Tags" },
          { key: "owners", label: "Owners" },
          {
            key: "chips",
            label: "Chips",
            // A render may return several nodes
            render: (row) => row.tags.map((tag) => <i key={tag}>{tag}</i>),
          },
        ]}
        data={[{ id: 1, owners: [{ name: "Ann" }], tags: ["alpha", "beta"] }]}
        pagination={false}
      />,
    );

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "alpha, beta",
      '{"name":"Ann"}',
      "alphabeta",
    ]);
    expect(cells[2].querySelectorAll("i")).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("highlights a search in an array", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={[{ key: "tags", label: "Tags" }]}
        data={[
          { id: 1, tags: ["alpha", "beta"] },
          { id: 2, tags: ["gamma"] },
        ]}
        defaultSearchOpen
        enableGlobalSearch
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Search" }), "bet");

    await waitFor(() => expect(bodyNames()).toEqual(["alpha, beta"]));
    expect(screen.getByText("bet", { selector: "b" })).toBeInTheDocument();
  });

  it("sorts texts by the rules of the language", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={[{ key: "title", label: "Název", sortable: true }]}
          data={["hrad", "chata", "cena"].map((title, id) => ({ id, title }))}
        />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Název" }));
    // Czech sorts "ch" after "h"
    expect(bodyNames()).toEqual(["cena", "hrad", "chata"]);
  });
});

describe("DataTable filters", () => {
  it("offers Clear filters in the toolbar of a table without actions", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { team: "A" } }}
        onQueryChange={onQueryChange}
      />,
    );

    expect(bodyNames()).toEqual(["Adam", "Běla"]);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {} }),
    );
    expect(bodyNames()).toHaveLength(4);
    // Nothing left to clear - the pressed button keeps the focus
    const clear = screen.getByRole("button", { name: "Clear filters" });
    expect(clear).toHaveAttribute("aria-disabled", "true");
    expect(clear).toHaveFocus();
    await user.tab();
    expect(clear).toBeDisabled();
  });

  it("keeps the button in the actions column when there is one", () => {
    render(
      <DataTable
        actions={() => <button type="button">Edit</button>}
        columns={columns}
        data={rows}
      />,
    );

    const button = screen.getByRole("button", { name: "Clear filters" });
    // In the row of the filters, under the header of the actions
    expect(button.closest("thead")).not.toBeNull();
    expect(button.closest("tr")?.firstElementChild).toContainElement(button);
  });
});

describe("DataTable filtering the user cannot see", () => {
  it("ignores a search without the search field client-side", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ search: "adam" }}
      />,
    );

    expect(bodyNames()).toHaveLength(4);
    expect(screen.queryByText("Adam", { selector: "b" })).toBeNull();
  });

  it("clears a search without its field with Clear filters", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    // The server filters by it - the table cannot ignore it there
    render(
      <DataTable
        columns={columns}
        data={rows.slice(1, 2)}
        onQueryChange={onQueryChange}
        query={createDataTableQuery({ search: "adam" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {}, search: "" }),
    );
  });

  it("ignores a filter of no filterable column client-side", () => {
    // An old bookmark - `?filters={"id":"1"}`, the Name field is empty
    render(
      <DataTable
        clientSide
        columns={[columns[0]]}
        data={rows}
        defaultQuery={{ filters: { id: "1", team: "A" } }}
      />,
    );

    expect(bodyNames()).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Clear filters" }),
    ).toBeDisabled();
  });

  it("keeps a filter of no filterable column for a server, clearable", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        columns={[{ key: "name", label: "Name" }]}
        data={rows.slice(0, 1)}
        onQueryChange={onQueryChange}
        query={createDataTableQuery({ filters: { status: "archived" } })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: {} }),
    );
  });

  it("drops the filter of a column the user hides", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { name: "a", team: "A" } }}
        onQueryChange={onQueryChange}
      />,
    );
    expect(bodyNames()).toEqual(["Adam", "Běla"]);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Team" }));

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { name: "a" } }),
    );
    expect(bodyNames()).toEqual([
      "Adam",
      "Běla",
      "<img src=x onerror=alert(1)>",
    ]);
  });

  it.each([
    ["without", undefined],
    ["with", () => "Edit"],
  ])(
    "offers Clear filters for the filter of a hidden column %s actions",
    async (_, actions) => {
      const user = userEvent.setup();
      const bodyRows = () =>
        within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

      // No filter field is visible - the filter row is not there
      render(
        <DataTable
          actions={actions}
          clientSide
          columns={[
            { key: "name", label: "Name" },
            { ...columns[1], visible: false },
          ]}
          data={rows}
          defaultQuery={{ filters: { team: "A" } }}
        />,
      );
      expect(bodyRows()).toHaveLength(2);

      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(bodyRows()).toHaveLength(4);
    },
  );
});

describe("DataTable column settings", () => {
  const headers = () =>
    within(screen.getAllByRole("rowgroup")[0])
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

  it("are operated from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DataTable columns={columns} data={rows} />
        <button type="button">After the table</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Columns" });
    trigger.focus();
    await user.keyboard("{Enter}");

    // Tab moves into the panel - "Reset columns" is disabled yet
    await user.tab();
    const handle = screen.getByRole("button", {
      name: "Move Name (arrow keys)",
    });
    expect(handle).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(headers()).toEqual(["Team", "Name"]);
    await waitFor(() => expect(handle).toHaveFocus());

    await user.click(screen.getByRole("switch", { name: "Team" }));
    expect(headers()).toEqual(["Name"]);

    // Escape closes the panel and gives the focus back to its trigger
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("switch", { name: "Team" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("keep the focus on Reset columns once there is nothing to reset", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} />);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Team" }));
    const reset = screen.getByRole("button", { name: "Reset columns" });
    reset.focus();
    await user.keyboard("{Enter}");

    // The panel stays open, the focus on the button - unavailable now
    expect(headers()).toEqual(["Name", "Team"]);
    expect(reset).toHaveFocus();
    expect(reset).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("switch", { name: "Team" })).toBeChecked();
  });

  it("leaves the panel with Tab for what follows the trigger", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} />);

    screen.getByRole("button", { name: "Columns" }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("switch", { name: "Team" }).focus();
    await user.tab();

    expect(screen.queryByRole("switch", { name: "Team" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Toggle full screen" }),
    ).toHaveFocus();
  });
});

describe("DataTable group actions", () => {
  it("run one at a time and keep the selection when they fail", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail!: (error: Error) => void;
    const archive = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );

    render(
      <DataTable
        autoResetSelectedRows
        columns={columns}
        data={rows}
        groupActions={[
          { label: "Archive", onClick: archive },
          { label: "Export", onClick: () => {} },
        ]}
      />,
    );

    await user.click(
      screen.getAllByRole("checkbox", { name: /^Select row/ })[0],
    );
    const button = screen.getByRole("button", { name: "Archive" });
    await user.click(button);
    await user.click(button);

    expect(archive).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();

    await act(async () => fail(new Error("Server down")));

    expect(button).not.toHaveAttribute("aria-busy");
    expect(
      screen.getAllByRole("checkbox", { name: /^Select row/ })[0],
    ).toBeChecked();
  });

  it("tell actions with the same label apart", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const first = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const second = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DataTable
        columns={columns}
        data={rows}
        groupActions={[
          { label: "Export", onClick: first },
          { label: "Export", onClick: second },
        ]}
      />,
    );

    // No duplicate key warning from React
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();

    await user.click(
      screen.getAllByRole("checkbox", { name: /^Select row/ })[0],
    );
    const [firstButton, secondButton] = screen.getAllByRole("button", {
      name: "Export",
    });
    await user.click(firstButton);

    expect(first).toHaveBeenCalledTimes(1);
    expect(firstButton).toHaveAttribute("aria-busy", "true");
    expect(secondButton).not.toHaveAttribute("aria-busy");
    expect(secondButton).toBeDisabled();

    await act(async () => finish());
    await user.click(secondButton);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("leave the selection to the checkboxes, not to aria-selected", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={rows}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );

    await user.click(
      screen.getAllByRole("checkbox", { name: /^Select row/ })[0],
    );

    for (const row of within(screen.getAllByRole("rowgroup")[1]).getAllByRole(
      "row",
    )) {
      expect(row).not.toHaveAttribute("aria-selected");
    }
  });

  it("words the filtered selection by the count", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={columns}
          data={rows}
          defaultQuery={{ pageSize: 2 }}
          filteredSelection
          groupActions={[{ label: "Smazat", onClick: () => {} }]}
        />
      </UIProvider>,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Vybrat všechny řádky" }),
    );

    expect(
      screen.getByText(/Na této stránce jsou vybrány/).parentElement,
    ).toHaveTextContent("Na této stránce jsou vybrány 2 řádky.");
    expect(
      screen.getByRole("button", { name: "Vybrat všechny 4 řádky" }),
    ).toBeInTheDocument();
  });
});

describe("DataTable cursor paging", () => {
  const firstPage = {
    endCursor: "end1",
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: "start1",
  };

  it("waits for the pageInfo of the requested page before paging on", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const props = { columns, onQueryChange, total: 6 };

    const { rerender } = render(
      <DataTable {...props} data={rows.slice(0, 2)} pageInfo={firstPage} />,
    );

    const next = screen.getByRole("button", { name: "Next page" });
    await user.click(next);
    // The next page is not there yet - its pageInfo still is the old one
    await user.click(next);

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: "end1", page: 2 }),
    );
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveFocus();

    rerender(
      <DataTable
        {...props}
        data={rows.slice(2)}
        pageInfo={{
          ...firstPage,
          endCursor: "end2",
          hasPreviousPage: true,
          startCursor: "start2",
        }}
      />,
    );

    expect(next).not.toHaveAttribute("aria-disabled");
    await user.click(next);
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: "end2", page: 3 }),
    );
  });

  it("does not page while loading and lets a failed load be retried", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const props = {
      columns,
      data: rows.slice(0, 2),
      onQueryChange,
      pageInfo: firstPage,
    };

    const { rerender } = render(<DataTable {...props} loading />);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onQueryChange).not.toHaveBeenCalled();

    rerender(<DataTable {...props} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onQueryChange).toHaveBeenCalledTimes(1);

    // The load fails - the same pageInfo stays, but the move can be repeated
    rerender(<DataTable {...props} loading />);
    rerender(<DataTable {...props} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onQueryChange).toHaveBeenCalledTimes(2);
  });
});

describe("DataTable with an asynchronous router", () => {
  function Table({ toolbar }: { toolbar: string }) {
    const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });
    return (
      <DataTable
        columns={columns}
        data={rows}
        onQueryChange={setQuery}
        query={query}
        toolbar={toolbar}
      />
    );
  }

  function App({ navigate }: { navigate: (href: string) => void }) {
    const [search, setSearch] = useState("");
    const [pending, setPending] = useState<string[]>([]);

    return (
      <UIProvider
        router={{
          navigate: (href) => {
            navigate(href);
            // The URL changes later, like in a router with loaders
            setPending((current) => [...current, href]);
          },
          pathname: "/people",
          search,
        }}
      >
        <button
          onClick={() => {
            const href = pending[pending.length - 1];
            setSearch(href.slice(href.indexOf("?")));
            setPending([]);
          }}
          type="button"
        >
          Finish navigation
        </button>
        {/* Re-renders the table with the old URL meanwhile */}
        <Table toolbar={`${pending.length} pending`} />
      </UIProvider>
    );
  }

  it("builds a change on the pending one while the URL catches up", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App navigate={navigate} />);

    // Each navigation re-renders the app with the old URL meanwhile
    await user.click(screen.getByRole("button", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(navigate).toHaveBeenLastCalledWith("/people?sortBy=name&order=desc");

    await user.click(screen.getByRole("button", { name: "Finish navigation" }));
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(navigate).toHaveBeenLastCalledWith("/people");
  });
});

describe("DataTable paging with an asynchronous router", () => {
  function Table() {
    const [query, setQuery] = useDataTableQuery({
      defaults: { pageSize: 1 },
      syncWithUrl: true,
    });
    return (
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        onQueryChange={setQuery}
        query={query}
      />
    );
  }

  function App({
    initialSearch = "",
    navigate,
  }: {
    initialSearch?: string;
    navigate: (href: string) => void;
  }) {
    const [search, setSearch] = useState(initialSearch);
    const [pending, setPending] = useState<string[]>([]);

    return (
      <UIProvider
        router={{
          navigate: (href) => {
            navigate(href);
            // The URL changes later, like in a router with transitions
            setPending((current) => [...current, href]);
          },
          pathname: "/people",
          search,
        }}
      >
        <button
          onClick={() => {
            const href = pending[pending.length - 1];
            setSearch(href.includes("?") ? href.slice(href.indexOf("?")) : "");
            setPending([]);
          }}
          type="button"
        >
          Finish navigation
        </button>
        <Table />
      </UIProvider>
    );
  }

  it("pages on from the pending page", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App navigate={navigate} />);

    const next = screen.getByRole("button", { name: "Next page" });
    await user.click(next);
    await user.click(next);
    expect(navigate).toHaveBeenLastCalledWith("/people?page=3");

    await user.click(screen.getByRole("button", { name: "Finish navigation" }));
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(navigate).toHaveBeenLastCalledWith("/people?page=2");
  });

  it("pages the rows of a pending filter from their first page", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const filters = new URLSearchParams({
      filters: JSON.stringify({ name: "e" }),
    });
    render(<App initialSearch="?page=3" navigate={navigate} />);

    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "e",
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenLastCalledWith(`/people?${filters}`),
    );

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(navigate).toHaveBeenLastCalledWith(`/people?${filters}&page=2`);
  });

  it("does not page past the last page", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App initialSearch="?page=3" navigate={navigate} />);

    const next = screen.getByRole("button", { name: "Next page" });
    await user.click(next);
    await user.click(next);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith("/people?page=4");
  });
});

describe("DataTable with a router that applies each navigation late", () => {
  const searchOf = (href: string) =>
    href.includes("?") ? href.slice(href.indexOf("?")) : "";

  function App({
    children,
    navigate,
  }: {
    children: React.ReactNode;
    navigate: (href: string) => void;
  }) {
    const [search, setSearch] = useState("");
    const [pending, setPending] = useState<string[]>([]);

    return (
      <UIProvider
        router={{
          navigate: (href) => {
            navigate(href);
            setPending((current) => [...current, href]);
          },
          pathname: "/people",
          search,
        }}
      >
        <button
          onClick={() => {
            const [href, ...later] = pending;
            setSearch(searchOf(href));
            setPending(later);
          }}
          type="button"
        >
          Apply the oldest navigation
        </button>
        {children}
      </UIProvider>
    );
  }

  function UrlTable() {
    const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });
    return (
      <DataTable
        columns={columns}
        data={rows}
        onQueryChange={setQuery}
        query={query}
      />
    );
  }

  it("keeps the typed text when an older filter arrives late", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const filterUrl = (name: string) =>
      `/people?${new URLSearchParams({ filters: JSON.stringify({ name }) })}`;

    render(
      <App navigate={navigate}>
        <UrlTable />
      </App>,
    );
    const filter = screen.getByRole("searchbox", { name: "Filter Name" });
    const applyOldest = screen.getByRole("button", {
      name: "Apply the oldest navigation",
    });

    await user.type(filter, "ab");
    await waitFor(() =>
      expect(navigate).toHaveBeenLastCalledWith(filterUrl("ab")),
    );
    await user.type(filter, "c");
    await waitFor(() =>
      expect(navigate).toHaveBeenLastCalledWith(filterUrl("abc")),
    );

    // The router gets to the first change only now
    await user.click(applyOldest);
    expect(filter).toHaveValue("abc");

    await user.type(filter, "d");
    await user.click(applyOldest);
    await waitFor(() =>
      expect(navigate).toHaveBeenLastCalledWith(filterUrl("abcd")),
    );
    expect(filter).toHaveValue("abcd");
  });

  it("composes the changes of two tables before the URL catches up", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();

    function Pages() {
      const [a, setA] = useDataTableQuery({
        syncWithUrl: true,
        urlPrefix: "a_",
      });
      const [b, setB] = useDataTableQuery({
        syncWithUrl: true,
        urlPrefix: "b_",
      });
      const next = (query: DataTableQuery) => ({
        ...query,
        page: query.page + 1,
      });

      return (
        <>
          <button onClick={() => setA(next)} type="button">
            Next A
          </button>
          <button onClick={() => setB(next)} type="button">
            Next B
          </button>
          <output>{`${a.page} ${b.page}`}</output>
        </>
      );
    }

    render(
      <App navigate={navigate}>
        <Pages />
      </App>,
    );

    await user.click(screen.getByRole("button", { name: "Next A" }));
    await user.click(screen.getByRole("button", { name: "Next B" }));
    expect(navigate).toHaveBeenLastCalledWith("/people?a_page=2&b_page=2");

    await user.click(
      screen.getByRole("button", { name: "Apply the oldest navigation" }),
    );
    await user.click(screen.getByRole("button", { name: "Next B" }));
    expect(navigate).toHaveBeenLastCalledWith("/people?a_page=2&b_page=3");

    await user.click(
      screen.getByRole("button", { name: "Apply the oldest navigation" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Apply the oldest navigation" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 3");
  });

  it("keeps a change back to the shown URL while the router is behind", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();

    function Pages() {
      const [a, setA] = useDataTableQuery({
        syncWithUrl: true,
        urlPrefix: "a_",
      });
      const [b, setB] = useDataTableQuery({
        syncWithUrl: true,
        urlPrefix: "b_",
      });

      return (
        <>
          <button
            onClick={() => setA((query) => ({ ...query, page: 2 }))}
            type="button"
          >
            A to page 2
          </button>
          <button
            onClick={() => setA((query) => ({ ...query, page: 1 }))}
            type="button"
          >
            A to page 1
          </button>
          <button
            onClick={() =>
              setB((query) => ({ ...query, page: query.page + 1 }))
            }
            type="button"
          >
            Next B
          </button>
          <output>{`${a.page} ${b.page}`}</output>
        </>
      );
    }

    render(
      <App navigate={navigate}>
        <Pages />
      </App>,
    );

    // A goes to page 2 and back before the router shows either change
    await user.click(screen.getByRole("button", { name: "A to page 2" }));
    await user.click(screen.getByRole("button", { name: "A to page 1" }));
    expect(navigate).toHaveBeenLastCalledWith("/people");

    // The router shows the first of them, then B moves on - on top of the
    // way back of A, not of the page 2 the router shows meanwhile
    await user.click(
      screen.getByRole("button", { name: "Apply the oldest navigation" }),
    );
    await user.click(screen.getByRole("button", { name: "Next B" }));
    expect(navigate).toHaveBeenLastCalledWith("/people?b_page=2");

    await user.click(
      screen.getByRole("button", { name: "Apply the oldest navigation" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Apply the oldest navigation" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 2");
  });
});

describe("useDataTableQuery URL", () => {
  it("keeps the hash of the page", () => {
    window.history.replaceState(null, "", "/people?tab=all#details");
    const { result } = renderHook(() =>
      useDataTableQuery({ syncWithUrl: true }),
    );

    act(() => result.current[1]((query) => ({ ...query, page: 2 })));

    expect(window.location.search).toBe("?tab=all&page=2");
    expect(window.location.hash).toBe("#details");
  });

  it("takes only the offered page sizes from the URL", () => {
    window.history.replaceState(null, "", "/people?pageSize=100000");
    const { result } = renderHook(() =>
      useDataTableQuery({ pageSizeOptions: [10, 25], syncWithUrl: true }),
    );

    expect(result.current[0].pageSize).toBe(20);
  });

  it("warns about a page size the URL cannot keep", () => {
    window.history.replaceState(null, "", "/people");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useDataTableQuery({ pageSizeOptions: [10, 25], syncWithUrl: true }),
    );

    act(() => result.current[1]((query) => ({ ...query, pageSize: 25 })));
    expect(warn).not.toHaveBeenCalled();

    act(() => result.current[1]((query) => ({ ...query, pageSize: 200 })));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("200"));

    // Once
    act(() => result.current[1]((query) => ({ ...query, page: 2 })));
    act(() => result.current[1]((query) => ({ ...query, pageSize: 200 })));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  const withRouter =
    (router: Partial<RouterAdapter>) =>
    ({ children }: { children: React.ReactNode }) => (
      <UIProvider router={router}>{children}</UIProvider>
    );

  it("does not put the path of a hash router into its hash again", () => {
    // A hash router at its root - the page itself is at `/` too
    window.history.replaceState(null, "", "/#/?page=3");
    const navigate = vi.fn();
    const { result } = renderHook(
      () => useDataTableQuery({ syncWithUrl: true }),
      { wrapper: withRouter({ navigate, pathname: "/", search: "?page=3" }) },
    );

    act(() => result.current[1]((query) => ({ ...query, page: 4 })));

    expect(navigate).toHaveBeenLastCalledWith("/?page=4", { replace: false });
  });

  it("keeps the hash of the page under a basename", () => {
    window.history.replaceState(null, "", "/app/people?tab=all#details");
    const navigate = vi.fn();
    const { result } = renderHook(
      () => useDataTableQuery({ syncWithUrl: true }),
      {
        wrapper: withRouter({
          navigate,
          pathname: "/people",
          search: "?tab=all",
        }),
      },
    );

    act(() => result.current[1]((query) => ({ ...query, page: 2 })));

    expect(navigate).toHaveBeenLastCalledWith(
      "/people?tab=all&page=2#details",
      { replace: false },
    );
  });

  it("lets two tables of one page change the URL at once", () => {
    window.history.replaceState(null, "", "/people?tab=all");
    const { result } = renderHook(
      () =>
        [
          useDataTableQuery({ syncWithUrl: true, urlPrefix: "a_" }),
          useDataTableQuery({ syncWithUrl: true, urlPrefix: "b_" }),
        ] as const,
    );

    act(() => {
      result.current[0][1]((query) => ({ ...query, page: 2 }));
      result.current[1][1]((query) => ({ ...query, page: 3 }));
    });

    expect(window.location.search).toBe("?tab=all&a_page=2&b_page=3");
    expect(result.current[0][0].page).toBe(2);
    expect(result.current[1][0].page).toBe(3);
  });
});

describe("DataTable selection", () => {
  const archive = { label: "Archive" };
  const dana: Row = { id: 5, name: "Dana", team: "B" };

  it("gives the actions the rows as they are after a refetch", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const groupActions = [{ ...archive, onClick }];

    const { rerender } = render(
      <DataTable columns={columns} data={rows} groupActions={groupActions} />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select row Adam" }));

    const refetched = rows.map((row) => ({ ...row, name: `${row.name}!` }));
    rerender(
      <DataTable
        columns={columns}
        data={refetched}
        groupActions={groupActions}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Select row Adam!" }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledWith([refetched[1]], expect.anything());
  });

  it("keeps the selected rows that are still there after a refetch", async () => {
    const user = userEvent.setup();
    const groupActions = [{ ...archive, onClick: vi.fn() }];
    const table = (data: Row[], loading = false) => (
      <DataTable
        columns={columns}
        data={data}
        groupActions={groupActions}
        loading={loading}
      />
    );

    const { rerender } = render(table(rows));
    await user.click(
      screen.getByRole("checkbox", { name: "Select row Cecilie" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Select row Adam" }));

    // A poll: Adam was deleted meanwhile, Dana is new
    const polled = [...rows.filter((row) => row.id !== 2), dana];
    rerender(table(polled));

    expect(
      screen.getByRole("checkbox", { name: "Select row Cecilie" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select row Dana" }),
    ).not.toBeChecked();
    expect(screen.getByText("1 item selected")).toBeInTheDocument();

    // A refetch showing no rows while it loads
    rerender(table([], true));
    rerender(table(polled));
    expect(
      screen.getByRole("checkbox", { name: "Select row Cecilie" }),
    ).toBeChecked();
  });

  it("keeps rows selected while an action ran when resetting after it", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    render(
      <DataTable
        autoResetSelectedRows
        columns={columns}
        data={rows}
        groupActions={[{ ...archive, onClick }]}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Select row Cecilie" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(screen.getByRole("checkbox", { name: "Select row Adam" }));
    await act(async () => finish());

    expect(
      screen.getByRole("checkbox", { name: "Select row Cecilie" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select row Adam" }),
    ).toBeChecked();
  });

  it("offers all filtered rows only once the whole page is selected", async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2 }}
        filteredSelection
        groupActions={[{ ...archive, onClick: () => {} }]}
      />,
    );

    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });
    await user.click(
      screen.getByRole("checkbox", { name: "Select row Cecilie" }),
    );

    expect(
      screen.getByText(/row on this page is selected/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select all 4 rows" }),
    ).toBeNull();
    expect(selectAll).toBePartiallyChecked();

    await user.click(screen.getByRole("checkbox", { name: "Select row Adam" }));
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();
    expect(
      screen.getByRole("button", { name: "Select all 4 rows" }),
    ).toBeInTheDocument();
  });
});

describe("DataTable header names", () => {
  it("names the headers by their labels alone", () => {
    render(
      <DataTable
        columns={[{ ...columns[0], labelInfo: "Full legal name" }, columns[1]]}
        data={rows}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
        renderSubRow={(row) => row.name}
      />,
    );

    const name = screen.getByRole("columnheader", { name: "Name" });
    expect(name).toHaveAttribute("aria-sort", "none");
    expect(name).toHaveAccessibleDescription("Full legal name");
    expect(
      screen.getByRole("columnheader", { name: "Team" }),
    ).not.toHaveAttribute("aria-sort");
    expect(
      screen.getByRole("columnheader", { name: "Expand row" }),
    ).toBeInTheDocument();
    // The filters are no column headers
    expect(
      screen.getByRole("searchbox", { name: "Filter Name" }).closest("th"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand row Cecilie" }),
    ).toBeInTheDocument();
  });
});

describe("DataTable global search", () => {
  it("gives the focus back to the search button on Escape", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} enableGlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Open search" }));
    const input = screen.getByRole("textbox", { name: "Search" });
    await waitFor(() => expect(input).toHaveFocus());

    await user.keyboard("x{Escape}");

    const toggle = screen.getByRole("button", { name: "Open search" });
    expect(toggle).toHaveFocus();
    // The closed field is out of the way of Tab and screen readers
    expect(input.closest("[inert]")).not.toBeNull();

    await user.keyboard("y");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("");
  });
});

describe("DataTable loading", () => {
  it("covers only the table while the first page loads", () => {
    render(<DataTable columns={columns} data={[]} loading toolbar="Tools" />);

    // The toolbar above and the pagination below stay usable - the
    // overlay is positioned in the table, not in the whole component
    const overlay = screen.getByRole("status").closest("td");
    let container = overlay?.parentElement;
    while (
      container &&
      !/\b(relative|absolute|fixed|sticky)\b/.test(container.className)
    ) {
      container = container.parentElement;
    }

    expect(container?.tagName).toBe("TABLE");
    expect(container).not.toContainElement(screen.getByText("Tools"));
  });
});

describe("DataTable full screen", () => {
  it("leaves full screen on Escape and keeps Tab inside meanwhile", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before the table</button>
        <DataTable columns={columns} data={rows} enableGlobalSearch />
        <button type="button">After the table</button>
      </>,
    );
    const region = screen.getByRole("region", { name: "Data table" });
    const toggle = screen.getByRole("button", { name: "Toggle full screen" });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    // The page under the table is out of reach
    for (let step = 0; step < 20; step++) {
      await user.tab();
      expect(region).toContainElement(document.activeElement as HTMLElement);
    }

    // Escape closes what is open in the table first
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("switch", { name: "Team" })).toBeNull();
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Open search" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});

describe("DataTable scrolling", () => {
  it("shows another page, sorting or filter from the first rows", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 2 }}
      />,
    );
    const scroller = container.querySelector<HTMLElement>(
      "[data-table-scroll]",
    ) as HTMLElement;
    const scrollDown = () => {
      Object.defineProperty(scroller, "scrollTop", {
        configurable: true,
        value: 400,
        writable: true,
      });
      fireEvent.scroll(scroller);
    };

    scrollDown();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(scroller.scrollTop).toBe(0);

    scrollDown();
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(scroller.scrollTop).toBe(0);

    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "a",
    );
    await waitFor(() => expect(bodyNames()).toHaveLength(2));
    scrollDown();
    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "d",
    );
    await waitFor(() => expect(bodyNames()).toEqual(["Adam"]));
    expect(scroller.scrollTop).toBe(0);

    // Not for what shows the same rows - the column settings
    scrollDown();
    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(scroller.scrollTop).toBe(400);
  });
});

describe("DataTable focus scrolling", () => {
  it("keeps the rows where they are when the focus moves into the toolbar or the header", () => {
    const { container } = render(
      <DataTable
        actions={() => <button type="button">Edit</button>}
        columns={columns}
        data={rows}
      />,
    );
    const scroller = container.querySelector<HTMLElement>(
      "[data-table-scroll]",
    ) as HTMLElement;
    let scrollTop = 400;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    act(() => {
      fireEvent.scroll(scroller);
    });

    // The browser scrolls what sticks to where it would be without sticking
    // - up, out from under the scroll padding meant for the rows
    for (const name of ["Columns", "Name", "Filter Name"]) {
      scrollTop = 120;
      act(() =>
        screen
          .getAllByRole(name === "Filter Name" ? "searchbox" : "button", {
            name,
          })[0]
          .focus(),
      );
      expect(scrollTop).toBe(400);
    }

    // A control of the rows is scrolled out from under the header as it is
    scrollTop = 120;
    act(() => screen.getAllByRole("button", { name: "Edit" })[0].focus());
    expect(scrollTop).toBe(120);
  });
});

describe("DataTable without ResizeObserver", () => {
  it("renders - as in a test environment without it", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    try {
      render(
        <DataTable
          clientSide
          columns={[{ ...columns[0], pinned: "left" }, columns[1]]}
          data={rows}
          virtualized
        />,
      );

      expect(bodyNames()).toHaveLength(4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("DataTable column settings storage", () => {
  it("works when the site data is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Reading `localStorage` throws then - also `typeof localStorage`
    const storage = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });

    try {
      render(<DataTable columns={columns} data={rows} tableId="people" />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("switch", { name: "Team" }));

      expect(screen.queryByRole("columnheader", { name: /Team/ })).toBeNull();
    } finally {
      storage.mockRestore();
    }
  });
});
