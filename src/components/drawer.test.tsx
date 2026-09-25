import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog from "./dialog";
import Drawer from "./drawer";
import DrawerProvider from "../providers/drawer-provider";
import { useDrawer } from "../providers/drawer-context";
import UIProvider from "../providers/ui-provider";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  it("marks the item whose query the page has, of items of one path", () => {
    render(
      <UIProvider router={{ pathname: "/tasks", search: "?filter=mine" }}>
        <DrawerProvider storageKey={null}>
          <Drawer
            items={[
              { href: "/tasks?filter=all", label: "All tasks" },
              { href: "/tasks?filter=mine", label: "My tasks" },
            ]}
          />
        </DrawerProvider>
      </UIProvider>,
    );

    expect(screen.getByRole("link", { name: "My tasks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All tasks" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is the named navigation landmark of the app", () => {
    render(
      <DrawerProvider storageKey={null}>
        <Drawer items={[{ href: "/users", label: "Users" }]} />
      </DrawerProvider>,
    );

    // One landmark - no complementary one around the navigation
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toContainElement(screen.getByRole("link", { name: "Users" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("keeps the state of a group when entries before it come and go", async () => {
    const user = userEvent.setup();
    const at = (canAdmin: boolean) => (
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider storageKey={null}>
          <Drawer
            items={[
              // Written as the permissions allow - the group appears later
              canAdmin && {
                children: [{ href: "/admin/users", label: "Admin users" }],
                label: "Administration",
              },
              {
                children: [{ href: "/reports/sales", label: "Sales" }],
                label: "Reports",
              },
            ]}
          />
        </DrawerProvider>
      </UIProvider>
    );

    const { rerender } = render(at(false));
    await user.click(screen.getByRole("button", { name: "Reports" }));

    rerender(at(true));
    expect(screen.getByRole("button", { name: "Reports" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Administration" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("expands a group when the current page moves into it", async () => {
    const user = userEvent.setup();
    const items = [
      { href: "/", label: "Home" },
      {
        children: [{ href: "/users", label: "All users" }],
        label: "Users",
      },
      {
        children: [{ href: "/reports/sales", label: "Sales" }],
        label: "Reports",
      },
    ];
    const at = (pathname: string) => (
      <UIProvider router={{ pathname, search: "" }}>
        <DrawerProvider storageKey={null}>
          <Drawer items={items} />
        </DrawerProvider>
      </UIProvider>
    );

    const { rerender } = render(at("/"));
    expect(screen.queryByRole("link", { name: "All users" })).toBeNull();
    // A group the user expands stays expanded
    await user.click(screen.getByRole("button", { name: "Reports" }));

    rerender(at("/users"));
    expect(screen.getByRole("button", { name: "Users" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "All users" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Sales" })).toBeInTheDocument();
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

  it("keeps the children open while the pointer moves between them and the group", async () => {
    const user = userEvent.setup();
    renderCollapsed();

    const group = await screen.findByRole("button", { name: "Users" });
    await user.hover(group);
    // Diagonally over the edge of the drawer, past the narrow bridge
    await user.hover(screen.getByRole("navigation"));
    await user.hover(await screen.findByRole("link", { name: "New user" }));
    await act(() => sleep(80));
    expect(screen.getByRole("link", { name: "New user" })).toBeInTheDocument();

    // Back up onto the group
    await user.hover(group);
    await act(() => sleep(80));
    expect(screen.getByRole("link", { name: "New user" })).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-expanded", "true");

    await user.hover(screen.getByRole("link", { name: "Reports" }));
    await act(() => sleep(80));
    expect(screen.queryByRole("link", { name: "New user" })).toBeNull();
  });

  it("shows the first letter of an item without an icon", async () => {
    localStorage.setItem("drawer-collapsed", "true");
    render(
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider>
          <Drawer
            items={[
              { href: "/orders", label: "orders" },
              {
                children: [{ href: "/settings/team", label: "Team" }],
                label: "Settings",
              },
            ]}
          />
        </DrawerProvider>
      </UIProvider>,
    );

    const link = await screen.findByRole("link", { name: "orders" });
    expect(link).toHaveTextContent("O");
    expect(link).toHaveAttribute("title", "orders");
    expect(screen.getByRole("button", { name: "Settings" })).toHaveTextContent(
      "S",
    );
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
    // Hidden, it has no name
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "inert",
    );
    expect(toggle).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("is a modal dialog with its backdrop right before it", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = screen.getByRole("dialog", { name: "Main navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    // Not portaled: in a transformed parent (the docs demo) a backdrop in
    // the body would paint over the drawer
    const drawer = screen.getByRole("navigation", { name: "Main navigation" });
    const backdrop = screen.getByRole("button", { name: "Close" });
    expect(backdrop.nextElementSibling).toBe(drawer);

    await user.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("hides the page next to it from assistive technology - not its backdrop", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    // A screen reader on a touch screen closes it with the backdrop
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(toggle).toHaveAttribute("aria-hidden", "true");

    await user.keyboard("{Escape}");
    expect(toggle).not.toHaveAttribute("aria-hidden");
  });

  it("stays closed while a server-rendered page hydrates on a phone", async () => {
    const ui = (
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider storageKey={null}>
          <Toggle />
          <Drawer items={[{ href: "/users", label: "Users" }]} />
        </DrawerProvider>
      </UIProvider>
    );
    // The server cannot know the device - it renders the desktop layout
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui);
    document.body.append(container);

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: () => {},
        matches: true,
        media: query,
        removeEventListener: () => {},
      })),
    );
    const focused: EventTarget[] = [];
    const recordFocus = (event: FocusEvent) => focused.push(event.target!);
    document.addEventListener("focusin", recordFocus);
    const styles: string[] = [];
    const observer = new MutationObserver(() =>
      styles.push(document.body.style.overflow),
    );
    observer.observe(document.body, { attributeFilter: ["style"] });

    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      await act(() => sleep(0));

      expect(container.querySelector(".cui-drawer")).toHaveAttribute("inert");
      // Never slid in on the way: no scroll lock, no focus moved in
      expect(styles).not.toContain("hidden");
      expect(focused).toEqual([]);
    } finally {
      document.removeEventListener("focusin", recordFocus);
      observer.disconnect();
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("leaves Escape to a Dialog opened above it", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Help" })).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).not.toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "inert",
    );
  });

  it("stays open on the Escape that ends an IME composition", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const help = screen.getByRole("button", { name: "Help" });
    fireEvent.keyDown(help, { isComposing: true, key: "Escape" });
    fireEvent.keyDown(help, { key: "Escape", keyCode: 229 });
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).not.toHaveAttribute("inert");

    fireEvent.keyDown(help, { key: "Escape" });
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "inert",
    );
  });
});
