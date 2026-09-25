import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent, type CalendarResource } from ".";

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

/** A press of the primary mouse button. */
const press = { clientX: 400, clientY: 100, isPrimary: true };

/** Presses and moves the pointer by the given pixels - without letting go. */
function pressAndMove(target: Element, deltaY: number, deltaX = 0) {
  fireEvent.pointerDown(target, press);
  fireEvent.pointerMove(document, {
    buttons: 1,
    clientX: 400 + deltaX,
    clientY: 100 + deltaY,
  });
}

/** Drags from the press point by the given pixels and lets go. */
function drag(target: Element, deltaY: number, deltaX = 0) {
  pressAndMove(target, deltaY, deltaX);
  fireEvent.pointerUp(document);
}

/** The column of a resource - the first one of that resource. */
const column = (container: HTMLElement, resourceId: string) =>
  container.querySelector<HTMLElement>(
    `.day-column[data-resource="${resourceId}"]`,
  )!;

/** The slot rows of a column. */
const slots = (columnElement: HTMLElement) =>
  columnElement.querySelectorAll<HTMLElement>(":scope > [data-slot]");

/** The bottom resize handle of a tile. */
const bottomHandle = (tile: HTMLElement) =>
  tile.querySelectorAll(".cursor-ns-resize")[1];

const standup = event("Standup", d(24, 9), d(24, 10), { resourceId: "a" });
const interview = event("Interview", d(24, 11), d(24, 12), {
  resourceId: "b",
});

