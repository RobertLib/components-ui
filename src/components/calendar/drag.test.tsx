import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (title: string, start: Date, end: Date): CalendarEvent => ({
  end,
  id: title,
  start,
  title,
});

/** A press of the primary mouse button. */
const press = { clientX: 400, clientY: 100, isPrimary: true };

/** Presses and moves the pointer by the given pixels - without letting go. */
function pressAndMove(target: Element, deltaY: number, deltaX = 0) {
  fireEvent.pointerDown(target, press);
  fireEvent.pointerMove(document, {
    clientX: 400 + deltaX,
    clientY: 100 + deltaY,
  });
}

/** Drags from the press point by the given pixels and lets go. */
function drag(target: Element, deltaY: number, deltaX = 0) {
  pressAndMove(target, deltaY, deltaX);
  fireEvent.pointerUp(document);
}

/** The top and bottom resize handles of a tile. */
const handles = (tile: HTMLElement) => {
  const [top, bottom] = tile.querySelectorAll(".cursor-ns-resize");
  return { bottom, top };
};

/** The half-hour rows of a day column of the week view (Sunday first). */
const weekSlots = (container: HTMLElement, dayIndex: number) =>
  container
    .querySelectorAll(".day-column")
    [dayIndex].querySelectorAll<HTMLElement>(":scope > .h-16");

const change = (newStart: Date, newEnd: Date) =>
  expect.objectContaining({ newEnd, newStart });

/** Lets the task that ends a drag finish. */
const nextTask = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve)));

describe("Calendar resizing", () => {
  it("changes only the dragged edge, not a part out of view", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Late", d(24, 20), d(24, 23))]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
      />,
    );

    // The end is out of view past 22:00 - dragging down past the grid
    // keeps it
    drag(handles(screen.getByTitle("Late")).bottom, 500);
    expect(onEventResize).not.toHaveBeenCalled();

    // An hour up from the edge drawn at 22:00
    drag(handles(screen.getByTitle("Late")).bottom, -128);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 20), d(24, 21)),
    );

    // The top edge leaves the end alone
    drag(handles(screen.getByTitle("Late")).top, -128);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 19), d(24, 23)),
    );
  });

  it("keeps a start out of view when its edge is dragged above the grid", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Early", d(24, 6), d(24, 9))]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
      />,
    );

    drag(handles(screen.getByTitle("Early")).top, -300);
    expect(onEventResize).not.toHaveBeenCalled();

    // From the top of the grid (7:00) an hour down
    drag(handles(screen.getByTitle("Early")).top, 128);
    expect(onEventResize).toHaveBeenLastCalledWith(change(d(24, 8), d(24, 9)));
  });

  it("keeps the minimum length", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Short", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
      />,
    );

    drag(handles(screen.getByTitle("Short")).bottom, -1000);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 9), d(24, 9, 15)),
    );
  });
});

describe("Calendar moving", () => {
  it("moves an event to another day with its time, also out of view", () => {
    // jsdom has no layout - 100px per day column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Early", d(24, 6), d(24, 8))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByTitle("Early"), 0, 100);
    expect(onEventDrop).toHaveBeenLastCalledWith(change(d(25, 6), d(25, 8)));
  });

  it("keeps the length of an event moved against the day hours", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Long", d(24, 8), d(24, 21, 30))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    // An hour down - only the half hour left to 22:00 fits
    drag(screen.getByTitle("Long"), 128);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      change(d(24, 8, 30), d(24, 22)),
    );

    // Far up - to the start hour
    drag(screen.getByTitle("Long"), -1000);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      change(d(24, 7), d(24, 20, 30)),
    );
  });

  it("moves an event longer than the day hours by nothing up or down", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("All day long", d(24, 6), d(24, 23))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByTitle("All day long"), 256);
    drag(screen.getByTitle("All day long"), -256);
    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("drops nothing when the browser cancels the pointer", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
      />,
    );

    pressAndMove(screen.getByTitle("Review"), 128);
    fireEvent.pointerCancel(document);
    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("lays out overlapping tiles by where an event is dragged to", () => {
    render(
      <Calendar
        events={[
          event("A", d(24, 9), d(24, 10)),
          event("B", d(24, 12), d(24, 13)),
        ]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={() => {}}
      />,
    );

    expect(screen.getByTitle("A")).toHaveStyle({ left: "calc(0% + 2px)" });
    expect(screen.getByTitle("B")).toHaveStyle({ left: "calc(0% + 2px)" });

    // B dragged over A - three hours up
    pressAndMove(screen.getByTitle("B"), -384);
    const lefts = ["A", "B"].map(
      (title) => screen.getByTitle(title).style.left,
    );
    expect(lefts).toContain("calc(50% + 2px)");
    fireEvent.pointerUp(document);
  });

  it("lets a finger drag the tiles, but scroll over the slots", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={() => {}}
        onEventResize={() => {}}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const tile = screen.getByTitle("Review");
    expect(tile).toHaveClass("touch-none");
    expect(handles(tile).top).toHaveClass("touch-none");

    const slot = weekSlots(container, 4)[10];
    fireEvent.pointerDown(slot, { ...press, pointerType: "touch" });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 300 });
    fireEvent.pointerUp(document);
    expect(onSlotDragEnd).not.toHaveBeenCalled();
  });
});

describe("Calendar clicks after a drag", () => {
  it("does not swallow the next click when the drag ends elsewhere", async () => {
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[
          event("Review", d(24, 9), d(24, 10)),
          event("Night shift", d(24, 20), d(25, 6)),
        ]}
        dayEndHour={24}
        initialDate={d(24)}
        initialView="day"
        onEventClick={onEventClick}
        onEventDrop={() => {}}
      />,
    );

    // The release lands elsewhere - no click on the tile follows
    drag(screen.getByTitle("Review"), 128);
    await nextTask();

    // A tile that cannot be dragged - its press starts no drag
    fireEvent.click(screen.getByTitle("Night shift"));
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("does not swallow the next slot click after a slot drag", async () => {
    const onDateClick = vi.fn();
    const onSlotDragEnd = vi.fn();
    render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const rows = document.querySelectorAll<HTMLElement>(
      ".day-view .relative > .h-32",
    );
    drag(rows[2], 200);
    expect(onSlotDragEnd).toHaveBeenCalledTimes(1);
    await nextTask();

    // An assistive click - no press before it
    fireEvent.click(rows[4]);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 11));
  });
});

describe("Calendar slot ranges", () => {
  it("ends a range from the end hour row by the end hour", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    // The 22:00 row of Thursday - the last slot before it is 21:30
    const slots = weekSlots(container, 4);
    drag(slots[slots.length - 1], 200);
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 22),
      start: d(24, 21, 30),
    });
  });
});

describe("Calendar navigation", () => {
  it("stays within the next month from its last days", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={new Date(2026, 0, 31)} />);

    const date = screen.getByRole("combobox", { name: "Go to date" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(date).toHaveValue("02/28/2026");
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(date).toHaveValue("01/28/2026");
  });
});
