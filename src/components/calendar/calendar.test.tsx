import { fireEvent, render, screen, within } from "@testing-library/react";
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

/** The hour rows of the day view. */
const daySlots = (container: HTMLElement) =>
  container.querySelectorAll<HTMLElement>(".day-view .relative > .h-32");

/** The half-hour rows of a day column of the week view (Sunday first). */
const weekSlots = (container: HTMLElement, dayIndex: number) =>
  container
    .querySelectorAll(".day-column")
    [dayIndex].querySelectorAll<HTMLElement>(":scope > .h-16");

/** A press of the primary mouse button. */
const press = { clientX: 400, clientY: 100, isPrimary: true };

/** Drags from the press point by the given pixels and lets go. */
function drag(target: Element, deltaY: number, deltaX = 0) {
  fireEvent.pointerDown(target, press);
  fireEvent.pointerMove(document, {
    clientX: 400 + deltaX,
    clientY: 100 + deltaY,
  });
  fireEvent.pointerUp(document);
}

const change = (newStart: Date, newEnd: Date) =>
  expect.objectContaining({ newEnd, newStart });

describe("Calendar event clicks and drags", () => {
  it("reports a click on a draggable event in the day view", () => {
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[event("Standup", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventClick={onEventClick}
        onEventDrop={() => {}}
      />,
    );

    const tile = screen.getByTitle("Standup");
    fireEvent.pointerDown(tile, press);
    fireEvent.pointerUp(document);
    fireEvent.click(tile);

    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("takes pointer jitter during a click for a click, not a move", () => {
    const onEventClick = vi.fn();
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9, 10), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
        onEventDrop={onEventDrop}
      />,
    );

    const tile = screen.getByTitle("Review");
    drag(tile, 1);
    fireEvent.click(tile);

    expect(onEventDrop).not.toHaveBeenCalled();
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("moves an event by whole slots, keeping its minutes", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9, 10), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByTitle("Review"), 64);
    expect(onEventDrop).toHaveBeenCalledWith(
      change(d(24, 9, 40), d(24, 10, 30)),
    );
  });

  it("starts no drag on a right click", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    const tile = screen.getByTitle("Review");
    fireEvent.pointerDown(tile, { ...press, button: 2 });
    fireEvent.pointerMove(document, { clientY: 228 });
    fireEvent.pointerUp(document);

    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("drops events on the enabled days of the week only", () => {
    // jsdom has no layout - 100px per day column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Meeting", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        minDate={d(23, 12)}
        onEventDrop={onEventDrop}
      />,
    );

    // Thursday to Monday, before `minDate` - Wednesday is the first day left
    drag(screen.getByTitle("Meeting"), 0, -300);
    expect(onEventDrop).toHaveBeenLastCalledWith(change(d(23, 9), d(23, 10)));

    // Far past the end of the week - Saturday is its last day
    drag(screen.getByTitle("Meeting"), 0, 1000);
    expect(onEventDrop).toHaveBeenLastCalledWith(change(d(26, 9), d(26, 10)));
  });
});

