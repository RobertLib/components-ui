import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "./app-shell";
import ColorSchemeScript from "./color-scheme-script";
import ColorSchemeToggle from "./color-scheme-toggle";
import CommandPalette from "./command-palette";
import ConfirmDialog from "./confirm-dialog";
import ContextMenu from "./context-menu";
import Dialog, { DialogFooter } from "./dialog";
import Drawer from "./drawer";
import Dropdown from "./dropdown";
import Header from "./header";
import Navbar from "./navbar";
import Overlay from "./overlay";
import Popover from "./popover";
import Sheet from "./sheet";
import SplitButton from "./split-button";
import Toast from "./toast";
import Tooltip from "./tooltip";
import DrawerProvider from "../providers/drawer-provider";
import UIProvider from "../providers/ui-provider";

const noop = () => {};

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

/** The element a `ref` of the component was given, checked by its test id. */
function expectRef<T extends Element>(
  ref: React.RefObject<T | null>,
  testId = "root",
) {
  expect(ref.current).toBeInstanceOf(Element);
  expect(ref.current).toBe(screen.getByTestId(testId));
  return ref.current!;
}

describe("The ref of the overlays and the app frame", () => {
  it("is the wrapper around the trigger of a Popover, a Tooltip and a Dropdown", () => {
    const popover = createRef<HTMLDivElement>();
    const tooltip = createRef<HTMLDivElement>();
    const dropdown = createRef<HTMLDivElement>();
    const { unmount } = render(
      <>
        <Popover
          data-testid="popover"
          ref={popover}
          trigger="Filters"
          triggerType="click"
        >
          Panel
        </Popover>
        <Tooltip data-testid="tooltip" ref={tooltip} title="Help">
          <button type="button">?</button>
        </Tooltip>
        <Dropdown
          aria-label="Actions"
          data-testid="dropdown"
          items={[{ label: "Rename" }]}
          ref={dropdown}
          trigger="…"
        />
      </>,
    );

    expect(expectRef(popover, "popover")).toHaveAttribute("role", "button");
    expect(expectRef(tooltip, "tooltip")).toContainElement(
      screen.getByRole("button", { name: "?" }),
    );
    expect(expectRef(dropdown, "dropdown")).toBe(
      screen.getByRole("button", { name: "Actions" }),
    );

    unmount();
    expect(popover.current).toBeNull();
    expect(tooltip.current).toBeNull();
  });

  it("is also a callback ref, called with null once gone", () => {
    const ref = vi.fn();
    const { unmount } = render(
      <Popover ref={ref} trigger="Filters" triggerType="click">
        Panel
      </Popover>,
    );

    expect(ref).toHaveBeenLastCalledWith(
      screen.getByRole("button", { name: "Filters" }),
    );
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it("keeps the popover working - it is its own ref too", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(
      <Popover ref={ref} trigger="Filters" triggerType="click">
        <button type="button">Apply</button>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // A press outside the wrapper closes it
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is the element with the role of a Dialog, a Sheet, a ConfirmDialog and a CommandPalette", async () => {
    const dialog = createRef<HTMLDivElement>();
    const footer = createRef<HTMLDivElement>();
    const { unmount } = render(
      <Dialog data-testid="root" onClose={noop} open ref={dialog} title="Edit">
        <DialogFooter data-testid="footer" ref={footer}>
          <button type="button">Save</button>
        </DialogFooter>
      </Dialog>,
    );
    expect(expectRef(dialog)).toBe(screen.getByRole("dialog"));
    expectRef(footer, "footer");
    unmount();
    expect(dialog.current).toBeNull();

    const sheet = createRef<HTMLDivElement>();
    const second = render(
      <Sheet data-testid="root" onClose={noop} open ref={sheet} title="Details">
        Content
      </Sheet>,
    );
    expect(expectRef(sheet)).toBe(screen.getByRole("dialog"));
    second.unmount();

    const confirm = createRef<HTMLDivElement>();
    const third = render(
      <ConfirmDialog
        aria-describedby="extra"
        data-testid="root"
        id="delete-dialog"
        message="It cannot be undone."
        onClose={noop}
        onConfirm={noop}
        open
        ref={confirm}
        title="Delete?"
      />,
    );
    const alertDialog = expectRef(confirm);
    expect(alertDialog).toBe(screen.getByRole("alertdialog"));
    expect(alertDialog).toHaveAttribute("id", "delete-dialog");
    // Described by its message and by what was given
    expect(alertDialog.getAttribute("aria-describedby")).toMatch(/ extra$/);
    expect(alertDialog).toHaveAccessibleDescription(/It cannot be undone/);
    third.unmount();

    const palette = createRef<HTMLDivElement>();
    render(
      <CommandPalette
        data-testid="root"
        items={[{ id: 1, label: "Invoices" }]}
        open
        ref={palette}
        shortcut={null}
      />,
    );
    expect(expectRef(palette)).toBe(screen.getByRole("dialog"));
  });

  it("is the toast and the backdrop of an Overlay", () => {
    const toast = createRef<HTMLDivElement>();
    const overlay = createRef<HTMLDivElement>();
    render(
      <>
        <Toast data-testid="root" message="Saved" ref={toast} />
        <Overlay data-testid="backdrop" ref={overlay} />
      </>,
    );

    expect(expectRef(toast)).toBe(screen.getByRole("status"));
    expectRef(overlay, "backdrop");
  });

  it("is the target of a ContextMenu - its own ref set as well", () => {
    const given = createRef<HTMLLIElement>();
    const own = createRef<HTMLLIElement>();
    const { rerender } = render(
      <ul>
        <ContextMenu
          className="given"
          data-testid="root"
          id="row"
          items={[{ label: "Rename" }]}
          ref={given}
          style={{ color: "red" }}
        >
          <li className="own" ref={own} style={{ fontWeight: 700 }}>
            report.pdf
          </li>
        </ContextMenu>
      </ul>,
    );

    const row = expectRef(given);
    expect(own.current).toBe(row);
    expect(row.tagName).toBe("LI");
    expect(row).toHaveAttribute("id", "row");
    expect(row).toHaveClass("own", "given");
    expect(row).toHaveStyle({ color: "rgb(255, 0, 0)", fontWeight: "700" });

    // Anything else is wrapped in a div, which gets the props
    const wrapper = createRef<HTMLDivElement>();
    rerender(
      <ContextMenu
        data-testid="root"
        items={[{ label: "Rename" }]}
        ref={wrapper}
      >
        report.pdf
      </ContextMenu>,
    );
    expect(expectRef(wrapper).tagName).toBe("DIV");
  });

  it("runs the handlers of the target and those given to a ContextMenu", () => {
    const own = vi.fn();
    const given = vi.fn();
    const onClick = vi.fn();
    render(
      <ContextMenu
        items={[{ label: "Rename" }]}
        onClick={onClick}
        onContextMenu={given}
      >
        <div onContextMenu={own} tabIndex={0}>
          report.pdf
        </div>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("report.pdf"));
    fireEvent.click(screen.getByText("report.pdf"));
    expect(own).toHaveBeenCalledOnce();
    expect(given).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is the main button of a SplitButton", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <SplitButton
        data-testid="root"
        items={[{ label: "Save as draft" }]}
        ref={ref}
      >
        Save
      </SplitButton>,
    );

    expect(expectRef(ref)).toBe(screen.getByRole("button", { name: "Save" }));
  });

  it("is the nav of the Drawer, the bar of the Navbar and the main of the AppShell", () => {
    const drawer = createRef<HTMLElement>();
    const navbar = createRef<HTMLElement>();
    const main = createRef<HTMLElement>();
    render(
      <AppShell
        data-testid="main"
        drawer={
          <Drawer
            data-testid="drawer"
            items={[{ href: "/", label: "Home" }]}
            ref={drawer}
          />
        }
        drawerStorageKey={null}
        navbar={<Navbar data-testid="navbar" ref={navbar} />}
        ref={main}
      >
        Page
      </AppShell>,
    );

    expect(expectRef(drawer, "drawer")).toBe(screen.getByRole("navigation"));
    // The bar inside the header landmark
    expect(expectRef(navbar, "navbar").parentElement).toBe(
      screen.getByRole("banner"),
    );
    expect(expectRef(main, "main")).toBe(screen.getByRole("main"));
  });

  it("is the row of a Header and the group of a ColorSchemeToggle", () => {
    const header = createRef<HTMLDivElement>();
    const toggle = createRef<HTMLDivElement>();
    render(
      <>
        <Header data-testid="header" ref={header} title="Orders" />
        <ColorSchemeToggle data-testid="toggle" ref={toggle} />
      </>,
    );

    expect(expectRef(header, "header")).toContainElement(
      screen.getByRole("heading", { name: "Orders" }),
    );
    expect(expectRef(toggle, "toggle")).toBe(screen.getByRole("radiogroup"));
  });

  it("is the script of a ColorSchemeScript, which takes the native props", () => {
    const ref = createRef<HTMLScriptElement>();
    const { container } = render(
      <ColorSchemeScript data-testid="root" id="color-scheme" ref={ref} />,
    );

    expect(expectRef(ref)).toBe(container.querySelector("script"));
    expect(ref.current).toHaveAttribute("id", "color-scheme");
    expect(
      renderToStaticMarkup(<ColorSchemeScript id="color-scheme" />),
    ).toMatch(/^<script id="color-scheme">/);
  });
});

describe("The state attributes", () => {
  it("tell whether a Popover is open - on the trigger and the panel, with its resolved side", async () => {
    const user = userEvent.setup();
    render(
      <Popover align="end" position="top" trigger="Filters" triggerType="click">
        Panel
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Filters" });
    expect(trigger).toHaveAttribute("data-state", "closed");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("data-state", "open");

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-state", "open");
    // No room above the trigger at the top of the page - it flipped
    expect(panel).toHaveAttribute("data-side", "bottom");
    expect(panel).toHaveAttribute("data-align", "end");
  });

  it("put the state on a button trigger, and resolve a deprecated align right to left", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <Popover
          align="left"
          buttonTrigger
          position="bottom"
          trigger={<button type="button">Filters</button>}
          triggerType="click"
        >
          Panel
        </Popover>
      </div>,
    );

    const button = screen.getByRole("button", { name: "Filters" });
    expect(button).toHaveAttribute("data-state", "closed");
    await user.click(button);
    expect(button).toHaveAttribute("data-state", "open");
    // The left edge is the end right to left
    expect(screen.getByRole("dialog")).toHaveAttribute("data-align", "end");
  });

  it("tell whether a Tooltip is shown, and the side it is on", () => {
    const { container } = render(
      <Tooltip open position="bottom" title="Help">
        <button type="button">?</button>
      </Tooltip>,
    );

    expect(container.firstElementChild).toHaveAttribute("data-state", "open");
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");
    expect(tooltip).toHaveAttribute("data-side", "bottom");
  });

  it("mark the items of a menu - highlighted, checked, disabled, with a submenu", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { label: "Rename" },
          { checked: true, label: "Show hidden files" },
          { checked: false, label: "Show extensions" },
          { disabled: true, label: "Archive" },
          { items: [{ label: "PDF" }], label: "Export" },
          {
            options: [
              { label: "Name", value: "name" },
              { label: "Date", value: "date" },
            ],
            type: "radio",
            value: "name",
          },
        ]}
        trigger="…"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("data-state", "open");

    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("data-orientation", "vertical");
    expect(menu.closest("[data-side]")).toHaveAttribute("data-side", "bottom");

    const rename = screen.getByRole("menuitem", { name: "Rename" });
    expect(rename).toHaveAttribute("data-highlighted", "");
    expect(rename).not.toHaveAttribute("data-state");
    expect(rename).not.toHaveAttribute("data-disabled");

    await user.keyboard("{ArrowDown}");
    expect(rename).not.toHaveAttribute("data-highlighted");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Show hidden files" }),
    ).toHaveAttribute("data-highlighted", "");

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Show hidden files" }),
    ).toHaveAttribute("data-state", "checked");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Show extensions" }),
    ).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByRole("menuitemradio", { name: "Name" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByRole("menuitemradio", { name: "Date" })).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveAttribute(
      "data-disabled",
      "",
    );

    const exportItem = screen.getByRole("menuitem", { name: "Export" });
    expect(exportItem).toHaveAttribute("data-state", "closed");
    fireEvent.click(exportItem);
    expect(exportItem).toHaveAttribute("data-state", "open");

    const submenu = screen.getByRole("menu", { name: "Export" });
    const popup = submenu.parentElement!;
    expect(popup).toHaveAttribute("data-state", "open");
    expect(popup).toHaveAttribute("data-side", "right");
    expect(popup).toHaveAttribute("data-align", "start");
  });

  it("tell whether a ContextMenu is open, and where its menu is", () => {
    render(
      <ContextMenu items={[{ label: "Rename" }]}>
        <div tabIndex={0}>report.pdf</div>
      </ContextMenu>,
    );

    const target = screen.getByText("report.pdf");
    expect(target).toHaveAttribute("data-state", "closed");
    fireEvent.keyDown(target, { key: "F10", shiftKey: true });
    expect(target).toHaveAttribute("data-state", "open");

    const panel = screen.getByRole("menu").parentElement!;
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel).toHaveAttribute("data-side", "bottom");
    expect(panel).toHaveAttribute("data-align", "start");
  });

  it("tell whether a Dialog is open, also while it animates out", async () => {
    vi.useFakeTimers();
    try {
      render(<Dialog title="Edit" />);
      act(() => vi.advanceTimersByTime(20));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("data-state", "open");
      const backdrop = document.body.querySelector(".bg-black\\/50");
      expect(backdrop).toHaveAttribute("data-state", "open");

      fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
      expect(dialog).toHaveAttribute("data-state", "closed");
      expect(backdrop).toHaveAttribute("data-state", "closed");
      act(() => vi.advanceTimersByTime(200));
      expect(dialog).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tell whether a toast is shown, and its variant", () => {
    const { rerender } = render(<Toast message="Saved" variant="success" />);

    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("data-state", "open");
    expect(toast).toHaveAttribute("data-variant", "success");

    rerender(<Toast message="Saved" open={false} variant="error" />);
    expect(toast).toHaveAttribute("data-state", "closed");
    // `error` is `danger`
    expect(toast).toHaveAttribute("data-variant", "danger");
  });

  it("tell whether the Drawer and its groups are open, and so the Navbar toggle", async () => {
    const user = userEvent.setup();
    render(
      <DrawerProvider storageKey={null}>
        <Navbar />
        <Drawer
          items={[
            {
              children: [{ href: "/users", label: "All users" }],
              label: "Users",
            },
          ]}
        />
      </DrawerProvider>,
    );

    expect(screen.getByRole("navigation")).toHaveAttribute(
      "data-state",
      "open",
    );
    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(toggle).toHaveAttribute("data-state", "open");

    const group = screen.getByRole("button", { name: "Users" });
    expect(group).toHaveAttribute("data-state", "closed");
    await user.click(group);
    expect(group).toHaveAttribute("data-state", "open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-state", "closed");
  });

  it("tell the choice of a ColorSchemeToggle and its orientation", () => {
    render(<ColorSchemeToggle />);

    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });

  it("mark the highlighted and the disabled command of a CommandPalette", async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        items={[
          { disabled: true, id: 1, label: "Archive" },
          { id: 2, label: "Invoices" },
          { id: 3, label: "Customers" },
        ]}
        open
        shortcut={null}
      />,
    );

    const archive = screen.getByRole("option", { name: "Archive" });
    const invoices = screen.getByRole("option", { name: "Invoices" });
    expect(archive).toHaveAttribute("data-disabled", "");
    expect(archive).not.toHaveAttribute("data-highlighted");
    expect(invoices).toHaveAttribute("data-highlighted", "");
    expect(invoices).not.toHaveAttribute("data-disabled");

    await user.keyboard("{ArrowDown}");
    expect(invoices).not.toHaveAttribute("data-highlighted");
    expect(screen.getByRole("option", { name: "Customers" })).toHaveAttribute(
      "data-highlighted",
      "",
    );
  });

  it("tell whether the menu of a SplitButton is open", async () => {
    const user = userEvent.setup();
    render(
      <SplitButton items={[{ label: "Save as draft" }]}>Save</SplitButton>,
    );

    const toggle = screen.getByRole("button", { name: "More options" });
    expect(toggle).toHaveAttribute("data-state", "closed");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-state", "open");
  });
});

