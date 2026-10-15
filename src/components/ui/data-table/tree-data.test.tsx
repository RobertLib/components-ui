import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataTable, { type DataTableProps } from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import type { Column, RowId } from "./types";

interface Account {
  balance: number;
  children?: Account[];
  code: string;
  id: string;
  name: string;
}

const account = (
  code: string,
  name: string,
  balance: number,
  children?: Account[],
): Account => ({ balance, children, code, id: code, name });

// A chart of accounts - the parents hold the totals of their branches
const accounts: Account[] = [
  account("1", "Assets", 600, [
    account("11", "Cash", 100),
    account("12", "Bank accounts", 500, [
      account("121", "Current account", 300),
      account("122", "Savings account", 200),
    ]),
  ]),
  account("2", "Liabilities", 250, [account("21", "Loans", 250)]),
  account("3", "Equity", 350),
];

const columns: Column<Account>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  { key: "code", label: "Code", sortable: true },
  { key: "balance", label: "Balance", sortable: true, summary: "sum" },
];

const getSubRows = (row: Account) => row.children;

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

/** The rows shown - indented by their `aria-level`. */
const shownRows = () =>
  bodyRows().map(
    (row) =>
      "  ".repeat(Number(row.getAttribute("aria-level")) - 1) +
      row.querySelector('[data-column-key="name"]')?.textContent,
  );

const rowOf = (name: string) =>
  bodyRows().find((row) =>
    row
      .querySelector('[data-column-key="name"]')
      ?.textContent?.startsWith(name),
  ) as HTMLElement;

const toggle = (name: string) =>
  screen.getByRole("button", { name: `Sub-rows ${name}` });

/** The text of the live region of the tree. */
const announced = () =>
  Array.from(document.querySelectorAll("[aria-live]"))
    .map((region) => region.textContent)
    .join("");

function renderTree(props: Partial<DataTableProps<Account>> = {}) {
  return render(
    <DataTable
      clientSide
      columns={columns}
      data={accounts}
      getSubRows={getSubRows}
      {...props}
    />,
  );
}

