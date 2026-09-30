import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";
import {
  createDataTableQuery,
  readQueryFromSearch,
  setFilter,
  writeQueryToSearch,
} from "./query";

// Keys as a backend may name its fields - quotes and backslashes included
const QUOTED = 'address["city"]';
const ESCAPED = "path\\to";

type Row = Record<string, string | number> & { id: number };

const rows: Row[] = [
  { [ESCAPED]: "C:", [QUOTED]: "Brno", id: 1, name: "Adam" },
  { [ESCAPED]: "D:", [QUOTED]: "Praha", id: 2, name: "Běla" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { key: QUOTED, label: "City" },
  { key: ESCAPED, label: "Path" },
];

const headers = () =>
  within(screen.getAllByRole("rowgroup")[0])
    .getAllByRole("columnheader")
    .map((header) => header.textContent);

describe("DataTable column keys", () => {
  it.each(
    ["constructor", "toString", "__proto__"].flatMap((key) =>
      [undefined, "special-keys"].map((tableId) => ({ key, tableId })),
    ),
  )(
    "renders and manages $key without inherited settings (tableId: $tableId)",
    async ({ key, tableId }) => {
      const user = userEvent.setup();
      const onColumnStateChange = vi.fn();
      const data = [
        { id: 1, [key]: "Adam" },
        { id: 2, [key]: "Běla" },
      ];
      const props = {
        clientSide: true,
        columns: [{ key, label: "Value", filter: "input" as const }],
        data,
        onColumnStateChange,
        resizableColumns: true,
        tableId,
      };
      expect(renderToString(<DataTable {...props} />)).toContain("Adam");
      const { unmount } = render(<DataTable {...props} />);
      expect(screen.getByRole("cell", { name: "Adam" })).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Value" }).style.width,
      ).toBe("");

      await user.click(screen.getByRole("button", { name: "Columns" }));
      expect(
        screen.getByRole("button", { name: "Reset columns" }),
      ).toBeDisabled();
      await user.click(
        screen.getByRole("button", { name: "Pin Value to the left" }),
      );
      expect(onColumnStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ pinning: { [key]: "left" } }),
      );
      expect(screen.getByRole("columnheader", { name: "Value" })).toHaveClass(
        "sticky",
      );
      await user.click(screen.getByRole("switch", { name: "Value" }));
      expect(
        screen.queryByRole("cell", { name: "Adam" }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole("switch", { name: "Value" }));
      await user.click(screen.getByRole("button", { name: "Reset columns" }));
      expect(
        screen.getByRole("columnheader", { name: "Value" }),
      ).not.toHaveClass("sticky");
      await user.keyboard("{Escape}");

      await user.type(
        screen.getByRole("searchbox", { name: "Filter Value" }),
        "Adam",
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("cell", { name: "Běla" }),
        ).not.toBeInTheDocument(),
      );
      screen.getByRole("separator", { name: "Resize Value" }).focus();
      await user.keyboard("{Home}");
      expect(screen.getByRole("columnheader", { name: "Value" })).toHaveStyle({
        width: "50px",
      });
      expect(onColumnStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ widths: { [key]: 50 } }),
      );
      unmount();
      render(<DataTable {...props} />);
      expect(screen.getByRole("cell", { name: "Běla" })).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Value" }).style.width,
      ).toBe(tableId ? "50px" : "");
    },
  );

  it("keeps prototype names in grouped columns and summaries", () => {
    render(
      <DataTable
        columns={[
          { key: "constructor", label: "Name" },
          {
            key: "__proto__",
            label: "Amounts",
            children: [
              { key: "__proto__", label: "Amount", summary: "sum", width: 120 },
            ],
          },
        ]}
        data={[{ id: 1, constructor: "Adam", ["__proto__"]: 42 }]}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "Amounts" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toHaveStyle({
      width: "120px",
    });
    expect(screen.getByRole("cell", { name: "Adam" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "42" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /Sum\s*42/ })).toBeInTheDocument();
  });

  it("describes a header by its info with spaces in the key", () => {
    render(
      <DataTable
        columns={[
          { key: "first name", label: "Name", labelInfo: "Full legal name" },
        ]}
        data={[{ id: 1, "first name": "Adam" }]}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toHaveAccessibleDescription("Full legal name");
  });

  it.each(["constructor", "toString", "__proto__"])(
    "keeps the filter %s through a URL round trip",
    (key) => {
      const query = setFilter(createDataTableQuery(), key, {
        from: "10",
        to: "20",
      });
      expect(Object.hasOwn(query.filters, key)).toBe(true);
      const restored = readQueryFromSearch(writeQueryToSearch("", query));
      expect(Object.hasOwn(restored.filters, key)).toBe(true);
      expect(restored.filters[key]).toEqual({ from: "10", to: "20" });
      expect(Object.keys(setFilter(restored, key, "").filters)).toEqual([]);
    },
  );

  it("moves columns with quotes and backslashes in their keys from the keyboard", async () => {
    const user = userEvent.setup();
    // A selector made of the key threw in the next animation frame
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    render(<DataTable columns={columns} data={rows} />);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    const city = screen.getByRole("button", { name: "Move City (arrow keys)" });
    city.focus();
    await user.keyboard("{ArrowDown}");
    expect(headers()).toEqual(["Name", "Path", "City"]);
    // The row moved and lost the focus - its handle gets it back
    screen.getByRole("button", { name: "Reset columns" }).focus();
    expect(() => frames.forEach((frame) => frame(0))).not.toThrow();
    await waitFor(() => expect(city).toHaveFocus());

    const path = screen.getByRole("button", { name: "Move Path (arrow keys)" });
    path.focus();
    await user.keyboard("{ArrowUp}");
    expect(headers()).toEqual(["Path", "Name", "City"]);
    screen.getByRole("button", { name: "Reset columns" }).focus();
    expect(() => frames.forEach((frame) => frame(0))).not.toThrow();
    expect(path).toHaveFocus();
  });
});
