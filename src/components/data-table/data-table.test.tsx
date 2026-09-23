import {
  act,
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
import { createDataTableQuery } from "./query";
import useDataTableQuery from "./use-data-table-query";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
import type { Column } from "./types";

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
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
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
    render(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        onQueryChange={onQueryChange}
        pageInfo={{ hasNextPage: true, hasPreviousPage: true }}
        query={createDataTableQuery({ page: 3, pageSize: 2 })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, before: null, page: 2 }),
    );
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, before: null, page: 4 }),
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
    expect(
      screen.getByRole("button", { name: "Clear filters" }),
    ).toBeDisabled();
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
});

describe("DataTable selection", () => {
  const archive = { label: "Archive" };

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
