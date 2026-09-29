import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Calendar, {
  type CalendarEvent,
  type CalendarResource,
  type CalendarView,
} from ".";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (
  title: string,
  start: Date,
  end: Date,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({ end, id: title, start, title, ...extra });

const rooms: CalendarResource[] = [
  { color: "blue", id: "a", title: "Room A" },
  { color: "green", id: "b", title: "Room B" },
  { id: "c", title: "Room C" },
];

const change = (newStart: Date, newEnd: Date, newResourceId?: string) =>
  expect.objectContaining({
    newEnd,
    newStart,
    ...(newResourceId !== undefined && { newResourceId }),
  });

/** Presses at `y` pixels from the top of the rows and drags. */
function drag(target: Element, deltaX: number, deltaY = 0, y = 20) {
  fireEvent.pointerDown(target, { clientX: 400, clientY: y, isPrimary: true });
  fireEvent.pointerMove(document, {
    buttons: 1,
    clientX: 400 + deltaX,
    clientY: y + deltaY,
  });
  fireEvent.pointerUp(document);
}

/** Lays the rows out 48 pixels high each - jsdom has no layout. */
function layOutRows(container: HTMLElement) {
  container
    .querySelectorAll<HTMLElement>("[data-row]")
    .forEach((row, index) => {
      Object.defineProperty(row, "offsetTop", { value: index * 48 });
      Object.defineProperty(row, "offsetHeight", { value: 48 });
    });
}

const rowOf = (container: HTMLElement, resourceId: string) =>
  container.querySelector<HTMLElement>(
    `[data-row][data-resource="${resourceId}"]`,
  )!;

const slotsOf = (row: HTMLElement) =>
  row.querySelectorAll<HTMLElement>("[data-slot]");

const renderTimeline = (
  props: Partial<React.ComponentProps<typeof Calendar>> = {},
  view: CalendarView = "timelineDay",
) =>
  render(
    <Calendar
      initialDate={d(24)}
      initialView={view}
      resources={rooms}
      viewOptions={["timelineDay", "timelineWeek"]}
      {...props}
    />,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("Calendar timeline", () => {
  it("shows a row for each resource, the hours across", () => {
    const { container } = renderTimeline({
      events: [
        event("Sync", d(24, 9), d(24, 10, 30), { resourceId: "a" }),
        event("Interview", d(24, 13), d(24, 14), { resourceId: "b" }),
        event("No room", d(24, 13), d(24, 14)),
      ],
    });

    const rows = container.querySelectorAll("[data-row]");
    expect([...rows].map((row) => row.firstElementChild?.textContent)).toEqual([
      "Room A",
      "Room B",
      "Room C",
    ]);
    expect(rowOf(container, "a")).toContainElement(screen.getByTitle("Sync"));
    expect(screen.queryByText("No room")).toBeNull();

    // 96 pixels an hour from 7:00
    const sync = screen.getByTitle("Sync");
    expect(sync).toHaveStyle({ insetInlineStart: "192px", width: "144px" });
    // Named with its resource - text, as it opens nothing
    expect(
      screen.getByText(/^Sync, Room A, Thursday, September 24, 2026/),
    ).toHaveClass("sr-only");

    const header = container.querySelector(".timeline-view .sticky")!;
    expect(header).toHaveTextContent(/^Thu24Sep7:00 AM8:00 AM/);
    expect(header).toHaveTextContent(/9:00 PM$/);
  });

  it("stacks overlapping events of a row in lanes", () => {
    const { container } = renderTimeline({
      events: [
        event("First", d(24, 9), d(24, 11), { resourceId: "a" }),
        event("Second", d(24, 10), d(24, 12), { resourceId: "a" }),
      ],
    });

    expect(screen.getByTitle("First")).toHaveStyle({ top: "4px" });
    expect(screen.getByTitle("Second")).toHaveStyle({ top: "32px" });
    expect(rowOf(container, "a")).toHaveStyle({ height: "64px" });
    expect(rowOf(container, "b")).toHaveStyle({ height: "48px" });
  });

  it("opens an event and picks a slot of a resource", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const onEventClick = vi.fn();
    const { container } = renderTimeline({
      events: [event("Sync", d(24, 9), d(24, 10), { resourceId: "a" })],
      onDateClick,
      onEventClick,
    });

    await user.click(screen.getByRole("button", { name: /^Sync,/ }));
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Sync" }),
    );

    const slot = slotsOf(rowOf(container, "b"))[3];
    expect(slot).toHaveAccessibleName(
      "Room B, Thursday, September 24, 2026 at 10:00 AM",
    );
    await user.click(slot);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 10), "b");
  });

  it("goes across the time and down the resources by the keys", async () => {
    const user = userEvent.setup();
    const onSlotDragEnd = vi.fn();
    const { container } = renderTimeline({ onSlotDragEnd });

    act(() => slotsOf(rowOf(container, "a"))[2].focus());
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(document.activeElement).toBe(slotsOf(rowOf(container, "b"))[3]);

    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
    expect(
      container.querySelector(".timeline-view > [aria-live]")?.textContent,
    ).toMatch(
      /^Selected: Room B, Thursday, September 24, 2026, 10:00\sAM\s–\s1:00\sPM$/,
    );
    await user.keyboard("{Enter}");
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 13),
      resourceId: "b",
      start: d(24, 10),
    });
  });

  it("drags a range across the slots of a row", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = renderTimeline({ onSlotDragEnd });

    // From 9:00 three hours on
    drag(slotsOf(rowOf(container, "c"))[2], 96 * 2);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 12),
      resourceId: "c",
      start: d(24, 9),
    });
  });

  it("moves an event to another time and resource by the pointer", () => {
    const onEventDrop = vi.fn();
    const { container } = renderTimeline({
      events: [event("Sync", d(24, 9), d(24, 10), { resourceId: "a" })],
      onEventDrop,
    });
    layOutRows(container);

    const tile = screen.getByTitle("Sync");
    expect(tile).toHaveClass("cursor-move", "touch-none");
    // An hour and a half later - the slots are hours - two rows down
    drag(tile, 96 + 60, 96);
    expect(onEventDrop).toHaveBeenCalledWith(change(d(24, 11), d(24, 12), "c"));
  });

  it("resizes an event by its edges", () => {
    const onEventResize = vi.fn();
    renderTimeline({
      events: [event("Sync", d(24, 9), d(24, 10), { resourceId: "a" })],
      onEventResize,
    });

    const [start, end] = screen
      .getByTitle("Sync")
      .querySelectorAll(".cursor-ew-resize");
    drag(end, 96 * 2);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 9), d(24, 12), "a"),
    );
    drag(start, -96);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 8), d(24, 10), "a"),
    );
    // Not shorter than a quarter of an hour
    drag(end, -96 * 3);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 9), d(24, 9, 15), "a"),
    );
  });

  it("moves and resizes an event by the keys", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    const onEventResize = vi.fn();
    renderTimeline({
      events: [event("Sync", d(24, 9), d(24, 10), { resourceId: "a" })],
      onEventDrop,
      onEventResize,
    });

    act(() => screen.getByRole("button", { name: /^Sync,/ }).focus());
    await user.keyboard("{Control>}x{/Control}{ArrowRight}{ArrowDown}{Enter}");
    expect(onEventDrop).toHaveBeenCalledWith(change(d(24, 10), d(24, 11), "b"));

    act(() => screen.getByRole("button", { name: /^Sync,/ }).focus());
    await user.keyboard(
      "{Control>}x{/Control}{Shift>}{ArrowRight}{/Shift}{Enter}",
    );
    expect(onEventResize).toHaveBeenCalledWith(change(d(24, 9), d(24, 11)));
  });

  it("shows the days of the week across - without the hidden ones", () => {
    const { container } = renderTimeline(
      {
        events: [
          event("Late", d(21, 21), d(21, 22), { resourceId: "a" }),
          event("Trip", d(22), d(24), { allDay: true, resourceId: "b" }),
        ],
        hiddenDays: [0, 6],
      },
      "timelineWeek",
    );

    const header = container.querySelector(".timeline-view .sticky")!;
    expect(header).toHaveTextContent(/^Mon21Sep/);
    expect(header).not.toHaveTextContent(/Sun|Sat/);
    // 40 pixels an hour, 15 hours a day - 600 pixels
    expect(screen.getByTitle("Late")).toHaveStyle({
      insetInlineStart: "560px",
      width: "40px",
    });
    // Tuesday and Wednesday, whole
    expect(screen.getByTitle("Trip")).toHaveStyle({
      insetInlineStart: "600px",
      width: "1200px",
    });
    // Every two hours in the time row
    expect(header).toHaveTextContent(/7:00 AM9:00 AM11:00 AM/);
  });

  it("moves on to the next day past the hours shown", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    renderTimeline(
      {
        events: [
          event("Late", d(21, 21), d(21, 22), { resourceId: "a" }),
          event("Trip", d(22), d(24), { allDay: true, resourceId: "b" }),
        ],
        onEventDrop,
      },
      "timelineWeek",
    );

    act(() => screen.getByRole("button", { name: /^Late,/ }).focus());
    await user.keyboard("{Control>}x{/Control}{ArrowRight}{Enter}");
    expect(onEventDrop).toHaveBeenLastCalledWith(
      change(d(22, 7), d(22, 8), "a"),
    );

    // An all-day event by whole days
    act(() => screen.getByRole("button", { name: /^Trip,/ }).focus());
    await user.keyboard("{Control>}x{/Control}{ArrowRight}{ArrowRight}{Enter}");
    expect(onEventDrop).toHaveBeenLastCalledWith(change(d(24), d(26), "b"));
  });

  it("draws the current time and shades the time out of the working hours", () => {
    vi.useFakeTimers({ now: d(24, 10, 30) });
    const { container } = renderTimeline({ businessHours: true });

    const line = container.querySelector<HTMLElement>("[data-now-indicator]");
    // Beside the resource column, three and a half hours on
    expect(line).toHaveStyle({ insetInlineStart: "496px" });
    expect(line).toHaveAttribute("aria-hidden", "true");
    expect(line).toHaveClass("forced-color-adjust-none");

    const shaded = rowOf(container, "a").querySelectorAll("[data-off-hours]");
    expect(shaded).toHaveLength(2);
    expect(shaded[0]).toHaveStyle({ insetInlineStart: "0px", width: "192px" });
    expect(shaded[1]).toHaveStyle({
      insetInlineStart: "960px",
      width: "480px",
    });
  });

  it("picks a day by its heading - not one without working hours", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    renderTimeline(
      { businessHours: true, onDateClick, restrictToBusinessHours: true },
      "timelineWeek",
    );

    await user.click(
      screen.getByRole("button", { name: "Friday, September 25, 2026" }),
    );
    expect(onDateClick).toHaveBeenCalledWith(d(25));
    // The weekend has no working hours
    expect(
      screen.queryByRole("button", { name: "Saturday, September 26, 2026" }),
    ).toBeNull();
  });

  it("shows all events in one row without resources", () => {
    const { container } = render(
      <Calendar
        events={[event("Sync", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="timelineDay"
      />,
    );
    expect(container.querySelectorAll("[data-row]")).toHaveLength(1);
    expect(screen.getByTitle("Sync")).toBeInTheDocument();
  });

  it("goes by weeks in the week timeline", async () => {
    const user = userEvent.setup();
    renderTimeline({}, "timelineWeek");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "09/20/2026 - 09/26/2026",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "09/27/2026 - 10/03/2026",
    );
    // The date stays - its day
    await user.click(screen.getByRole("button", { name: "Day timeline" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thursday, October 1, 2026",
    );
  });
});
