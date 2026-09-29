import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Pagination from "./pagination";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

describe("Pagination", () => {
  it("passes its props to the navigation landmark", () => {
    render(
      <Pagination
        aria-label="Invoice pages"
        className="justify-end"
        data-testid="pages"
        id="invoice-pages"
        onChange={() => {}}
        total={45}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Invoice pages" });
    expect(nav).toHaveAttribute("id", "invoice-pages");
    expect(nav).toHaveClass("justify-end");
    expect(screen.getByTestId("pages")).toBe(nav);
    expect(screen.getByRole("list")).not.toHaveAttribute("id");
  });

  it("names the landmark by default", () => {
    render(<Pagination onChange={() => {}} total={45} />);

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
  });

  it("writes the range as the language writes numbers", () => {
    const { rerender } = render(
      <Pagination currentPage={3} onChange={() => {}} total={1234567} />,
    );
    expect(screen.getByRole("navigation")).toHaveTextContent(
      "41–60 of 1,234,567",
    );

    rerender(
      <UIProvider locale={cs}>
        <Pagination currentPage={3} onChange={() => {}} total={1234567} />
      </UIProvider>,
    );
    expect(screen.getByRole("navigation")).toHaveTextContent(
      "41–60 z 1 234 567",
    );
  });

  it("keeps the focus on a button that becomes unavailable", async () => {
    const user = userEvent.setup();

    function Pages() {
      const [page, setPage] = useState(9);
      return (
        <>
          <Pagination
            currentPage={page}
            onChange={(direction) =>
              setPage((current) =>
                direction === "last"
                  ? 10
                  : direction === "next"
                    ? current + 1
                    : direction === "first"
                      ? 1
                      : current - 1,
              )
            }
            pageSize={10}
            total={100}
          />
          <button type="button">After</button>
        </>
      );
    }
    render(<Pages />);

    // Next onto the last page - no next page after it
    const next = screen.getByRole("button", { name: "Next page" });
    next.focus();
    await user.keyboard("{Enter}");

    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toBeEnabled();
    // Pressed again, it does nothing
    await user.keyboard("{Enter}");
    expect(screen.getByRole("navigation")).toHaveTextContent("91–100 of 100");

    // Once the focus moves on, it is disabled like the others
    await user.tab();
    expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveFocus();
    expect(next).toBeDisabled();

    // First page - the pressed button itself becomes unavailable
    const first = screen.getByRole("button", { name: "First page" });
    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Pagination of a cursor connection", () => {
  const pageInfo = {
    endCursor: "c20",
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: "c1",
  };

  it("waits after a move until the load it reports ends", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Pagination loading={false} onChange={onChange} pageInfo={pageInfo} />,
    );
    const next = screen.getByRole("button", { name: "Next page" });

    await user.click(next);
    // The old cursors would repeat the move
    await user.click(next);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(next).toHaveAttribute("aria-disabled", "true");

    // The load failed - the same page info, the move can be tried again
    rerender(<Pagination loading onChange={onChange} pageInfo={pageInfo} />);
    rerender(
      <Pagination loading={false} onChange={onChange} pageInfo={pageInfo} />,
    );
    expect(next).not.toHaveAttribute("aria-disabled");
    await user.click(next);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not wait for good without a loading state", async () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<Pagination onChange={onChange} pageInfo={pageInfo} />);
      const next = screen.getByRole("button", { name: "Next page" });

      fireEvent.click(next);
      fireEvent.click(next);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(next).toHaveAttribute("aria-disabled", "true");

      // The load failed and nothing said so - the page info stays
      act(() => vi.advanceTimersByTime(10_000));
      expect(next).not.toHaveAttribute("aria-disabled");
      fireEvent.click(next);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith("next", "c20");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Pagination with numbered pages", () => {
  /** The visible items of the list - numbers and gaps. */
  const shownPages = () =>
    screen
      .getAllByRole("listitem", { hidden: true })
      .map((item) => item.textContent)
      .filter((text) => text && /^(\d+|…)$/.test(text));

  it.each([
    [1, ["1", "2", "3", "4", "5", "…", "10"]],
    [5, ["1", "…", "4", "5", "6", "…", "10"]],
    [10, ["1", "…", "6", "7", "8", "9", "10"]],
  ])("shows the pages around page %i with gaps", (page, expected) => {
    render(
      <Pagination
        currentPage={page}
        pageCount={10}
        onPageChange={() => {}}
        variant="pages"
      />,
    );

    expect(shownPages()).toEqual(expected);
  });

  it("shows every page of a short list, and the counts given", () => {
    const { rerender } = render(
      <Pagination currentPage={2} pageCount={4} variant="pages" />,
    );
    expect(shownPages()).toEqual(["1", "2", "3", "4"]);

    rerender(
      <Pagination
        boundaryCount={2}
        currentPage={10}
        pageCount={20}
        siblingCount={2}
        variant="pages"
      />,
    );
    expect(shownPages()).toEqual([
      "1",
      "2",
      "…",
      "8",
      "9",
      "10",
      "11",
      "12",
      "…",
      "19",
      "20",
    ]);
  });

  it("marks the current page and hides the gaps from screen readers", () => {
    render(<Pagination currentPage={5} pageCount={10} variant="pages" />);

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("button", { name: "Page 5" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("button", { name: "Page 4" }),
    ).not.toHaveAttribute("aria-current");
    // Also for styling - and in the colors of a selection in forced colors
    const current = within(nav).getByRole("button", { name: "Page 5" });
    expect(current).toHaveAttribute("data-current", "");
    expect(current).toHaveAttribute("data-selected", "");
    expect(current).toHaveClass(
      "forced-colors:bg-[Highlight]",
      "forced-colors:text-[HighlightText]",
    );
    const other = within(nav).getByRole("button", { name: "Page 4" });
    expect(other).not.toHaveAttribute("data-current");
    expect(other).not.toHaveAttribute("data-selected");
    expect(other).not.toHaveClass("forced-colors:bg-[Highlight]");
    for (const gap of within(nav).getAllByText("…")) {
      expect(gap).toHaveAttribute("aria-hidden", "true");
    }
    // The first and the last page are numbers - no buttons for them
    expect(
      within(nav).queryByRole("button", { name: "First page" }),
    ).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Last page" })).toBeNull();
  });

  it("goes to a page by its number - keeping the focus on it", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    function Pages() {
      const [page, setPage] = useState(1);
      return (
        <Pagination
          currentPage={page}
          onPageChange={(next) => {
            onPageChange(next);
            setPage(next);
          }}
          pageSize={10}
          total={100}
          variant="pages"
        />
      );
    }

    render(<Pages />);
    const five = screen.getByRole("button", { name: "Page 5" });
    await user.click(five);
    expect(onPageChange).toHaveBeenCalledWith(5);
    expect(five).toHaveFocus();
    expect(five).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("41–50 of 100")).toBeInTheDocument();

    // The current page does nothing
    await user.click(five);
    expect(onPageChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(5);
  });

  it("tells onPageChange the page of every button in offset mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        onChange={onChange}
        onPageChange={onPageChange}
        pageSize={10}
        total={95}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Last page" }));
    expect(onChange).toHaveBeenLastCalledWith("last");
    expect(onPageChange).toHaveBeenLastCalledWith(10);
    await user.click(screen.getByRole("button", { name: "First page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it("writes the page numbers as the language does", () => {
    render(
      <UIProvider locale={cs}>
        <Pagination currentPage={1200} pageCount={2000} variant="pages" />
      </UIProvider>,
    );

    const page = new Intl.NumberFormat("cs-CZ").format(1200);
    expect(
      screen.getByRole("button", { name: `Stránka ${page}` }).textContent,
    ).toBe(page);
  });

  it("stays compact in cursor mode, which has no page numbers", () => {
    render(
      <Pagination
        onChange={() => {}}
        pageInfo={{ hasNextPage: true, hasPreviousPage: false }}
        variant="pages"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Page / })).toBeNull();
    expect(
      screen.getByRole("button", { name: "First page" }),
    ).toBeInTheDocument();
  });

  it("does nothing while loading", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        loading
        onPageChange={onPageChange}
        pageCount={5}
        variant="pages"
      />,
    );

    const three = screen.getByRole("button", { name: "Page 3" });
    expect(three).toHaveAttribute("aria-disabled", "true");
    await user.click(three);
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

describe("Pagination extras", () => {
  it("picks the page size in a select", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <form>
        <Pagination
          onPageSizeChange={onPageSizeChange}
          pageSize={20}
          pageSizeOptions={[10, 20, 50]}
          total={200}
        />
      </form>,
    );

    const select = screen.getByRole("combobox", { name: "Per page" });
    expect(select).toHaveValue("20");
    await user.selectOptions(select, "50");
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    // Not a field of the form around it
    expect(select).not.toHaveAttribute("name");
    // In the landmark, beside the buttons
    expect(screen.getByRole("navigation")).toContainElement(select);
  });

  it("jumps to a page typed in - within the pages", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Pagination
          currentPage={1}
          onPageChange={onPageChange}
          pageCount={12}
          showJumpTo
        />
      </form>,
    );

    const field = screen.getByRole("spinbutton", { name: "Go to page" });
    await user.type(field, "7{Enter}");
    expect(onPageChange).toHaveBeenLastCalledWith(7);
    expect(field).toHaveValue(null);
    // The Enter goes to the page, it submits no form
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(field, "40");
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onPageChange).toHaveBeenLastCalledWith(12);

    // The page shown already, or no number
    await user.type(field, "1{Enter}");
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it("lays the extras out beside the list, with the class of the nav", () => {
    render(
      <Pagination
        className="justify-end"
        pageCount={3}
        pageSizeOptions={[10]}
        showJumpTo
      />,
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("flex", "flex-wrap", "justify-end");
  });
});
