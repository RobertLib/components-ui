import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  id: number;
  joined: Date;
  name: string;
  salary: number;
}

const rows: Row[] = Array.from({ length: 500 }, (_, index) => ({
  id: index + 1,
  joined: new Date(2026, 8, 1 + (index % 28)),
  name: `Person ${index + 1}`,
  salary: 1000 + index,
}));

const columns: Column<Row>[] = [
  { editable: true, key: "name", label: "Name", pinned: "left", width: 160 },
  { key: "joined", label: "Joined", summary: "min" },
  { key: "salary", label: "Salary", pinned: "right", summary: "sum" },
];

describe("DataTable on the server", () => {
  it("renders the new features without the browser, then hydrates them", async () => {
    // Saved settings - the server knows none of them
    localStorage.setItem(
      "table-state-people",
      JSON.stringify({ columnWidths: { salary: 120 }, density: "compact" }),
    );
    const table = (
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        enableCsvExport
        onCellEdit={() => {}}
        pagination={false}
        tableId="people"
        virtualized
      />
    );

    const storage = vi
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(undefined as unknown as Storage);
    vi.stubGlobal("ResizeObserver", undefined);
    const html = renderToString(table);
    storage.mockRestore();
    vi.unstubAllGlobals();

    // The first rows, the summary of all of them, the controls
    expect(html).toContain("Person 1<");
    expect(html).not.toContain("Person 500<");
    expect(html).toContain("<tfoot");
    expect(html).toContain('role="separator"');
    expect(html).toContain("Export to CSV");

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
      // Then the saved settings
      const salary = container.querySelector<HTMLElement>(
        'th[data-column-key="salary"]',
      );
      expect(salary).toHaveStyle({ width: "120px" });
      expect(container.querySelector("tbody td")).toHaveClass("py-0.5");
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});
