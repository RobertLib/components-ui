import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
}

const manyRows: Row[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: index + 1,
  name: `Person ${index + 1}`,
}));

const columns: Column<Row>[] = [{ key: "name", label: "Name" }];

// Reports every observed element once - the table measures its rows so
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

const scroller = () => {
  const element = document.querySelector<HTMLElement>(".overflow-x-auto");
  if (!element) throw new Error("No scrolling element");
  return element;
};

// The height of a row in the layout below - a test may change it
let rowHeight = 30;

// The layout jsdom has not: a 300px high view of the table, whose body
// starts 100px below the top of the scrolled content; rows are 30px high,
// details 90px
beforeEach(() => {
  rowHeight = 30;
  vi.stubGlobal("ResizeObserver", MeasuringObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.tagName === "TBODY") {
        return { height: 0, top: 100 - scroller().scrollTop } as DOMRect;
      }
      const key = this.getAttribute("data-measure-key");
      if (key !== null) {
        return {
          height: key.endsWith("\u0000sub") ? 90 : rowHeight,
        } as DOMRect;
      }
      return { height: 0, top: 0, width: 0 } as DOMRect;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Scrolls the view of the table to `scrollTop`. */
function scrollTo(scrollTop: number) {
  const element = scroller();
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
  act(() => {
    fireEvent.scroll(element);
  });
}

/** Indexes of the rendered rows - without their detail rows. */
const renderedIndexes = () =>
  Array.from(document.querySelectorAll("tbody > tr[data-row-index]"))
    .filter(
      (row) => !row.getAttribute("data-measure-key")?.endsWith("\u0000sub"),
    )
    .map((row) => Number(row.getAttribute("data-row-index")));

const spacers = () =>
  Array.from(document.querySelectorAll<HTMLElement>("tbody > tr[aria-hidden]"));

describe("DataTable virtualization", () => {
  it("renders only the rows in view and tells screen readers the rest", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );
    scrollTo(0);

    const indexes = renderedIndexes();
    expect(indexes[0]).toBe(0);
    // The view (10 rows) and half a view or more around it
    expect(indexes.length).toBeGreaterThan(10);
    expect(indexes.length).toBeLessThan(40);

    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "10001");
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("aria-rowindex", "2");
    // The room of the other rows, hidden from screen readers
    const [bottom] = spacers();
    expect(bottom.firstElementChild).toHaveStyle({
      height: `${(10_000 - indexes.length) * 30}px`,
    });
  });

  it("renders the rows scrolled into view", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );

    scrollTo(100 + 5000 * 30);

    const indexes = renderedIndexes();
    expect(indexes).toContain(5000);
    expect(indexes).toContain(5009);
    expect(indexes).not.toContain(0);
    expect(screen.getByText("Person 5001")).toBeInTheDocument();
    // The rows above are room of the same height
    expect(spacers()[0].firstElementChild).toHaveStyle({
      height: `${indexes[0] * 30}px`,
    });
    // The header row is still there
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
  });

  it("keeps the row with the focus while it is scrolled away", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        groupActions={[{ label: "Archive", onClick }]}
        pagination={false}
        virtualized
      />,
    );
    scrollTo(0);

    const checkbox = screen.getByRole("checkbox", {
      name: "Select row Person 3",
    });
    await user.click(checkbox);
    expect(checkbox).toHaveFocus();

    scrollTo(100 + 8000 * 30);

    expect(renderedIndexes()).toContain(2);
    expect(checkbox).toHaveFocus();
    expect(checkbox).toBeChecked();

    // A row far down joins the selection
    await user.click(
      screen.getByRole("checkbox", { name: "Select row Person 8003" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledWith(
      [manyRows[2], manyRows[8002]],
      expect.anything(),
    );
  });

  it("counts expanded details by their measured height", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        renderSubRow={(row) => `Detail of ${row.name}`}
        virtualized
      />,
    );
    scrollTo(0);

    await user.click(
      screen.getByRole("button", { name: "Expand row Person 2" }),
    );

    expect(screen.getByText("Detail of Person 2")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "10002");
    // Rows after the detail row come one later
    const third = screen.getByText("Person 3").closest("tr");
    expect(third).toHaveAttribute("aria-rowindex", "5");

    // The rows under the 90px detail start 90px later - the expanded row
    // itself has the focus, it stays rendered
    scrollTo(100 + 90 + 5000 * 30);
    const [kept, start, ...others] = renderedIndexes();
    expect(kept).toBe(1);
    expect([start, ...others]).toContain(5000);
    const heights = spacers().map((spacer) =>
      parseFloat((spacer.firstElementChild as HTMLElement).style.height),
    );
    // Row 0 above the kept row, then the rows up to the view
    expect(heights.slice(0, 2)).toEqual([30, (start - 2) * 30]);
    const rendered = renderedIndexes().length * 30 + 90;
    expect(heights.reduce((total, height) => total + height) + rendered).toBe(
      10_000 * 30 + 90,
    );
  });

  it("finds the rows of a search among all of them", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        defaultSearchOpen
        enableGlobalSearch
        pagination={false}
        virtualized
      />,
    );
    scrollTo(100 + 3000 * 30);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "9999");

    // Scrolled past the one row left - it is rendered for the browser to
    // bring the view back to it
    await waitFor(() => expect(renderedIndexes()).toEqual([0]));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Person 9999");
  });

  it("keeps its rows while the browser anchors the scroll by a pixel", () => {
    // Chrome keeps the row in view in place when rows above it are swapped
    // for spacers of a slightly different height - here the content moves
    // up a pixel whenever row 80 is rendered. A range computed from every
    // such position flipped row 80 in and out without end.
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(
      function (this: Element) {
        if (this.tagName === "TBODY") {
          const anchored = document.querySelector('tr[data-row-index="80"]');
          return {
            height: 0,
            top: 100 - scroller().scrollTop - (anchored ? 1 : 0),
          } as DOMRect;
        }
        const key = this.getAttribute("data-measure-key");
        if (key !== null) return { height: 30 } as DOMRect;
        return { height: 0, top: 0, width: 0 } as DOMRect;
      },
    );
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );

    // The top of the rows above the view ends half a pixel into row 81
    // without the anchoring, half a pixel past it with it
    scrollTo(81 * 30 + 299.5);
    const indexes = renderedIndexes();
    scrollTo(81 * 30 + 299.5);

    expect(renderedIndexes()).toEqual(indexes);
    expect(indexes).toContain(90);
  });

  it("stops the browser anchoring the scroll of a virtualized table", () => {
    const { rerender } = render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows.slice(0, 50)}
        pagination={false}
        virtualized
      />,
    );
    expect(scroller()).toHaveStyle({ overflowAnchor: "none" });

    rerender(
      <DataTable clientSide columns={columns} data={manyRows.slice(0, 50)} />,
    );
    expect(scroller().style.overflowAnchor).toBe("");
  });

  it("places the summary row last among the rows it counts", () => {
    render(
      <DataTable
        clientSide
        columns={[{ key: "name", label: "Name", summary: "count" }]}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );

    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "10002");
    const summary = within(screen.getAllByRole("rowgroup")[2]).getByRole("row");
    expect(summary).toHaveAttribute("aria-rowindex", "10002");
  });

  it("measures the rows again with another density", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );
    scrollTo(0);

    // Compact rows are lower - the observer reports no row that stays
    // rendered, the table measures them itself
    rowHeight = 20;
    await user.click(screen.getByRole("button", { name: "Row density" }));
    await user.click(screen.getByRole("button", { name: "Compact" }));

    const indexes = renderedIndexes();
    expect(spacers().at(-1)?.firstElementChild).toHaveStyle({
      height: `${(10_000 - indexes.at(-1)! - 1) * 20}px`,
    });
  });

  it("keeps the row at the top of the view there with another density", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );
    scrollTo(100 + 5000 * 30);
    expect(renderedIndexes()).toContain(5000);

    // Lower rows - those above the view take less room, so the table
    // scrolls up by it, to the same row
    rowHeight = 20;
    await user.click(screen.getByRole("button", { name: "Row density" }));
    await user.click(screen.getByRole("button", { name: "Compact" }));

    expect(scroller().scrollTop).toBe(100 + 5000 * 20);
    expect(renderedIndexes()).toContain(5000);
  });

  it("does not scroll when a column is resized with a detail at the top", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        expandedByDefault
        pagination={false}
        renderSubRow={(row) => `Detail of ${row.name}`}
        virtualized
      />,
    );
    // The top of the view in the middle of the detail of row 5000
    const top = 100 + 5000 * 120 + 30 + 45;
    scrollTo(top);

    // The rows keep their heights - nothing moves
    screen.getByRole("separator", { name: "Resize Name" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(scroller().scrollTop).toBe(top);
  });

  it("keeps the measured heights when only the view gets wider", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );
    scrollTo(0);

    // A resized window, a sidebar closed - the rows keep their heights, and
    // a table scrolled down does not jump
    rowHeight = 20;
    Object.defineProperty(scroller(), "clientWidth", {
      configurable: true,
      value: 500,
    });
    scrollTo(0);

    const indexes = renderedIndexes();
    expect(spacers().at(-1)?.firstElementChild).toHaveStyle({
      height: `${(10_000 - indexes.at(-1)! - 1) * 30}px`,
    });
  });

  it("forgets the heights of rows that are gone", () => {
    const { rerender } = render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows}
        pagination={false}
        virtualized
      />,
    );
    scrollTo(0);

    // Other rows, lower - the rows of before weigh in no estimate
    rowHeight = 10;
    const otherRows = manyRows.map((row) => ({ ...row, id: row.id + 20_000 }));
    rerender(
      <DataTable
        clientSide
        columns={columns}
        data={otherRows}
        pagination={false}
        virtualized
      />,
    );

    const indexes = renderedIndexes();
    expect(spacers().at(-1)?.firstElementChild).toHaveStyle({
      height: `${(10_000 - indexes.at(-1)! - 1) * 10}px`,
    });
  });

  it("renders every row without virtualized", () => {
    render(
      <DataTable
        clientSide
        columns={columns}
        data={manyRows.slice(0, 300)}
        pagination={false}
      />,
    );

    expect(
      within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row"),
    ).toHaveLength(300);
    expect(screen.getByRole("table")).not.toHaveAttribute("aria-rowcount");
    expect(spacers()).toHaveLength(0);
  });
});
