import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tabs from "./tabs";
import type { LinkComponentProps } from "../providers/router";
import UIProvider from "../providers/ui-provider";

/** Lays the page out right to left - jsdom knows no `dir`. */
function mockRightToLeft() {
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return new Proxy(style, {
      get: (target, property) => {
        if (property === "direction") return "rtl";
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

describe("Tabs", () => {
  it("marks the most specific matching link as active", () => {
    render(
      <UIProvider router={{ pathname: "/users/archive", search: "" }}>
        <Tabs
          items={[
            { href: "/users", label: "All" },
            { href: "/users/archive", label: "Archive" },
          ]}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks a relative link and a path the URL escapes", () => {
    render(
      <UIProvider
        router={{ pathname: "/projects/42/nastaven%C3%AD", search: "" }}
      >
        <Tabs
          items={[
            { href: "overview", label: "Overview" },
            { href: "nastavení", label: "Nastavení" },
          ]}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("link", { name: "Nastavení" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("works without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    try {
      render(
        <Tabs
          items={[
            { label: "Day", value: "day" },
            { label: "Week", value: "week" },
          ]}
          value="week"
        />,
      );
      expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Tabs while loading", () => {
  it("are a busy list of placeholders - no tablist without tabs", () => {
    const items = [
      { label: "Orders", value: "orders" },
      { label: "Invoices", value: "invoices" },
    ];
    const { container, rerender } = render(
      <Tabs items={items} loading value="orders" />,
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    const list = container.querySelector("ul")!;
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(list).not.toHaveAttribute("aria-orientation");
    // The placeholders say nothing
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    rerender(<Tabs items={items} value="orders" />);
    expect(screen.getByRole("tablist")).not.toHaveAttribute("aria-busy");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });
});

describe("Tabs with query parameters", () => {
  const activeTab = () =>
    screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent);

  function renderAt(url: string, hrefs: [string, string][]) {
    const [pathname, query = ""] = url.split("?");
    return render(
      <UIProvider router={{ pathname, search: query && `?${query}` }}>
        <Tabs
          includeQueryParams
          items={hrefs.map(([label, href]) => ({ href, label }))}
        />
      </UIProvider>,
    );
  }

  it("prefers the tab matching most parameters over one without any", () => {
    const tabs: [string, string][] = [
      ["All", "/orders"],
      ["Archived", "/orders?tab=archived"],
    ];

    renderAt("/orders?tab=archived&page=2", tabs);
    expect(activeTab()).toEqual(["Archived"]);

    cleanup();
    renderAt("/orders?page=2", tabs);
    expect(activeTab()).toEqual(["All"]);
  });

  it("looks at the parameters of all tabs", () => {
    const tabs: [string, string][] = [
      ["List", "/tasks?view=list"],
      ["Done", "/tasks?status=done"],
    ];

    renderAt("/tasks?status=done", tabs);
    expect(activeTab()).toEqual(["Done"]);

    // None of the tab parameters - the first tab
    cleanup();
    renderAt("/tasks", tabs);
    expect(activeTab()).toEqual(["List"]);
  });

  it("marks no tab of another page", () => {
    renderAt("/customers?status=open", [
      ["Open", "/orders?status=open"],
      ["Shipped", "/orders?status=shipped"],
    ]);

    expect(activeTab()).toEqual([]);
  });

  it("finds the page by a path with a trailing slash or escapes", () => {
    renderAt("/orders/?tab=archived", [
      ["Active", "/orders?tab=active"],
      ["Archived", "/orders?tab=archived"],
    ]);
    expect(activeTab()).toEqual(["Archived"]);

    cleanup();
    renderAt("/objedn%C3%A1vky?tab=archived", [
      ["Active", "/objednávky?tab=active"],
      ["Archived", "/objednávky?tab=archived"],
    ]);
    expect(activeTab()).toEqual(["Archived"]);

    // A link of just a query is one of the current page
    cleanup();
    renderAt("/orders?tab=archived", [
      ["Active", "?tab=active"],
      ["Archived", "?tab=archived"],
    ]);
    expect(activeTab()).toEqual(["Archived"]);
  });
});

describe("Tabs with values", () => {
  function Controlled() {
    const [value, setValue] = useState("week");

    return (
      <Tabs
        items={[
          { label: "Day", value: "day" },
          { label: "Week", value: "week" },
          { label: "Month", value: "month" },
        ]}
        onChange={setValue}
        value={value}
      />
    );
  }

  it("are one tab stop and switched with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("tab", { name: "Week" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    const month = screen.getByRole("tab", { name: "Month" });
    expect(month).toHaveFocus();
    expect(month).toHaveAttribute("aria-selected", "true");

    // Around the end, and Home / End
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Day" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(month).toHaveAttribute("aria-selected", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("move to the next tab with Left in a right-to-left page", async () => {
    const user = userEvent.setup();
    mockRightToLeft();
    render(<Controlled />);

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("link to their tab panels", () => {
    render(
      <>
        <Tabs
          items={[
            { id: "tab-day", label: "Day", panelId: "panel-day", value: "day" },
            { label: "Week", value: "week" },
          ]}
          value="day"
        />
        <div aria-labelledby="tab-day" id="panel-day" role="tabpanel">
          Today
        </div>
      </>,
    );

    const day = screen.getByRole("tab", { name: "Day" });
    expect(day).toHaveAttribute("aria-controls", "panel-day");
    expect(screen.getByRole("tabpanel", { name: "Day" })).toHaveTextContent(
      "Today",
    );
    expect(screen.getByRole("tab", { name: "Week" })).not.toHaveAttribute(
      "aria-controls",
    );
  });
});

describe("Tabs with disabled items", () => {
  const items = [
    { label: "Draft", value: "draft" },
    { disabled: true, label: "Sent", value: "sent" },
    { label: "Paid", value: "paid" },
    { disabled: true, label: "Cancelled", value: "cancelled" },
  ];

  function Controlled({ initial = "draft" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <Tabs items={items} onChange={setValue} value={value} />;
  }

  it("skips the disabled tabs with the arrow keys and Home / End", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    const draft = screen.getByRole("tab", { name: "Draft" });
    const paid = screen.getByRole("tab", { name: "Paid" });
    expect(screen.getByRole("tab", { name: "Sent" })).toBeDisabled();

    await user.tab();
    expect(draft).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(paid).toHaveFocus();
    expect(paid).toHaveAttribute("aria-selected", "true");

    // Past the disabled last tab, around to the first one
    await user.keyboard("{ArrowRight}");
    expect(draft).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(paid).toHaveFocus();

    await user.keyboard("{Home}");
    expect(draft).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(paid).toHaveAttribute("aria-selected", "true");
  });

  it("cannot be selected by a click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={items} onChange={onChange} value="draft" />);

    await user.click(screen.getByRole("tab", { name: "Sent" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the tab stop on an enabled tab", async () => {
    const user = userEvent.setup();
    // The selected tab was disabled after it was selected
    render(<Controlled initial="sent" />);

    expect(screen.getByRole("tab", { name: "Sent" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.tab();
    expect(screen.getByRole("tab", { name: "Draft" })).toHaveFocus();
  });

  it("ignores the arrow keys with a modifier", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={items} onChange={onChange} value="draft" />);

    await user.tab();
    // Alt + ArrowLeft goes back in the browser history
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("do not link anywhere as links", async () => {
    const user = userEvent.setup();
    const linkClicks = vi.fn();

    function SpyLink({ href, ...props }: LinkComponentProps) {
      return <a {...props} href={href} onClick={() => linkClicks(href)} />;
    }

    render(
      <UIProvider
        router={{ Link: SpyLink, pathname: "/orders/open", search: "" }}
      >
        <Tabs
          items={[
            { href: "/orders/open", label: "Open" },
            { disabled: true, href: "/orders/archive", label: "Archive" },
          ]}
        />
      </UIProvider>,
    );

    const archive = screen.getByRole("link", { name: "Archive" });
    expect(archive).toHaveAttribute("aria-disabled", "true");
    expect(archive).not.toHaveAttribute("href");

    await user.click(archive);
    expect(linkClicks).not.toHaveBeenCalled();

    // Not in the tab order
    await user.tab();
    expect(screen.getByRole("link", { name: "Open" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});

describe("Vertical tabs", () => {
  function Controlled() {
    const [value, setValue] = useState("profile");

    return (
      <Tabs
        aria-label="Settings"
        items={[
          { label: "Profile", value: "profile" },
          { label: "Security", value: "security" },
          { label: "Notifications", value: "notifications" },
        ]}
        onChange={setValue}
        orientation="vertical"
        value={value}
      />
    );
  }

  it("are switched with the up and down arrows", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    expect(screen.getByRole("tablist", { name: "Settings" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");
    const security = screen.getByRole("tab", { name: "Security" });
    expect(security).toHaveFocus();
    expect(security).toHaveAttribute("aria-selected", "true");

    // The arrows across the list do nothing
    await user.keyboard("{ArrowRight}");
    expect(security).toHaveFocus();

    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveFocus();
  });

  it("leave the up and down arrows alone when horizontal", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { label: "Day", value: "day" },
          { label: "Week", value: "week" },
        ]}
        onChange={onChange}
        value="day"
      />,
    );

    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );

    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Tabs with icons", () => {
  it("are named by their label", () => {
    render(
      <Tabs
        items={[
          {
            icon: <svg data-testid="inbox-icon" />,
            label: "Inbox",
            value: "inbox",
          },
          { icon: <svg />, label: "Archive", value: "archive" },
        ]}
        value="inbox"
      />,
    );

    const inbox = screen.getByRole("tab", { name: "Inbox" });
    expect(inbox).toContainElement(screen.getByTestId("inbox-icon"));
    expect(screen.getByTestId("inbox-icon").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("Tabs wider than their container", () => {
  const labels = ["All", "Draft", "Sent", "Paid", "Overdue", "Disputed"];

  /**
   * Lays the bar out as a browser would: a 300px wide scroller (or
   * `getWidth()` wide) over six 100px wide tabs.
   */
  function mockLayout(getWidth = () => 300) {
    const isScroller = (element: Element) =>
      element.classList.contains("overflow-x-auto");
    const scroller = () => document.querySelector(".overflow-x-auto");

    vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(
      function (this: Element) {
        return isScroller(this) ? 608 : 0;
      },
    );
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(
      function (this: Element) {
        return isScroller(this) ? getWidth() : 0;
      },
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const scrollLeft = scroller()?.scrollLeft ?? 0;
        const index =
          this.tagName === "LI"
            ? Array.from(this.parentElement?.children ?? [])
                .filter((child) => child.tagName === "LI")
                .indexOf(this)
            : -1;
        const left = isScroller(this)
          ? 0
          : index === -1
            ? -scrollLeft
            : 4 + index * 100 - scrollLeft;
        const width = isScroller(this) ? getWidth() : index === -1 ? 608 : 100;
        return DOMRect.fromRect({ height: 32, width, x: left, y: 0 });
      },
    );

    const scrollTo = vi.fn(function (
      this: HTMLElement,
      options: ScrollToOptions,
    ) {
      this.scrollLeft = options.left ?? 0;
      this.dispatchEvent(new Event("scroll"));
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    return scrollTo;
  }

  function Controlled({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return (
      <Tabs
        items={labels.map((label) => ({ label, value: label }))}
        onChange={setValue}
        value={value}
      />
    );
  }

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  it("scrolls the selected tab into view and fades the edges", async () => {
    const user = userEvent.setup();
    const scrollTo = mockLayout();
    // jsdom cannot parse the mask - what the bar asks for is checked
    const setMask = vi.spyOn(
      Object.getPrototypeOf(document.body.style),
      "maskImage",
      "set",
    );
    render(<Controlled initial="Overdue" />);

    // At once when the page opens on it: its right edge (504px) 24px clear
    // of the fade at the right edge of the bar
    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "instant",
      left: 504 - 300 + 24,
    });
    // More tabs on both sides
    expect(setMask).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^linear-gradient\(to right, transparent, .*, transparent\)$/,
      ),
    );

    // Smoothly to a tab selected later - the browser stops at the start
    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      left: 4 - 24,
    });
  });

  it("scrolls the selected tab back into view when the bar narrows", () => {
    let width = 600;
    const scrollTo = mockLayout(() => width);
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

    try {
      render(<Controlled initial="Paid" />);
      // In view in the wide bar (its right edge at 404px)
      expect(scrollTo).not.toHaveBeenCalled();

      // A phone turned - the bar is 300px wide now
      width = 300;
      act(() =>
        observers.forEach((callback) =>
          callback([], {} as unknown as ResizeObserver),
        ),
      );
      expect(scrollTo).toHaveBeenLastCalledWith({
        behavior: "instant",
        left: 404 - 300 + 24,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("leaves a bar the user scrolled alone when it renders again", () => {
    const scrollTo = mockLayout();
    const items = labels.map((label) => ({ label, value: label }));
    const { rerender } = render(<Tabs items={items} value="Overdue" />);
    expect(scrollTo).toHaveBeenCalledOnce();

    rerender(<Tabs items={[...items]} value="Overdue" />);
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it("does not scroll a vertical list", () => {
    const scrollTo = mockLayout();
    render(
      <Tabs
        items={labels.map((label) => ({ label, value: label }))}
        orientation="vertical"
        value="Overdue"
      />,
    );

    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.querySelector(".overflow-x-auto")).toBeNull();
  });
});

describe("Tabs with a ref", () => {
  const items = [
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
  ];

  it("give the list to the ref and keep working", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLUListElement>();

    function Controlled() {
      const [value, setValue] = useState("day");
      return <Tabs items={items} onChange={setValue} ref={ref} value={value} />;
    }

    render(<Controlled />);

    const tablist = screen.getByRole("tablist");
    expect(ref.current).toBe(tablist);
    // The indicator still finds the list
    expect(tablist.firstElementChild).toHaveAttribute("aria-hidden", "true");

    await user.tab();
    await user.keyboard("{ArrowRight}");

    // The focus follows the selection - it stayed on "Day" before
    const week = screen.getByRole("tab", { name: "Week" });
    expect(week).toHaveFocus();
    expect(week).toHaveAttribute("aria-selected", "true");
  });

  it("call a callback ref and detach it again", () => {
    const callbackRef = vi.fn();
    const { unmount } = render(
      <Tabs items={items} ref={callbackRef} value="day" />,
    );

    const tablist = screen.getByRole("tablist");
    expect(callbackRef.mock.lastCall?.[0]).toBe(tablist);
    expect(tablist.firstElementChild).toHaveAttribute("aria-hidden", "true");

    unmount();
    expect(callbackRef.mock.lastCall?.[0]).toBeNull();
  });
});

describe("Tabs on the server", () => {
  it.each(["horizontal", "vertical"] as const)(
    "render and hydrate (%s)",
    async (orientation) => {
      const tabs = (
        <UIProvider router={{ pathname: "/orders/open", search: "" }}>
          <Tabs
            items={[
              { icon: <svg />, label: "Day", value: "day" },
              { disabled: true, label: "Week", value: "week" },
            ]}
            orientation={orientation}
            value="day"
          />
          <Tabs
            items={[
              { href: "/orders/open", label: "Open" },
              { disabled: true, href: "/orders/archive", label: "Archive" },
            ]}
            orientation={orientation}
          />
        </UIProvider>
      );

      const html = renderToString(tabs);
      expect(html).toContain('aria-selected="true"');

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();

      const root = await act(async () =>
        hydrateRoot(container, tabs, { onRecoverableError }),
      );
      expect(onRecoverableError).not.toHaveBeenCalled();

      act(() => root.unmount());
      container.remove();
    },
  );
});
