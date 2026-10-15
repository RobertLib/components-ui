import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationCenter, {
  type NotificationCenterProps,
  type NotificationItem,
} from ".";
import UIProvider from "../../../providers/ui-provider";
import { cs } from "../../../i18n/ui/cs";
import type { LinkComponentProps } from "../../../providers/router";

const NOW = new Date(2026, 9, 15, 12, 0, 0).getTime();
const MINUTE = 60_000;

const items: NotificationItem[] = [
  {
    body: "Stavebniny Novák s.r.o. · 48 620 Kč",
    href: "/invoices/418",
    id: 1,
    time: NOW - 5 * MINUTE,
    title: "Invoice FV-2026-0418 was approved",
  },
  {
    avatar: { name: "Petr Svoboda" },
    id: 2,
    onClick: vi.fn(),
    read: true,
    time: NOW - 3 * 60 * MINUTE,
    title: "Petr Svoboda commented on order 1042",
  },
  {
    icon: <svg data-testid="icon" />,
    id: 3,
    time: NOW - 2 * 24 * 60 * MINUTE,
    title: "The export of October is ready",
  },
];

function renderCenter(props: Partial<NotificationCenterProps> = {}) {
  return render(<NotificationCenter notifications={items} {...props} />);
}

/** The bell - named by the count of the unread notifications. */
const bell = (name: RegExp | string = /Notifications/) =>
  screen.getByRole("button", { name });

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(bell());
  return screen.getByRole("dialog", { name: "Notifications" });
}