describe("Calendar hours", () => {
  it("keeps drags that reach midnight on their day (dayEndHour 24)", () => {
    const onEventDrop = vi.fn();
    const onEventResize = vi.fn();
    render(
      <Calendar
        dayEndHour={24}
        events={[event("Late", d(24, 23), d(24, 23, 30))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
      />,
    );

    const tile = screen.getByTitle("Late");
    const handles = tile.querySelectorAll(".cursor-ns-resize");
    drag(handles[handles.length - 1], 64);
    expect(onEventResize).toHaveBeenCalledWith(change(d(24, 23), d(25)));

    drag(tile, 128);
    expect(onEventDrop).toHaveBeenCalledWith(change(d(24, 23, 30), d(25)));
  });

  it("keeps drags that overshoot the grid within the day hours", () => {
    const onEventDrop = vi.fn();
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        events={[event("Evening", d(24, 20), d(24, 21))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    drag(screen.getByTitle("Evening"), 2000);
    expect(onEventDrop).toHaveBeenCalledWith(change(d(24, 21), d(24, 22)));

    // The 21:00 slot of Thursday, dragged far below the grid
    drag(weekSlots(container, 4)[28], 2000);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 22),
      start: d(24, 21),
    });
  });

  it("gives the 24:00 row a time of its own day", () => {
    const onDateClick = vi.fn();
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        dayEndHour={24}
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const slots = daySlots(container);
    drag(slots[slots.length - 2], 128);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(25),
      start: d(24, 23),
    });

    fireEvent.pointerDown(slots[slots.length - 1], press);
    fireEvent.pointerUp(slots[slots.length - 1]);
    fireEvent.click(slots[slots.length - 1]);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 23));
  });

  it("does not report the click that ends a slot drag", () => {
    const onDateClick = vi.fn();
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    // A drag within the 9:00 row - the click lands on the same row
    const row = daySlots(container)[2];
    drag(row, 100);
    fireEvent.click(row);

    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 11),
      start: d(24, 9),
    });
    expect(onDateClick).not.toHaveBeenCalled();

    // The next click is one again
    fireEvent.pointerDown(row, press);
    fireEvent.pointerUp(row);
    fireEvent.click(row);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 9));
  });

  it("shows the visible part of events crossing the day hours", () => {
    const events = [
      event("Early", d(24, 6, 30), d(24, 7, 45)),
      event("Evening", d(24, 21), d(25)),
    ];
    const { unmount } = render(
      <Calendar events={events} initialDate={d(24)} initialView="day" />,
    );

    expect(screen.getByTitle("Early")).toHaveStyle({
      height: "96px",
      top: "0px",
    });
    // 21:00 - 22:00, the end hour
    expect(screen.getByTitle("Evening")).toHaveStyle({
      height: "128px",
      top: `${14 * 128}px`,
    });
    unmount();

    render(
      <Calendar
        dayEndHour={24}
        events={events}
        initialDate={d(24)}
        initialView="week"
      />,
    );
    expect(screen.getByTitle("Early")).toHaveStyle({
      height: "96px",
      top: "0px",
    });
    // 21:00 - 24:00
    expect(screen.getByTitle("Evening")).toHaveStyle({
      height: `${6 * 64}px`,
      top: `${28 * 64}px`,
    });
  });
});

describe("Calendar", () => {
  it("shows an all-day event on its days only - the end is exclusive", () => {
    render(
      <Calendar
        events={[{ ...event("Conference", d(10), d(11)), allDay: true }]}
        initialDate={d(24)}
      />,
    );

    expect(screen.getAllByText("Conference")).toHaveLength(1);
  });

  it("shows all-day events in the header of the week view", () => {
    const onDateClick = vi.fn();
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[{ ...event("Offsite", d(22), d(24)), allDay: true }]}
        initialDate={d(24)}
        initialView="week"
        onDateClick={onDateClick}
        onEventClick={onEventClick}
      />,
    );

    // Tuesday and Wednesday - the end is exclusive
    const tiles = screen.getAllByTitle("Offsite");
    expect(tiles).toHaveLength(2);

    fireEvent.click(tiles[0]);
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onDateClick).not.toHaveBeenCalled();
  });

  it("keeps the shown date when the date field is cleared", () => {
    render(<Calendar initialDate={d(24)} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear value" }));
    expect(screen.getByRole("combobox", { name: "Go to date" })).toHaveValue(
      "09/24/2026",
    );
  });
});

describe("Calendar events over several days", () => {
  const conference = { ...event("Conference", d(22), d(25)), allDay: true };
  const nightShift = event("Night shift", d(22, 20), d(23, 6));

  it("shows them on every day they run into", () => {
    const { unmount } = render(
      <Calendar
        dayEndHour={24}
        dayStartHour={0}
        events={[conference, nightShift]}
        initialDate={d(23)}
        initialView="day"
      />,
    );

    // The second day of both
    expect(screen.getByText(/Conference/)).toBeInTheDocument();
    expect(screen.getByTitle("Night shift")).toBeInTheDocument();
    unmount();

    render(
      <Calendar
        dayEndHour={24}
        dayStartHour={0}
        events={[conference, nightShift]}
        initialDate={d(23)}
        initialView="week"
      />,
    );
    expect(screen.getAllByTitle("Conference")).toHaveLength(3);
    expect(screen.getAllByTitle("Night shift")).toHaveLength(2);
  });

  it("shows a timed event over midnight on both days of the month view", () => {
    render(<Calendar events={[nightShift]} initialDate={d(23)} />);

    expect(screen.getAllByText("Night shift")).toHaveLength(2);
  });

  it("does not drag or resize an event over midnight", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        dayEndHour={24}
        dayStartHour={0}
        events={[nightShift]}
        initialDate={d(22)}
        initialView="day"
        onEventDrop={onEventDrop}
        onEventResize={() => {}}
      />,
    );

    const tile = screen.getByTitle("Night shift");
    drag(tile, 128);

    expect(onEventDrop).not.toHaveBeenCalled();
    expect(tile.querySelector(".cursor-ns-resize")).toBeNull();
  });
});

