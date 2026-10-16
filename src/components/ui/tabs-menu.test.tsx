import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Tabs, { type TabItem } from "./tabs";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/ui/cs";

const labels = ["All", "Draft", "Sent", "Paid", "Overdue", "Disputed"];

/**
 * Lays the bar out as a browser would: tabs 100px wide (or `widths`), a
 * "More" button 80px wide, and a bar `getWidth()` wide. The callbacks of
 * the ResizeObserver are returned - they tell the bar it was resized.
 */
function mockLayout(
  getWidth: () => number,
  widths: Record<string, number> = {},
) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const width = this.classList.contains("overflow-x-auto")
        ? getWidth()
        : this.tagName === "LI"
          ? (widths[this.textContent ?? ""] ?? 100)
          : this.previousElementSibling?.tagName === "UL"
            ? 80
            : 0;
      return DOMRect.fromRect({ height: 32, width, x: 0, y: 0 });
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

/** The labels of the tabs in the bar - not those in the menu. */
const barTabs = () =>
  screen.queryAllByRole("tab").map((tab) => tab.textContent);

function Controlled({
  initial,
  items = labels.map((label) => ({ label, value: label })),
}: {
  initial: string;
  items?: TabItem[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Tabs items={items} onChange={setValue} overflow="menu" value={value} />
      <p data-testid="value">{value}</p>
    </>
  );
}

describe("Tabs with overflow menu", () => {
  it("move the tabs past the room into a More menu - the active one stays", async () => {
    mockLayout(() => 350);
    const user = userEvent.setup();
    render(<Controlled initial="Paid" />);

    // 350px: the More button and two tabs - the first and the active one
    expect(barTabs()).toEqual(["All", "Paid"]);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-haspopup", "menu");

    await user.click(more);
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Draft", "Sent", "Overdue", "Disputed"]);
  });

  it("show all tabs and no More button while they fit", () => {
    mockLayout(() => 600);
    const { container } = render(<Controlled initial="All" />);

    expect(barTabs()).toEqual(labels);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    // Measured out of sight, for when the bar narrows
    const slot = container.querySelector("ul + div")!;
    expect(slot).toHaveAttribute("inert");
    expect(slot).toHaveClass("invisible", "absolute");
  });

  it("select a tab picked in the menu - it moves into the bar with the focus", async () => {
    mockLayout(() => 350);
    const user = userEvent.setup();
    render(<Controlled initial="All" />);
    expect(barTabs()).toEqual(["All", "Draft"]);

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Overdue" }));

    expect(screen.getByTestId("value")).toHaveTextContent("Overdue");
    expect(barTabs()).toEqual(["All", "Overdue"]);
    const overdue = screen.getByRole("tab", { name: "Overdue" });
    expect(overdue).toHaveAttribute("aria-selected", "true");
    expect(overdue).toHaveFocus();
  });

  it("follow the room as the bar narrows and widens", () => {
    let width = 600;
    const resize = mockLayout(() => width);
    render(<Controlled initial="Disputed" />);
    expect(barTabs()).toEqual(labels);

    width = 450;
    resize();
    // The More button takes 80px - two tabs and the active one fit
    expect(barTabs()).toEqual(["All", "Draft", "Disputed"]);

    width = 600;
    resize();
    expect(barTabs()).toEqual(labels);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("give the tabs back as the row around a bar as wide as them widens", () => {
    // In a flex row beside a button: as wide as what is in the flow of the
    // bar - tabs 100px, the More button 80px - at most the room of the row
    let room = 600;
    const isInFlow = (element: Element) =>
      !element.hasAttribute("inert") ||
      (element as HTMLElement).style.position === "static";
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        let width = 0;
        if (this.classList.contains("overflow-x-auto")) {
          const tabs = Array.from(this.querySelectorAll("li")).filter(isInFlow);
          const more = this.querySelector("ul + div")!;
          width = Math.min(room, tabs.length * 100 + (isInFlow(more) ? 80 : 0));
        } else if (this.tagName === "LI") {
          width = 100;
        } else if (this.previousElementSibling?.tagName === "UL") {
          width = 80;
        }
        return DOMRect.fromRect({ height: 32, width, x: 0, y: 0 });
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
        <Controlled initial="All" />
      </div>,
    );
    expect(barTabs()).toEqual(labels);
    // The row around is followed - the bar does not widen by itself
    expect(observed).toContain(screen.getByTestId("row"));

    room = 350;
    resize();
    expect(barTabs()).toEqual(["All", "Draft"]);

    room = 600;
    resize();
    expect(barTabs()).toEqual(labels);
  });

  it("do not open the menu again by itself once it closed with nothing in it", async () => {
    let width = 350;
    const resize = mockLayout(() => width);
    const user = userEvent.setup();
    render(<Controlled initial="All" />);
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Room for all - the menu closes
    width = 600;
    resize();
    expect(screen.queryByRole("menu")).toBeNull();

    width = 350;
    resize();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("give the focus in the menu, or on its button, to the selected tab once all fit", async () => {
    let width = 350;
    const resize = mockLayout(() => width);
    const user = userEvent.setup();
    render(
      <>
        <Controlled initial="Draft" />
        <button type="button">Elsewhere</button>
      </>,
    );
    const draft = () => screen.getByRole("tab", { name: "Draft" });

    // In the menu - the bar widens, the menu goes
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menu")).toContainElement(
      document.activeElement as HTMLElement,
    );
    width = 600;
    resize();
    // Not to the page after the commit either
    await act(async () => {});
    expect(draft()).toHaveFocus();

    // On the "More" button
    width = 350;
    resize();
    act(() => screen.getByRole("button", { name: "More" }).focus());
    width = 600;
    resize();
    await act(async () => {});
    expect(draft()).toHaveFocus();

    // Elsewhere - it stays there
    width = 350;
    resize();
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    width = 600;
    resize();
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("measure each tab - a long one moves out sooner", () => {
    mockLayout(() => 450, { Draft: 300 });
    render(<Controlled initial="All" />);

    expect(barTabs()).toEqual(["All"]);
  });

  it("reach the More button with the arrow keys, around the ends", async () => {
    mockLayout(() => 350);
    const user = userEvent.setup();
    render(<Controlled initial="All" />);

    await user.tab();
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
    // Value tabs are one tab stop - the More button is not another one
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Draft" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveFocus();
    // Only the focus moves to it - Draft stays selected
    expect(screen.getByTestId("value")).toHaveTextContent("Draft");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
    expect(screen.getByTestId("value")).toHaveTextContent("All");

    await user.keyboard("{ArrowLeft}");
    expect(more).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Draft" })).toHaveFocus();

    // Home and End go to the tabs
    await user.keyboard("{ArrowRight}{End}");
    expect(screen.getByRole("tab", { name: "Draft" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{Home}");
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
  });

  it("open the menu from the keyboard at its first item", async () => {
    mockLayout(() => 350);
    const user = userEvent.setup();
    render(<Controlled initial="All" />);

    await user.tab();
    await user.keyboard("{ArrowLeft}{ArrowDown}");
    expect(screen.getByRole("menu")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Sent" }).id,
    );

    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Sent" })).toHaveFocus();
    expect(screen.getByTestId("value")).toHaveTextContent("Sent");
  });

  it("move to the next one with Left in a right-to-left page", async () => {
    mockLayout(() => 350);
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
    render(<Controlled initial="Draft" />);

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
  });

  it("skip the disabled tabs and show them disabled in the menu", async () => {
    mockLayout(() => 350);
    const user = userEvent.setup();
    render(
      <Controlled
        initial="All"
        items={labels.map((label) => ({
          disabled: label === "Draft" || label === "Overdue",
          label,
          value: label,
        }))}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    // Past the disabled Draft
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Overdue" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("put link tabs into the menu as links", async () => {
    mockLayout(() => 350);
    const user = userEvent.setup();
    render(
      <UIProvider router={{ pathname: "/orders/paid", search: "" }}>
        <Tabs
          items={labels.map((label) => ({
            href: `/orders/${label.toLowerCase()}`,
            label,
          }))}
          overflow="menu"
        />
      </UIProvider>,
    );

    expect(
      screen
        .getAllByRole("link")
        .filter((link) => !link.closest("[inert]"))
        .map((link) => link.textContent),
    ).toEqual(["All", "Paid"]);
    // Links are tab stops of their own - so is the More button
    const more = screen.getByRole("button", { name: "More" });
    expect(more).not.toHaveAttribute("tabindex");

    await user.click(more);
    expect(screen.getByRole("menuitem", { name: "Overdue" })).toHaveAttribute(
      "href",
      "/orders/overdue",
    );
  });

  it("give the focus of a tab moving into the menu to the More button", () => {
    let width = 600;
    const resize = mockLayout(() => width);
    render(
      <UIProvider router={{ pathname: "/orders/all", search: "" }}>
        <Tabs
          items={labels.map((label) => ({
            href: `/orders/${label.toLowerCase()}`,
            label,
          }))}
          overflow="menu"
        />
      </UIProvider>,
    );

    act(() => screen.getByRole("link", { name: "Disputed" }).focus());
    width = 350;
    resize();
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("show the text of a label in the menu - also one for screen readers", async () => {
    mockLayout(() => 250);
    const user = userEvent.setup();
    render(
      <Controlled
        initial="comments"
        items={[
          {
            icon: <svg data-testid="icon" />,
            label: <span className="sr-only">Comments</span>,
            value: "comments",
          },
          { label: <strong>Activity</strong>, value: "activity" },
          {
            icon: <svg data-testid="icon" />,
            label: "Details",
            onClose: () => {},
            value: "details",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Activity",
      "Details",
    ]);
    // The icon comes along
    expect(within(items[1]).getByTestId("icon")).toBeInTheDocument();
  });

  it("leave a vertical bar and a loading one alone", () => {
    mockLayout(() => 100);
    const { rerender } = render(
      <Tabs
        items={labels.map((label) => ({ label, value: label }))}
        orientation="vertical"
        overflow="menu"
        value="All"
      />,
    );
    expect(barTabs()).toEqual(labels);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();

    rerender(
      <Tabs
        items={labels.map((label) => ({ label, value: label }))}
        loading
        overflow="menu"
        value="All"
      />,
    );
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("name the More button in the language of the app", () => {
    mockLayout(() => 350);
    render(
      <UIProvider locale={cs}>
        <Controlled initial="All" />
      </UIProvider>,
    );

    expect(screen.getByRole("button", { name: "Více" })).toBeInTheDocument();
  });

  it("print the active tab alone", () => {
    mockLayout(() => 600);
    render(<Controlled initial="Sent" />);

    const sent = screen.getByRole("tab", { name: "Sent" }).closest("li");
    const draft = screen.getByRole("tab", { name: "Draft" }).closest("li");
    expect(sent).not.toHaveClass("print:hidden");
    expect(draft).toHaveClass("print:hidden");
  });

  it("render all tabs on the server and hydrate", async () => {
    const tabs = (
      <Tabs
        items={labels.map((label) => ({ label, value: label }))}
        overflow="menu"
        value="Paid"
      />
    );
    const html = renderToString(tabs);
    for (const label of labels) expect(html).toContain(`>${label}</button>`);

    mockLayout(() => 350);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, tabs, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    // Laid out once hydrated
    expect(barTabs()).toEqual(["All", "Paid"]);

    act(() => root.unmount());
    container.remove();
  });
});
