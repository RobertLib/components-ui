import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AppShell from "./app-shell";
import Drawer from "./drawer";
import Navbar from "./navbar";
import SystemBanner from "./system-banner";
import UIProvider from "../../providers/ui-provider";

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
    expect(drawer).toHaveClass("cui-drawer");
    expect(navbar).toHaveClass("cui-navbar");
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
    ).toHaveClass("cui-drawer-collapsed");
    expect(localStorage.getItem("drawer-collapsed")).toBe("true");
  });

  it("remembers nothing with drawerStorageKey={null}", async () => {
    const user = userEvent.setup();
    renderShell(null);

    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveClass("cui-drawer-collapsed");
    expect(localStorage.length).toBe(0);
  });

  it("stacks its banners above the navbar - beside the drawer", () => {
    const { container } = render(
      <AppShell
        banner={
          <>
            <SystemBanner variant="warning">TEST environment</SystemBanner>
            <SystemBanner variant="neutral">
              Signed in as Jana Nováková
            </SystemBanner>
          </>
        }
        drawer={<Drawer items={[{ href: "/orders", label: "Orders" }]} />}
        navbar={<Navbar />}
      >
        Page
      </AppShell>,
    );

    // The layout CSS moves the banners aside for the drawer too
    const [drawer, banners, navbar, main] = Array.from(container.children);
    expect(drawer).toHaveClass("cui-drawer");
    expect(banners).toHaveClass("cui-banners");
    expect(navbar).toHaveClass("cui-navbar");
    expect(main.tagName).toBe("MAIN");
    expect(
      Array.from(banners.children).map((banner) => banner.textContent),
    ).toEqual(["TEST environment", "Signed in as Jana Nováková"]);
  });

  it("renders no banner area without banners", () => {
    const { container } = render(
      <AppShell banner={false} navbar={<Navbar />}>
        Page
      </AppShell>,
    );

    expect(container.querySelector(".cui-banners")).toBeNull();
  });
});
