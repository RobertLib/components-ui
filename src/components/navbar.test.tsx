import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Navbar from "./navbar";
import DrawerProvider from "../providers/drawer-provider";

const onPhone = () =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: () => {},
      matches: true,
      media: query,
      removeEventListener: () => {},
    })),
  );

describe("Navbar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells whether the drawer is expanded on desktop", async () => {
    const user = userEvent.setup();
    render(
      <DrawerProvider storageKey={null}>
        <Navbar />
      </DrawerProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("tells whether the drawer is slid in on a phone", async () => {
    const user = userEvent.setup();
    onPhone();
    render(
      <DrawerProvider storageKey={null}>
        <Navbar />
      </DrawerProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Toggle menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the drawer toggle with noDrawerToggle", () => {
    render(
      <DrawerProvider storageKey={null}>
        <Navbar noDrawerToggle>Search</Navbar>
      </DrawerProvider>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    // The banner of the page - no navigation of its own
    expect(screen.getByRole("banner")).toHaveTextContent("Search");
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("names the user menu once, also with a picture", async () => {
    const user = userEvent.setup();
    const logOut = vi.fn();
    render(
      <Navbar
        noDrawerToggle
        user={{
          avatarUrl: "/jana.png",
          description: "Administrator",
          menuItems: [{ label: "Log out", onClick: logOut }],
          name: "Jana Nováková",
        }}
      />,
    );

    const menuButton = screen.getByRole("button", {
      name: "Jana Nováková Administrator",
    });
    await user.click(menuButton);
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));
    expect(logOut).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner instead of the right side while loading", () => {
    render(
      <Navbar
        actions={<button type="button">Help</button>}
        loading
        noDrawerToggle
        user={{ name: "Jana Nováková" }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
    expect(screen.queryByText("Jana Nováková")).toBeNull();
  });
});