describe("Calendar resources in the day view", () => {
  it("shows a column for each resource with its events", () => {
    const { container } = render(
      <Calendar
        events={[
          standup,
          interview,
          event("Nobody's", d(24, 9), d(24, 10)),
          event("Unknown room", d(24, 9), d(24, 10), { resourceId: "x" }),
        ]}
        initialDate={d(24)}
        initialView="day"
        onEventClick={() => {}}
        resources={rooms}
      />,
    );

    const header = container.querySelector<HTMLElement>(
      ".resource-view > .sticky",
    )!;
    expect(
      [...header.querySelectorAll("[data-resource]")].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["Room A", "Room B", "Room C"]);
    expect(column(container, "a")).toContainElement(
      screen.getByTitle("Standup"),
    );
    expect(column(container, "b")).toContainElement(
      screen.getByTitle("Interview"),
    );
    // Events of no resource among them are left out
    expect(screen.queryByTitle("Nobody's")).toBeNull();
    expect(screen.queryByTitle("Unknown room")).toBeNull();
    // Named with their resource
    expect(
      screen.getByRole("button", {
        name: /^Standup, Room A, Thursday, September 24, 2026.* 9:00\s–\s10:00\sAM$/,
      }),
    ).toBeInTheDocument();
  });

  it("colors the events without a color of their own by their resource", () => {
    const { container } = render(
      <Calendar
        events={[
          standup,
          event("Urgent", d(24, 13), d(24, 14), {
            color: "red",
            resourceId: "a",
          }),
          event("Plain", d(24, 13), d(24, 14), { resourceId: "c" }),
        ]}
        initialDate={d(24)}
        initialView="day"
        resources={rooms}
      />,
    );

    expect(screen.getByTitle("Standup")).toHaveClass("bg-blue-100");
    expect(screen.getByTitle("Urgent")).toHaveClass("bg-red-100");
    expect(screen.getByTitle("Plain")).toHaveClass("bg-primary-100");
    // The mark of the resource in its header
    expect(
      container.querySelector('.sticky [data-resource="a"] .border-blue-500'),
    ).not.toBeNull();
  });

  it("gives the resource of a clicked slot", () => {
    const onDateClick = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        resources={rooms}
      />,
    );

    // 9:00 in Room B
    const nine = slots(column(container, "b"))[2];
    expect(nine).toHaveAccessibleName(
      /^Room B, Thursday, September 24, 2026.* 9:00\sAM$/,
    );
    fireEvent.click(nine);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 9), "b");
  });

  it("moves between the resources with the arrow keys and picks a range", async () => {
    const user = userEvent.setup();
    const onSlotDragEnd = vi.fn();
    render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onSlotDragEnd={onSlotDragEnd}
        resources={rooms}
      />,
    );

    // One tab stop - the first slot of the first resource
    const first = screen.getByRole("button", { name: /^Room A, .* 7:00\sAM$/ });
    expect(first).toHaveAttribute("tabindex", "0");
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("button", { name: /^Room B, .* 7:00\sAM$/ }),
    ).toHaveFocus();

    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(screen.getByText(/^Selected: /)).toHaveTextContent(
      /^Selected: Room B, Thursday, September 24, 2026.* 7:00\s–\s10:00\sAM$/,
    );
    await user.keyboard("{Enter}");
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 10),
      resourceId: "b",
      start: d(24, 7),
    });
  });

  it("gives the resource of a range dragged over its slots", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onSlotDragEnd={onSlotDragEnd}
        resources={rooms}
      />,
    );

    // From 9:00 of Room C two hours down
    drag(slots(column(container, "c"))[2], 256);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 12),
      resourceId: "c",
      start: d(24, 9),
    });
  });

  it("moves an event to another resource", () => {
    // jsdom has no layout - 100px per resource column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
        resources={rooms}
      />,
    );

    // Two columns right and an hour down
    drag(screen.getByTitle("Standup"), 128, 200);
    expect(onEventDrop).toHaveBeenLastCalledWith({
      event: standup,
      newEnd: d(24, 11),
      newResourceId: "c",
      newStart: d(24, 10),
    });

    // Only sideways - the times stay; past the last column the last one
    drag(screen.getByTitle("Standup"), 0, 1000);
    expect(onEventDrop).toHaveBeenLastCalledWith({
      event: standup,
      newEnd: d(24, 10),
      newResourceId: "c",
      newStart: d(24, 9),
    });
  });

  it("shows a dragged event in the column it is over", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
    const { container } = render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={() => {}}
        resources={rooms}
      />,
    );

    pressAndMove(screen.getByTitle("Standup"), 0, 100);
    expect(column(container, "b")).toContainElement(
      screen.getByTitle("Standup"),
    );
    expect(column(container, "a")).not.toContainElement(
      screen.getByTitle("Standup"),
    );

    // Escape puts it back
    fireEvent.keyDown(document, { key: "Escape" });
    expect(column(container, "a")).toContainElement(
      screen.getByTitle("Standup"),
    );
    fireEvent.pointerUp(document);
  });

  it("reports the resource of a resized event", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
        resources={rooms}
      />,
    );

    drag(bottomHandle(screen.getByTitle("Standup")), 128);
    expect(onEventResize).toHaveBeenCalledWith({
      event: standup,
      newEnd: d(24, 11),
      newResourceId: "a",
      newStart: d(24, 9),
    });
  });

  it("shows the all-day events in the header of their resource", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Calendar
        events={["Holiday", "Inventory", "Painting"].map((title) =>
          event(title, d(24), d(25), { allDay: true, resourceId: "b" }),
        )}
        initialDate={d(24)}
        initialView="day"
        resources={rooms}
      />,
    );

    const roomB = container.querySelector<HTMLElement>(
      '.sticky [data-resource="b"]',
    )!;
    expect(within(roomB).getByText("Holiday")).toBeVisible();
    // Two, and the rest behind "+1 more"
    expect(within(roomB).queryByText("Painting")).toBeNull();
    await user.click(
      within(roomB).getByRole("button", {
        name: "+1 more, Room B, Thursday, September 24, 2026",
      }),
    );
    const list = screen.getByRole("dialog");
    expect(
      within(list).getByText("Room B, Thursday, September 24, 2026"),
    ).toBeVisible();
    expect(within(list).getByText("Painting")).toBeVisible();
  });

  it("keeps the header and the time column in view", () => {
    const { container } = render(
      <Calendar initialDate={d(24)} initialView="day" resources={rooms} />,
    );

    expect(container.querySelector(".resource-view > .sticky")).toHaveClass(
      "top-0",
      "z-20",
    );
    expect(container.querySelector(".time-column")).toHaveClass(
      "sticky",
      "left-0",
      "z-10",
    );
    // Many resources get wider than the view - it scrolls sideways
    expect(container.querySelector(".resource-view")).toHaveClass(
      "overflow-y-auto",
    );
    expect(
      container.querySelector<HTMLElement>(".resource-view > .sticky")!.style
        .minWidth,
    ).toBe(`${60 + 3 * 120}px`);
  });

  it("shows the plain day view without resources", () => {
    const { container } = render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="day"
        resources={[]}
      />,
    );

    expect(container.querySelector(".resource-view")).toBeNull();
    expect(screen.getByTitle("Standup")).toBeInTheDocument();
  });
});