describe("Forced colors (Windows High Contrast)", () => {
  it("keep the focus of the triggers and panels visible - a transparent outline, not none", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover trigger="Filters" triggerType="click">
          Panel
        </Popover>
        <Dropdown
          aria-label="Actions"
          items={[{ label: "Rename" }]}
          trigger="…"
        />
      </>,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toHaveClass(
      "focus:outline-hidden",
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toHaveClass("focus:outline-hidden");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveClass(
      "focus:outline-hidden",
    );
    for (const element of document.body.querySelectorAll("[class]")) {
      expect(element.getAttribute("class")).not.toMatch(/outline-none/);
    }
  });

  it("show the highlighted item of a menu in the colors of a selection", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { label: "Rename" },
          { disabled: true, label: "Archive" },
          {
            options: [{ label: "Name", value: "name" }],
            type: "radio",
            value: "name",
          },
        ]}
        trigger="…"
      />,
    );

    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveClass(
      "forced-colors:bg-[Highlight]",
      "forced-colors:text-[HighlightText]",
    );
    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveClass(
      "forced-colors:text-[GrayText]",
    );
    // The dot of the checked option is drawn in the text color - forced
    // colors would drop a background
    const dot = screen
      .getByRole("menuitemradio", { name: "Name" })
      .querySelector("circle");
    expect(dot).toHaveAttribute("fill", "currentColor");
  });

  it("show the highlighted command, the current page and the chosen scheme as selected", () => {
    render(
      <UIProvider router={{ pathname: "/users", search: "" }}>
        <DrawerProvider storageKey={null}>
          <Drawer items={[{ href: "/users", label: "Users" }]} />
        </DrawerProvider>
        <ColorSchemeToggle />
        <CommandPalette
          items={[{ id: 1, label: "Invoices" }]}
          open
          shortcut={null}
        />
      </UIProvider>,
    );

    // The page is hidden behind the open palette
    for (const element of [
      screen.getByRole("link", { hidden: true, name: "Users" }),
      screen.getByRole("radio", { hidden: true, name: "System" }),
      screen.getByRole("option", { name: "Invoices" }),
    ]) {
      expect(element).toHaveClass(
        "forced-colors:bg-[Highlight]",
        "forced-colors:text-[HighlightText]",
      );
    }
    expect(
      screen.getByRole("radio", { hidden: true, name: "Dark" }),
    ).not.toHaveClass("forced-colors:bg-[Highlight]");
  });

  it("outline a tooltip, whose background they take", () => {
    render(
      <Tooltip open title="Help">
        <button type="button">?</button>
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip")).toHaveClass("forced-colors:outline");
  });

  it("tell the variants of the toasts by an icon shown only there", () => {
    render(
      <>
        <Toast data-testid="default" message="Note" />
        <Toast data-testid="danger" message="Failed" variant="danger" />
        <Toast data-testid="loading" loading message="Saving" variant="info" />
      </>,
    );

    expect(
      screen.getByTestId("default").querySelector("[data-toast-icon]"),
    ).toBeNull();
    const icon = screen
      .getByTestId("danger")
      .querySelector("[data-toast-icon]");
    expect(icon).toHaveClass("hidden", "forced-colors:block");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    // The spinner takes its place
    expect(
      screen.getByTestId("loading").querySelector("[data-toast-icon]"),
    ).toBeNull();
  });
});

