import { act, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cs } from "../i18n/cs";
import { en } from "../i18n/en";
import { createLocale } from "../i18n/format";
import Timeline, { type TimelineItem } from "./timeline";
import UIProvider from "../providers/ui-provider";

/** September 24, 2026 - a Thursday. */
const at = (hours: number, minutes = 0) =>
  new Date(2026, 8, 24, hours, minutes);

const items: TimelineItem[] = [
  {
    description: "Order 2026-0042",
    id: "created",
    time: at(9, 5),
    title: "Jana Nováková created the order",
  },
  {
    color: "success",
    content: <p>Status: Draft → Approved</p>,
    icon: <svg data-testid="check" />,
    id: "approved",
    time: at(14, 30),
    title: "Petr Svoboda approved it",
  },
  {
    id: "shipped",
    pending: true,
    time: "Expected tomorrow",
    title: "Shipping",
  },
];

describe("Timeline", () => {
  it("is an ordered list of the events", () => {
    render(<Timeline aria-label="History" items={items} />);

    const list = screen.getByRole("list", { name: "History" });
    expect(list.tagName).toBe("OL");

    const [created, approved, shipped] = within(list).getAllByRole("listitem");
    expect(created).toHaveTextContent(
      "Jana Nováková created the order" + "Sep 24, 2026, 9:05 AM",
    );
    expect(created).toHaveTextContent("Order 2026-0042");
    expect(approved).toHaveTextContent("Status: Draft → Approved");
    expect(shipped).toHaveTextContent("Expected tomorrow");
  });

  it("writes the dates by the locale in time elements", () => {
    const { container, rerender } = render(<Timeline items={items} />);

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", at(9, 5).toISOString());
    expect(time).toHaveTextContent("Sep 24, 2026, 9:05 AM");

    rerender(
      <UIProvider locale={cs}>
        <Timeline items={items} />
      </UIProvider>,
    );
    expect(container.querySelector("time")).toHaveTextContent(
      "24. 9. 2026 9:05",
    );

    // A string is written as it is, in no time element
    expect(screen.getByText("Expected tomorrow").tagName).toBe("SPAN");
    expect(container.querySelectorAll("time")).toHaveLength(2);
  });

  it("follows the clock of the locale and the time format", () => {
    const en24 = createLocale(en, { formats: { time: "HH:mm" } });
    const { container, rerender } = render(
      <UIProvider locale={en24}>
        <Timeline items={[{ time: at(14, 30), title: "Approved" }]} />
      </UIProvider>,
    );
    expect(container.querySelector("time")).toHaveTextContent(
      "Sep 24, 2026, 14:30",
    );

    rerender(
      <Timeline
        items={[{ time: at(14, 30), title: "Approved" }]}
        timeFormat={{ timeStyle: "short" }}
      />,
    );
    expect(container.querySelector("time")).toHaveTextContent(/^2:30\sPM$/);
  });

  it("leaves out an invalid date", () => {
    render(
      <Timeline
        items={[{ time: new Date("not a date"), title: "Imported" }]}
      />,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent(/^Imported$/);
  });

  it("tells screen readers which items are pending", () => {
    const { rerender } = render(<Timeline items={items} />);

    const shipped = screen.getAllByRole("listitem")[2];
    expect(shipped).toHaveTextContent("Shipping, Pending");
    expect(screen.getByText(", Pending")).toHaveClass("sr-only");

    rerender(
      <UIProvider locale={cs}>
        <Timeline items={items} />
      </UIProvider>,
    );
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent(
      "Shipping, Čeká na vyřízení",
    );
  });

  it("hides the markers from screen readers", () => {
    render(<Timeline items={items} />);

    const icon = screen.getByTestId("check");
    expect(icon.closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getAllByRole("listitem")[1]).not.toHaveTextContent(/^\s/);
  });

  it("shows placeholders while loading", () => {
    render(
      <Timeline
        aria-label="History"
        items={items}
        loading
        loadingItemsCount={4}
      />,
    );

    const list = screen.getByRole("list", { name: "History" });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
    expect(list.children).toHaveLength(4);
    expect(list).not.toHaveTextContent("Jana");
  });

  it("puts the time across the line when alternate", () => {
    render(<Timeline alternate items={items} />);

    const [created, approved] = screen.getAllByRole("listitem");
    // Both times of an item are rendered - CSS displays one of them
    expect(created.querySelectorAll("time")).toHaveLength(2);
    expect(created.lastElementChild).toHaveClass("hidden", "md:block");
    // The second item is on the left of the line
    expect(approved.children[1]).toHaveClass("md:col-start-1", "md:text-end");
    expect(created.children[1]).toHaveClass("md:col-start-3");
  });

  it("renders on the server and hydrates with the time zone given", async () => {
    const timeline = (
      <Timeline
        items={items}
        timeFormat={{
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }}
      />
    );

    const html = renderToString(timeline);
    expect(html).toContain("Jana Nováková created the order");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, timeline, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
