import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  active: boolean;
  age: number;
  id: number;
  joined: Date;
  name: string;
  team: string;
}

const rows: Row[] = [
  {
    active: true,
    age: 30,
    id: 1,
    joined: new Date(2026, 8, 24),
    name: "Adam",
    team: "A",
  },
  {
    active: false,
    age: 41,
    id: 2,
    joined: new Date(2025, 0, 5),
    name: "Běla",
    team: "B",
  },
];

const teamOptions = [
  { label: "Team A", value: "A" },
  { label: "Team B", value: "B" },
];

const columns: Column<Row>[] = [
  {
    editable: true,
    key: "name",
    label: "Name",
    validate: (value) => (String(value).trim() ? undefined : "Enter a name."),
  },
  { editable: true, key: "age", label: "Age" },
  { editable: true, editorOptions: teamOptions, key: "team", label: "Team" },
  { editable: true, key: "active", label: "Active" },
  { editable: true, key: "joined", label: "Joined" },
];

/** A cell of the body - the head may have a row of filters too. */
const cell = (row: number, column: number) =>
  within(
    within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row")[row],
  ).getAllByRole("cell")[column];

/** A table that saves the edits into its rows, like an app would. */
function EditableTable({
  onCellEdit,
  ...props
}: Partial<React.ComponentProps<typeof DataTable<Row>>> & {
  onCellEdit: (row: Row, key: string, value: unknown) => void | Promise<void>;
}) {
  const [data, setData] = useState(rows);

  return (
    <DataTable
      columns={columns}
      data={data}
      onCellEdit={async (row, key, value) => {
        await onCellEdit(row, key, value);
        setData((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, [key]: value } : item,
          ),
        );
      }}
      {...props}
    />
  );
}

