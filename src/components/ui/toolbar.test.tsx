import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "./segmented-control";
import Toolbar, { type ToolbarItem } from "./toolbar";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/ui/cs";

/**
 * Lays the toolbar out as a browser would: items 80px wide (or `widths`
 * by id), separators 9px, the "More" button 34px and the toolbar
 * `getWidth()` wide. Returns a function telling it it was resized.
 */
function mockLayout(
  getWidth: () => number,
  widths: Record<string, number> = {},
) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      let width = 0;
      if (this.getAttribute("role") === "toolbar") {
        width = getWidth();
      } else if (this.hasAttribute("data-toolbar-slot")) {
        const id =
          this.querySelector("[data-toolbar-item]")?.getAttribute(
            "data-toolbar-item",
          ) ?? "";
        width = this.querySelector("[role=separator]") ? 9 : (widths[id] ?? 80);
      } else if (this.parentElement?.getAttribute("role") === "toolbar") {
        width = 34;
      }
      return DOMRect.fromRect({ height: 34, width, x: 0, y: 0 });
    },
  );

  const observers: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(callback);
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );

  return () =>
    act(() =>
      observers.forEach((callback) =>
        callback([], {} as unknown as ResizeObserver),
      ),
    );
}

/** The names of the controls in the bar - not those in the menu. */
const barItems = () =>
  within(screen.getByRole("toolbar"))
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "More" }));
  return screen.getByRole("menu");
};

const actions: ToolbarItem[] = [
  { id: "new", label: "New", onClick: () => {}, priority: 2 },
  { id: "edit", label: "Edit", onClick: () => {} },
  { id: "copy", label: "Copy", onClick: () => {} },
  { type: "separator" },
  { id: "export", label: "Export", onClick: () => {} },
  { id: "print", label: "Print", onClick: () => {}, priority: -1 },
];