describe("Calendar resources in the week view", () => {
  const twoRooms = rooms.slice(0, 2);

  it("shows a column for each resource of every day", () => {
    const { container } = render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="week"
        onDateClick={() => {}}
        resources={twoRooms}
      />,
    );

    const columns = container.querySelectorAll(".day-column");
    expect(columns).toHaveLength(14);
    // Thursday - the fifth day, Room A its first resource
    expect(columns[8]).toContainElement(screen.getByTitle("Standup"));
    expect(columns[8]).toHaveAttribute("data-resource", "a");
    // The days over their resources - a day button each
    expect(
      screen.getByRole("button", { name: "Thursday, September 24, 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Room B, Thursday, .* 7:00\sAM$/ }),
    ).toBeInTheDocument();
  });

  it("moves an event to another day and resource", () => {
    // jsdom has no layout - 100px per column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1400);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="week"
        minDate={d(24)}
        onEventDrop={onEventDrop}
        resources={twoRooms}
      />,
    );

    // Three columns right - Friday, Room B
    drag(screen.getByTitle("Standup"), 64, 300);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      expect.objectContaining({
        newEnd: d(25, 10, 30),
        newResourceId: "b",
        newStart: d(25, 9, 30),
      }),
    );

    // Far left - not before `minDate`: Thursday, Room A
    drag(screen.getByTitle("Standup"), 64, -1000);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      expect.objectContaining({
        newResourceId: "a",
        newStart: d(24, 9, 30),
      }),
    );
  });

  it("reports no resource in a week without resources", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByTitle("Standup"), 64);
    expect(Object.keys(onEventDrop.mock.calls[0][0]).sort()).toEqual([
      "event",
      "newEnd",
      "newStart",
    ]);
  });
});

describe("Calendar drags near the edges of resource columns", () => {
  it("scrolls the view sideways to the resources out of view", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
    const onEventDrop = vi.fn();
    const { container } = render(
      <Calendar
        events={[standup]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
        resources={[
          ...rooms,
          { id: "d", title: "Room D" },
          { id: "e", title: "Room E" },
          { id: "f", title: "Room F" },
        ]}
      />,
    );

    // A view of 300px showing three of the six columns of 100px
    const scroller = container.querySelector<HTMLElement>(".resource-view")!;
    const grid = container.querySelector(".day-column")!.parentElement!;
    vi.spyOn(scroller, "scrollWidth", "get").mockReturnValue(660);
    vi.spyOn(scroller, "clientWidth", "get").mockReturnValue(360);
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      left: 0,
      right: 360,
      top: 0,
    } as DOMRect);
    vi.spyOn(grid, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: 60 - scroller.scrollLeft,
          top: 50,
        }) as DOMRect,
    );

    // Pressed at x 100 - to the right edge of the view
    fireEvent.pointerDown(screen.getByTitle("Standup"), {
      clientX: 100,
      clientY: 300,
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { buttons: 1, clientX: 355, clientY: 300 });
    // A few frames scroll the view - the event goes along
    for (let index = 0; index < 20 && frames.length > 0; index++) {
      frames.shift()!(0);
      fireEvent.scroll(scroller);
    }
    expect(scroller.scrollLeft).toBeGreaterThan(0);
    fireEvent.pointerUp(document);

    // Further right than the pointer moved - by the scrolled distance
    const { newResourceId } = onEventDrop.mock.calls[0][0];
    expect(["e", "f"]).toContain(newResourceId);
  });
});