describe("DataTable tree data", () => {
  it("shows the top-level rows collapsed, with their places in the tree", () => {
    renderTree();

    expect(shownRows()).toEqual(["Assets", "Liabilities", "Equity"]);
    const [assets, liabilities, equity] = bodyRows();
    expect(assets).toHaveAttribute("aria-level", "1");
    expect(assets).toHaveAttribute("aria-expanded", "false");
    expect(assets).toHaveAttribute("aria-posinset", "1");
    expect(assets).toHaveAttribute("aria-setsize", "3");
    expect(liabilities).toHaveAttribute("aria-posinset", "2");
    // A row without sub rows has no toggle, nor a state
    expect(equity).not.toHaveAttribute("aria-expanded");
    expect(
      within(equity).queryByRole("button", { name: /Sub-rows/ }),
    ).toBeNull();
    expect(toggle("Assets")).toHaveAttribute("aria-expanded", "false");
  });

  it("expands and collapses the sub rows, indented by their level", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(toggle("Assets"));
    await user.click(toggle("Bank accounts"));

    expect(shownRows()).toEqual([
      "Assets",
      "  Cash",
      "  Bank accounts",
      "    Current account",
      "    Savings account",
      "Liabilities",
      "Equity",
    ]);
    expect(toggle("Assets")).toHaveAttribute("aria-expanded", "true");
    const bank = rowOf("Bank accounts");
    expect(bank).toHaveAttribute("aria-level", "2");
    expect(bank).toHaveAttribute("aria-posinset", "2");
    expect(bank).toHaveAttribute("aria-setsize", "2");
    // Indented by two levels - from the start, the right edge right to left
    expect(
      rowOf("Savings account").querySelector('[data-column-key="name"] > div'),
    ).toHaveAttribute(
      "style",
      expect.stringContaining("padding-inline-start: 2.5rem"),
    );

    // Collapsed, the parent keeps the expansion of its descendants
    await user.click(toggle("Assets"));
    expect(shownRows()).toEqual(["Assets", "Liabilities", "Equity"]);
    await user.click(toggle("Assets"));
    expect(shownRows()).toHaveLength(7);
  });

  it("names the controls of a sub row by its first cell, not by the toggle", async () => {
    const user = userEvent.setup();
    renderTree({ selectionMode: "multiple" });

    await user.click(toggle("Assets"));

    expect(screen.getByRole("checkbox", { name: "Select row Cash" })).toBe(
      within(rowOf("Cash")).getByRole("checkbox"),
    );
  });

  it("puts the toggles into the tree column - the first one shown without it", async () => {
    const user = userEvent.setup();
    renderTree({ treeColumn: "code" });

    expect(
      rowOf("Assets").querySelector('[data-column-key="code"] button'),
    ).toBe(screen.getByRole("button", { name: "Sub-rows Assets" }));

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Code" }));
    await user.keyboard("{Escape}");

    expect(
      rowOf("Assets").querySelector('[data-column-key="name"] button'),
    ).toBe(toggle("Assets"));
  });

  it("warns about a tree column that is no column", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderTree({ treeColumn: "missing" });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing"'));
    expect(
      rowOf("Assets").querySelector('[data-column-key="name"] button'),
    ).not.toBeNull();
  });

  it("starts expanded to defaultExpandDepth, also rows loaded later", () => {
    const { rerender } = renderTree({ defaultExpandDepth: 1 });

    expect(shownRows()).toEqual([
      "Assets",
      "  Cash",
      "  Bank accounts",
      "Liabilities",
      "  Loans",
      "Equity",
    ]);

    rerender(
      <DataTable
        clientSide
        columns={columns}
        data={[
          ...accounts,
          account("4", "Income", 10, [account("41", "Sales", 10)]),
        ]}
        defaultExpandDepth={1}
        getSubRows={getSubRows}
      />,
    );
    expect(shownRows().slice(-2)).toEqual(["Income", "  Sales"]);
  });

  it("starts with every row expanded at an infinite depth", () => {
    renderTree({ defaultExpandDepth: Infinity });

    expect(shownRows()).toHaveLength(8);
  });

  it("starts with defaultExpandedTreeIds and reports every change", async () => {
    const user = userEvent.setup();
    const onExpandedTreeIdsChange = vi.fn();
    renderTree({
      defaultExpandedTreeIds: ["12", "2"],
      onExpandedTreeIdsChange,
    });

    // Bank accounts is expanded under the collapsed Assets
    expect(shownRows()).toEqual(["Assets", "Liabilities", "  Loans", "Equity"]);
    await user.click(toggle("Assets"));
    expect(shownRows()).toContain("    Current account");
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith(["1", "12", "2"]);

    await user.click(toggle("Liabilities"));
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith(["1", "12"]);
  });

  it("follows a controlled expandedTreeIds", async () => {
    const user = userEvent.setup();
    const onExpandedTreeIdsChange = vi.fn();
    const { rerender } = renderTree({
      expandedTreeIds: ["2"],
      onExpandedTreeIdsChange,
    });

    expect(shownRows()).toEqual(["Assets", "Liabilities", "  Loans", "Equity"]);
    await user.click(toggle("Assets"));
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith(["2", "1"]);
    // Until the parent applies it
    expect(shownRows()).toHaveLength(4);

    rerender(
      <DataTable
        clientSide
        columns={columns}
        data={accounts}
        expandedTreeIds={["2", "1"]}
        getSubRows={getSubRows}
        onExpandedTreeIdsChange={onExpandedTreeIdsChange}
      />,
    );
    expect(shownRows()).toContain("  Cash");
    await user.click(toggle("Liabilities"));
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith(["1"]);
  });

  it("warns about a controlled expansion the user cannot change", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderTree({ expandedTreeIds: [] });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("`expandedTreeIds` without"),
    );
  });

  it("expands and collapses all rows from the header of the tree column", async () => {
    const user = userEvent.setup();
    const onExpandedTreeIdsChange = vi.fn();
    renderTree({ onExpandedTreeIdsChange });

    const header = screen.getByRole("columnheader", { name: "Name" });
    await user.click(
      within(header).getByRole("button", { name: "Expand all rows" }),
    );

    expect(shownRows()).toHaveLength(8);
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith(["1", "12", "2"]);
    expect(announced()).toContain("All rows expanded");

    // A row collapsed by hand - all others stay expanded
    await user.click(toggle("Bank accounts"));
    expect(shownRows()).toHaveLength(6);

    await user.click(
      within(header).getByRole("button", { name: "Collapse all rows" }),
    );
    expect(shownRows()).toEqual(["Assets", "Liabilities", "Equity"]);
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith([]);
    expect(announced()).toContain("All rows collapsed");
    expect(
      within(header).getByRole("button", { name: "Expand all rows" }),
    ).toBeInTheDocument();
  });

  it("offers no expand all without rows to expand", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={[account("3", "Equity", 350)]}
        getSubRows={getSubRows}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Expand all rows" }),
    ).toBeNull();
  });

  it("keeps the details of renderSubRow apart from the sub rows", async () => {
    const user = userEvent.setup();
    const onExpandedIdsChange = vi.fn();
    const onExpandedTreeIdsChange = vi.fn();
    renderTree({
      onExpandedIdsChange,
      onExpandedTreeIdsChange,
      renderSubRow: (row) => `Detail of ${row.name}`,
    });

    await user.click(toggle("Assets"));
    expect(onExpandedTreeIdsChange).toHaveBeenLastCalledWith(["1"]);
    expect(onExpandedIdsChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Detail of Assets")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand row Cash" }));
    expect(screen.getByText("Detail of Cash")).toBeInTheDocument();
    expect(onExpandedIdsChange).toHaveBeenLastCalledWith(["11"]);
    expect(rowOf("Cash")).toHaveAttribute("data-state", "open");
  });

  it("shows the texts in Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={columns}
          data={accounts}
          getSubRows={getSubRows}
        />
      </UIProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Rozbalit všechny řádky" }),
    );
    expect(
      screen.getByRole("button", { name: "Podřízené řádky Assets" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(announced()).toContain("Všechny řádky jsou rozbalené");
    expect(
      screen.getByRole("button", { name: "Sbalit všechny řádky" }),
    ).toBeInTheDocument();
  });
});