describe("Toolbar", () => {
  it("is a toolbar with the ref and the attributes, left out when printed", () => {
    mockLayout(() => 1000);
    const ref = createRef<HTMLDivElement>();
    render(
      <Toolbar
        aria-label="Invoice"
        data-testid="toolbar"
        items={actions}
        ref={ref}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Invoice" });
    expect(ref.current).toBe(toolbar);
    expect(screen.getByTestId("toolbar")).toBe(toolbar);
    expect(toolbar).toHaveClass("print:hidden");
    expect(barItems()).toEqual(["New", "Edit", "Copy", "Export", "Print"]);
    expect(within(toolbar).getByRole("separator")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    // All fit - no More button
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("moves the items with no room into the More menu - by priority, then from the end", async () => {
    mockLayout(() => 300);
    const user = userEvent.setup();
    render(<Toolbar items={actions} />);

    // 300px without the More button (34px): three items of 80px, the
    // separator left out at the end of the bar
    expect(barItems()).toEqual(["New", "Edit", "Copy", "More"]);

    const menu = await openMenu(user);
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Export", "Print"]);
  });

  it("keeps the items of the highest priority longest", async () => {
    mockLayout(() => 200);
    const user = userEvent.setup();
    render(<Toolbar items={actions} />);

    // Print (-1) first, then Export, Copy, Edit from the end - New (2) stays
    expect(barItems()).toEqual(["New", "Edit", "More"]);

    const menu = await openMenu(user);
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Copy", "Export", "Print"]);
    // The separator between the groups comes along
    expect(within(menu).getAllByRole("separator")).toHaveLength(1);
  });

  it("follows the room as it narrows and widens", () => {
    let width = 1000;
    const resize = mockLayout(() => width);
    render(<Toolbar items={actions} />);
    expect(barItems()).toHaveLength(5);

    width = 300;
    resize();
    expect(barItems()).toEqual(["New", "Edit", "Copy", "More"]);

    width = 1000;
    resize();
    expect(barItems()).toEqual(["New", "Edit", "Copy", "Export", "Print"]);
  });

  it("gives the items back as the row around a toolbar as wide as them widens", () => {
    // In a flex row beside a title: as wide as what is in the flow of the
    // bar - items 80px, the More button 34px - at most the room of the row
    let room = 1000;
    const isInFlow = (element: Element) =>
      !element.hasAttribute("inert") ||
      (element as HTMLElement).style.position === "static";
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        let width = 0;
        if (this.getAttribute("role") === "toolbar") {
          const content = Array.from(this.children)
            .filter(isInFlow)
            .reduce(
              (sum, child) =>
                sum + (child.hasAttribute("data-toolbar-slot") ? 80 : 34),
              0,
            );
          width = Math.min(room, content);
        } else if (this.hasAttribute("data-toolbar-slot")) {
          width = 80;
        } else if (this.parentElement?.getAttribute("role") === "toolbar") {
          width = 34;
        }
        return DOMRect.fromRect({ height: 34, width, x: 0, y: 0 });
      },
    );
    const observed: Element[] = [];
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        disconnect() {}
        observe(element: Element) {
          observed.push(element);
        }
        unobserve() {}
      },
    );
    const resize = () =>
      act(() =>
        observers.forEach((callback) =>
          callback([], {} as unknown as ResizeObserver),
        ),
      );

    render(
      <div data-testid="row">
        <Toolbar
          items={["a", "b", "c", "d", "e"].map((id) => ({
            id,
            label: id.toUpperCase(),
          }))}
        />
      </div>,
    );
    expect(barItems()).toEqual(["A", "B", "C", "D", "E"]);
    // The row around is followed - the toolbar does not widen by itself
    expect(observed).toContain(screen.getByTestId("row"));

    room = 300;
    resize();
    expect(barItems()).toEqual(["A", "B", "C", "More"]);

    room = 1000;
    resize();
    expect(barItems()).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("does not open the menu again by itself once it closed with nothing in it", async () => {
    let width = 200;
    const resize = mockLayout(() => width);
    const user = userEvent.setup();
    render(<Toolbar items={actions} />);
    await openMenu(user);

    // Room for all - the menu closes
    width = 1000;
    resize();
    expect(screen.queryByRole("menu")).toBeNull();

    width = 200;
    resize();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("gives the focus in the menu, or on its button, to the bar once all fit", async () => {
    let width = 200;
    const resize = mockLayout(() => width);
    const user = userEvent.setup();
    render(
      <>
        <Toolbar items={actions} />
        <button type="button">Elsewhere</button>
      </>,
    );
    const newButton = () => screen.getByRole("button", { name: "New" });

    // In the menu - the bar widens, the menu goes
    const menu = await openMenu(user);
    expect(menu).toContainElement(document.activeElement as HTMLElement);
    width = 1000;
    resize();
    // Not to the page after the commit either
    await act(async () => {});
    expect(newButton()).toHaveFocus();

    // On the "More" button
    width = 200;
    resize();
    act(() => screen.getByRole("button", { name: "More" }).focus());
    width = 1000;
    resize();
    await act(async () => {});
    expect(newButton()).toHaveFocus();

    // Elsewhere - it stays there
    width = 200;
    resize();
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    width = 1000;
    resize();
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("keeps items of Infinity priority and custom content without a menu item", () => {
    mockLayout(() => 150);
    render(
      <Toolbar
        items={[
          {
            id: "search",
            render: (props) => <input aria-label="Search" {...props} />,
            type: "custom",
          },
          { id: "save", label: "Save", priority: Infinity },
          { id: "edit", label: "Edit" },
        ]}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toBeVisible();
    expect(barItems()).toEqual(["Save", "More"]);
  });

  it("shows the items of menuOnly in the menu always", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();
    const archive = vi.fn();
    render(
      <Toolbar
        items={[
          { id: "edit", label: "Edit" },
          { id: "archive", label: "Archive", menuOnly: true, onClick: archive },
          { color: "danger", id: "delete", label: "Delete", menuOnly: true },
        ]}
      />,
    );

    expect(barItems()).toEqual(["Edit", "More"]);
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(archive).toHaveBeenCalledOnce();
  });

  it("puts custom content with a menu item into the menu", async () => {
    mockLayout(() => 130);
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Toolbar
        items={[
          { id: "edit", label: "Edit", priority: 1 },
          {
            id: "density",
            menuItem: { label: "Density", onClick },
            render: (props) => (
              <button {...props} type="button">
                Compact
              </button>
            ),
            type: "custom",
          },
        ]}
      />,
    );

    expect(barItems()).toEqual(["Edit", "More"]);
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Density" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is one stop of Tab - the arrow keys move along it, past the disabled items", async () => {
    mockLayout(() => 300);
    const user = userEvent.setup();
    render(
      <>
        <Toolbar
          items={[
            { id: "new", label: "New" },
            { disabled: true, id: "edit", label: "Edit" },
            { id: "copy", label: "Copy" },
            { id: "export", label: "Export" },
          ]}
        />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Copy" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(more).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(more).toHaveFocus();

    // Out and back - to the item the focus was on last
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(more).toHaveFocus();
  });

  it("keeps a disabled item with a reason a stop that says why and does nothing", async () => {
    mockLayout(() => 300);
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Toolbar
        items={[
          { id: "new", label: "New" },
          {
            disabled: true,
            disabledReason: "Only an accountant can approve",
            id: "approve",
            label: "Approve",
            onClick,
          },
          { id: "copy", label: "Copy" },
        ]}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toHaveFocus();
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveAccessibleDescription(
      "Only an accountant can approve",
    );

    await user.keyboard("{Enter}");
    await user.click(approve);
    expect(onClick).not.toHaveBeenCalled();
    // The click shows the reason instead
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Only an accountant can approve",
    );
  });

  it("shows the label of an icon alone above its reason, and the reason in the menu", async () => {
    let width = 1000;
    const resize = mockLayout(() => width);
    const user = userEvent.setup();
    render(
      <Toolbar
        items={[
          { id: "new", label: "New", priority: 1 },
          {
            disabled: true,
            disabledReason: "The invoice is paid",
            icon: <svg />,
            iconOnly: true,
            id: "delete",
            label: "Delete",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAccessibleDescription("The invoice is paid");
    await user.hover(button);
    // After the delay of the tooltip - longer in a busy test run
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 3000 });
    expect(tooltip).toHaveTextContent("DeleteThe invoice is paid");
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    await user.unhover(button);

    width = 50;
    resize();
    await openMenu(user);
    const item = screen.getByRole("menuitem", { name: "Delete" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAccessibleDescription("The invoice is paid");
  });

  it("moves to the next item with Left in a right-to-left page", async () => {
    mockLayout(() => 1000);
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element, pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return new Proxy(style, {
          get: (target, property) => {
            if (property === "direction") return "rtl";
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    );
    const user = userEvent.setup();
    render(<Toolbar items={actions} />);

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });

  it("leaves the arrow keys to a text field in it", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();
    render(
      <Toolbar
        items={[
          { id: "new", label: "New" },
          {
            id: "search",
            render: (props) => <input aria-label="Search" {...props} />,
            type: "custom",
          },
          { id: "export", label: "Export" },
        ]}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    const search = screen.getByRole("textbox", { name: "Search" });
    expect(search).toHaveFocus();
    await user.keyboard("ab{ArrowLeft}{Home}{End}{ArrowLeft}");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("ab");

    // At the end of the text the key moves on - at its start back
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(search).toHaveFocus();
    await user.keyboard("{Home}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
  });

  it("moves through a group of radio buttons in it - one stop of Tab", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();

    function Views() {
      const [view, setView] = useState("table");
      return (
        <>
          <Toolbar
            items={[
              { id: "new", label: "New" },
              {
                id: "view",
                render: (props) => (
                  <SegmentedControl
                    {...props}
                    aria-label="View"
                    onChange={setView}
                    options={[
                      { label: "Table", value: "table" },
                      { label: "Board", value: "board" },
                    ]}
                    value={view}
                  />
                ),
                type: "custom",
              },
              { id: "export", label: "Export" },
            ]}
          />
          <button type="button">After</button>
        </>
      );
    }

    render(<Views />);
    const table = screen.getByRole("radio", { name: "Table" });
    const board = screen.getByRole("radio", { name: "Board" });

    // One stop of Tab - not the group, nor its checked radio
    await user.tab();
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });

    // Into the group at its checked radio, through its options, then on
    await user.keyboard("{ArrowRight}");
    expect(table).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(board).toHaveFocus();
    expect(board).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(board).toHaveFocus();

    // Tab leaves the toolbar from the group and comes back to it
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(board).toHaveFocus();
  });

  it("skips custom content with a disabled control", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();
    render(
      <Toolbar
        items={[
          {
            id: "state",
            render: (props) => (
              <select {...props} aria-label="State" disabled>
                <option>All</option>
              </select>
            ),
            type: "custom",
          },
          { id: "new", label: "New" },
          {
            id: "search",
            render: (props) => (
              <input {...props} aria-label="Search" disabled />
            ),
            type: "custom",
          },
          { id: "export", label: "Export" },
        ]}
      />,
    );

    // Tab reaches the first enabled item
    await user.tab();
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
    await user.keyboard("{End}{Home}");
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
  });

  it("keeps a disabled link with a reason a stop of the arrow keys alone", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();
    render(
      <>
        <Toolbar
          items={[
            { id: "new", label: "New" },
            {
              disabled: true,
              disabledReason: "You cannot open it",
              href: "/orders/7",
              id: "open",
              label: "Open",
            },
          ]}
        />
        <button type="button">After</button>
      </>,
    );

    const open = screen.getByRole("link", { name: "Open" });
    expect(open).toHaveAttribute("tabindex", "-1");
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();

    await user.tab({ shift: true });
    await user.keyboard("{ArrowRight}");
    expect(open).toHaveFocus();
    expect(open).toHaveAccessibleDescription("You cannot open it");
  });

  it("gives the focus of an item moving into the menu to the More button", () => {
    let width = 1000;
    const resize = mockLayout(() => width);
    render(<Toolbar items={actions} />);

    act(() => screen.getByRole("button", { name: "Print" }).focus());
    width = 300;
    resize();
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("has toggles - pressed buttons, checkboxes in the menu", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();

    function Filters() {
      const [archived, setArchived] = useState(false);
      return (
        <Toolbar
          items={[
            { id: "new", label: "New", priority: 1 },
            {
              id: "archived",
              label: "Show archived",
              onPressedChange: setArchived,
              pressed: archived,
              type: "toggle",
            },
          ]}
        />
      );
    }

    render(<Filters />);
    const toggle = screen.getByRole("button", { name: "Show archived" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a toggle in the menu as a checkbox", async () => {
    mockLayout(() => 100);
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <Toolbar
        items={[
          { id: "new", label: "New", priority: 1 },
          {
            id: "archived",
            label: "Show archived",
            onPressedChange,
            pressed: true,
            type: "toggle",
          },
        ]}
      />,
    );

    await openMenu(user);
    const item = screen.getByRole("menuitemcheckbox", {
      name: "Show archived",
    });
    expect(item).toHaveAttribute("aria-checked", "true");
    await user.click(item);
    expect(onPressedChange).toHaveBeenCalledWith(false);
  });

  it("names a button with the icon alone and shows its label in a tooltip", async () => {
    mockLayout(() => 1000);
    const user = userEvent.setup();
    render(
      <Toolbar
        items={[
          {
            icon: <svg data-testid="refresh" />,
            iconOnly: true,
            id: "refresh",
            label: "Refresh",
          },
        ]}
        size="sm"
      />,
    );

    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).not.toHaveTextContent("Refresh");
    expect(button).toHaveClass("size-6.5");

    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Refresh");
  });

  it("writes the label of an icon button out in the menu", async () => {
    mockLayout(() => 50);
    const user = userEvent.setup();
    render(
      <Toolbar
        items={[
          { id: "new", label: "New", priority: 1 },
          {
            href: "/reports",
            icon: <svg data-testid="icon" />,
            iconOnly: true,
            id: "reports",
            label: "Reports",
          },
        ]}
      />,
    );

    await openMenu(user);
    const item = screen.getByRole("menuitem", { name: "Reports" });
    expect(item).toHaveAttribute("href", "/reports");
    expect(within(item).getByTestId("icon")).toBeInTheDocument();
  });

  it("names the More button in the language of the app", () => {
    mockLayout(() => 50);
    const { rerender } = render(
      <UIProvider locale={cs}>
        <Toolbar items={actions} />
      </UIProvider>,
    );
    expect(screen.getByRole("button", { name: "Více" })).toBeInTheDocument();

    rerender(
      <UIProvider locale={cs}>
        <Toolbar items={actions} moreLabel="Další akce" />
      </UIProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Další akce" }),
    ).toBeInTheDocument();
  });

  it("skips null and false items", () => {
    mockLayout(() => 1000);
    const canEdit = false;
    render(
      <Toolbar
        items={[
          { id: "new", label: "New" },
          canEdit && { id: "edit", label: "Edit" },
          null,
        ]}
      />,
    );

    expect(barItems()).toEqual(["New"]);
  });

  it("renders all items on the server and hydrates", async () => {
    const toolbar = <Toolbar items={actions} />;
    const html = renderToString(toolbar);
    expect(html).toContain('role="toolbar"');
    expect(html).toContain(">Print</button>");

    mockLayout(() => 300);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, toolbar, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(barItems()).toEqual(["New", "Edit", "Copy", "More"]);

    act(() => root.unmount());
    container.remove();
  });
});
