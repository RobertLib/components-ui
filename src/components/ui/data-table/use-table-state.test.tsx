import { act, render, renderHook, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import useTableState from "./use-table-state";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
  team: string;
}

const rows: Row[] = [
  { id: 1, name: "Adam", team: "A" },
  { id: 2, name: "Běla", team: "B" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { key: "team", label: "Team" },
];

const headers = () =>
  screen.queryAllByRole("columnheader").map((header) => header.textContent);

const saveHiddenTeam = () =>
  localStorage.setItem(
    "table-state-people",
    JSON.stringify({ columnVisibility: { team: false } }),
  );

describe("DataTable column settings", () => {
  it("hydrate server HTML without a mismatch, then show what was saved", async () => {
    saveHiddenTeam();
    const table = <DataTable columns={columns} data={rows} tableId="people" />;

    // A server has no localStorage - it renders the default columns
    const storage = vi
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(undefined as unknown as Storage);
    const html = renderToString(table);
    storage.mockRestore();

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
      expect(headers()).toEqual(["Name"]);
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("show what was saved from the first render of a client-only app", () => {
    saveHiddenTeam();
    const firstHeaders: (string | null)[][] = [];

    // Runs once the table is in the page for the first time
    function Probe({ children }: { children: React.ReactNode }) {
      useLayoutEffect(() => {
        firstHeaders.push(headers());
      }, []);
      return children;
    }

    render(
      <Probe>
        <DataTable columns={columns} data={rows} tableId="people" />
      </Probe>,
    );

    expect(firstHeaders).toEqual([["Name"]]);
  });
});

describe("DataTable saved settings", () => {
  it.each(["replace", "remove", "clear"] as const)(
    "accepts another tab's %s after a failed write",
    (operation) => {
      const tableId = `failed-write-${operation}`;
      const key = `table-state-${tableId}`;
      localStorage.setItem(key, JSON.stringify({ density: "normal" }));
      const { result } = renderHook(() => ({
        first: useTableState(tableId),
        second: useTableState(tableId),
      }));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const write = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("full", "QuotaExceededError");
        });
      act(() => result.current.first[1]({ density: "compact" }));
      expect(result.current.second[0].density).toBe("compact");
      write.mockRestore();

      act(() => {
        if (operation === "clear") localStorage.clear();
        else if (operation === "remove") localStorage.removeItem(key);
        else
          localStorage.setItem(key, JSON.stringify({ density: "comfortable" }));
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: operation === "clear" ? null : key,
            newValue: localStorage.getItem(key),
            storageArea: localStorage,
          }),
        );
      });
      const density = operation === "replace" ? "comfortable" : null;
      expect(result.current.first[0].density).toBe(density);
      expect(result.current.second[0].density).toBe(density);

      act(() => result.current.first[1]({ columnWidths: { name: 200 } }));
      expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ density });
    },
  );

  it("keeps unsaved settings when another table or sessionStorage changes", () => {
    const tableId = "unrelated-storage";
    const key = `table-state-${tableId}`;
    const { result } = renderHook(() => useTableState(tableId));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    act(() => result.current[1]({ density: "compact" }));
    write.mockRestore();

    for (const event of [
      { key: "table-state-someone-else", storageArea: localStorage },
      { key, storageArea: sessionStorage },
      { key: null, storageArea: sessionStorage },
    ]) {
      act(() => window.dispatchEvent(new StorageEvent("storage", event)));
      expect(result.current[0].density).toBe("compact");
    }
  });

  it("tolerate hand-edited values", () => {
    localStorage.setItem(
      "table-state-people",
      JSON.stringify({
        columnPinning: { name: "top", team: "right" },
        columnWidths: { name: "wide", team: -5 },
        density: "tiny",
      }),
    );
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    const team = screen.getByRole("columnheader", { name: "Team" });
    expect(team).toHaveStyle({ insetInlineEnd: "0px" });
    expect(team.style.width).toBe("");
    expect(screen.getByRole("columnheader", { name: "Name" })).not.toHaveClass(
      "sticky",
    );
    expect(screen.getAllByRole("cell")[0]).toHaveClass("py-1");
  });
});