describe("DataTable tree data keyboard", () => {
  it("expands, collapses and moves through the tree with the arrow keys", async () => {
    const user = userEvent.setup();
    renderTree();

    // The rows are one tab stop - the toggles are reached by the keys
    expect(bodyRows().map((row) => row.tabIndex)).toEqual([0, -1, -1]);
    expect(toggle("Assets")).toHaveAttribute("tabindex", "-1");

    act(() => bodyRows()[0].focus());
    await user.keyboard("{ArrowRight}");
    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "true");
    expect(rowOf("Assets")).toHaveFocus();

    // To the first sub row, the next one, and its parent
    await user.keyboard("{ArrowRight}");
    expect(rowOf("Cash")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(shownRows()).toContain("    Current account");
    await user.keyboard("{ArrowRight}");
    expect(rowOf("Current account")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Bank accounts")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Bank accounts")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Assets")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(shownRows()).toEqual(["Assets", "Liabilities", "Equity"]);

    // A leaf has nothing to expand; the top level no parent
    await user.keyboard("{End}{ArrowRight}{ArrowLeft}");
    expect(rowOf("Equity")).toHaveFocus();

    // Enter toggles a row without onRowClick
    await user.keyboard("{ArrowUp}{Enter}");
    expect(shownRows()).toContain("  Loans");
  });

  it("leaves Enter to onRowClick", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTree({ onRowClick });

    act(() => bodyRows()[0].focus());
    await user.keyboard("{Enter}");

    expect(onRowClick).toHaveBeenCalledWith(accounts[0], expect.anything());
    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "false");

    // A click on the toggle is no click on the row
    await user.click(toggle("Assets"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "true");
  });

  it("turns the arrow keys round right to left", async () => {
    const user = userEvent.setup();
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element, pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return new Proxy(style, {
          get: (target, property) => {
            if (property === "direction") return "rtl";
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    );
    render(
      <div dir="rtl">
        <DataTable
          clientSide
          columns={columns}
          data={accounts}
          getSubRows={getSubRows}
        />
      </div>,
    );

    act(() => bodyRows()[0].focus());
    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Cash")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(rowOf("Assets")).toHaveFocus();
  });

  it("keeps the toggles in the tab order of rows with links", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTree({ getRowHref: (row) => `/accounts/${row.id}`, onRowClick });

    expect(bodyRows()[0]).not.toHaveAttribute("tabindex");
    expect(toggle("Assets")).not.toHaveAttribute("tabindex");
    // The toggle is no part of the link - nor of a click on the row
    const link = within(rowOf("Assets")).getByRole("link", { name: "Assets" });
    expect(link.contains(toggle("Assets"))).toBe(false);

    await user.click(toggle("Assets"));
    expect(onRowClick).not.toHaveBeenCalled();
    expect(shownRows()).toContain("  Cash");
  });
});

