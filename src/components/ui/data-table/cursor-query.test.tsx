import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import useDataTableQuery from "./use-data-table-query";
import UIProvider from "../../../providers/ui-provider";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
  team: string;
}

const rows: Row[] = [{ id: 1, name: "Adam", team: "A" }];
const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  { key: "team", label: "Team", sortable: true },
];

function Table({ hasNewConnection }: { hasNewConnection: boolean }) {
  const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultSearchOpen
      enableGlobalSearch
      multiSort
      onQueryChange={setQuery}
      pageInfo={{
        endCursor: hasNewConnection ? "new-end" : "old-end",
        hasNextPage: true,
        hasPreviousPage: !hasNewConnection,
        startCursor: hasNewConnection ? "new-start" : "old-start",
      }}
      query={query}
    />
  );
}

function App({
  initialSearch = "?page=3&after=old-page2",
  navigate,
}: {
  initialSearch?: string;
  navigate: (href: string) => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [pending, setPending] = useState<string | null>(null);
  const [hasNewConnection, setHasNewConnection] = useState(false);

  return (
    <UIProvider
      router={{
        navigate: (href) => {
          navigate(href);
          // A router with loaders re-renders while still showing the old URL.
          setPending(href);
        },
        pathname: "/people",
        search,
      }}
    >
      <button
        onClick={() => {
          if (pending === null) return;
          setSearch(new URL(pending, "https://example.test").search);
          setHasNewConnection(true);
          setPending(null);
        }}
        type="button"
      >
        Finish navigation
      </button>
      <Table hasNewConnection={hasNewConnection} />
    </UIProvider>
  );
}

const searchParams = (href: string) =>
  new URL(href, "https://example.test").searchParams;

describe.each(["Next page", "Previous page"])(
  "DataTable %s with a pending cursor query",
  (direction) => {
    it.each(["filter", "search", "sort", "page size"])(
      "waits for the connection after a %s change",
      async (change) => {
        const user = userEvent.setup();
        const navigate = vi.fn<(href: string) => void>();
        render(
          <App
            initialSearch={
              change === "sort"
                ? "?page=3&after=old-page2&sort=team,name"
                : undefined
            }
            navigate={navigate}
          />,
        );

        if (change === "filter") {
          await user.type(
            screen.getByRole("searchbox", { name: "Filter Name" }),
            "Adam",
          );
        } else if (change === "search") {
          await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "Adam",
          );
        } else if (change === "sort") {
          // Only the secondary sort changes; sortBy/order stay the same.
          await user.keyboard("{Shift>}");
          await user.click(screen.getByRole("button", { name: /Name/ }));
          await user.keyboard("{/Shift}");
        } else {
          await user.selectOptions(
            screen.getByRole("combobox", { name: "Rows per page" }),
            "10",
          );
        }

        await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
        const pending = searchParams(navigate.mock.calls[0][0]);
        expect(pending.get("after")).toBeNull();
        expect(pending.get("before")).toBeNull();
        expect(pending.get("page")).toBeNull();
        if (change === "filter") {
          expect(JSON.parse(pending.get("filters")!)).toEqual({ name: "Adam" });
        } else if (change === "search") {
          expect(pending.get("search")).toBe("Adam");
        } else if (change === "sort") {
          expect(pending.get("sort")).toBe("team,-name");
        } else {
          expect(pending.get("pageSize")).toBe("10");
        }

        await user.click(screen.getByRole("button", { name: direction }));
        expect(navigate).toHaveBeenCalledTimes(1);

        await user.click(
          screen.getByRole("button", { name: "Finish navigation" }),
        );
        await user.click(screen.getByRole("button", { name: "Next page" }));
        expect(navigate).toHaveBeenCalledTimes(2);
        const next = searchParams(navigate.mock.calls[1][0]);
        expect(next.get("after")).toBe("new-end");
        expect(next.get("before")).toBeNull();
        expect(next.get("page")).toBe("2");
      },
    );

    it("uses the shown cursor when the query is unchanged", async () => {
      const user = userEvent.setup();
      const navigate = vi.fn<(href: string) => void>();
      render(<App navigate={navigate} />);

      await user.click(screen.getByRole("button", { name: direction }));

      expect(navigate).toHaveBeenCalledTimes(1);
      const next = searchParams(navigate.mock.calls[0][0]);
      const forward = direction === "Next page";
      expect(next.get("after")).toBe(forward ? "old-end" : null);
      expect(next.get("before")).toBe(forward ? null : "old-start");
      expect(next.get("page")).toBe(forward ? "4" : "2");
    });
  },
);
