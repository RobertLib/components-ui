import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Breadcrumbs from "./breadcrumbs";

describe("Breadcrumbs", () => {
  it("links the crumbs before the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { href: "/customers", label: "Customers" },
          { label: "Jana Nováková" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(nav).getByRole("link", { name: "Customers" }),
    ).toHaveAttribute("href", "/customers");
    expect(within(nav).getByText("Jana Nováková")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByText("Jana Nováková")).toHaveAttribute(
      "data-current",
      "",
    );
    expect(
      within(nav).getByRole("link", { name: "Customers" }),
    ).not.toHaveAttribute("data-current");
    expect(within(nav).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows a crumb without href as text instead of a link to /", () => {
    render(
      <Breadcrumbs
        home={false}
        items={[{ label: "Settings" }, { label: "Users" }]}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Settings").tagName).toBe("SPAN");
  });

  it("hides the separators from screen readers", () => {
    render(
      <Breadcrumbs
        items={[{ href: "/projects", label: "Projects" }, { label: null }]}
      />,
    );

    const separators = screen.getAllByText(">");
    expect(separators).toHaveLength(2);
    separators.forEach((separator) =>
      expect(separator).toHaveAttribute("aria-hidden", "true"),
    );
    // A label that is still loading
    expect(screen.getByText("...")).toHaveAttribute("aria-current", "page");
  });
});

describe("Breadcrumbs of a long path", () => {
  const path = [
    { href: "/projects", label: "Projects" },
    { href: "/projects/42", label: "Website" },
    { href: "/projects/42/pages", label: "Pages" },
    { href: "/projects/42/pages/7", label: "About" },
    { label: "Edit" },
  ];

  it("collapses to its ends with maxItems", () => {
    render(<Breadcrumbs items={path} maxItems={4} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Website" })).toBeNull();
    expect(within(nav).getByText("Edit")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("button", { name: "Show the whole path" }),
    ).toHaveTextContent("…");
  });

  it("shows the crumbs given before and after the gap", () => {
    render(
      <Breadcrumbs
        items={path}
        itemsAfterCollapse={2}
        itemsBeforeCollapse={2}
        maxItems={3}
      />,
    );

    const links = screen.getAllByRole("link").map((link) => link.textContent);
    // The house icon is hidden from screen readers
    expect(links).toEqual(["Home", "Projects", "About"]);
  });

  it("shows the whole path from the gap - the focus on the first crumb it brings", async () => {
    const user = userEvent.setup();
    render(<Breadcrumbs items={path} maxItems={3} />);

    await user.click(
      screen.getByRole("button", { name: "Show the whole path" }),
    );
    expect(screen.queryByRole("button")).toBeNull();
    // Home and the five crumbs
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveFocus();
  });

  it("does not collapse a path that fits", () => {
    render(<Breadcrumbs items={path} maxItems={6} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("takes a separator of its own", () => {
    const { container } = render(
      <Breadcrumbs
        items={[{ href: "/orders", label: "Orders" }, { label: "42" }]}
        separator={<svg data-testid="chevron" />}
      />,
    );

    const separators = screen.getAllByTestId("chevron");
    expect(separators).toHaveLength(2);
    const wrapper = separators[0].parentElement!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    // An icon is mirrored in a right-to-left page
    expect(wrapper).toHaveClass("rtl:[&>svg]:-scale-x-100");
    expect(container).not.toHaveTextContent(">");
  });
});
