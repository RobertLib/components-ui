import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/ui/cs";
import { en } from "../../../i18n/ui/en";
import UIProvider from "../../../providers/ui-provider";
import { createTsv } from "./csv";
import type { Column } from "./types";

interface Row {
  active: boolean;
  id: number;
  name: string;
  note: string;
  salary: number;
}

const rows: Row[] = [
  { active: true, id: 1, name: "Cecílie", note: "VIP", salary: 1200.5 },
  { active: false, id: 2, name: "Adam", note: "", salary: 900 },
  { active: true, id: 3, name: "Běla", note: "nová", salary: 1000 },
];

const columns: Column<Row>[] = [
  { editable: true, key: "name", label: "Name", sortable: true },
  { key: "active", label: "Active" },
  {
    exportValue: (row) => row.salary,
    key: "salary",
    label: "Salary",
    render: (row) => `${row.salary} CZK`,
  },
  { key: "note", label: "Note", visible: false },
];

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");
const rowCheckbox = (index: number) =>
  within(bodyRows()[index]).getByRole("checkbox");
/** The text announced in the polite live region of the table. */
const announced = async (text: string) => {
  const message = await screen.findByText(text);
  expect(message.closest("[aria-live='polite']")).toHaveClass("sr-only");
};

describe("DataTable copying with Ctrl + C", () => {
  it("copies the selected rows - the visible columns, as the cells show them, in their order", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ sortBy: "name" }}
        selectionMode="multiple"
      />,
    );

    // Selected in another order than they are shown
    await user.click(rowCheckbox(2));
    await user.click(rowCheckbox(0));
    await user.keyboard("{Control>}c{/Control}");

    expect(await navigator.clipboard.readText()).toBe(
      "Name\tActive\tSalary\nAdam\tNo\t900\nCecílie\tYes\t1200.5",
    );
    await announced("2 rows copied.");
  });

  it("writes numbers and says it in Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable columns={columns} data={rows} defaultSelectedIds={[1, 3]} />
      </UIProvider>,
    );

    act(() => rowCheckbox(0).focus());
    await user.keyboard("{Control>}c{/Control}");

    expect(await navigator.clipboard.readText()).toBe(
      "Name\tActive\tSalary\nCecílie\tAno\t1200,5\nBěla\tAno\t1000",
    );
    await announced("Zkopírovány 2 řádky.");
  });

  it("copies all rows matching the filters of an all-filtered selection", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 1 }}
        filteredSelection
        selectionMode="multiple"
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Select all 3 rows" }));
    await user.keyboard("{Control>}c{/Control}");

    expect((await navigator.clipboard.readText()).split("\n")).toHaveLength(4);
    await announced("3 rows copied.");
  });

  it("copies the focused cell when no row is selected", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={rows}
        onCellEdit={() => {}}
        selectionMode="multiple"
      />,
    );

    const cell = screen.getByText("Adam").closest("td") as HTMLElement;
    act(() => cell.focus());
    await user.keyboard("{Control>}c{/Control}");

    expect(await navigator.clipboard.readText()).toBe("Adam");
    await announced("Cell copied.");
  });

  it("copies a focused row without the names of the columns", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} onRowClick={() => {}} />);

    act(() => bodyRows()[1].focus());
    await user.keyboard("{Control>}c{/Control}");

    expect(await navigator.clipboard.readText()).toBe("Adam\tNo\t900");
    await announced("1 row copied.");
  });

  it("leaves a field and a text the user selected to the browser", async () => {
    // The clipboard of user-event
    userEvent.setup();
    await navigator.clipboard.writeText("before");
    render(
      <DataTable
        columns={[{ ...columns[0], filter: "input" }]}
        data={rows}
        defaultSelectedIds={[1]}
      />,
    );

    const field = screen.getByRole("searchbox", { name: "Filter Name" });
    act(() => field.focus());
    expect(fireEvent.keyDown(field, { ctrlKey: true, key: "c" })).toBe(true);

    act(() => rowCheckbox(0).focus());
    const selection = document.getSelection() as Selection;
    selection.selectAllChildren(screen.getByText("Adam"));
    expect(fireEvent.keyDown(rowCheckbox(0), { ctrlKey: true, key: "c" })).toBe(
      true,
    );
    selection.removeAllRanges();

    expect(await navigator.clipboard.readText()).toBe("before");
  });

  it("copies nothing with nothing selected or focused, or with copyable={false}", async () => {
    const user = userEvent.setup();
    await navigator.clipboard.writeText("before");
    const { rerender } = render(<DataTable columns={columns} data={rows} />);

    const button = screen.getByRole("button", { name: "Columns" });
    act(() => button.focus());
    expect(fireEvent.keyDown(button, { ctrlKey: true, key: "c" })).toBe(true);

    rerender(
      <DataTable
        columns={columns}
        copyable={false}
        data={rows}
        defaultSelectedIds={[1]}
      />,
    );
    act(() => rowCheckbox(0).focus());
    await user.keyboard("{Control>}c{/Control}");

    expect(await navigator.clipboard.readText()).toBe("before");
  });

  it("calls an onKeyDown given to it first - preventing the default keeps the rows", () => {
    const onKeyDown = vi.fn((event: React.KeyboardEvent) =>
      event.preventDefault(),
    );
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(
      <DataTable
        columns={columns}
        data={rows}
        defaultSelectedIds={[1]}
        onKeyDown={onKeyDown}
      />,
    );

    fireEvent.keyDown(rowCheckbox(0), { ctrlKey: true, key: "c" });

    expect(onKeyDown).toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("announces a failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Denied"),
    );
    document.execCommand = () => false;
    render(
      <DataTable columns={columns} data={rows} defaultSelectedIds={[2]} />,
    );

    act(() => rowCheckbox(1).focus());
    await user.keyboard("{Control>}c{/Control}");

    await announced("Copying failed.");
  });
});

describe("createTsv", () => {
  it("quotes only a field with a tab, a line break or a quote", () => {
    expect(
      createTsv(
        [
          {
            id: 1,
            name: 'Novák, "Jan"',
            note: "first\nsecond",
            tag: "a;b",
          },
        ],
        [
          { key: "name", label: "Name" },
          { key: "note", label: "Note" },
          { key: "tag", label: "Tag\tline" },
        ],
        { locale: en },
      ),
    ).toBe('Name\tNote\t"Tag\tline"\n"Novák, ""Jan"""\t"first\nsecond"\ta;b');
  });

  it("keeps a text from starting a formula and leaves out the names on request", () => {
    expect(
      createTsv(
        [{ id: 1, value: "=1+2" }],
        [{ key: "value", label: "Value" }],
        { header: false, locale: en },
      ),
    ).toBe("'=1+2");
  });
});
