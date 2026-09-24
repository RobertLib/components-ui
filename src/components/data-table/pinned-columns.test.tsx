import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
  salary: number;
  team: string;
}

const rows: Row[] = [
  { id: 1, name: "Adam", salary: 10, team: "A" },
  { id: 2, name: "Běla", salary: 20, team: "B" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { key: "team", label: "Team" },
  { key: "salary", label: "Salary" },
];

const header = (name: string) => screen.getByRole("columnheader", { name });

// Reports every observed cell once, measured by its column key
class MeasuringObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ target } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  disconnect() {}
  unobserve() {}
}

/** Header cells measure the widths given by their column key. */
function measureColumns(widths: Record<string, number>) {
  vi.stubGlobal("ResizeObserver", MeasuringObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const key = this.getAttribute("data-column-key") ?? "";
      return { width: widths[key] ?? 0 } as DOMRect;
    },
  );
}

/** Makes the scrolling element of the table report a scroll position. */
function scrollTable(
  container: HTMLElement,
  scrollLeft: number,
  { clientWidth = 400, scrollWidth = 1000 } = {},
) {
  const scroller = container.querySelector<HTMLElement>(".overflow-x-auto");
  if (!scroller) throw new Error("No scrolling element");
  Object.defineProperties(scroller, {
    clientWidth: { configurable: true, value: clientWidth },
    scrollLeft: { configurable: true, value: scrollLeft },
    scrollWidth: { configurable: true, value: scrollWidth },
  });
  fireEvent.scroll(scroller);
}

const hasShadow = (cell: HTMLElement, side: "left" | "right") =>
  !!cell.querySelector(
    side === "left" ? ":scope > .bg-linear-to-r" : ":scope > .bg-linear-to-l",
  );

