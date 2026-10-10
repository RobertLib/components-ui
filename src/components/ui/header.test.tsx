import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Header from "./header";
import { cs } from "../../i18n/ui/cs";
import type { LinkComponentProps } from "../../providers/router";
import UIProvider from "../../providers/ui-provider";

describe("Header", () => {
  it("is the heading of the page with its actions", () => {
    render(
      <Header actions={<button type="button">New</button>} title="Orders" />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("says the title is loading - the heading is never empty", () => {
    const { rerender } = render(<Header title={null} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Loading…" }),
    ).toBeInTheDocument();

    rerender(
      <UIProvider locale={cs}>
        <Header title={undefined} />
      </UIProvider>,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: cs.messages.ui.common.loading,
      }),
    ).toBeInTheDocument();
  });

  it("goes back through the router, or as onBack says", async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    const { rerender } = render(
      <UIProvider router={{ back }}>
        <Header back title="Order 42" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalledOnce();
    // Not with the click event - a router's `back` may read an argument
    expect(back).toHaveBeenCalledWith();

    const onBack = vi.fn();
    rerender(
      <UIProvider router={{ back }}>
        <Header back onBack={onBack} title="Order 42" />
      </UIProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledWith();
    expect(back).toHaveBeenCalledOnce();
  });

  it("links back to a page of its own, and shows a line under the title", () => {
    render(
      <UIProvider>
        <Header
          backHref="/orders?status=open"
          description="Created 1 Oct 2026"
          title="Order 42"
        />
      </UIProvider>,
    );

    // A link - not the history, which a page opened directly has not got
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/orders?status=open",
    );
    expect(screen.getByText("Created 1 Oct 2026")).toBeInTheDocument();
    // The heading is the title alone
    expect(
      screen.getByRole("heading", { level: 1, name: "Order 42" }),
    ).toHaveClass("font-heading", "text-page-title");
  });

  it("calls onBack at the click of the back link - it can keep the page", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    // A router's link - it leaves a prevented click alone
    function Link({ href, onClick, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            navigate(href);
          }}
        />
      );
    }
    const onBack = vi.fn();
    const { rerender } = render(
      <UIProvider router={{ Link }}>
        <Header backHref="/orders" onBack={onBack} title="Order 42" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("link", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/orders");

    // Unsaved changes - the page stays
    rerender(
      <UIProvider router={{ Link }}>
        <Header
          backHref="/orders"
          onBack={(event) => event?.preventDefault()}
          title="Order 42"
        />
      </UIProvider>,
    );
    await user.click(screen.getByRole("link", { name: "Back" }));
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("calls onBack not at a click opening the back link in a new tab", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Header backHref="/orders" onBack={onBack} title="Order 42" />);
    const link = screen.getByRole("link", { name: "Back" });
    // The browser opens the tab - here it would load the page
    link.addEventListener("click", (event) => event.preventDefault());

    for (const key of ["Control", "Meta", "Shift"]) {
      await user.keyboard(`{${key}>}`);
      await user.click(link);
      await user.keyboard(`{/${key}}`);
    }
    expect(onBack).not.toHaveBeenCalled();

    await user.click(link);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("titles a section or a dialog with the heading level given", () => {
    render(
      <>
        <Header title="Orders" />
        <Header headingLevel={2} title="Items" />
      </>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Items" }),
    ).toBeInTheDocument();
  });
});
