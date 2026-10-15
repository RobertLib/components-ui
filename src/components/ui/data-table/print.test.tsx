import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
}

const manyRows: Row[] = Array.from({ length: 500 }, (_, index) => ({
  id: index + 1,
  name: `Person ${index + 1}`,
}));

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name" },
];

const renderedRows = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .filter((row) => !row.hasAttribute("aria-hidden"));

describe("DataTable printing", () => {
  it("renders every row of a virtualized table while printing", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        maxHeight="300px"
        pagination={false}
        virtualized
      />,
    );
    expect(renderedRows().length).toBeLessThan(manyRows.length);

    // Rendered by the time the event is over - the printout is laid out
    // right after it, before React would render on its own
    let rowsAfterEvent = 0;
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
      rowsAfterEvent = renderedRows().length;
    });
    expect(rowsAfterEvent).toBe(manyRows.length);

    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(renderedRows().length).toBeLessThan(manyRows.length);
  });

  it("follows the print media query - Safari", () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: (_: string, callback: typeof listener) => {
        if (query === "print") listener = callback;
      },
      matches: false,
      removeEventListener: () => {},
    }));
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );

    act(() => listener?.({ matches: true }));
    expect(renderedRows()).toHaveLength(manyRows.length);
    act(() => listener?.({ matches: false }));
    expect(renderedRows().length).toBeLessThan(manyRows.length);
    vi.unstubAllGlobals();
  });

  it("leaves the controls out of a printout and prints the table whole", () => {
    render(
      <DataTable
        actions={() => <button type="button">Edit</button>}
        clientSide
        columns={columns}
        data={manyRows.slice(0, 3)}
        defaultQuery={{ filters: { name: "Person" } }}
        selectionMode="multiple"
      />,
    );

    const region = screen.getByRole("region");
    // The toolbar with the chips of the filters, the row of the filters and
    // the pagination
    expect(region.querySelector("header")).toHaveClass("print:hidden");
    expect(
      screen.getByRole("searchbox", { name: "Filter Name" }).closest("tr"),
    ).toHaveClass("print:hidden");
    expect(region.querySelector("footer")).toHaveClass("print:hidden");
    // The selection and actions columns, also their cells in the header
    const table = screen.getByRole("table");
    expect(table).toHaveClass(
      "print:**:data-leading-column:hidden",
      "print:[&_tr]:break-inside-avoid",
    );
    for (const cell of [
      screen.getByRole("columnheader", { name: "Actions" }),
      within(screen.getAllByRole("row")[2]).getAllByRole("cell")[0],
    ]) {
      expect(cell).toHaveAttribute("data-leading-column");
    }
    // The header row repeats on every page - not sticking
    expect(table.querySelector("thead")).toHaveClass("print:static");
    // Not up to `maxHeight`
    expect(table.parentElement).toHaveClass(
      "print:max-h-none!",
      "print:overflow-visible",
    );
  });
});