describe("DataTable inline editing", () => {
  it("edits a cell from the keyboard - Enter starts, Enter saves", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableTable onCellEdit={onCellEdit} />);

    cell(0, 0).focus();
    await user.keyboard("{Enter}");

    const field = screen.getByRole("textbox", { name: "Name" });
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Adam");

    await user.clear(field);
    await user.type(field, "Adam Novák{Enter}");

    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "name", "Adam Novák");
    await waitFor(() => expect(cell(0, 0)).toHaveTextContent("Adam Novák"));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(cell(0, 0)).toHaveFocus();
  });

  it("starts editing with F2 and with a double-click", async () => {
    const user = userEvent.setup();
    render(<EditableTable onCellEdit={vi.fn()} />);

    cell(1, 0).focus();
    await user.keyboard("{F2}");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Běla");

    await user.keyboard("{Escape}");
    await user.dblClick(cell(0, 1));
    expect(screen.getByRole("spinbutton", { name: "Age" })).toHaveValue(30);
  });

  it("starts editing on a tap of the focused cell", () => {
    render(<EditableTable onCellEdit={vi.fn()} />);

    // The first tap focuses the cell, the next one edits it
    cell(0, 0).focus();
    fireEvent.pointerDown(cell(0, 0), { pointerType: "touch" });
    fireEvent.click(cell(0, 0));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });

  it("cancels with Escape - which leaves a full screen table alone", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableTable onCellEdit={onCellEdit} />);

    const fullScreen = screen.getByRole("button", {
      name: "Toggle full screen",
    });
    await user.click(fullScreen);

    cell(0, 0).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("Something{Escape}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(cell(0, 0)).toHaveTextContent("Adam");
    expect(cell(0, 0)).toHaveFocus();
    expect(fullScreen).toHaveAttribute("aria-pressed", "true");
  });

  it("saves and edits the next editable cell on Tab, the previous one on Shift+Tab", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableTable onCellEdit={onCellEdit} />);

    cell(0, 0).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Control>}a{/Control}Anna{Tab}");

    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "name", "Anna");
    expect(screen.getByRole("spinbutton", { name: "Age" })).toHaveFocus();

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Anna");

    // Past the last column - on the next row
    await user.keyboard("{Escape}");
    await user.dblClick(cell(0, 4));
    await user.keyboard("{Tab}");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Běla");
  });

  it("keeps an invalid value in the field with the message", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableTable onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 0));
    const field = screen.getByRole("textbox", { name: "Name" });
    await user.clear(field);
    await user.keyboard("{Enter}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Enter a name.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name.");

    // The message follows the value
    await user.type(field, "Eva");
    expect(screen.queryByRole("alert")).toBeNull();

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "name", "Eva");
  });

  it("shows the new value while saving, and the old one with the message when saving fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail!: (reason: unknown) => void;
    const onCellEdit = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    render(<DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Eva{Enter}");

    expect(cell(0, 0)).toHaveTextContent("Eva");
    expect(cell(0, 0)).toHaveAttribute("aria-busy", "true");
    expect(within(cell(0, 0)).getByRole("status")).toHaveTextContent("Saving…");
    // No second edit while the first one is on its way
    await user.dblClick(cell(0, 0));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();

    await act(async () => fail(new Error("The name is taken.")));

    expect(cell(0, 0)).not.toHaveAttribute("aria-busy");
    expect(cell(0, 0)).toHaveTextContent("Adam");
    expect(within(cell(0, 0)).getByRole("alert")).toHaveTextContent(
      "The name is taken.",
    );

    // Another try forgets the message; a failure without one says so generally
    await user.dblClick(cell(0, 0));
    expect(within(cell(0, 0)).queryByRole("alert")).toBeNull();
    await user.keyboard("{Control>}a{/Control}Iva{Enter}");
    await act(async () => fail(undefined));

    expect(within(cell(0, 0)).getByRole("alert")).toHaveTextContent(
      "The change could not be saved.",
    );
  });

  it("shows the old value and the message when an optimistic update fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // The app shows the change at once, then saves it
    function OptimisticTable() {
      const [data, setData] = useState(rows);
      return (
        <DataTable
          columns={columns}
          data={data}
          onCellEdit={async (row, key, value) => {
            setData((current) =>
              current.map((item) =>
                item.id === row.id ? { ...item, [key]: value } : item,
              ),
            );
            await Promise.reject(new Error("The name is taken."));
          }}
        />
      );
    }
    render(<OptimisticTable />);

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Eva{Enter}");

    await waitFor(() =>
      expect(within(cell(0, 0)).getByRole("alert")).toHaveTextContent(
        "The name is taken.",
      ),
    );
    expect(cell(0, 0)).toHaveTextContent(/^AdamThe name is taken\.$/);
    // Editing starts from the value shown
    await user.dblClick(cell(0, 0));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Adam");
  });

  it("keeps a save on its way over new rows of a refetch", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail!: (reason: unknown) => void;
    const onCellEdit = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const { rerender } = render(
      <DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />,
    );

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Eva{Enter}");

    // A poll brings new objects of the same rows meanwhile
    const polled = rows.map((row) => ({ ...row }));
    rerender(
      <DataTable columns={columns} data={polled} onCellEdit={onCellEdit} />,
    );

    expect(cell(0, 0)).toHaveAttribute("aria-busy", "true");
    expect(cell(0, 0)).toHaveTextContent("Eva");
    await user.dblClick(cell(0, 0));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();

    await act(async () => fail(new Error("Offline")));

    expect(cell(0, 0)).not.toHaveAttribute("aria-busy");
    expect(cell(0, 0)).toHaveTextContent("Adam");
    expect(within(cell(0, 0)).getByRole("alert")).toHaveTextContent("Offline");
  });

  it("shows a saved value over a refetch that does not have it yet", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onCellEdit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = render(
      <DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />,
    );

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Eva{Enter}");
    const polled = rows.map((row) => ({ ...row }));
    rerender(
      <DataTable columns={columns} data={polled} onCellEdit={onCellEdit} />,
    );
    await act(async () => finish());

    // Until the app gives the table rows with the saved value
    expect(cell(0, 0)).toHaveTextContent("Eva");
    const updated = polled.map((row, index) =>
      index === 0 ? { ...row, name: "Eva" } : row,
    );
    rerender(
      <DataTable columns={columns} data={updated} onCellEdit={onCellEdit} />,
    );
    expect(cell(0, 0)).toHaveTextContent("Eva");
  });

  it("keeps an edited row in place while its next cell is edited", async () => {
    const user = userEvent.setup();
    const saves: (() => void)[] = [];
    const onCellEdit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          saves.push(resolve);
        }),
    );
    const people = [
      { email: "adam@example.com", id: 1, name: "Adam" },
      { email: "bela@example.com", id: 2, name: "Běla" },
      { email: "cyril@example.com", id: 3, name: "Cyril" },
    ];
    const editable: Column<(typeof people)[number]>[] = [
      { editable: true, key: "name", label: "Name", sortable: true },
      { editable: true, key: "email", label: "Email" },
    ];

    // Saves into the rows once the server is done - the sorted page changes
    function SortedTable() {
      const [data, setData] = useState(people);
      return (
        <DataTable
          clientSide
          columns={editable}
          data={data}
          defaultQuery={{ pageSize: 2, sortBy: "name" }}
          onCellEdit={async (row, key, value) => {
            await onCellEdit();
            setData((current) =>
              current.map((item) =>
                item.id === row.id ? { ...item, [key]: value } : item,
              ),
            );
          }}
        />
      );
    }
    render(<SortedTable />);

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Zzzz Moved{Tab}");
    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveFocus();

    // The rename is saved - the row sorts past the page, but not while its
    // email is edited
    await act(async () => saves[0]());
    expect(email).toHaveFocus();
    expect(cell(0, 0)).toHaveTextContent("Zzzz Moved");

    await user.keyboard("{Control>}a{/Control}moved@example.com{Enter}");
    expect(onCellEdit).toHaveBeenCalledTimes(2);

    // Done editing - the rows take their order, and the focus stays in the
    // table, at the same place
    await act(async () => saves[1]());
    expect(cell(0, 0)).toHaveTextContent("Běla");
    expect(document.activeElement).toBe(cell(0, 1));
  });

  it("saves a field left for a control that ends the editing", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />,
    );

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Iva");
    // The focus leaves, and the table goes away before the field notices
    act(() => (document.activeElement as HTMLElement).blur());
    rerender(<p>Elsewhere</p>);

    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "name", "Iva");
  });

  it("edits numbers, options, booleans and dates as such", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 1));
    await user.clear(screen.getByRole("spinbutton", { name: "Age" }));
    await user.keyboard("42{Enter}");
    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], "age", 42);

    await user.dblClick(cell(0, 2));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Team" }),
      "Team B",
    );
    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], "team", "B");

    // A checkbox saves at once
    await user.dblClick(cell(0, 3));
    await user.keyboard(" ");
    expect(onCellEdit).toHaveBeenLastCalledWith(rows[0], "active", false);

    await user.dblClick(cell(1, 4));
    const date = screen.getByRole("combobox", { name: "Joined" });
    expect(date).toHaveValue("01/05/2025");
    await user.keyboard("{Control>}a{/Control}09/25/2026{Enter}");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      rows[1],
      "joined",
      new Date(2026, 8, 25),
    );
    expect(cell(1, 4)).toHaveFocus();
  });

  it("takes Enter in an open date picker for the picker, the next one saves", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 4));
    const date = screen.getByRole("combobox", { name: "Joined" });
    // A click opens the popup
    await user.click(date);
    expect(date).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Control>}a{/Control}10/01/2026{Enter}");
    expect(date).toHaveAttribute("aria-expanded", "false");
    expect(onCellEdit).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(
      rows[0],
      "joined",
      new Date(2026, 9, 1),
    );
  });

  it("keeps the time of a date-time when only its day is edited", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const events = [
      { id: 1, at: new Date(2026, 8, 24, 14, 30), utc: "2026-09-24T14:30:00Z" },
    ];
    render(
      <>
        <DataTable
          columns={[
            { editable: true, editor: "date", key: "at", label: "At" },
            { editable: true, filter: "date", key: "utc", label: "UTC" },
          ]}
          data={events}
          onCellEdit={onCellEdit}
        />
        <button type="button">Elsewhere</button>
      </>,
    );

    // Opened and left without a change - nothing to save
    await user.dblClick(cell(0, 0));
    await user.keyboard("{Enter}");
    await user.dblClick(cell(0, 0));
    await user.keyboard("{Tab}{Escape}");
    await user.dblClick(cell(0, 1));
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onCellEdit).not.toHaveBeenCalled();

    // Another day - at the same time
    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}09/25/2026{Enter}");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      events[0],
      "at",
      new Date(2026, 8, 25, 14, 30),
    );

    // A text keeps its time and zone
    await user.dblClick(cell(0, 1));
    await user.keyboard("{Control>}a{/Control}10/01/2026{Enter}");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      events[0],
      "utc",
      "2026-10-01T14:30:00Z",
    );
  });

  it("takes a typed date on Tab and Shift+Tab", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 4));
    await user.keyboard("{Control>}a{/Control}09/30/2026{Tab}");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      rows[0],
      "joined",
      new Date(2026, 8, 30),
    );
    // On to the first cell of the next row
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Běla");

    await user.keyboard("{Escape}");
    await user.dblClick(cell(1, 4));
    await user.keyboard("{Control>}a{/Control}01/02/2027{Shift>}{Tab}{/Shift}");
    expect(onCellEdit).toHaveBeenLastCalledWith(
      rows[1],
      "joined",
      new Date(2027, 0, 2),
    );
    expect(screen.getByRole("checkbox", { name: "Active" })).toHaveFocus();
  });

  it("picks the field of an empty cell by the values of its column", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const sparse = [
      { age: null, id: 1, member: null },
      { age: 41, id: 2, member: true },
    ];
    render(
      <DataTable
        columns={[
          { editable: true, key: "age", label: "Age" },
          { editable: true, key: "member", label: "Member" },
        ]}
        data={sparse}
        onCellEdit={onCellEdit}
      />,
    );

    await user.dblClick(cell(0, 0));
    await user.keyboard("42{Enter}");
    expect(onCellEdit).toHaveBeenLastCalledWith(sparse[0], "age", 42);

    await user.dblClick(cell(0, 1));
    expect(screen.getByRole("checkbox", { name: "Member" })).not.toBeChecked();
  });

  it("scrolls a focused pinned cell only up or down", () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    render(
      <DataTable
        columns={[{ ...columns[0], pinned: "left" }, columns[1]]}
        data={rows}
        onCellEdit={vi.fn()}
      />,
    );

    // A sticky cell is in view sideways anyway - scrolling it into view
    // would scroll the table to where it would be without sticking
    act(() => cell(0, 0).focus());
    expect(scrollIntoView).not.toHaveBeenCalled();

    act(() => cell(0, 1).focus());
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "nearest",
    });
  });

  it("saves when the focus leaves the field", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <>
        <EditableTable onCellEdit={onCellEdit} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Oto");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    await waitFor(() =>
      expect(onCellEdit).toHaveBeenCalledWith(rows[0], "name", "Oto"),
    );
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("does not save a value that did not change", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableTable onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 0));
    await user.keyboard("{Enter}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(cell(0, 0)).toHaveFocus();
  });

  it("does not overwrite a value a refetch brought while the field was left as it was", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const { rerender } = render(
      <>
        <DataTable columns={columns} data={rows} onCellEdit={onCellEdit} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.dblClick(cell(0, 0));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Adam");

    // Another user renamed the row - a poll brings it while the field is open
    const renamed = rows.map((row, index) =>
      index === 0 ? { ...row, name: "Adam Novák" } : row,
    );
    rerender(
      <>
        <DataTable columns={columns} data={renamed} onCellEdit={onCellEdit} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.keyboard("{Enter}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(cell(0, 0)).toHaveTextContent("Adam Novák");

    // Nor on Tab, nor when the focus leaves the field
    await user.dblClick(cell(1, 0));
    const polled = renamed.map((row) => ({ ...row, age: row.age + 1 }));
    rerender(
      <>
        <DataTable columns={columns} data={polled} onCellEdit={onCellEdit} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.keyboard("{Tab}");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onCellEdit).not.toHaveBeenCalled();

    // A value typed into the field is saved, whatever came meanwhile
    await user.dblClick(cell(0, 0));
    await user.keyboard("{Control>}a{/Control}Eva{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(polled[0], "name", "Eva");
  });

  it("ends the editing of an invalid field with another page, sorting or filter", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const people = ["Cyril", "Adam", "Běla", "Dan", "Eva"].map(
      (name, index) => ({
        ...rows[index % 2],
        id: index + 1,
        name,
      }),
    );
    render(
      <DataTable
        clientSide
        columns={[{ ...columns[0], sortable: true }]}
        data={people}
        defaultQuery={{ pageSize: 2 }}
        onCellEdit={onCellEdit}
        pageSizeOptions={[2, 5]}
      />,
    );
    const names = () =>
      within(screen.getAllByRole("rowgroup")[1])
        .getAllByRole("row")
        .map((row) => row.textContent);

    // Left with an invalid value, the field stays open with its message
    await user.dblClick(cell(0, 0));
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    // The rows of the page the pagination shows - not the frozen ones
    expect(screen.getByText("3–4 of 5")).toBeInTheDocument();
    expect(names()).toEqual(["Běla", "Dan"]);
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();

    await user.dblClick(cell(0, 0));
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(names()).toEqual(["Adam", "Běla"]);
    expect(onCellEdit).not.toHaveBeenCalled();
  });

  it("refuses text a number field cannot read instead of emptying the cell", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(<EditableTable onCellEdit={onCellEdit} />);

    await user.dblClick(cell(0, 1));
    const field = screen.getByRole("spinbutton", { name: "Age" });
    // "1-2" - the browser reports no value and a bad input
    Object.defineProperty(field, "validity", {
      configurable: true,
      value: { badInput: true },
    });
    fireEvent.change(field, { target: { value: "" } });
    await user.keyboard("{Enter}");

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription("Enter a number.");

    Object.defineProperty(field, "validity", {
      configurable: true,
      value: { badInput: false },
    });
    fireEvent.change(field, { target: { value: "12" } });
    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "age", 12);
  });

  it("edits only the rows a column allows, and only with onCellEdit", () => {
    const partly: Column<Row>[] = [
      { ...columns[0], editable: (row) => row.age < 40 },
    ];
    const { rerender } = render(
      <DataTable columns={partly} data={rows} onCellEdit={vi.fn()} />,
    );

    expect(cell(0, 0)).toHaveAttribute("tabindex", "0");
    expect(cell(0, 0)).toHaveAccessibleDescription("Press Enter or F2 to edit");
    expect(cell(1, 0)).not.toHaveAttribute("tabindex");

    rerender(<DataTable columns={partly} data={rows} />);
    expect(cell(0, 0)).not.toHaveAttribute("tabindex");
  });

  it("builds the field of a column with renderEditor", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <DataTable
        columns={[
          {
            editable: true,
            key: "team",
            label: "Team",
            renderEditor: ({ cancel, commit, label, value }) => (
              <div aria-label={label} role="group">
                <span>{String(value)}</span>
                <button onClick={() => commit("C")} type="button">
                  Team C
                </button>
                <button onClick={cancel} type="button">
                  Keep
                </button>
              </div>
            ),
          },
        ]}
        data={rows}
        onCellEdit={onCellEdit}
      />,
    );

    await user.dblClick(cell(0, 0));
    const editor = screen.getByRole("group", { name: "Team" });
    // The first control takes the focus
    expect(
      within(editor).getByRole("button", { name: "Team C" }),
    ).toHaveFocus();

    await user.click(within(editor).getByRole("button", { name: "Keep" }));
    expect(onCellEdit).not.toHaveBeenCalled();

    await user.dblClick(cell(0, 0));
    await user.click(screen.getByRole("button", { name: "Team C" }));
    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "team", "C");
  });
});
