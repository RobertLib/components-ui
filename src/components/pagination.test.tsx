import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
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