describe("DataTable tree data on the client", () => {
  it("keeps the ancestors of the matches of a search, expanded", async () => {
    const user = userEvent.setup();
    renderTree({
      defaultQuery: { search: "account" },
      enableGlobalSearch: true,
    });

    // The matches in their places - other branches left out
    expect(shownRows()).toEqual([
      "Assets",
      "  Bank accounts",
      "    Current account",
      "    Savings account",
    ]);
    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "true");
    expect(rowOf("Bank accounts")).toHaveAttribute("aria-setsize", "1");

    // The user may collapse them while the search lasts
    await user.click(toggle("Bank accounts"));
    expect(shownRows()).toEqual(["Assets", "  Bank accounts"]);
  });

  it("shows the sub rows of a match as the user expands it", async () => {
    const user = userEvent.setup();
    renderTree({ defaultQuery: { filters: { name: "liab" } } });

    expect(shownRows()).toEqual(["Liabilities"]);
    expect(rowOf("Liabilities")).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle("Liabilities"));
    expect(shownRows()).toEqual(["Liabilities", "  Loans"]);
  });

  it("brings back the expansion of before once the filter is cleared", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(toggle("Liabilities"));
    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "savings",
    );
    await waitFor(() =>
      expect(shownRows()).toEqual([
        "Assets",
        "  Bank accounts",
        "    Savings account",
      ]),
    );

    await user.clear(screen.getByRole("searchbox", { name: "Filter Name" }));
    await waitFor(() =>
      expect(shownRows()).toEqual([
        "Assets",
        "Liabilities",
        "  Loans",
        "Equity",
      ]),
    );
  });

  it("sorts the siblings within each parent", async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandDepth: Infinity });

    await user.click(screen.getByRole("button", { name: /^Balance/ }));
    await user.click(screen.getByRole("button", { name: /^Balance/ }));

    expect(shownRows()).toEqual([
      "Assets",
      "  Bank accounts",
      "    Current account",
      "    Savings account",
      "  Cash",
      "Equity",
      "Liabilities",
      "  Loans",
    ]);
    expect(rowOf("Cash")).toHaveAttribute("aria-posinset", "2");
  });

  it("pages the top-level rows, each with its branch", async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandDepth: 1, defaultQuery: { pageSize: 2 } });

    expect(shownRows()).toEqual([
      "Assets",
      "  Cash",
      "  Bank accounts",
      "Liabilities",
      "  Loans",
    ]);
    expect(screen.getByText(/1–2 of 3/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(shownRows()).toEqual(["Equity"]);
    // Its place among all top-level rows
    expect(rowOf("Equity")).toHaveAttribute("aria-posinset", "3");
    expect(rowOf("Equity")).toHaveAttribute("aria-setsize", "3");
  });

  it("sums up the rows at the bottom of the tree - each total once", async () => {
    renderTree();

    const summary = screen.getAllByRole("rowgroup")[2];
    // 100 + 300 + 200 + 250 + 350, not the totals of the parents again
    expect(summary).toHaveTextContent("1,200");

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "account",
    );
    await waitFor(() => expect(summary).toHaveTextContent("500"));
  });

  it("ignores groupBy and warns about it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderTree({ groupBy: "code" });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("`groupBy` is ignored with tree data"),
    );
    expect(shownRows()).toEqual(["Assets", "Liabilities", "Equity"]);
    expect(document.querySelector("[data-group-key]")).toBeNull();
  });

  it("warns about ids given to more than one row", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <DataTable
        clientSide
        columns={columns}
        data={[
          account("1", "Assets", 1, [account("2", "Twin", 1)]),
          account("2", "Liabilities", 1),
        ]}
        defaultExpandDepth={1}
        getSubRows={getSubRows}
      />,
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("has the id 2 - getRowId must give"),
    );
    // The first one met keeps it - level by level
    expect(shownRows()).toEqual(["Assets", "Liabilities"]);
  });
});

describe("DataTable tree data from a server", () => {
  it("shows the rows as they come, placed among all top-level rows", () => {
    render(
      <DataTable
        columns={columns}
        data={[accounts[2], accounts[0]]}
        defaultExpandDepth={1}
        defaultQuery={{ page: 3, pageSize: 2, search: "nothing" }}
        enableGlobalSearch
        getSubRows={getSubRows}
        total={6}
      />,
    );

    // Neither searched nor sorted by the table
    expect(shownRows()).toEqual([
      "Equity",
      "Assets",
      "  Cash",
      "  Bank accounts",
    ]);
    expect(rowOf("Assets")).toHaveAttribute("aria-posinset", "6");
    expect(rowOf("Assets")).toHaveAttribute("aria-setsize", "6");
    expect(rowOf("Cash")).toHaveAttribute("aria-posinset", "1");
    expect(rowOf("Cash")).toHaveAttribute("aria-setsize", "2");
  });

  it("leaves out the places of cursor pages", () => {
    render(
      <DataTable
        columns={columns}
        data={accounts}
        getSubRows={getSubRows}
        pageInfo={{ hasNextPage: true, hasPreviousPage: true }}
      />,
    );

    expect(rowOf("Assets")).not.toHaveAttribute("aria-posinset");
    expect(rowOf("Assets")).not.toHaveAttribute("aria-setsize");
    expect(rowOf("Assets")).toHaveAttribute("aria-level", "1");
  });
});

