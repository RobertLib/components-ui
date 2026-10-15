import { render, screen, within } from "@testing-library/react";
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

  it("shows the path to the page above the title", () => {
    const { container } = render(
      <UIProvider locale={cs}>
        <Header
          breadcrumbs={[
            { href: "/customers", label: "Zákazníci" },
            { label: "Novák s.r.o." },
          ]}
          title="Novák s.r.o."
        />
      </UIProvider>,
    );

    const nav = screen.getByRole("navigation", { name: "Drobečková navigace" });
    expect(
      within(nav).getByRole("link", { name: "Zákazníci" }),
    ).toHaveAttribute("href", "/customers");
    expect(within(nav).getByText("Novák s.r.o.")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Before the heading - read first, also by screen readers
    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      nav.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // A line of its own
    expect(nav.parentElement).toHaveClass("basis-full");
    expect(container.firstElementChild).toBe(nav.parentElement?.parentElement);
  });

  it("takes breadcrumbs of its own, and none for an empty path", () => {
    const { rerender } = render(
      <Header
        breadcrumbs={<nav aria-label="Path">Custom</nav>}
        title="Settings"
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Path" }),
    ).toBeInTheDocument();

    rerender(<Header breadcrumbs={[]} title="Home" />);
    expect(screen.queryByRole("navigation")).toBeNull();

    // An array of elements is content, not crumbs
    rerender(
      <Header
        breadcrumbs={[<span key="a">Reports</span>, <span key="b">2026</span>]}
        title="Reports"
      />,
    );
    expect(
      screen.getByText("Reports", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows its children under the title, across the header", () => {
    const { container } = render(
      <Header title="Invoice 2026-0042">
        <p>Due 31 Oct 2026</p>
      </Header>,
    );

    const content = screen.getByText("Due 31 Oct 2026").parentElement;
    expect(content).toHaveClass("basis-full");
    expect(container.firstElementChild?.lastElementChild).toBe(content);
  });

  it("leaves the back arrow and the actions out when printed", () => {
    render(
      <Header
        actions={<button type="button">Export</button>}
        backHref="/orders"
        title="Order 42"
      />,
    );

    expect(screen.getByRole("link", { name: "Back" })).toHaveClass(
      "print:hidden",
    );
    expect(
      screen.getByRole("button", { name: "Export" }).parentElement,
    ).toHaveClass("print:hidden");
  });
});