describe("Calendar from the keyboard", () => {
  it("moves between the days with the arrow keys and opens them", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(<Calendar initialDate={d(24)} onDateClick={onDateClick} />);

    // The selected day is the tab stop of the month grid
    const thursday = screen.getByRole("button", {
      name: "Thursday, September 24, 2026",
    });
    expect(thursday).toHaveAttribute("tabindex", "0");

    thursday.focus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(
      screen.getByRole("button", { name: "Friday, October 2, 2026" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onDateClick).toHaveBeenCalledWith(new Date(2026, 9, 2));
  });

  it("opens an event with Enter", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[event("Standup", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        onDateClick={onDateClick}
        onEventClick={onEventClick}
      />,
    );

    screen.getByRole("button", { name: "Standup" }).focus();
    await user.keyboard("{Enter}");

    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Standup" }),
    );
    expect(onDateClick).not.toHaveBeenCalled();
  });

  it("picks a time slot of the week view with the arrow keys", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onDateClick={onDateClick}
      />,
    );

    // One slot is the tab stop - the first one of the selected day
    const first = screen.getByRole("button", {
      name: /September 24, 2026.*7:00\sAM/,
    });
    expect(first).toHaveAttribute("tabindex", "0");

    first.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    expect(
      screen.getByRole("button", { name: /September 25, 2026.*8:00\sAM/ }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onDateClick).toHaveBeenCalledWith(d(25, 8));
  });

  it("lists the events a crowded day has no room for", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const onEventClick = vi.fn();
    const busy = ["A", "B", "C", "D", "E"].map((title, index) =>
      event(title, d(24, 8 + index), d(24, 9 + index)),
    );
    render(
      <Calendar
        events={busy}
        initialDate={d(24)}
        onDateClick={onDateClick}
        onEventClick={onEventClick}
      />,
    );

    expect(screen.queryByText("D")).toBeNull();
    const more = screen.getByRole("button", { name: "+2 more" });
    more.focus();
    await user.keyboard("{Enter}");

    const list = screen.getByRole("dialog");
    expect(
      within(list).getByText("Thursday, September 24, 2026"),
    ).toBeVisible();
    await user.tab();
    expect(within(list).getByRole("button", { name: "A" })).toHaveFocus();

    within(list).getByRole("button", { name: "D" }).focus();
    await user.keyboard("{Enter}");
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ title: "D" }),
    );
    expect(onDateClick).not.toHaveBeenCalled();
  });
});

describe("Calendar", () => {
  it("renders an htmlTitle without scripts", () => {
    render(
      <Calendar
        events={[
          {
            ...event("Team", d(24, 9), d(24, 10)),
            htmlTitle:
              '<b class="text-danger-600">Team</b><img src=x onerror="alert(1)">',
          },
        ]}
        initialDate={d(24)}
      />,
    );

    expect(screen.getByText("Team", { selector: "b" })).toHaveClass(
      "text-danger-600",
    );
    expect(document.querySelector("img")).toBeNull();
  });

  it("follows a controlled view", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const { rerender } = render(
      <Calendar initialDate={d(24)} onViewChange={onViewChange} view="month" />,
    );

    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(onViewChange).toHaveBeenCalledWith("week");
    // The parent has not switched it yet
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    rerender(
      <Calendar initialDate={d(24)} onViewChange={onViewChange} view="week" />,
    );
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