describe("DataTable pinned columns", () => {
  it("pins a column by its definition", () => {
    render(
      <DataTable
        columns={[
          columns[0],
          { ...columns[1], pinned: "left" },
          { ...columns[2], pinned: "right" },
        ]}
        data={rows}
      />,
    );

    // Pinned columns go to their edge and stick there
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual(["Team", "Name", "Salary"]);
    expect(header("Team")).toHaveClass("sticky");
    expect(header("Team")).toHaveStyle({ left: "0px" });
    expect(header("Salary")).toHaveClass("sticky");
    expect(header("Salary")).toHaveStyle({ right: "0px" });
    expect(header("Name")).not.toHaveClass("sticky");
  });

  it("lets the user unpin a pinned column and brings the pin back on reset", async () => {
    const user = userEvent.setup();
    const pinned = [{ ...columns[0], pinned: "left" as const }, columns[1]];
    render(<DataTable columns={pinned} data={rows} tableId="people" />);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    const pinLeft = screen.getByRole("button", {
      name: "Pin Name to the left",
    });
    expect(pinLeft).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Reset columns" }),
    ).toBeDisabled();

    await user.click(pinLeft);

    expect(pinLeft).toHaveAttribute("aria-pressed", "false");
    expect(header("Name")).not.toHaveClass("sticky");
    expect(
      JSON.parse(localStorage.getItem("table-state-people") ?? "{}"),
    ).toMatchObject({ columnPinning: { name: false } });

    await user.click(screen.getByRole("button", { name: "Reset columns" }));

    expect(header("Name")).toHaveClass("sticky");
    expect(localStorage.getItem("table-state-people")).toBeNull();
  });

  it("moves a pinned column to the other edge", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(
      screen.getByRole("button", { name: "Pin Name to the left" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Pin Name to the right" }),
    );

    expect(
      screen.getByRole("button", { name: "Pin Name to the left" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(header("Name")).toHaveStyle({ right: "0px" });
    expect(
      JSON.parse(localStorage.getItem("table-state-people") ?? "{}"),
    ).toMatchObject({ columnPinning: { name: "right" } });
  });

  it("reads the pins saved by an older version", () => {
    localStorage.setItem(
      "table-state-people",
      JSON.stringify({ pinnedColumns: { left: ["team"], right: ["name"] } }),
    );
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    expect(header("Team")).toHaveStyle({ left: "0px" });
    expect(header("Name")).toHaveStyle({ right: "0px" });
  });

  it("offsets pinned columns by the expand, selection and actions columns and by resized widths", () => {
    measureColumns({
      actions: 80,
      expand: 40,
      id: 50,
      name: 120,
      salary: 90,
      selection: 30,
      team: 60,
    });

    try {
      render(
        <DataTable
          actions={() => "Edit"}
          columns={[
            // Resized - its width counts, not the measured one
            { ...columns[0], pinned: "left", width: 150 },
            { ...columns[1], pinned: "left" },
            { ...columns[2], pinned: "right" },
            { key: "id", label: "Id", pinned: "right" },
          ]}
          data={rows}
          groupActions={[{ label: "Archive", onClick: () => {} }]}
          renderSubRow={(row) => row.name}
        />,
      );

      const left = (key: string) =>
        document.querySelector<HTMLElement>(`th[data-column-key="${key}"]`)
          ?.style.left;
      const right = (key: string) =>
        document.querySelector<HTMLElement>(`th[data-column-key="${key}"]`)
          ?.style.right;

      expect(left("expand")).toBe("0px");
      expect(left("selection")).toBe("40px");
      expect(left("actions")).toBe("70px");
      expect(left("name")).toBe("150px");
      expect(left("team")).toBe("300px");
      expect(right("id")).toBe("0px");
      expect(right("salary")).toBe("50px");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offsets a column pinned to the right by the pinned columns right of it", () => {
    measureColumns({ salary: 90, team: 60 });

    try {
      render(
        <DataTable
          columns={[
            columns[0],
            { ...columns[1], pinned: "right" },
            { ...columns[2], pinned: "right" },
          ]}
          data={rows}
        />,
      );

      expect(header("Salary")).toHaveStyle({ right: "0px" });
      expect(header("Team")).toHaveStyle({ right: "90px" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("casts a shadow from the pinned edges while the table is scrolled under them", () => {
    const { container } = render(
      <DataTable
        columns={[
          { ...columns[0], pinned: "left" },
          columns[1],
          { ...columns[2], pinned: "right" },
        ]}
        data={rows}
      />,
    );

    // At the left end - only the right edge has columns under it
    act(() => scrollTable(container, 0));
    expect(hasShadow(header("Name"), "left")).toBe(false);
    expect(hasShadow(header("Salary"), "right")).toBe(true);

    act(() => scrollTable(container, 300));
    expect(hasShadow(header("Name"), "left")).toBe(true);
    expect(hasShadow(header("Salary"), "right")).toBe(true);

    // At the right end
    act(() => scrollTable(container, 600));
    expect(hasShadow(header("Name"), "left")).toBe(true);
    expect(hasShadow(header("Salary"), "right")).toBe(false);
  });

  it("casts the shadow from the selection column without pinned columns", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={rows}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );

    act(() => scrollTable(container, 100));

    const selection = screen.getByRole("checkbox", { name: "Select all rows" })
      .parentElement as HTMLElement;
    expect(hasShadow(selection, "left")).toBe(true);
  });

  it("keeps the table scrolled sideways when the focus moves into a pinned cell", () => {
    const { container } = render(
      <DataTable
        columns={[{ ...columns[0], pinned: "left" }, columns[1], columns[2]]}
        data={rows}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
      />,
    );
    const scroller = container.querySelector<HTMLElement>(".overflow-x-auto");
    if (!scroller) throw new Error("No scrolling element");
    let scrollLeft = 150;
    Object.defineProperty(scroller, "scrollLeft", {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    });
    act(() => {
      fireEvent.scroll(scroller);
    });

    // The browser scrolls a sticky cell into view as if it did not stick -
    // back to the start of the table
    scrollLeft = 0;
    act(() =>
      screen.getByRole("checkbox", { name: "Select row Adam" }).focus(),
    );

    expect(scrollLeft).toBe(150);
  });

  it("lets pinned columns scroll along when they would cover most of a narrow view", () => {
    measureColumns({ name: 150, salary: 120 });

    try {
      const { container } = render(
        <DataTable
          columns={[
            { ...columns[0], pinned: "left" },
            columns[1],
            { ...columns[2], pinned: "right" },
          ]}
          data={rows}
        />,
      );

      // 270px of pinned columns in a 400px view - the right one gives way
      act(() => scrollTable(container, 0, { clientWidth: 400 }));
      expect(header("Name")).toHaveClass("sticky");
      expect(header("Salary")).not.toHaveClass("sticky");

      // A phone - neither sticks
      act(() => scrollTable(container, 0, { clientWidth: 280 }));
      expect(header("Name")).not.toHaveClass("sticky");

      act(() => scrollTable(container, 0, { clientWidth: 1000 }));
      expect(header("Name")).toHaveClass("sticky");
      expect(header("Salary")).toHaveClass("sticky");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("resizes a pinned column only as far as the pinned columns still stick", async () => {
    const user = userEvent.setup();
    measureColumns({});

    try {
      const { container } = render(
        <DataTable
          columns={[
            { ...columns[0], pinned: "left", width: 150 },
            columns[1],
            { ...columns[2], pinned: "right", width: 60 },
          ]}
          data={rows}
        />,
      );
      // 210px of pinned columns in a 500px view - 40px to spare
      act(() => scrollTable(container, 0, { clientWidth: 500 }));

      const handle = screen.getByRole("separator", { name: "Resize Salary" });
      expect(handle).toHaveAttribute("aria-valuemax", "100");

      // Wider by its left edge - until the pinned columns would cover more
      // than half of the view: then all of them would scroll along, the
      // column out of view and its handle to its other edge
      act(() => handle.focus());
      for (let step = 0; step < 6; step++) await user.keyboard("{ArrowLeft}");

      expect(header("Salary")).toHaveStyle({ width: "100px" });
      expect(header("Salary")).toHaveClass("sticky");
      expect(header("Name")).toHaveClass("sticky");
      expect(handle).toHaveAttribute("aria-valuenow", "100");

      await user.keyboard("{ArrowRight}");
      expect(header("Salary")).toHaveStyle({ width: "90px" });
      await user.keyboard("{End}");
      expect(header("Salary")).toHaveStyle({ width: "100px" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
