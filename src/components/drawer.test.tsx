import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog from "./dialog";
import Drawer from "./drawer";
import DrawerProvider from "../providers/drawer-provider";
import { useDrawer } from "../providers/drawer-context";
import UIProvider from "../providers/ui-provider";

describe("Drawer", () => {
  it("marks only the most specific matching item as active", () => {
    render(
      <UIProvider router={{ pathname: "/users/new", search: "" }}>
        <DrawerProvider storageKey={null}>
          <Drawer
            items={[
              { href: "/", label: "Home" },
              {
                children: [
                  { href: "/users", label: "All users" },
                  { href: "/users/new", label: "New user" },
                ],
                label: "Users",
              },
            ]}
          />
        </DrawerProvider>
      </UIProvider>,
    );

    expect(screen.getByRole("link", { name: "New user" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All users" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("Drawer collapsed to icons", () => {
  const renderCollapsed = () => {
    localStorage.setItem("drawer-collapsed", "true");
    render(
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider>
          <Drawer
            items={[
              {
                children: [
                  { href: "/users", label: "All users" },
                  { href: "/users/new", label: "New user" },
                ],
                icon: "U",
                label: "Users",
              },
              { href: "/reports", icon: "R", label: "Reports" },
            ]}
          />
        </DrawerProvider>
      </UIProvider>,
    );
  };

  it("opens the children of a group from the keyboard", async () => {
    const user = userEvent.setup();
    renderCollapsed();

    const group = await screen.findByRole("button", { name: "Users" });
    expect(group).toHaveAttribute("aria-expanded", "false");

    group.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("link", { name: "All users" })).toHaveFocus();
    expect(group).toHaveAttribute("aria-expanded", "true");

    // Escape closes them and gives the focus back to the group
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "All users" })).toBeNull();
    expect(group).toHaveFocus();
  });

  it("goes on from the last child to the next item with Tab", async () => {
    const user = userEvent.setup();
    renderCollapsed();

    const group = await screen.findByRole("button", { name: "Users" });
    group.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("link", { name: "New user" })).toHaveFocus();

    await user.tab();
    expect(screen.queryByRole("link", { name: "New user" })).toBeNull();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveFocus();
  });
});

describe("Drawer slid in on a phone", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function Toggle() {
    const { toggleOpen } = useDrawer();
    return (
      <button onClick={toggleOpen} type="button">
        Menu
      </button>
    );
  }

  function WithDialog() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)} type="button">
          Help
        </button>
        <Dialog onClose={() => setOpen(false)} open={open} title="Help">
          <input aria-label="Search" />
        </Dialog>
      </>
    );
  }

  const renderOnPhone = () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: () => {},
        matches: true,
        media: query,
        removeEventListener: () => {},
      })),
    );
    render(
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider storageKey={null}>
          <Toggle />
          <Drawer
            header={<WithDialog />}
            items={[
              { href: "/users", label: "Users" },
              { href: "/reports", label: "Reports" },
            ]}
          />
        </DrawerProvider>
      </UIProvider>,
    );
  };

  it("is modal: takes the focus, keeps Tab and the page scroll, gives the focus back", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.tab({ shift: true });
    expect(screen.getByRole("link", { name: "Reports" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();

    // Focus that lands on the page comes back into the drawer
    act(() => toggle.focus());
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary", { hidden: true })).toHaveAttribute(
      "inert",
    );
    expect(toggle).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("leaves Escape to a Dialog opened above it", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("complementary")).not.toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary", { hidden: true })).toHaveAttribute(
      "inert",
    );
  });
});
