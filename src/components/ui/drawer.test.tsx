import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog from "./dialog";
import Drawer from "./drawer";
import Dropdown from "./dropdown";
import Tooltip from "./tooltip";
import DrawerProvider from "../../providers/drawer-provider";
import { useDrawer } from "../../providers/drawer-context";
import UIProvider from "../../providers/ui-provider";

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
  afterEach(() => vi.useRealTimers());

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

  it("keeps the children open while the pointer moves between them and the group", () => {
    vi.useFakeTimers();
    renderCollapsed();

    const group = screen.getByRole("button", { name: "Users" });
    fireEvent.mouseEnter(group);
    const child = screen.getByRole("link", { name: "New user" });
    const navigation = screen.getByRole("navigation");
    // Diagonally over the edge of the drawer, past the narrow bridge
    fireEvent.mouseLeave(group, { relatedTarget: navigation });
    fireEvent.mouseEnter(child, { relatedTarget: navigation });
    act(() => vi.advanceTimersByTime(80));
    expect(screen.getByRole("link", { name: "New user" })).toBeInTheDocument();

    // Back up onto the group
    fireEvent.mouseLeave(child, { relatedTarget: group });
    fireEvent.mouseEnter(group, { relatedTarget: child });
    act(() => vi.advanceTimersByTime(80));
    expect(screen.getByRole("link", { name: "New user" })).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(group, {
      relatedTarget: screen.getByRole("link", { name: "Reports" }),
    });
    act(() => vi.advanceTimersByTime(80));
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
    expect(screen.getByRole("button", { name: "Settings" })).toHaveTextContent(
      "S",
    );
  });

  it("shows the name of an item in a tooltip - without describing the item with it", async () => {
    renderCollapsed();

    const link = await screen.findByRole("link", { name: "Reports" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(link);
    await act(() => sleep(250));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Reports");
    // Named by the label already - a screen reader would read it twice
    expect(link).not.toHaveAttribute("aria-describedby");

    fireEvent.mouseLeave(link);
    await act(() => sleep(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("marks a group holding the current page by its icon", async () => {
    localStorage.setItem("drawer-collapsed", "true");
    render(
      <UIProvider router={{ pathname: "/users/new", search: "" }}>
        <DrawerProvider>
          <Drawer
            items={[
              {
                children: [{ href: "/users/new", label: "New user" }],
                icon: "U",
                label: "Users",
              },
              {
                children: [{ href: "/reports/sales", label: "Sales" }],
                icon: "R",
                label: "Reports",
              },
            ]}
          />
        </DrawerProvider>
      </UIProvider>,
    );

    const users = await screen.findByRole("button", { name: "Users" });
    const reports = screen.getByRole("button", { name: "Reports" });
    expect(users).toHaveClass("bg-primary-50");
    expect(reports).not.toHaveClass("bg-primary-50");
  });

  it("shows a dot for a badge - and reads the badge in the name", async () => {
    localStorage.setItem("drawer-collapsed", "true");
    render(
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider>
          <Drawer
            items={[{ badge: 12, href: "/inbox", icon: "I", label: "Inbox" }]}
          />
        </DrawerProvider>
      </UIProvider>,
    );

    const link = await screen.findByRole("link", { name: "Inbox 12" });
    fireEvent.mouseEnter(link);
    await act(() => sleep(250));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Inbox12");
  });

  it("renders a header or footer function while collapsed - hides the others", async () => {
    localStorage.setItem("drawer-collapsed", "true");
    render(
      <DrawerProvider>
        <Drawer
          footer={<span>Version 2</span>}
          header={({ isCollapsed }) => (isCollapsed ? "Mark" : "Acme")}
          items={[{ href: "/", label: "Home" }]}
        />
      </DrawerProvider>,
    );

    expect(await screen.findByText("Mark")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByText("Version 2")).toBeNull();
  });
});

describe("Drawer sections, separators, badges and actions", () => {
  it("names the list of a section by its heading - and hides empty ones", () => {
    render(
      <DrawerProvider storageKey={null}>
        <Drawer
          items={[
            { href: "/", label: "Home" },
            {
              items: [
                { href: "/users", label: "Users" },
                { href: "/roles", label: "Roles" },
              ],
              label: "Administration",
              type: "section",
            },
            // Nothing the user may see
            { items: [false, null], label: "Billing", type: "section" },
          ]}
        />
      </DrawerProvider>,
    );

    const section = screen.getByRole("list", { name: "Administration" });
    expect(section).toContainElement(
      screen.getByRole("link", { name: "Users" }),
    );
    expect(section).toContainElement(
      screen.getByRole("link", { name: "Roles" }),
    );
    expect(screen.queryByText("Billing")).toBeNull();
  });

  it("keeps the heading of a section for screen readers while collapsed", async () => {
    localStorage.setItem("drawer-collapsed", "true");
    render(
      <DrawerProvider>
        <Drawer
          items={[
            {
              items: [{ href: "/users", icon: "U", label: "Users" }],
              label: "Administration",
              type: "section",
            },
          ]}
        />
      </DrawerProvider>,
    );

    expect(
      await screen.findByRole("list", { name: "Administration" }),
    ).toContainElement(screen.getByRole("link", { name: "Users" }));
    expect(screen.getByText("Administration")).toHaveClass("sr-only");
  });

  it("shows no separator at an end or next to another", () => {
    const { container } = render(
      <DrawerProvider storageKey={null}>
        <Drawer
          items={[
            { type: "separator" },
            { href: "/", label: "Home" },
            { type: "separator" },
            // Hidden - the separators around it would meet
            false,
            { type: "separator" },
            { href: "/help", label: "Help" },
            { type: "separator" },
          ]}
        />
      </DrawerProvider>,
    );

    const entries = Array.from(container.querySelectorAll("nav ul > li"));
    expect(entries.map((entry) => entry.textContent)).toEqual([
      "Home",
      "",
      "Help",
    ]);
    // A line for the eye only
    expect(entries[1]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("reads a badge after the label", () => {
    render(
      <DrawerProvider storageKey={null}>
        <Drawer
          items={[
            { badge: 12, href: "/inbox", label: "Inbox" },
            {
              badge: "New",
              children: [{ href: "/reports/sales", label: "Sales" }],
              label: "Reports",
            },
          ]}
        />
      </DrawerProvider>,
    );

    expect(screen.getByRole("link", { name: "Inbox 12" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reports New" }),
    ).toBeInTheDocument();
  });

  it("makes an item with onClick and no href an action button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onLinkClick = vi.fn();
    render(
      <DrawerProvider storageKey={null}>
        <Drawer
          items={[
            { label: "Search", onClick },
            { href: "#reports", label: "Reports", onClick: onLinkClick },
          ]}
        />
      </DrawerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onClick).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("link", { name: "Reports" }));
    expect(onLinkClick).toHaveBeenCalledOnce();
  });

  it("renders the footer below the menu", () => {
    render(
      <DrawerProvider storageKey={null}>
        <Drawer
          footer={<button type="button">Account</button>}
          items={[{ href: "/", label: "Home" }]}
        />
      </DrawerProvider>,
    );

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const account = screen.getByRole("button", { name: "Account" });
    expect(nav).toContainElement(account);
    expect(
      screen
        .getByRole("link", { name: "Home" })
        .compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("scrolls the menu - not the page - to the current page out of sight", () => {
    const scrolled: number[] = [];
    const rects = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        // The link of the current page far below the visible part of the menu
        const top = this.matches("[aria-current=page]") ? 500 : 0;
        return DOMRect.fromRect({ height: 36, width: 200, y: top });
      });
    const setScrollTop = vi
      .spyOn(HTMLElement.prototype, "scrollTop", "set")
      .mockImplementation((value) => scrolled.push(value));
    const scrollPage = vi.spyOn(window, "scrollTo");

    try {
      render(
        <UIProvider router={{ pathname: "/reports", search: "" }}>
          <DrawerProvider storageKey={null}>
            <Drawer
              items={[
                { href: "/", label: "Home" },
                { href: "/reports", label: "Reports" },
              ]}
            />
          </DrawerProvider>
        </UIProvider>,
      );

      expect(scrolled).toHaveLength(1);
      expect(scrolled[0]).toBeGreaterThan(0);
      expect(scrollPage).not.toHaveBeenCalled();
    } finally {
      rects.mockRestore();
      setScrollTop.mockRestore();
      scrollPage.mockRestore();
    }
  });
});

describe("DrawerProvider shortcut", () => {
  it("toggles the drawer - not while typing", async () => {
    const user = userEvent.setup();
    render(
      <DrawerProvider shortcut="ctrl+b" storageKey={null}>
        <input aria-label="Name" />
        <Drawer items={[{ href: "/", label: "Home" }]} />
      </DrawerProvider>,
    );

    const drawer = screen.getByRole("navigation", { name: "Main navigation" });
    await user.keyboard("{Control>}b{/Control}");
    expect(drawer).toHaveClass("cui-drawer-collapsed");

    await user.click(screen.getByRole("textbox", { name: "Name" }));
    await user.keyboard("{Control>}b{/Control}");
    expect(drawer).toHaveClass("cui-drawer-collapsed");

    await user.click(document.body);
    await user.keyboard("{Control>}b{/Control}");
    expect(drawer).not.toHaveClass("cui-drawer-collapsed");
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

  const renderOnPhone = (header = <WithDialog />, shortcut?: string) => {
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
        <DrawerProvider shortcut={shortcut} storageKey={null}>
          <Toggle />
          <Drawer
            header={header}
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

  it("gives the focus back to its toggle when Safari did not focus it on the click", async () => {
    renderOnPhone();

    // Safari focuses no button it clicks - the focus stays on the page
    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.pointerDown(toggle);
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(toggle).toHaveFocus();
  });

  it("slides out with the shortcut that slid it in - not while typing", async () => {
    const user = userEvent.setup();
    renderOnPhone(<input aria-label="Search" />, "ctrl+b");

    const drawer = screen.getByRole("navigation", { hidden: true });
    await user.keyboard("{Control>}b{/Control}");
    expect(drawer).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();

    await user.keyboard("{Control>}b{/Control}");
    expect(drawer).toHaveAttribute("data-state", "open");

    await user.tab();
    expect(screen.getByRole("link", { name: "Users" })).toHaveFocus();
    await user.keyboard("{Control>}b{/Control}");
    expect(drawer).toHaveAttribute("data-state", "closed");
  });

  it("shows a tooltip of its header - which is in the drawer", async () => {
    const user = userEvent.setup();
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
            header={
              <Tooltip delay={0} title="Your account">
                <button type="button">Account</button>
              </Tooltip>
            }
            items={[{ href: "/users", label: "Users" }]}
          />
        </DrawerProvider>
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Account" }));
    await act(() => sleep(5));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Your account");
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

  it.each(["mouse", "touch"])(
    "stays open when a %s press on its backdrop closes a menu above it",
    async (pointer) => {
      const user = userEvent.setup();
      renderOnPhone(
        <Dropdown items={[{ label: "Edit" }]} trigger={<span>Actions</span>} />,
      );

      await user.click(screen.getByRole("button", { name: "Menu" }));
      await user.click(screen.getByRole("button", { name: "Actions" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      const backdrop = screen.getByRole("button", { name: "Close" });
      if (pointer === "touch") {
        await user.pointer([
          { keys: "[TouchA>]", target: backdrop },
          { keys: "[/TouchA]" },
        ]);
      } else {
        await user.click(backdrop);
      }

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(
        screen.getByRole("dialog", { name: "Main navigation" }),
      ).toBeInTheDocument();

      await user.click(backdrop);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("closes on a backdrop activation without a pointer press", async () => {
    const user = userEvent.setup();
    renderOnPhone();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a backdrop press while a tooltip is shown", async () => {
    const user = userEvent.setup();
    renderOnPhone(
      <Tooltip delay={0} title="Your account">
        <button type="button">Account</button>
      </Tooltip>,
    );

    await user.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Account" }));
    await act(() => sleep(5));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("slides out before an action opens a dialog - the focus returns to the toggle", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: () => {},
        matches: true,
        media: query,
        removeEventListener: () => {},
      })),
    );

    function WithAction() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Toggle />
          <Drawer
            items={[
              { href: "/users", label: "Users" },
              { label: "Feedback", onClick: () => setOpen(true) },
            ]}
          />
          <Dialog onClose={() => setOpen(false)} open={open} title="Feedback">
            <input aria-label="Message" />
          </Dialog>
        </>
      );
    }

    render(
      <UIProvider router={{ pathname: "/", search: "" }}>
        <DrawerProvider storageKey={null}>
          <WithAction />
        </DrawerProvider>
      </UIProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Feedback" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "inert",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toggle).toHaveFocus();
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
