import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
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
  { key: "name", label: "Name", width: 200 },
  { key: "team", label: "Team", maxWidth: 300, minWidth: 80 },
];

const header = (name: string) => screen.getByRole("columnheader", { name });

/** The table with a spy as the `render` of the team column. */
const renderTable = (renderTeam: (row: Row) => React.ReactNode) =>
  render(
    <DataTable
      columns={[columns[0], { ...columns[1], render: renderTeam }]}
      data={rows}
    />,
  );
const handle = (name: string) =>
  screen.getByRole("separator", { name: `Resize ${name}` });
const firstCell = () =>
  within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0];

/** The width a drag shows - a CSS variable on the table. */
const dragWidth = () =>
  screen.getByRole("table").style.getPropertyValue("--data-table-drag-width");

const drag = (element: HTMLElement, from: number, to: number) => {
  fireEvent.pointerDown(element, { button: 0, clientX: from, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: to, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: to, pointerId: 1 });
};

describe("DataTable column resizing", () => {
  it("puts a resize handle on each column, named by it", () => {
    render(<DataTable columns={columns} data={rows} />);

    const name = handle("Name");
    expect(name).toHaveAttribute("aria-orientation", "vertical");
    expect(name).toHaveAttribute("aria-valuenow", "200");
    expect(name).toHaveAttribute("aria-valuemin", "50");
    expect(name).toHaveAttribute("aria-valuetext", "200 pixels");
    expect(name).toHaveAttribute("tabindex", "0");
    expect(handle("Team")).toHaveAttribute("aria-valuemin", "80");
    expect(handle("Team")).toHaveAttribute("aria-valuemax", "300");
    // The handle is no part of the name of the header
    expect(header("Name")).toContainElement(name);
  });

  it("sizes a column with a width exactly - its cells cannot widen it", () => {
    render(<DataTable columns={columns} data={rows} />);

    expect(header("Name")).toHaveStyle({
      maxWidth: "200px",
      minWidth: "200px",
      width: "200px",
    });
    expect(firstCell()).toHaveStyle({ maxWidth: "200px" });
  });

  it("resizes from the keyboard within the limits", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} />);

    handle("Name").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(header("Name")).toHaveStyle({ width: "220px" });
    expect(handle("Name")).toHaveAttribute("aria-valuenow", "220");

    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(header("Name")).toHaveStyle({ width: "170px" });

    await user.keyboard("{Home}");
    expect(header("Name")).toHaveStyle({ width: "50px" });

    // Enter brings back the column's own width, like a double-click
    await user.keyboard("{Enter}");
    expect(header("Name")).toHaveStyle({ width: "200px" });
  });

  it("stops at the maximum width, and End goes there", async () => {
    const user = userEvent.setup();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 290,
    } as DOMRect);
    render(<DataTable columns={columns} data={rows} />);

    handle("Team").focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(header("Team")).toHaveStyle({ width: "300px" });

    await user.keyboard("{Home}{End}");
    expect(header("Team")).toHaveStyle({ width: "300px" });
  });

  it("starts from the width a column has when it has none of its own", async () => {
    const user = userEvent.setup();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 133.4,
    } as DOMRect);
    render(<DataTable columns={columns} data={rows} />);

    handle("Team").focus();
    await user.keyboard("{ArrowLeft}");

    expect(header("Team")).toHaveStyle({ width: "123px" });
  });

  it("resizes by dragging the edge - shown while dragging, saved at the end", () => {
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    fireEvent.pointerDown(handle("Name"), {
      button: 0,
      clientX: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(handle("Name"), { clientX: 160, pointerId: 1 });

    expect(dragWidth()).toBe("260px");
    expect(header("Name").style.width).toBe(
      "var(--data-table-drag-width, 260px)",
    );
    expect(firstCell().style.maxWidth).toBe(
      "var(--data-table-drag-width, 260px)",
    );
    expect(localStorage.getItem("table-state-people")).toBeNull();

    fireEvent.pointerUp(handle("Name"), { clientX: 160, pointerId: 1 });

    expect(dragWidth()).toBe("");
    expect(header("Name")).toHaveStyle({ width: "260px" });
    expect(firstCell()).toHaveStyle({ maxWidth: "260px" });
    expect(
      JSON.parse(localStorage.getItem("table-state-people") ?? "{}"),
    ).toMatchObject({ columnWidths: { name: 260 } });
  });

  it("renders the rows when a drag starts and ends, not on every move", () => {
    const render = vi.fn((row: Row) => row.team);
    renderTable(render);

    fireEvent.pointerDown(handle("Name"), {
      button: 0,
      clientX: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle("Name"), { clientX: 110, pointerId: 1 });
    const afterStart = render.mock.calls.length;

    for (let x = 120; x <= 200; x += 10) {
      fireEvent.pointerMove(handle("Name"), { clientX: x, pointerId: 1 });
    }

    expect(render).toHaveBeenCalledTimes(afterStart);
    expect(dragWidth()).toBe("300px");

    fireEvent.pointerUp(handle("Name"), { clientX: 200, pointerId: 1 });
    expect(header("Name")).toHaveStyle({ width: "300px" });
  });

  it("moves the pinned columns after a dragged one with it", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 80,
    } as DOMRect);
    render(
      <DataTable
        columns={[
          { ...columns[0], pinned: "left" },
          { ...columns[1], pinned: "left" },
        ]}
        data={rows}
      />,
    );
    expect(header("Team")).toHaveStyle({ left: "200px" });

    fireEvent.pointerDown(handle("Name"), {
      button: 0,
      clientX: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle("Name"), { clientX: 150, pointerId: 1 });

    expect(header("Team").style.left).toBe(
      "calc(0px + var(--data-table-drag-width))",
    );
    fireEvent.pointerUp(handle("Name"), { clientX: 150, pointerId: 1 });
    expect(header("Team")).toHaveStyle({ left: "250px" });
  });

  it("keeps the width after a click without a move", () => {
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    drag(handle("Name"), 100, 100);

    expect(localStorage.getItem("table-state-people")).toBeNull();
  });

  it("puts the column back when Escape cancels a drag", () => {
    render(<DataTable columns={columns} data={rows} />);

    fireEvent.pointerDown(handle("Name"), {
      button: 0,
      clientX: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle("Name"), { clientX: 40, pointerId: 1 });
    expect(dragWidth()).toBe("140px");

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerUp(handle("Name"), { clientX: 40, pointerId: 1 });

    expect(header("Name")).toHaveStyle({ width: "200px" });
  });

  it("brings back the column's width on a double-click", () => {
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    drag(handle("Name"), 100, 30);
    expect(header("Name")).toHaveStyle({ width: "130px" });

    fireEvent.doubleClick(handle("Name"));

    expect(header("Name")).toHaveStyle({ width: "200px" });
    expect(localStorage.getItem("table-state-people")).toBeNull();
  });

  it("widens a column pinned to the right by its left edge", () => {
    render(
      <DataTable
        columns={[columns[0], { ...columns[1], pinned: "right", width: 100 }]}
        data={rows}
      />,
    );

    // Its handle is on the left edge - moving it left widens the column
    drag(handle("Team"), 500, 450);

    expect(header("Team")).toHaveStyle({ width: "150px" });
  });

  it("remembers the widths under tableId until the columns are reset", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "table-state-people",
      JSON.stringify({ columnWidths: { team: 150 } }),
    );
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    expect(header("Team")).toHaveStyle({ width: "150px" });

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("button", { name: "Reset columns" }));

    expect(header("Team")).not.toHaveStyle({ width: "150px" });
    expect(localStorage.getItem("table-state-people")).toBeNull();
  });

  it("can be turned off for a column or the whole table", () => {
    localStorage.setItem(
      "table-state-people",
      JSON.stringify({ columnWidths: { team: 150 } }),
    );
    const { rerender } = render(
      <DataTable
        columns={[columns[0], { ...columns[1], resizable: false }]}
        data={rows}
        tableId="people"
      />,
    );

    expect(handle("Name")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "Resize Team" })).toBeNull();
    // A saved width of a column that is not resizable is not applied
    expect(header("Team")).not.toHaveStyle({ width: "150px" });

    rerender(
      <DataTable
        columns={columns}
        data={rows}
        resizableColumns={false}
        tableId="people"
      />,
    );

    expect(screen.queryByRole("separator")).toBeNull();
    // The width of the definition stays
    expect(header("Name")).toHaveStyle({ width: "200px" });
  });

  it("says the width in the language of the table", () => {
    render(
      <UIProvider locale={cs}>
        <DataTable
          columns={[{ key: "name", label: "Jméno", width: 123 }]}
          data={rows}
        />
      </UIProvider>,
    );

    const czech = screen.getByRole("separator", {
      name: "Změnit šířku sloupce Jméno",
    });
    expect(czech).toHaveAttribute("aria-valuetext", "123 pixelů");
  });
});
