import { render, screen, within } from "@testing-library/react";
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
