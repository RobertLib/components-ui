import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  uuid: string;
  name: string;
  allowed: boolean;
  rank: number;
}
const data: Row[] = [
  { uuid: "alpha", name: "Alpha", allowed: true, rank: 3 },
  { uuid: "beta", name: "Beta", allowed: false, rank: 2 },
  { uuid: "gamma", name: "Gamma", allowed: true, rank: 1 },
];
const getRowId = (row: Row) => row.uuid;
const columns: Column<Row>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    sortFn: (a, b) => a.rank - b.rank,
  },
];
const allowed = (row: Row) => row.allowed;

describe("DataTable extended API", () => {
  it("selects only eligible filtered rows across client pages", async () => {
    const action = vi.fn(() => false);
    render(
      <DataTable
        clientSide
        columns={columns}
        data={data}
        defaultQuery={{ pageSize: 1 }}
        filteredSelection
        getRowId={getRowId}
        groupActions={[{ label: "Archive", onClick: action }]}
        isRowSelectable={allowed}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 2 rows" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      screen.getByRole("checkbox", { name: "Select row Beta" }),
    ).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      screen.getByRole("checkbox", { name: "Select row Gamma" }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(action).toHaveBeenCalledWith(
      [data[0], data[2]],
      expect.objectContaining({
        allFiltered: true,
        count: 2,
        ids: ["alpha", "gamma"],
      }),
    );
  });

  it("requires an eligible server total for all-filtered selection", async () => {
    const props = {
      columns,
      data,
      filteredSelection: true,
      getRowId,
      groupActions: [{ label: "Archive", onClick: () => false }],
      isRowSelectable: allowed,
      total: 100,
    };
    const { rerender } = render(<DataTable {...props} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(
      screen.queryByRole("button", { name: "Select all 100 rows" }),
    ).toBeNull();
    rerender(<DataTable {...props} filteredSelection={{ total: 80 }} />);
    expect(
      screen.getByRole("button", { name: "Select all 80 rows" }),
    ).toBeInTheDocument();
  });

  it("reports serialization failures as export errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Invalid export value");
    const onExportError = vi.fn();
    render(
      <DataTable
        columns={[
          {
            ...columns[0],
            exportValue: () => {
              throw error;
            },
          },
        ]}
        data={data}
        enableCsvExport
        getRowId={getRowId}
        onExportError={onExportError}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Export to CSV" }));
    expect(onExportError).toHaveBeenCalledWith(error);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("uses custom identities for selection and skips ineligible rows", async () => {
    const user = userEvent.setup();
    const onSelectedIdsChange = vi.fn();
    const action = vi.fn(() => false);
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={getRowId}
        groupActions={[{ label: "Archive", onClick: action }]}
        isRowSelectable={allowed}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Select row Beta" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      ["alpha", "gamma"],
      expect.objectContaining({ count: 2, rows: [data[0], data[2]] }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(action).toHaveBeenCalledWith(
      [data[0], data[2]],
      expect.objectContaining({ ids: ["alpha", "gamma"] }),
    );
  });

  it("filters an ineligible controlled selection from action payloads", async () => {
    const action = vi.fn(() => false);
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={getRowId}
        groupActions={[{ label: "Archive", onClick: action }]}
        isRowSelectable={allowed}
        selectedIds={["alpha", "beta"]}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Select row Beta" }),
    ).not.toBeChecked();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Archive" }));
    expect(action).toHaveBeenCalledWith(
      [data[0]],
      expect.objectContaining({ count: 1, ids: ["alpha"] }),
    );
  });

  it("skips disabled rows in a Shift selection range", () => {
    const onSelectedIdsChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={getRowId}
        groupActions={[{ label: "Archive", onClick: () => false }]}
        isRowSelectable={allowed}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row Alpha" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select row Gamma" }),
      { shiftKey: true },
    );
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(
      ["alpha", "gamma"],
      expect.anything(),
    );
  });

  it("disables select-all when no row is eligible", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        defaultSelectedIds={["beta"]}
        getRowId={getRowId}
        groupActions={[{ label: "Archive", onClick: () => false }]}
        isRowSelectable={() => false}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Select all rows" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });

  it("sorts using the row comparator in both directions", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={data}
        getRowId={getRowId}
      />,
    );
    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getByRole("cell").textContent);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(names()).toEqual(["Gamma", "Beta", "Alpha"]);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(names()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("keeps details controlled and reports the requested set", async () => {
    const onExpandedIdsChange = vi.fn();
    const props = {
      columns,
      data,
      getRowId,
      onExpandedIdsChange,
      renderSubRow: (row: Row) => `Detail ${row.name}`,
    };
    const { rerender } = render(
      <DataTable {...props} expandedIds={["alpha"]} />,
    );
    expect(screen.getByText("Detail Alpha")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Expand row Gamma" }));
    expect(onExpandedIdsChange).toHaveBeenCalledWith(["alpha", "gamma"]);
    expect(screen.queryByText("Detail Gamma")).toBeNull();
    rerender(<DataTable {...props} expandedIds={["gamma"]} />);
    expect(screen.queryByText("Detail Alpha")).toBeNull();
    expect(screen.getByText("Detail Gamma")).toBeInTheDocument();
  });

  it("starts with default expanded identities and toggles independently", async () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        defaultExpandedIds={["gamma"]}
        getRowId={getRowId}
        renderSubRow={(row) => `Detail ${row.name}`}
      />,
    );
    expect(screen.getByText("Detail Gamma")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Collapse row Gamma" }));
    expect(screen.queryByText("Detail Gamma")).toBeNull();
  });

  it("reports CSV rejection with visible feedback and clears it on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("Offline");
    const onExport = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce([]);
    const onExportError = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:csv");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={getRowId}
        onExport={onExport}
        onExportError={onExportError}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Export to CSV" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The export could not be completed",
    );
    expect(onExportError).toHaveBeenCalledWith(failure);
    await user.click(screen.getByRole("button", { name: "Export to CSV" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
