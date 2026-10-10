import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Card from "./card";
import type { LinkComponentProps } from "../../providers/router";
import UIProvider from "../../providers/ui-provider";

describe("Card", () => {
  it("lays out its header, content and footer", () => {
    render(
      <Card
        actions={<button type="button">Edit</button>}
        description="Last 30 days"
        footer={<a href="/orders">View all</a>}
        media={<img alt="Chart" src="/chart.png" />}
        title="Orders"
      >
        <p>128 new orders</p>
      </Card>,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Orders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(screen.getByText("128 new orders")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Chart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toBeInTheDocument();
  });

  it("titles itself with a heading of the level given", () => {
    render(<Card headingLevel={2} title="Revenue" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Revenue" }),
    ).toBeInTheDocument();
  });

  it("is a link through its title - with the router's Link", () => {
    const links: string[] = [];
    function RouterLink({ href, ...props }: LinkComponentProps) {
      links.push(href);
      return <a href={href} {...props} />;
    }

    render(
      <UIProvider router={{ Link: RouterLink }}>
        <Card
          actions={<button type="button">Pin</button>}
          description="3 open tasks"
          href="/projects/42"
          title="Website"
        >
          Due Friday
        </Card>
      </UIProvider>,
    );

    // Named by the title alone, not by all of the card
    const link = screen.getByRole("link", { name: "Website" });
    expect(link).toHaveAttribute("href", "/projects/42");
    expect(links).toContain("/projects/42");
    // Stretched over the card, which draws its focus ring - an outline in
    // forced colors mode, which drops rings
    expect(link).toHaveClass("after:absolute", "after:inset-0");
    expect(link.closest("[class*='has-']")).toHaveClass(
      "forced-colors:has-[[data-card-link]:focus-visible]:outline-2",
    );
    expect(link).toHaveClass("focus:outline-hidden");
    // No control in the link - the actions stay a button of their own, above it
    expect(link).not.toContainElement(
      screen.getByRole("button", { name: "Pin" }),
    );
    expect(
      screen.getByRole("button", { name: "Pin" }).parentElement,
    ).toHaveClass("relative", "z-10");
  });

  it("calls onClick of its link before it is followed - preventDefault() keeps the page", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    // A router's Link - it follows a click its `onClick` has not prevented
    function RouterLink({ href, onClick, ...props }: LinkComponentProps) {
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
    const targets: EventTarget[] = [];
    const onOpen = vi.fn((event: React.MouseEvent) => {
      targets.push(event.currentTarget);
    });
    const onStay = vi.fn((event: React.MouseEvent) => event.preventDefault());

    render(
      <UIProvider router={{ Link: RouterLink }}>
        <Card href="/projects/42" onClick={onOpen} title="Website" />
        <Card href="/projects/7" onClick={onStay} title="Billing" />
      </UIProvider>,
    );

    // Still a link, not a button
    const link = screen.getByRole("link", { name: "Website" });
    expect(screen.queryByRole("button")).toBeNull();
    await user.click(link);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(targets).toEqual([link]);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/projects/42");

    await user.click(screen.getByRole("link", { name: "Billing" }));
    expect(onStay).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("is a button through its title with onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card onClick={onClick} title="Standard shipping">
        3-5 days
      </Card>,
    );

    const button = screen.getByRole("button", { name: "Standard shipping" });
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Reached by the keyboard like any button
    await user.tab();
    await user.tab({ shift: true });
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("shows placeholders while loading - busy, without actions or a link", () => {
    const { container } = render(
      <Card
        actions={<button type="button">Edit</button>}
        footer="Footer"
        href="/orders"
        loading
        title="Orders"
      >
        Content
      </Card>,
    );

    const card = container.firstElementChild!;
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Orders")).toBeNull();
    expect(screen.queryByText("Content")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Footer")).toBeNull();
    expect(card.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("warns about a clickable card without a title", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Card href="/orders">Orders</Card>);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`title`"));
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows content next to its title, also in a clickable card", async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();
    render(
      <Card
        afterTitle={
          <button onClick={onHelp} type="button">
            Help
          </button>
        }
        href="/orders/42"
        title="Order 42"
      />,
    );

    expect(screen.getByRole("heading", { name: "Order 42" })).toHaveClass(
      "font-heading",
      "text-section-title",
    );
    // Above the stretched link of the title
    const help = screen.getByRole("button", { name: "Help" });
    expect(help.parentElement).toHaveClass("relative", "z-10");
    await user.click(help);
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("reaches its edges with the picture and the footer at any padding", () => {
    render(
      <Card
        data-testid="card"
        footer="Footer"
        media={<img alt="" src="/cover.png" />}
        padding="responsive"
        title="Trip"
      />,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveClass(
      "p-(--cui-panel-padding)",
      "[--cui-panel-padding:--spacing(4)]",
      "sm:[--cui-panel-padding:--spacing(6)]",
    );
    expect(card.querySelector("img")!.parentElement).toHaveClass(
      "-mx-(--cui-panel-padding)",
      "-mt-(--cui-panel-padding)",
    );
    expect(screen.getByText("Footer")).toHaveClass(
      "-mx-(--cui-panel-padding)",
      "-mb-(--cui-panel-padding)",
      "px-(--cui-panel-padding)",
    );
  });

  it("passes its props to the surface", () => {
    render(
      <Card border="neutral" data-testid="card" id="summary" title="Summary" />,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("id", "summary");
    expect(card).toHaveClass("border-neutral-200");
  });
});