/** The titles of the listed notifications. */
const titles = () =>
  within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("p")?.textContent);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NotificationCenter", () => {
  it("shows the unread count on the bell - in its name", () => {
    renderCenter();

    const button = bell("Notifications, 2 unread");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.querySelector("[data-badge]")).toHaveTextContent("2");
    expect(button.querySelector("[data-badge]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("takes the unread count of the app, also above max", () => {
    renderCenter({ max: 99, unreadCount: 120 });

    const button = bell("Notifications, 120 unread");
    expect(button.querySelector("[data-badge]")).toHaveTextContent("99+");
  });

  it("names the bell by the title without unread ones", () => {
    renderCenter({ notifications: [], title: "Alerts" });

    expect(bell("Alerts").querySelector("[data-badge]")).toHaveClass("scale-0");
  });

  it("lists the notifications with their time, unread ones marked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCenter();

    const panel = await openPanel(user);
    expect(bell()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(panel).getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    const list = within(panel).getByRole("list", { name: "Notifications" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);

    // The unread one says so before its title, and is a link to its page
    const link = within(rows[0]).getByRole("link", {
      name: "Unread: Invoice FV-2026-0418 was approved",
    });
    expect(link).toHaveAttribute("href", "/invoices/418");
    expect(link).toHaveAccessibleDescription(
      "Stavebniny Novák s.r.o. · 48 620 Kč 5 minutes ago",
    );
    expect(rows[0]).toHaveAttribute("data-state", "unread");
    expect(rows[1]).toHaveAttribute("data-state", "read");
    expect(
      within(rows[1]).getByRole("button", {
        name: "Petr Svoboda commented on order 1042",
      }),
    ).toBeInTheDocument();
    // Without href or onClick the title is plain text
    expect(within(rows[2]).queryByRole("link")).toBeNull();
    expect(within(rows[2]).getByTestId("icon")).toBeInTheDocument();
    expect(within(rows[2]).getByText("2 days ago")).toHaveAttribute(
      "datetime",
      new Date(NOW - 2 * 24 * 60 * MINUTE).toISOString(),
    );
  });

  it("opens a notification - marks it read and closes the panel", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const RouterLink = ({ href, onClick, ...props }: LinkComponentProps) => (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
          navigate(href);
        }}
      />
    );
    const onReadChange = vi.fn();
    render(
      <UIProvider router={{ Link: RouterLink }}>
        <NotificationCenter notifications={items} onReadChange={onReadChange} />
      </UIProvider>,
    );

    await openPanel(user);
    await user.click(screen.getByRole("link", { name: /FV-2026-0418/ }));
    expect(navigate).toHaveBeenCalledWith("/invoices/418");
    expect(onReadChange).toHaveBeenCalledWith(items[0], true);
    expect(screen.queryByRole("dialog")).toBeNull();

    // A read one with onClick
    await openPanel(user);
    await user.click(screen.getByRole("button", { name: /order 1042/ }));
    expect(items[1].onClick).toHaveBeenCalledTimes(1);
    expect(onReadChange).toHaveBeenCalledTimes(1);
  });

  it("marks one read or unread by its button", async () => {
    const user = userEvent.setup();
    const onReadChange = vi.fn();
    renderCenter({ onReadChange });

    await openPanel(user);
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    await user.click(
      within(rows[0]).getByRole("button", { name: "Mark as read" }),
    );
    expect(onReadChange).toHaveBeenLastCalledWith(items[0], true);
    await user.click(
      within(rows[1]).getByRole("button", { name: "Mark as unread" }),
    );
    expect(onReadChange).toHaveBeenLastCalledWith(items[1], false);
    // The panel stays open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("marks all as read - the focus stays in the panel", async () => {
    const user = userEvent.setup();

    function Center() {
      const [notifications, setNotifications] = useState(items);
      return (
        <NotificationCenter
          notifications={notifications}
          onMarkAllRead={() =>
            setNotifications((current) =>
              current.map((item) => ({ ...item, read: true })),
            )
          }
        />
      );
    }

    render(<Center />);
    const panel = await openPanel(user);
    const markAll = within(panel).getByRole("button", {
      name: "Mark all as read",
    });
    await user.click(markAll);

    expect(bell("Notifications")).toBeInTheDocument();
    expect(markAll).toBeDisabled();
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("filters the unread ones - a notification read meanwhile stays until the filter changes", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    function Center() {
      const [notifications, setNotifications] = useState(items);
      return (
        <NotificationCenter
          notifications={notifications}
          onFilterChange={onFilterChange}
          onReadChange={(notification, read) =>
            setNotifications((current) =>
              current.map((item) =>
                item.id === notification.id ? { ...item, read } : item,
              ),
            )
          }
        />
      );
    }

    render(<Center />);
    const panel = await openPanel(user);
    await user.click(within(panel).getByRole("radio", { name: "Unread" }));
    expect(onFilterChange).toHaveBeenCalledWith("unread");
    expect(titles()).toEqual([
      "Unread: Invoice FV-2026-0418 was approved",
      "Unread: The export of October is ready",
    ]);

    const markRead = within(
      within(screen.getByRole("list")).getAllByRole("listitem")[0],
    ).getByRole("button", { name: "Mark as read" });
    await user.click(markRead);
    // Still listed - and its button, which says it may be unread again,
    // keeps the focus
    expect(titles()).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Mark as unread" }),
    ).toHaveFocus();

    await user.click(within(panel).getByRole("radio", { name: "All" }));
    await user.click(within(panel).getByRole("radio", { name: "Unread" }));
    expect(titles()).toEqual(["Unread: The export of October is ready"]);
  });

  it("says so when no notification is unread", async () => {
    const user = userEvent.setup();
    renderCenter({
      defaultFilter: "unread",
      notifications: items.map((item) => ({ ...item, read: true })),
    });

    await openPanel(user);
    expect(screen.getByText("No unread notifications")).toBeVisible();
  });

  it("says so without notifications", async () => {
    const user = userEvent.setup();
    renderCenter({ notifications: [] });

    await openPanel(user);
    expect(screen.getByText("No notifications")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows placeholders while loading", async () => {
    const user = userEvent.setup();
    renderCenter({ loading: true, notifications: [] });

    await openPanel(user);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("shows an error with Try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderCenter({ error: true, notifications: [], onRetry });

    await openPanel(user);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The notifications could not be loaded.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows an error of loading more at the end of the list", async () => {
    const user = userEvent.setup();
    renderCenter({
      error: "Offline - check the connection.",
      hasMore: true,
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
    });

    await openPanel(user);
    expect(titles()).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Offline - check the connection.",
    );
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("loads more - once at a time while the promise is pending", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onLoadMore = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    renderCenter({ hasMore: true, infinite: false, onLoadMore });

    await openPanel(user);
    const loadMore = screen.getByRole("button", { name: "Load more" });
    await user.click(loadMore);
    expect(loadMore).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    await user.click(loadMore);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(loadMore).not.toHaveAttribute("aria-busy");
    await user.click(loadMore);
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("loads more as the end of the list scrolls into view", async () => {
    const user = userEvent.setup();
    const observers: {
      callback: IntersectionObserverCallback;
      elements: Element[];
    }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        elements: Element[] = [];
        constructor(callback: IntersectionObserverCallback) {
          observers.push({ callback, elements: this.elements });
        }
        disconnect() {}
        observe(element: Element) {
          this.elements.push(element);
        }
      },
    );
    const onLoadMore = vi.fn();
    renderCenter({ hasMore: true, loadingMore: false, onLoadMore });

    await openPanel(user);
    const observer = observers.at(-1)!;
    act(() =>
      observer.callback(
        [
          {
            isIntersecting: true,
            target: observer.elements[0],
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not load more while loadingMore", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderCenter({ hasMore: true, loadingMore: true, onLoadMore });

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("moves between the notifications with the arrow keys", async () => {
    const user = userEvent.setup();
    renderCenter({ onReadChange: vi.fn() });

    await openPanel(user);
    const link = screen.getByRole("link", { name: /FV-2026-0418/ });
    link.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /order 1042/ })).toHaveFocus();
    // A row without a link - its first control
    await user.keyboard("{ArrowDown}");
    const lastRow = within(screen.getByRole("list")).getAllByRole(
      "listitem",
    )[2];
    expect(
      within(lastRow).getByRole("button", { name: "Mark as read" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(
      within(lastRow).getByRole("button", { name: "Mark as read" }),
    ).toHaveFocus();
    await user.keyboard("{Home}");
    expect(link).toHaveFocus();
    await user.keyboard("{End}");
    expect(
      within(lastRow).getByRole("button", { name: "Mark as read" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: /order 1042/ })).toHaveFocus();
  });

  it("runs the actions of a notification without opening it", async () => {
    const user = userEvent.setup();
    const approve = vi.fn();
    const onClick = vi.fn();
    renderCenter({
      notifications: [
        {
          actions: [
            { color: "success", label: "Approve", onClick: approve },
            { label: "Reject", onClick: vi.fn() },
          ],
          id: 9,
          onClick,
          time: NOW,
          title: "Leave request of Jana Dvořáková",
        },
      ],
    });

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("is controlled by open and onOpenChange", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <NotificationCenter
        notifications={items}
        onOpenChange={onOpenChange}
        open={false}
      />,
    );

    await user.click(bell());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <NotificationCenter
        notifications={items}
        onOpenChange={onOpenChange}
        open
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("announces a new unread count once a burst of notifications settles", () => {
    vi.useFakeTimers();
    const view = (notifications: NotificationItem[], loading = false) => (
      <NotificationCenter loading={loading} notifications={notifications} />
    );
    const { container, rerender } = render(view([], true));
    const live = container.querySelector("[aria-live='polite']")!;

    // The first load is no news
    rerender(view(items));
    act(() => vi.advanceTimersByTime(2000));
    expect(live).toHaveTextContent("");

    const fresh = (id: number): NotificationItem => ({
      id,
      time: Date.now(),
      title: `New ${id}`,
    });
    rerender(view([fresh(10), ...items]));
    act(() => vi.advanceTimersByTime(500));
    rerender(view([fresh(11), fresh(10), ...items]));
    act(() => vi.advanceTimersByTime(1000));
    expect(live).toHaveTextContent("");
    act(() => vi.advanceTimersByTime(500));
    expect(live).toHaveTextContent("4 unread notifications");

    // Fewer unread - nothing to say
    rerender(view(items));
    act(() => vi.advanceTimersByTime(2000));
    expect(live).toHaveTextContent("4 unread notifications");
  });

  it("opens a sheet from the bottom on phones", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          addEventListener: () => {},
          matches: query.includes("max-width"),
          media: query,
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    renderCenter();

    const button = bell("Notifications, 2 unread");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(button);
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(within(sheet).getAllByRole("listitem")).toHaveLength(3);
    // The sheet has the heading
    expect(within(sheet).getAllByRole("heading")).toHaveLength(1);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("speaks Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <NotificationCenter
          notifications={items}
          onMarkAllRead={vi.fn()}
          onReadChange={vi.fn()}
        />
      </UIProvider>,
    );

    await user.click(bell(/Oznámení/));
    expect(
      screen.getByRole("button", { name: "Oznámení, 2 nepřečtená" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Označit vše jako přečtené" }),
    ).toBeVisible();
    expect(screen.getByRole("radio", { name: "Vše" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Nepřečtené" })).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Označit jako přečtené" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /^Nepřečtené: Invoice/ }),
    ).toBeVisible();
  });

  it("passes the ref and props to the wrapper", () => {
    const ref = { current: null as HTMLDivElement | null };
    renderCenter({ className: "ms-2", "data-testid": "center", ref } as never);

    expect(screen.getByTestId("center")).toBe(ref.current);
    expect(screen.getByTestId("center")).toHaveClass("ms-2");
    fireEvent.click(bell());
  });
});