describe("Right to left", () => {
  it("puts the Drawer at the start edge and slides it out over it", () => {
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
      <DrawerProvider storageKey={null}>
        <Drawer
          items={[
            {
              children: [{ href: "/users", label: "All users" }],
              defaultExpanded: true,
              label: "Users",
            },
          ]}
        />
      </DrawerProvider>,
    );

    const nav = screen.getByRole("navigation", { hidden: true });
    expect(nav).toHaveClass("inset-s-0", "border-e");
    expect(nav).toHaveClass("-translate-x-full", "rtl:translate-x-full");
    expect(nav.className).not.toMatch(/\b(left|border-r|border-l)-?/);

    // The guide line of a group at its start
    const list = screen
      .getByRole("link", { name: "All users", hidden: true })
      .closest("ul")!;
    expect(list).toHaveClass("border-s", "ps-2", "ms-3");
  });

  it("mirrors the icons that point along the line", () => {
    render(
      <DrawerProvider storageKey={null}>
        <Header back title="Order" />
        <Navbar />
      </DrawerProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Back" }).querySelector("svg"),
    ).toHaveClass("rtl:-scale-x-100");
    expect(
      screen
        .getByRole("button", { name: "Toggle sidebar" })
        .querySelector("svg"),
    ).toHaveClass("rtl:-scale-x-100");
  });

  it("gives a tooltip the direction of its trigger, and opens it on the resolved side", () => {
    // The trigger in the middle of the screen - room on every side
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 320,
      height: 20,
      left: 400,
      right: 420,
      top: 300,
      width: 20,
      x: 400,
      y: 300,
      toJSON: () => ({}),
    });
    render(
      <div dir="rtl">
        <Tooltip open position="end" title="Help">
          <button type="button">?</button>
        </Tooltip>
      </div>,
    );

    const tooltip = screen.getByRole("tooltip");
    // Rendered into the body, which is left to right
    expect(tooltip).toHaveAttribute("dir", "rtl");
    // The end is the left side right to left
    expect(tooltip).toHaveAttribute("data-side", "left");
  });

  it("moves through a ColorSchemeToggle with ArrowLeft", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <ColorSchemeToggle />
      </div>,
    );

    await user.click(screen.getByRole("radio", { name: "Light" }));
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });
});
