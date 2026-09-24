import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AppShell from "./app-shell";
import Drawer from "./drawer";
import Navbar from "./navbar";
import UIProvider from "../providers/ui-provider";

const renderShell = (drawerStorageKey?: string | null) =>
  render(
    <UIProvider router={{ pathname: "/orders", search: "" }}>
      <AppShell
        aria-label="Content"
        className="p-6"
        drawer={<Drawer items={[{ href: "/orders", label: "Orders" }]} />}
        drawerStorageKey={drawerStorageKey}
        navbar={<Navbar />}
      >
        <h1>Orders</h1>
      </AppShell>
    </UIProvider>,
  );

describe("AppShell", () => {
  it("renders the drawer, the navbar and the page as siblings", () => {
    const { container } = renderShell();

    // The layout CSS moves the navbar and main aside for the drawer
    const [drawer, navbar, main] = Array.from(container.children);
    expect(drawer).toHaveClass("drawer");
    expect(navbar).toHaveClass("navbar");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveClass("min-w-0", "p-6");
    expect(main).toHaveAttribute("aria-label", "Content");
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();

    // The landmarks of the page: one navigation, the banner, the content
    expect(screen.getAllByRole("navigation")).toEqual([drawer]);
    expect(screen.getByRole("banner")).toBe(navbar);
    expect(screen.getByRole("main", { name: "Content" })).toBe(main);
  });

  it("provides the drawer state the navbar toggles and remembers it", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveClass("drawer-collapsed");
    expect(localStorage.getItem("drawer-collapsed")).toBe("true");
  });

  it("remembers nothing with drawerStorageKey={null}", async () => {
    const user = userEvent.setup();
    renderShell(null);

    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveClass("drawer-collapsed");
    expect(localStorage.length).toBe(0);
  });
});