/** A promise to settle from the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("DataTable tree data loaded lazily", () => {
  const folders: Account[] = [
    account("1", "Assets", 600),
    account("2", "Liabilities", 250),
    account("3", "Equity", 350),
  ];
  const hasSubRows = (row: Account) => row.id !== "3";

  let requests: {
    reject: (error: unknown) => void;
    resolve: (rows: Account[]) => void;
    row: Account;
    signal: AbortSignal;
  }[];
  const loadSubRows = vi.fn(
    (row: Account, { signal }: { signal: AbortSignal }) => {
      const { promise, reject, resolve } = deferred<Account[]>();
      requests.push({ reject, resolve, row, signal });
      return promise;
    },
  );

  beforeEach(() => {
    requests = [];
    loadSubRows.mockClear();
  });

  const renderLazy = (props: Partial<DataTableProps<Account>> = {}) =>
    render(
      <DataTable
        columns={columns}
        data={folders}
        hasSubRows={hasSubRows}
        loadSubRows={loadSubRows}
        {...props}
      />,
    );

  it("loads the sub rows as a row is first expanded, then keeps them", async () => {
    const user = userEvent.setup();
    renderLazy();

    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "false");
    expect(rowOf("Equity")).not.toHaveAttribute("aria-expanded");
    expect(loadSubRows).not.toHaveBeenCalled();

    await user.click(toggle("Assets"));
    expect(loadSubRows).toHaveBeenCalledTimes(1);
    expect(requests[0].row).toBe(folders[0]);
    expect(rowOf("Assets")).toHaveAttribute("aria-busy", "true");
    expect(rowOf("Assets")).toHaveAttribute("aria-expanded", "true");

    await act(async () =>
      requests[0].resolve([
        account("11", "Cash", 100),
        account("12", "Bank", 500),
      ]),
    );
    expect(shownRows()).toEqual([
      "Assets",
      "  Cash",
      "  Bank",
      "Liabilities",
      "Equity",
    ]);
    expect(rowOf("Assets")).not.toHaveAttribute("aria-busy");
    expect(announced()).toContain("2 rows loaded");

    // Kept - collapsing and expanding again loads nothing
    await user.click(toggle("Assets"));
    await user.click(toggle("Assets"));
    expect(shownRows()).toContain("  Bank");
    expect(loadSubRows).toHaveBeenCalledTimes(1);
  });

  it("shows a failure with a retry button", async () => {
    const user = userEvent.setup();
    const onLoadSubRowsError = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderLazy({ onLoadSubRowsError });

    await user.click(toggle("Liabilities"));
    const failure = new Error("Offline");
    await act(async () => requests[0].reject(failure));

    const liabilities = rowOf("Liabilities");
    expect(
      within(liabilities).getByText("The rows could not be loaded."),
    ).toBeInTheDocument();
    expect(onLoadSubRowsError).toHaveBeenCalledWith(failure, folders[1]);
    expect(error).toHaveBeenCalled();
    expect(announced()).toContain("The rows could not be loaded.");

    await user.click(screen.getByRole("button", { name: "Retry Liabilities" }));
    expect(loadSubRows).toHaveBeenCalledTimes(2);
    await act(async () => requests[1].resolve([account("21", "Loans", 250)]));
    expect(shownRows()).toContain("  Loans");
    expect(liabilities).not.toHaveTextContent("The rows could not be loaded.");
  });

  it("tries again a row expanded again after a failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderLazy();

    await user.click(toggle("Assets"));
    await act(async () => requests[0].reject(new Error("Offline")));
    expect(rowOf("Assets")).toHaveTextContent("The rows could not be loaded.");
    await user.click(toggle("Assets"));
    expect(rowOf("Assets")).not.toHaveTextContent(
      "The rows could not be loaded.",
    );

    await user.click(toggle("Assets"));
    expect(loadSubRows).toHaveBeenCalledTimes(2);
  });

  it("aborts a load when its row is collapsed or the table unmounts", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLazy();

    await user.click(toggle("Assets"));
    await user.click(toggle("Assets"));
    expect(requests[0].signal.aborted).toBe(true);
    expect(rowOf("Assets")).not.toHaveAttribute("aria-busy");

    // A late answer of the aborted load is not shown
    await act(async () => requests[0].resolve([account("11", "Cash", 1)]));
    expect(shownRows()).not.toContain("  Cash");

    await user.click(toggle("Assets"));
    expect(loadSubRows).toHaveBeenCalledTimes(2);
    unmount();
    expect(requests[1].signal.aborted).toBe(true);
  });

  it("shows a row whose load brings no rows as one without sub rows", async () => {
    const user = userEvent.setup();
    renderLazy();

    await user.click(toggle("Assets"));
    await act(async () => requests[0].resolve([]));

    expect(rowOf("Assets")).not.toHaveAttribute("aria-expanded");
    expect(
      screen.queryByRole("button", { name: "Sub-rows Assets" }),
    ).toBeNull();
    expect(announced()).toContain("0 rows loaded");
  });

  it("loads the rows expanded by defaultExpandDepth - expand all loads none", async () => {
    const user = userEvent.setup();
    renderLazy({ defaultExpandDepth: 1 });

    await waitFor(() => expect(loadSubRows).toHaveBeenCalledTimes(2));
    expect(requests.map((request) => request.row.name)).toEqual([
      "Assets",
      "Liabilities",
    ]);
    await act(async () => {
      requests[0].resolve([account("11", "Cash", 100, [])]);
      requests[1].resolve([account("21", "Loans", 250)]);
    });
    // Rows expanded by default are not announced
    expect(announced()).not.toContain("loaded");

    await user.click(screen.getByRole("button", { name: "Collapse all rows" }));
    await user.click(screen.getByRole("button", { name: "Expand all rows" }));
    // Loans may have sub rows - still to load, it stays collapsed
    expect(shownRows()).toEqual([
      "Assets",
      "  Cash",
      "Liabilities",
      "  Loans",
      "Equity",
    ]);
    expect(rowOf("Loans")).toHaveAttribute("aria-expanded", "false");
    expect(loadSubRows).toHaveBeenCalledTimes(2);
  });

  it("loads the rows shown again for another loadSubRowsKey", async () => {
    const user = userEvent.setup();
    const { rerender } = renderLazy({ loadSubRowsKey: 1 });

    await user.click(toggle("Assets"));
    await act(async () => requests[0].resolve([account("11", "Cash", 100)]));
    await user.click(toggle("Liabilities"));
    await act(async () => requests[1].resolve([account("21", "Loans", 250)]));
    await user.click(toggle("Liabilities"));

    rerender(
      <DataTable
        columns={columns}
        data={folders}
        hasSubRows={hasSubRows}
        loadSubRows={loadSubRows}
        loadSubRowsKey={2}
      />,
    );

    // Only the expanded row - its rows stay until the new ones come
    await waitFor(() => expect(loadSubRows).toHaveBeenCalledTimes(3));
    expect(requests[2].row).toBe(folders[0]);
    expect(shownRows()).toContain("  Cash");
    expect(rowOf("Assets")).toHaveAttribute("aria-busy", "true");
    await act(async () =>
      requests[2].resolve([account("11", "Petty cash", 5)]),
    );
    expect(shownRows()).toContain("  Petty cash");

    // The other row loads once it is expanded
    await user.click(toggle("Liabilities"));
    expect(loadSubRows).toHaveBeenCalledTimes(4);
  });

  it("mixes given and loaded sub rows", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={[
          account("1", "Assets", 600, [account("11", "Cash", 100)]),
          account("2", "Liabilities", 250),
        ]}
        getSubRows={getSubRows}
        hasSubRows={(row) => row.id === "2"}
        loadSubRows={loadSubRows}
      />,
    );

    await user.click(toggle("Assets"));
    expect(shownRows()).toContain("  Cash");
    expect(loadSubRows).not.toHaveBeenCalled();
    expect(rowOf("Cash")).not.toHaveAttribute("aria-expanded");
    await user.click(toggle("Liabilities"));
    expect(loadSubRows).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable tree data selection", () => {
  it("selects a row alone - select all takes the collapsed sub rows too", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    renderTree({ onSelectedIdsChange });

    await user.click(
      screen.getByRole("checkbox", { name: "Select row Assets" }),
    );
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      ["1"],
      expect.anything(),
    );

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(onSelectedIdsChange.mock.lastCall?.[0].sort()).toEqual(
      ["1", "11", "12", "121", "122", "2", "21", "3"].sort(),
    );
  });

  it("selects the branches of rows with cascadeSelection", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    renderTree({ cascadeSelection: true, onSelectedIdsChange });

    const select = (name: string) =>
      screen.getByRole("checkbox", { name: `Select row ${name}` });

    // Also the collapsed sub rows
    await user.click(select("Assets"));
    expect(onSelectedIdsChange.mock.lastCall?.[0]).toEqual([
      "1",
      "11",
      "12",
      "121",
      "122",
    ]);
    expect(onSelectedIdsChange.mock.lastCall?.[1].rows).toHaveLength(5);

    await user.click(toggle("Assets"));
    await user.click(toggle("Bank accounts"));
    expect(select("Savings account")).toBeChecked();

    // One sub row less - the parents are mixed
    await user.click(select("Savings account"));
    expect(onSelectedIdsChange.mock.lastCall?.[0]).toEqual(["11", "121"]);
    expect(select("Bank accounts")).toBePartiallyChecked();
    expect(select("Assets")).toBePartiallyChecked();
    expect(select("Cash")).toBeChecked();

    // A mixed row checks its whole branch
    await user.click(select("Assets"));
    expect(select("Assets")).toBeChecked();
    expect(select("Bank accounts")).toBeChecked();
    expect(select("Savings account")).toBeChecked();

    // Unchecked, the branch goes; checking the last sub row checks parents
    await user.click(select("Bank accounts"));
    expect(onSelectedIdsChange.mock.lastCall?.[0]).toEqual(["11"]);
    await user.click(select("Current account"));
    await user.click(select("Savings account"));
    expect(select("Bank accounts")).toBeChecked();
    expect(select("Assets")).toBeChecked();
  });

  it("selects a range of the rows shown with Shift", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    renderTree({ defaultExpandDepth: 1, onSelectedIdsChange });

    await user.click(screen.getByRole("checkbox", { name: "Select row Cash" }));
    await user.keyboard("{Shift>}");
    await user.click(
      screen.getByRole("checkbox", { name: "Select row Liabilities" }),
    );
    await user.keyboard("{/Shift}");

    expect(onSelectedIdsChange.mock.lastCall?.[0]).toEqual(["11", "12", "2"]);
  });

  it("keeps the selected sub rows of a collapsed row", async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpandDepth: 1, selectionMode: "multiple" });

    await user.click(screen.getByRole("checkbox", { name: "Select row Cash" }));
    await user.click(toggle("Assets"));
    await user.click(toggle("Assets"));

    expect(
      screen.getByRole("checkbox", { name: "Select row Cash" }),
    ).toBeChecked();
  });
});

describe("DataTable tree data with other features", () => {
  it("edits the cells of sub rows", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <DataTable
        clientSide
        columns={[{ ...columns[0], editable: true }, ...columns.slice(1)]}
        data={accounts}
        defaultExpandDepth={1}
        getSubRows={getSubRows}
        onCellEdit={onCellEdit}
      />,
    );

    const cash = rowOf("Cash");
    const cell = cash.querySelector<HTMLElement>(
      '[data-column-key="name"]',
    ) as HTMLElement;
    // A double click of the toggle does not edit the cell
    await user.dblClick(toggle("Bank accounts"));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();

    await user.dblClick(cell);
    const field = screen.getByRole("textbox", { name: "Name" });
    // Indented like the cell's text
    expect(cash).toContainElement(field);
    await user.clear(field);
    await user.type(field, "Petty cash{Enter}");

    expect(onCellEdit).toHaveBeenCalledWith(
      accounts[0].children?.[0],
      "name",
      "Petty cash",
    );
  });

  it("exports the rows depth first with their levels", async () => {
    const user = userEvent.setup();
    let blob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: (object: Blob) => {
        blob = object;
        return "blob:csv";
      },
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderTree({ enableCsvExport: true });

    await user.click(screen.getByRole("button", { name: "Export to CSV" }));
    vi.unstubAllGlobals();

    // Also the collapsed sub rows
    expect((await (blob as Blob).text()).replace(/^﻿/, "")).toBe(
      [
        "Level,Name,Code,Balance",
        "1,Assets,1,600",
        "2,Cash,11,100",
        "2,Bank accounts,12,500",
        "3,Current account,121,300",
        "3,Savings account,122,200",
        "1,Liabilities,2,250",
        "2,Loans,21,250",
        "1,Equity,3,350",
      ].join("\r\n"),
    );
  });

  it("exports the rows of onExport with their given sub rows", async () => {
    const user = userEvent.setup();
    let blob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: (object: Blob) => {
        blob = object;
        return "blob:csv";
      },
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(
      <DataTable
        columns={columns.slice(0, 1)}
        data={[]}
        getSubRows={getSubRows}
        onExport={() => [accounts[1]]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export to CSV" }));
    await waitFor(() => expect(blob).toBeDefined());
    vi.unstubAllGlobals();

    expect((await (blob as Blob).text()).replace(/^﻿/, "")).toBe(
      "Level,Name\r\n1,Liabilities\r\n2,Loans",
    );
  });

  it("virtualizes the rows shown, counted for screen readers", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 200 }, (_, index) =>
      account(`${index}`, `Account ${index}`, index, [
        account(`${index}.1`, `Sub-account ${index}`, index),
      ]),
    );
    render(
      <DataTable
        clientSide
        columns={[{ key: "name", label: "Name" }]}
        data={many}
        getSubRows={getSubRows}
        pagination={false}
        virtualized
      />,
    );

    // The header row and the top-level rows
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "201");
    expect(bodyRows().length).toBeLessThan(200);

    await user.click(toggle("Account 0"));
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "202");
    expect(rowOf("Sub-account 0")).toHaveAttribute("aria-level", "2");
  });

  it("keeps the toggles of a pinned tree column in its sticky cells", () => {
    renderTree({
      columns: [{ ...columns[0], pinned: "left" }, ...columns.slice(1)],
      density: "compact",
    });

    const cell = rowOf("Assets").querySelector('[data-column-key="name"]');
    expect(cell).toHaveClass("sticky");
    expect(toggle("Assets")).toHaveClass("size-4");
  });

  it("keeps the tree column on narrow screens", () => {
    renderTree({
      columns: [{ ...columns[0], hideBelow: "md" }, ...columns.slice(1)],
    });

    expect(
      rowOf("Assets").querySelector('[data-column-key="name"]'),
    ).not.toHaveClass("max-md:hidden");
  });

  it("works with a controlled expansion in the parent's state", async () => {
    const user = userEvent.setup();
    function Accounts() {
      const [expanded, setExpanded] = useState<RowId[]>([]);
      return (
        <>
          <output>{expanded.join(",")}</output>
          <DataTable
            clientSide
            columns={columns}
            data={accounts}
            expandedTreeIds={expanded}
            getSubRows={getSubRows}
            onExpandedTreeIdsChange={setExpanded}
          />
        </>
      );
    }
    render(<Accounts />);

    await user.click(screen.getByRole("button", { name: "Expand all rows" }));
    expect(screen.getByRole("status")).toHaveTextContent("1,12,2");
    expect(shownRows()).toHaveLength(8);
    await user.click(toggle("Bank accounts"));
    expect(screen.getByRole("status")).toHaveTextContent("1,2");
  });
});

describe("DataTable tree data on the server", () => {
  it("renders the expanded rows without the browser, then hydrates them", async () => {
    const loadSubRows = vi.fn(() => new Promise<Account[]>(() => {}));
    const table = (
      <DataTable
        cascadeSelection
        clientSide
        columns={columns}
        data={[...accounts, account("4", "Income", 0)]}
        defaultExpandDepth={1}
        defaultSelectedIds={["11"]}
        getSubRows={(row) => (row.id === "4" ? undefined : row.children)}
        hasSubRows={(row) => row.id === "4"}
        loadSubRows={loadSubRows}
        virtualized
      />
    );

    vi.stubGlobal("ResizeObserver", undefined);
    const html = renderToString(table);
    vi.unstubAllGlobals();

    expect(html).toContain('aria-level="2"');
    expect(html).toContain("Bank accounts<");
    expect(html).not.toContain("Current account<");
    expect(html).toContain("Collapse all rows");
    // Nothing loads on the server
    expect(loadSubRows).not.toHaveBeenCalled();

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});

    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, table, { onRecoverableError });
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      // The expanded row of the lazy branch loads in the browser
      expect(loadSubRows).toHaveBeenCalledTimes(1);
      expect(
        within(container).getByRole("checkbox", { name: "Select row Assets" }),
      ).toBePartiallyChecked();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
