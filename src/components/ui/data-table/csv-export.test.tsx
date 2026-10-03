import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/cs";
import UIProvider from "../../../providers/ui-provider";
import type { Column } from "./types";

interface Row {
  active: boolean;
  id: number;
  name: string;
  salary: number;
  team: string;
}

const rows: Row[] = [
  { active: true, id: 1, name: "Cecilie", salary: 1200.5, team: "B" },
  { active: false, id: 2, name: "Adam", salary: 900, team: "A" },
  { active: true, id: 3, name: "Běla", salary: 1000, team: "A" },
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
  { key: "active", label: "Active" },
  {
    exportValue: (row) => row.salary,
    key: "salary",
    label: "Salary",
    render: (row) => `${row.salary} CZK`,
  },
];

// The files the table saves - read from the blobs it hands to the browser
let files: { name: string; text: () => Promise<string> }[] = [];

beforeEach(() => {
  files = [];
  let blob: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (object: Blob) => {
      blob = object;
      return "blob:csv";
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const saved = blob as Blob;
    files.push({
      name: this.download,
      // Without the BOM
      text: async () => (await saved.text()).replace(/^﻿/, ""),
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const exportButton = () =>
  screen.getByRole("button", { name: "Export to CSV" });

describe("DataTable CSV export", () => {
  it("is not offered unless asked for", () => {
    render(<DataTable clientSide columns={columns} data={rows} />);

    expect(screen.queryByRole("button", { name: "Export to CSV" })).toBeNull();
  });

  it("exports every matching row of a clientSide table, sorted, as the cells show them", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { team: "A" }, pageSize: 1, sortBy: "name" }}
        enableCsvExport
        exportFilename="people"
      />,
    );

    await user.click(exportButton());

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("people.csv");
    // Both pages of the filter, sorted by name
    expect(await files[0].text()).toBe(
      "Name,Team,Active,Salary\r\nAdam,A,No,900\r\nBěla,A,Yes,1000",
    );
  });

  it("exports the visible columns in their order", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows.slice(0, 1)}
        enableCsvExport
      />,
    );

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Team" }));
    await user.click(
      screen.getByRole("button", { name: "Pin Salary to the left" }),
    );
    await user.keyboard("{Escape}");
    await user.click(exportButton());

    expect(files[0].name).toBe("export.csv");
    expect(await files[0].text()).toBe(
      "Salary,Name,Active\r\n1200.5,Cecilie,Yes",
    );
  });

  it("writes for the spreadsheets of the language", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable
          clientSide
          columns={columns}
          data={rows.slice(0, 1)}
          enableCsvExport
        />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Exportovat do CSV" }));

    expect(await files[0].text()).toBe(
      "Name;Team;Active;Salary\r\nCecilie;B;Ano;1200,5",
    );
  });

  it("takes another separator", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns.slice(0, 2)}
        csvSeparator=";"
        data={rows.slice(0, 1)}
        enableCsvExport
      />,
    );

    await user.click(exportButton());

    expect(await files[0].text()).toBe("Name;Team\r\nCecilie;B");
  });

  it("asks onExport for all rows of the query with server data", async () => {
    const user = userEvent.setup();
    let resolve!: (rows: Row[]) => void;
    const onExport = vi.fn(
      () =>
        new Promise<Row[]>((done) => {
          resolve = done;
        }),
    );
    render(
      <DataTable
        columns={columns.slice(0, 2)}
        data={rows.slice(0, 1)}
        defaultQuery={{ filters: { team: "A" } }}
        onExport={onExport}
        total={3}
      />,
    );

    await user.click(exportButton());

    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { team: "A" } }),
    );
    // A spinner while the rows load - the button keeps the focus
    expect(exportButton()).toHaveAttribute("aria-busy", "true");
    expect(exportButton()).toHaveAttribute("aria-disabled", "true");
    expect(exportButton()).not.toBeDisabled();

    // One export at a time
    await user.click(exportButton());
    expect(onExport).toHaveBeenCalledTimes(1);

    await act(async () => resolve(rows.slice(1)));

    expect(exportButton()).not.toHaveAttribute("aria-busy");
    expect(await files[0].text()).toBe("Name,Team\r\nAdam,A\r\nBěla,A");
  });

  it("saves nothing when onExport fails", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <DataTable
        columns={columns}
        data={rows}
        onExport={() => Promise.reject(new Error("Server down"))}
      />,
    );

    await user.click(exportButton());

    await waitFor(() =>
      expect(exportButton()).not.toHaveAttribute("aria-busy"),
    );
    expect(files).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith(
      "The CSV export failed",
      expect.any(Error),
    );
  });

  it("exports the loaded rows of a server table without onExport", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns.slice(0, 1)}
        data={rows.slice(0, 2)}
        enableCsvExport
        total={3}
      />,
    );

    await user.click(exportButton());

    expect(await files[0].text()).toBe("Name\r\nCecilie\r\nAdam");
  });

  it.each([false, true])(
    "exports the displayed rollback after an optimistic save fails (getValue: %s)",
    async (useGetter) => {
      const user = userEvent.setup();
      vi.spyOn(console, "error").mockImplementation(() => {});
      let currentRow = rows[0];

      function OptimisticTable() {
        const [data, setData] = useState([rows[0]]);
        return (
          <DataTable
            columns={[
              {
                editable: true,
                getValue: useGetter ? (row) => row.name : undefined,
                key: useGetter ? "displayName" : "name",
                label: "Name",
              },
            ]}
            data={data}
            enableCsvExport
            onCellEdit={async (row, _key, value) => {
              currentRow = { ...row, name: String(value) };
              setData([currentRow]);
              throw new Error("The name is taken.");
            }}
          />
        );
      }
      render(<OptimisticTable />);

      await user.dblClick(screen.getByRole("cell", { name: "Cecilie" }));
      const field = screen.getByRole("textbox", { name: "Name" });
      await user.clear(field);
      await user.type(field, "Refused{Enter}");
      await waitFor(() =>
        expect(screen.getByRole("cell")).toHaveTextContent(
          /^CecilieThe name is taken\.$/,
        ),
      );
      await user.click(exportButton());

      expect(await files[0].text()).toBe("Name\r\nCecilie");
      // Exporting does not rewrite the caller's optimistic data.
      expect(currentRow.name).toBe("Refused");
    },
  );

  it("exports pending and confirmed cell values before data is refreshed", async () => {
    const user = userEvent.setup();
    let resolve!: (value: { value: string }) => void;
    render(
      <DataTable
        columns={[{ editable: true, key: "name", label: "Name" }]}
        data={[rows[0]]}
        enableCsvExport
        onCellEdit={() =>
          new Promise<{ value: string }>((done) => {
            resolve = done;
          })
        }
      />,
    );

    await user.dblClick(screen.getByRole("cell", { name: "Cecilie" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    await user.clear(field);
    await user.type(field, "Draft{Enter}");
    await user.click(exportButton());

    expect(await files[0].text()).toBe("Name\r\nDraft");

    await act(async () => resolve({ value: "Confirmed" }));
    expect(screen.getByRole("cell")).toHaveTextContent("Confirmed");
    await user.click(exportButton());

    expect(await files[1].text()).toBe("Name\r\nConfirmed");
    expect(rows[0].name).toBe("Cecilie");
  });

  it("keeps an explicit exportValue in charge of an edited column", async () => {
    const user = userEvent.setup();
    const exportValue = vi.fn((row: Row) => `Stored: ${row.name}`);
    render(
      <DataTable
        columns={[{ editable: true, exportValue, key: "name", label: "Name" }]}
        data={[rows[0]]}
        enableCsvExport
        onCellEdit={() => ({ value: "Confirmed" })}
      />,
    );

    await user.dblClick(screen.getByRole("cell", { name: "Cecilie" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    await user.clear(field);
    await user.type(field, "Draft{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("cell")).toHaveTextContent("Confirmed"),
    );
    await user.click(exportButton());

    expect(await files[0].text()).toBe("Name\r\nStored: Cecilie");
    expect(exportValue).toHaveBeenCalledWith(rows[0]);
  });

  it("keeps rows fetched by onExport authoritative while an edit is pending", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    render(
      <DataTable
        columns={[{ editable: true, key: "name", label: "Name" }]}
        data={[rows[0]]}
        onCellEdit={() =>
          new Promise<void>((done) => {
            resolve = done;
          })
        }
        onExport={() => [{ ...rows[0], name: "Exported by server" }]}
      />,
    );

    await user.dblClick(screen.getByRole("cell", { name: "Cecilie" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    await user.clear(field);
    await user.type(field, "Draft{Enter}");
    await user.click(exportButton());

    expect(await files[0].text()).toBe("Name\r\nExported by server");
    await act(async () => resolve());
  });
});
