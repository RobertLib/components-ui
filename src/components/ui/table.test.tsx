import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Table, {
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableRow,
  type TableProps,
} from "./table";
import UIProvider from "../../providers/ui-provider";

function Orders(props: Partial<TableProps>) {
  return (
    <Table caption="Orders" {...props}>
      <TableHead>
        <TableRow>
          <TableCell>Customer</TableCell>
          <TableCell align="end">Total</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell header>Jana Nováková</TableCell>
          <TableCell align="end">1 200 Kč</TableCell>
        </TableRow>
        <TableRow>
          <TableCell header>Petr Svoboda</TableCell>
          <TableCell align="end">800 Kč</TableCell>
        </TableRow>
      </TableBody>
      <TableFoot>
        <TableRow>
          <TableCell header>Sum</TableCell>
          <TableCell align="end">2 000 Kč</TableCell>
        </TableRow>
      </TableFoot>
    </Table>
  );
}

describe("Table", () => {
  it("is a table named by its caption, with column and row headers", () => {
    render(<Orders />);

    const table = screen.getByRole("table", { name: "Orders" });
    const columns = within(table).getAllByRole("columnheader");
    expect(columns.map((header) => header.textContent)).toEqual([
      "Customer",
      "Total",
    ]);
    expect(columns[0]).toHaveAttribute("scope", "col");
    const rowHeader = within(table).getByRole("rowheader", {
      name: "Jana Nováková",
    });
    expect(rowHeader).toHaveAttribute("scope", "row");
    expect(within(table).getByRole("cell", { name: "800 Kč" })).toHaveClass(
      "text-end",
    );
    expect(within(table).getAllByRole("row")).toHaveLength(4);
  });

  it("tints, highlights and lines the rows on request", () => {
    const { rerender } = render(<Orders />);
    const bodyRow = () =>
      screen.getByRole("rowheader", { name: "Jana Nováková" }).parentElement!;
    const cell = () => screen.getByRole("cell", { name: "800 Kč" });
    expect(bodyRow().className).toBe("");
    expect(cell()).not.toHaveClass("border-e");

    rerender(<Orders bordered hover striped />);
    expect(bodyRow()).toHaveClass("even:bg-neutral-50", "hover:bg-neutral-100");
    expect(cell()).toHaveClass("border-e", "last:border-e-0");
    // Not the header or the footer rows
    expect(
      screen.getByRole("columnheader", { name: "Customer" }).parentElement,
    ).not.toHaveClass("even:bg-neutral-50");
  });

  it("pads the cells by the density", () => {
    const { rerender } = render(<Orders />);
    const cell = () => screen.getByRole("cell", { name: "800 Kč" });
    expect(cell()).toHaveClass("px-3", "py-2");

    rerender(<Orders density="compact" />);
    expect(cell()).toHaveClass("px-2", "py-1");

    rerender(<Orders density="comfortable" />);
    expect(cell()).toHaveClass("px-4", "py-3");
  });

  it("keeps the header in sight in a frame of maxHeight", () => {
    const { container } = render(<Orders maxHeight="12rem" stickyHeader />);

    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveClass("overflow-auto");
    expect(frame.style.maxHeight).toBe("12rem");
    expect(screen.getByRole("columnheader", { name: "Total" })).toHaveClass(
      "sticky",
      "top-0",
    );
    // Separate borders - the line under a sticky header stays with it
    expect(screen.getByRole("table")).toHaveClass("border-separate");
  });

  it("is a named Tab stop while it scrolls", () => {
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(900);
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(300);

    const { container } = render(<Orders />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("region", { name: "Orders" })).toBe(frame);

    scrollWidth.mockRestore();
    clientWidth.mockRestore();
  });

  it("names a scrolling frame like a table without a caption", () => {
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(900);
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(300);

    const { container, rerender } = render(
      <Orders aria-label="Invoices" caption={undefined} />,
    );
    expect(screen.getByRole("region", { name: "Invoices" })).toBe(
      container.firstElementChild,
    );

    // Unnamed, it is a Tab stop - but no landmark
    rerender(<Orders caption={undefined} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("tabindex", "0");

    scrollWidth.mockRestore();
    clientWidth.mockRestore();
  });

  it("is no Tab stop while it fits", () => {
    const { container } = render(<Orders />);

    const frame = container.firstElementChild as HTMLElement;
    expect(frame).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("passes its props to the table and the frame classes to the frame", () => {
    const { container } = render(
      <Table
        className="table-fixed"
        containerClassName="rounded-none"
        data-testid="table"
      >
        <TableBody>
          <TableRow>
            <TableCell colSpan={2}>Empty</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId("table")).toHaveClass("table-fixed");
    expect(container.firstElementChild).toHaveClass("rounded-none");
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "2");
  });
});

describe("TableRow href", () => {
  /** A table of orders whose rows open them - by the link of the first cell. */
  function Orders({ withLink = true }: { withLink?: boolean }) {
    return (
      <Table>
        <TableBody>
          <TableRow data-testid="row" href="/orders/42">
            <TableCell>
              {withLink ? <a href="/orders/42">Order 42</a> : "Order 42"}
            </TableCell>
            <TableCell>
              <button type="button">Archive</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  it("follows the link of the row on a click anywhere on it", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <UIProvider router={{ navigate }}>
        <Orders />
      </UIProvider>,
    );
    screen.getByRole("link").addEventListener("click", followed);

    const row = screen.getByTestId("row");
    expect(row).toHaveClass("cursor-pointer", "hover:bg-neutral-100");
    await user.click(screen.getAllByRole("cell")[0]);
    expect(followed).toHaveBeenCalledOnce();

    // Ctrl + click is passed on - the link opens a new tab
    await user.keyboard("{Control>}");
    await user.click(screen.getAllByRole("cell")[0]);
    await user.keyboard("{/Control}");
    expect(followed).toHaveBeenLastCalledWith(
      expect.objectContaining({ ctrlKey: true }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves a click on a control or at the end of a selection alone", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <UIProvider router={{ navigate }}>
        <Orders withLink={false} />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(navigate).not.toHaveBeenCalled();

    // The click that ends selecting the text of the row
    const cell = screen.getAllByRole("cell")[0];
    const selection = document.getSelection()!;
    selection.selectAllChildren(cell);
    fireEvent.click(cell);
    expect(navigate).not.toHaveBeenCalled();
    selection.removeAllRanges();

    // Without a link in it the row navigates through the router
    await user.click(cell);
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate.mock.calls[0][0]).toBe("/orders/42");
  });
});
