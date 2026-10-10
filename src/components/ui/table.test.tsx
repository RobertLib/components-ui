import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Table, {
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableRow,
  type TableProps,
} from "./table";
import UIProvider from "../../providers/ui-provider";
import {
  browserNavigate,
  type LinkComponentProps,
} from "../../providers/router";

/** A click of the middle button - it fires `auxclick`, no `click`. */
const auxClick = (element: Element) =>
  fireEvent(
    element,
    new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true }),
  );

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
  afterEach(() => window.history.replaceState(null, "", "/"));

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

    // Alt + click is passed on with the key
    await user.keyboard("{Alt>}");
    await user.click(screen.getAllByRole("cell")[0]);
    await user.keyboard("{/Alt}");
    expect(followed).toHaveBeenLastCalledWith(
      expect.objectContaining({ altKey: true }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens the link of the row in a new tab on Ctrl, Cmd or Shift + click", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    // A router under a base path - its links add it
    function BaseLink({ href, ...props }: LinkComponentProps) {
      return <a href={`/app${href}`} {...props} />;
    }
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>
              <BaseLink href="/orders/42">Order 42</BaseLink>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
          <TableRow href="/orders/43">
            <TableCell>
              {/* A disabled link has no href */}
              <a aria-disabled="true" data-row-link="" role="link">
                Order 43
              </a>
            </TableCell>
            <TableCell>Petr</TableCell>
          </TableRow>
          <TableRow href="/orders/44">
            <TableCell>
              <a href="/orders/44">Order 44</a>
            </TableCell>
            <TableCell>Eva</TableCell>
          </TableRow>
          <TableRow
            href="/orders/45"
            onClick={(event) => {
              if (event.shiftKey) event.preventDefault();
            }}
          >
            <TableCell>
              <a href="/orders/45">Order 45</a>
            </TableCell>
            <TableCell>Ota</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const link of screen.getAllByRole("link")) {
      link.addEventListener("click", followed);
    }

    // Not passed on to the link - WebKit ignores the keys of a click the
    // page dispatches, the link would leave the page
    fireEvent.click(screen.getByText("Jana"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Jana"), { metaKey: true });
    fireEvent.click(screen.getByText("Jana"), { shiftKey: true });
    expect(followed).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenLastCalledWith(
      new URL("/app/orders/42", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );

    // No new tab for a disabled link, nor after `preventDefault()` - of a
    // row whose link would open one
    fireEvent.click(screen.getByText("Petr"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Petr"), { shiftKey: true });
    fireEvent.click(screen.getByText("Eva"), { shiftKey: true });
    expect(open).toHaveBeenLastCalledWith(
      new URL("/orders/44", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );
    fireEvent.click(screen.getByText("Ota"), { shiftKey: true });
    expect(open).toHaveBeenCalledTimes(4);
    fireEvent.click(screen.getByText("Ota"), { ctrlKey: true });
    expect(open).toHaveBeenLastCalledWith(
      new URL("/orders/45", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );
    expect(followed).not.toHaveBeenCalled();

    // A plain click is passed on
    fireEvent.click(screen.getByText("Jana"));
    expect(followed).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledTimes(5);
  });

  it("takes a Shift, Ctrl or middle click on selected text of the row for an activation", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>Jana Nováková</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    screen.getByRole("link").addEventListener("click", followed);
    const url = new URL("/orders/42", window.location.href).href;

    // Shift + click extends a selection into the row, Firefox selects the
    // cell for Ctrl + click - neither ends a drag
    const cell = screen.getByText("Jana Nováková");
    document.getSelection()!.selectAllChildren(cell);
    fireEvent.click(cell, { shiftKey: true });
    fireEvent.click(cell, { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith(url, "_blank", "noopener,noreferrer");

    // Nor does the middle button on text selected before
    expect(fireEvent.mouseDown(cell, { button: 1 })).toBe(false);
    auxClick(cell);
    expect(open).toHaveBeenCalledTimes(3);

    // A plain click there ends selecting it
    fireEvent.click(cell);
    expect(followed).not.toHaveBeenCalled();
    document.getSelection()!.removeAllRanges();
  });

  it("takes no click whose press began on a control of the row", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>Jana Nováková</TableCell>
            <TableCell>
              <button type="button">Archive</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    screen.getByRole("link").addEventListener("click", followed);
    const button = screen.getByRole("button", { name: "Archive" });
    const cell = screen.getByText("Jana Nováková");

    // Pressed on the button, released on another cell - the browser clicks
    // what holds both, the row
    fireEvent.mouseDown(button);
    fireEvent.click(screen.getAllByRole("row")[0], { detail: 1 });
    fireEvent.mouseDown(button, { button: 1 });
    fireEvent(
      cell,
      new MouseEvent("auxclick", {
        bubbles: true,
        button: 1,
        cancelable: true,
        detail: 1,
      }),
    );
    expect(followed).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();

    // A click of the keyboard has no press - one pressed on the row is its
    fireEvent.click(cell);
    fireEvent.mouseDown(cell);
    fireEvent.click(cell, { detail: 1 });
    expect(followed).toHaveBeenCalledTimes(2);
  });

  it("selects no text for a press with Shift or Ctrl on the row", () => {
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>Jana Nováková</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByText("Jana Nováková");

    expect(fireEvent.mouseDown(cell, { shiftKey: true })).toBe(false);
    expect(fireEvent.mouseDown(cell, { ctrlKey: true })).toBe(false);
    // A plain press selects, and the link has its own
    expect(fireEvent.mouseDown(cell)).toBe(true);
    expect(
      fireEvent.mouseDown(screen.getByRole("link"), { shiftKey: true }),
    ).toBe(true);
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

    // Without a link in it the row navigates through the router - and
    // warns, the keyboard has no way to it
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await user.click(cell);
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate.mock.calls[0][0]).toBe("/orders/42");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("data-row-link"));
  });

  it("calls the onClick of the row once - not again for the click passed on to its link", async () => {
    const user = userEvent.setup();
    const targets: EventTarget[] = [];
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <Table>
        <TableBody>
          <TableRow
            href="/orders/42"
            onClick={(event) => targets.push(event.target)}
          >
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    screen.getByRole("link").addEventListener("click", followed);

    await user.click(screen.getByText("Jana"));
    expect(followed).toHaveBeenCalledOnce();
    // The click of the user, on the cell
    expect(targets).toEqual([screen.getByText("Jana")]);
  });

  it("opens no unsafe href, and an absolute URL not by the router", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <UIProvider router={{ navigate }}>
        <Table>
          <TableBody>
            <TableRow href="javascript:alert(1)">
              <TableCell>Order 42</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </UIProvider>,
    );

    await user.click(screen.getByRole("cell"));
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("cell"));
    await user.keyboard("{/Control}");
    auxClick(screen.getByRole("cell"));
    expect(navigate).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("TableRow"),
      "javascript:alert(1)",
    );

    // The History API would throw on another origin - it is left for the
    // browser to load
    const { href, origin } = window.location;
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      assign,
      href,
      origin,
    } as unknown as Location);
    const rowTo = (url: string) => (
      <UIProvider router={{ navigate }}>
        <Table>
          <TableBody>
            <TableRow href={url}>
              <TableCell>Order 42</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </UIProvider>
    );
    rerender(rowTo("/\\example.com/orders"));
    await user.click(screen.getByRole("cell"));
    expect(navigate).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledExactlyOnceWith("/\\example.com/orders");

    // A new tab with Ctrl, and with the middle button - by a URL of its own
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("cell"));
    await user.keyboard("{/Control}");
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "/\\example.com/orders",
      "_blank",
      "noopener,noreferrer",
    );
    expect(fireEvent.mouseDown(screen.getByRole("cell"), { button: 1 })).toBe(
      false,
    );
    auxClick(screen.getByRole("cell"));
    expect(open).toHaveBeenCalledTimes(2);

    // Also the page's own origin is loaded - its path has the base path of
    // the router, which takes paths without it
    rerender(rowTo(`${origin}/app/orders/42?tab=items`));
    await user.click(screen.getByRole("cell"));
    expect(navigate).not.toHaveBeenCalled();
    expect(assign).toHaveBeenLastCalledWith(
      `${origin}/app/orders/42?tab=items`,
    );

    // A path of the app goes to the router - but to no new tab: without its
    // base path it would be another page, only the router's Link knows it
    rerender(rowTo("/orders/42"));
    await user.click(screen.getByRole("cell"));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/orders/42");
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("cell"));
    await user.keyboard("{/Control}");
    expect(fireEvent.mouseDown(screen.getByRole("cell"), { button: 1 })).toBe(
      true,
    );
    auxClick(screen.getByRole("cell"));
    expect(open).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("opens the link of the row in a new tab on a click of the middle button", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    // A router under a base path - its links add it
    function BaseLink({ href, ...props }: LinkComponentProps) {
      return <a href={`/app${href}`} {...props} />;
    }
    render(
      <UIProvider router={{ Link: BaseLink }}>
        <Table>
          <TableBody>
            <TableRow href="/orders/42">
              <TableCell>
                <BaseLink data-row-link="" href="/orders/42">
                  Order 42
                </BaseLink>
              </TableCell>
              <TableCell>Jana</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </UIProvider>,
    );

    // The browser does not scroll by the pointer - the press opens the link
    expect(fireEvent.mouseDown(screen.getByText("Jana"), { button: 1 })).toBe(
      false,
    );
    auxClick(screen.getByText("Jana"));
    expect(open).toHaveBeenCalledExactlyOnceWith(
      new URL("/app/orders/42", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );

    // The link itself opens it - as any link does
    expect(fireEvent.mouseDown(screen.getByRole("link"), { button: 1 })).toBe(
      true,
    );
    auxClick(screen.getByRole("link"));
    // The right button is no activation
    fireEvent(
      screen.getByText("Jana"),
      new MouseEvent("auxclick", { bubbles: true, button: 2 }),
    );
    expect(open).toHaveBeenCalledOnce();
  });

  it("opens no new tab for the middle button after preventDefault()", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <Table>
        <TableBody>
          <TableRow
            href="/orders/42"
            onAuxClick={(event) => event.preventDefault()}
          >
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    auxClick(screen.getByText("Jana"));
    expect(open).not.toHaveBeenCalled();
  });

  it("does not follow its link for a click in a portal of the row", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>
              {/* A popover of the row - its clicks bubble to the row in React */}
              {createPortal(<p>Note of Jana</p>, document.body)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    screen.getByRole("link").addEventListener("click", followed);

    fireEvent.click(screen.getByText("Note of Jana"));
    fireEvent.click(screen.getByText("Note of Jana"), { ctrlKey: true });
    expect(
      fireEvent.mouseDown(screen.getByText("Note of Jana"), { button: 1 }),
    ).toBe(true);
    auxClick(screen.getByText("Note of Jana"));
    expect(followed).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("finds the link to href under the base path of a router, or after its #", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    function BaseLink({ href, ...props }: LinkComponentProps) {
      return <a href={`/app${href}`} {...props} />;
    }
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42?tab=items">
            <TableCell>
              <BaseLink href="/orders/42?tab=items">Order 42</BaseLink>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
          <TableRow href="/orders/43">
            <TableCell>
              <a href="#/orders/43">Order 43</a>
            </TableCell>
            <TableCell>Petr</TableCell>
          </TableRow>
          <TableRow href="/orders/44">
            <TableCell>
              {/* Not the link of the row - another path, another query */}
              <a href="/app/orders/44/items">Items</a>
              <a href="/app/orders/44?tab=items">Order 44</a>
            </TableCell>
            <TableCell>Eva</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const link of screen.getAllByRole("link")) {
      link.addEventListener("click", followed);
    }

    fireEvent.click(screen.getByText("Jana"));
    fireEvent.click(screen.getByText("Petr"));
    expect(followed.mock.calls.map(([event]) => event.target)).toEqual([
      screen.getByRole("link", { name: "Order 42" }),
      screen.getByRole("link", { name: "Order 43" }),
    ]);
    auxClick(screen.getByText("Jana"));
    expect(open).toHaveBeenCalledExactlyOnceWith(
      new URL("/app/orders/42?tab=items", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );
    expect(warn).not.toHaveBeenCalled();

    // No link of the row - it warns
    fireEvent.click(screen.getByText("Eva"));
    expect(followed).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("data-row-link"));
  });

  it("takes the link to href itself, not a longer path or another site", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const navigate = vi.fn();
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <UIProvider router={{ navigate }}>
        <Table>
          <TableBody>
            <TableRow href="/orders/5">
              <TableCell>
                <a href="/customers/9/orders/5">Customer's order 5</a>
              </TableCell>
              <TableCell>
                <a href="/orders/5">Order 5</a>
              </TableCell>
              <TableCell>Jana</TableCell>
            </TableRow>
            <TableRow href="/orders/6">
              <TableCell>
                {/* Under the base path of a router - the shorter path */}
                <a href="/customers/9/orders/6">Customer's order 6</a>
                <a href="/app/orders/6">Order 6</a>
              </TableCell>
              <TableCell>Petr</TableCell>
            </TableRow>
            <TableRow href="/repos/acme">
              <TableCell>
                {/* The same path on another site is another page */}
                <a href="https://github.com/repos/acme">GitHub</a>
              </TableCell>
              <TableCell>Acme</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </UIProvider>,
    );
    for (const link of screen.getAllByRole("link")) {
      link.addEventListener("click", followed);
    }

    fireEvent.click(screen.getByText("Jana"));
    fireEvent.click(screen.getByText("Petr"));
    expect(followed.mock.calls.map(([event]) => event.target)).toEqual([
      screen.getByRole("link", { name: "Order 5" }),
      screen.getByRole("link", { name: "Order 6" }),
    ]);
    auxClick(screen.getByText("Petr"));
    expect(open).toHaveBeenCalledExactlyOnceWith(
      new URL("/app/orders/6", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );
    expect(warn).not.toHaveBeenCalled();

    // The row with no link of its own goes to its href - not to the site
    fireEvent.click(screen.getByText("Acme"));
    expect(followed).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/repos/acme");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("data-row-link"));
    // Nor does the middle button open the site
    auxClick(screen.getByText("Acme"));
    expect(open).toHaveBeenCalledOnce();
  });

  it("takes a link after the # with what the browser encodes there", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    window.history.replaceState(null, "", "/list?page=2");
    render(
      <Table>
        <TableBody>
          {/* Its `hash` is percent-encoded, `href` is not */}
          <TableRow href="/orders?customer=Nováková">
            <TableCell>
              <a href="#/orders?customer=Nováková">Orders of Jana</a>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
          <TableRow href="/files/a b">
            <TableCell>
              <a href="#/files/a b">File</a>
            </TableCell>
            <TableCell>Petr</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const link of screen.getAllByRole("link")) {
      link.addEventListener("click", followed);
    }

    fireEvent.click(screen.getByText("Jana"));
    fireEvent.click(screen.getByText("Petr"));
    expect(followed.mock.calls.map(([event]) => event.target)).toEqual([
      screen.getByRole("link", { name: "Orders of Jana" }),
      screen.getByRole("link", { name: "File" }),
    ]);
    fireEvent.click(screen.getByText("Jana"), { ctrlKey: true });
    auxClick(screen.getByText("Petr"));
    expect(open.mock.calls.map(([url]) => url)).toEqual([
      `${window.location.origin}/list?page=2#/orders?customer=Nov%C3%A1kov%C3%A1`,
      `${window.location.origin}/list?page=2#/files/a%20b`,
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("finds the link to an href with spaces around it, as the browser reads it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    function BaseLink({ href, ...props }: LinkComponentProps) {
      return <a href={`/app${href.trim()}`} {...props} />;
    }
    render(
      <Table>
        <TableBody>
          <TableRow href=" /orders/42">
            <TableCell>
              <BaseLink href=" /orders/42">Order 42</BaseLink>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
          <TableRow href={"/orders/43 \n"}>
            <TableCell>
              <a href="#/orders/43">Order 43</a>
            </TableCell>
            <TableCell>Petr</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const link of screen.getAllByRole("link")) {
      link.addEventListener("click", followed);
    }

    fireEvent.click(screen.getByText("Jana"));
    fireEvent.click(screen.getByText("Petr"));
    expect(followed.mock.calls.map(([event]) => event.target)).toEqual([
      screen.getByRole("link", { name: "Order 42" }),
      screen.getByRole("link", { name: "Order 43" }),
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("finds the link to an absolute URL of the page's origin by its path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <Table>
        <TableBody>
          <TableRow href={new URL("/orders/42", window.location.href).href}>
            <TableCell>
              <a href="/orders/42">Order 42</a>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    screen.getByRole("link").addEventListener("click", followed);

    fireEvent.click(screen.getByText("Jana"));
    expect(followed).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it("takes no link after the # of another page or site", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const navigate = vi.fn();
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <UIProvider router={{ navigate }}>
        <Table>
          <TableBody>
            <TableRow href="/orders/43">
              <TableCell>
                {/* Another app - the same path is another page there */}
                <a href="https://other.example/#/orders/43">Other site</a>
                <a href="/legacy/#/orders/43">Legacy</a>
              </TableCell>
              <TableCell>Eva</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </UIProvider>,
    );
    for (const link of screen.getAllByRole("link")) {
      link.addEventListener("click", followed);
    }

    // The row with no link of its own goes to its href
    fireEvent.click(screen.getByText("Eva"));
    expect(followed).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/orders/43");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("data-row-link"));
    // Nor does the middle button open it
    auxClick(screen.getByText("Eva"));
    expect(open).not.toHaveBeenCalled();
  });

  it("takes the link a hash router renders under a <base> - the page's URL with the #", () => {
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState(null, "", "/list?page=2");
    const base = document.createElement("base");
    base.href = "/app/";
    document.head.append(base);
    try {
      render(
        <Table>
          <TableBody>
            <TableRow href="/orders/42">
              <TableCell>
                {/* Another page - the base resolves it to /app/ */}
                <a href="#/orders/42">Order 42 in the app</a>
                <a href={`${window.location.href}#/orders/42`}>Order 42</a>
              </TableCell>
              <TableCell>Jana</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      screen
        .getByRole("link", { name: "Order 42" })
        .addEventListener("click", followed);

      fireEvent.click(screen.getByText("Jana"));
      expect(followed).toHaveBeenCalledOnce();
    } finally {
      base.remove();
    }
  });

  it("opens no new tab for a disabled link of the row", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>
              {/* A disabled link has no href */}
              <a aria-disabled="true" data-row-link="" role="link">
                Order 42
              </a>
            </TableCell>
            <TableCell>Jana</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(fireEvent.mouseDown(screen.getByText("Jana"), { button: 1 })).toBe(
      true,
    );
    auxClick(screen.getByText("Jana"));
    expect(open).not.toHaveBeenCalled();
  });

  it("renders no row again on a navigation - only rows with href read the router", () => {
    const onRender = vi.fn();
    render(
      <Table>
        <TableHead>
          <Profiler id="head" onRender={onRender}>
            <TableRow>
              <TableCell>Order</TableCell>
            </TableRow>
          </Profiler>
        </TableHead>
        <TableBody>
          <Profiler id="body" onRender={onRender}>
            <TableRow>
              <TableCell>Order 41</TableCell>
            </TableRow>
            <TableRow href="/orders/42">
              <TableCell>
                <a data-row-link="" href="/orders/42">
                  Order 42
                </a>
              </TableCell>
            </TableRow>
          </Profiler>
        </TableBody>
      </Table>,
    );
    onRender.mockClear();

    act(() => browserNavigate("/orders?page=2"));
    expect(onRender).not.toHaveBeenCalled();
  });

  it("calls the latest navigate of a router - one it changes on a navigation", async () => {
    const user = userEvent.setup();
    const navigated: string[] = [];
    // The same element on every render. A `Profiler` would not tell whether
    // the row renders again - React passes a change of a context by it; the
    // tests of `UIProvider` count what reads its contexts instead.
    const table = (
      <Table>
        <TableBody>
          <TableRow href="/orders/42">
            <TableCell>Order 42</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    // An inline adapter - a new `navigate` with every location
    const renderAt = (pathname: string) => (
      <UIProvider
        router={{
          navigate: (href) => navigated.push(`${href} from ${pathname}`),
          pathname,
          search: "",
        }}
      >
        {table}
      </UIProvider>
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = render(renderAt("/orders"));
    rerender(renderAt("/orders/41"));

    await user.click(screen.getByRole("cell"));
    expect(navigated).toEqual(["/orders/42 from /orders/41"]);
  });
});
