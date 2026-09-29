import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent, type EventTimeChange } from ".";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (
  title: string,
  start: Date,
  end: Date,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({ end, id: title, start, title, ...extra });

/** A press of the primary mouse button. */
const press = { clientX: 400, clientY: 100, isPrimary: true };

/** Drags from the press point by the given pixels and lets go. */
function drag(target: Element, deltaY: number, deltaX = 0) {
  fireEvent.pointerDown(target, press);
  fireEvent.pointerMove(document, {
    buttons: 1,
    clientX: 400 + deltaX,
    clientY: 100 + deltaY,
  });
  fireEvent.pointerUp(document);
}

const change = (newStart: Date, newEnd: Date) =>
  expect.objectContaining({ newEnd, newStart });

/** The button of the tile of an event - the element the keys go to. */
const tileButton = (title: string) =>
  screen.getByRole("button", { name: new RegExp(`^${title},`) });

/** The text of the live region of the calendar. */
const announcement = (container: HTMLElement) =>
  container.querySelector(":scope > div > [aria-live]:last-child")?.textContent;

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

/** A calendar that applies the moves - its events follow them. */
function Editable({
  initial,
  onChange,
  ...props
}: {
  initial: CalendarEvent[];
  onChange?: (change: EventTimeChange) => void;
} & React.ComponentProps<typeof Calendar>) {
  const [events, setEvents] = useState(initial);
  const apply = (change: EventTimeChange) => {
    onChange?.(change);
    setEvents((current) =>
      current.map((item) =>
        item.id === change.event.id
          ? {
              ...item,
              end: change.newEnd,
              start: change.newStart,
              ...(change.newResourceId !== undefined && {
                resourceId: change.newResourceId,
              }),
            }
          : item,
      ),
    );
  };

  return (
    <Calendar
      {...props}
      events={events}
      onEventDrop={apply}
      onEventResize={apply}
    />
  );
}

describe("Calendar moving in the month view", () => {
  it("moves an event to another day by the pointer - with its time", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(768);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10, 30))]}
        initialDate={d(24)}
        onEventDrop={onEventDrop}
      />,
    );

    const tile = screen.getByText("Review").closest(".group\\/event")!;
    expect(tile).toHaveClass("cursor-move", "touch-none");

    // Two days right, a week down - 100 x 128 pixels a day
    drag(tile, 128, 200);
    expect(onEventDrop).toHaveBeenCalledWith(
      change(d(3 + 30, 9), d(3 + 30, 10, 30)),
    );
  });

  it("keeps an all-day event of whole days - also one of UTC midnights", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(768);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[
          event("Trip", d(24), d(26), { allDay: true }),
          event("Holiday", new Date("2026-09-10"), new Date("2026-09-11"), {
            allDay: true,
          }),
        ]}
        initialDate={d(24)}
        onEventDrop={onEventDrop}
      />,
    );

    // The tile on the second day of the trip, a day to the left
    const trip = screen.getAllByText("Trip")[1].closest(".group\\/event")!;
    drag(trip, 0, -100);
    expect(onEventDrop).toHaveBeenLastCalledWith(change(d(23), d(25)));

    const holiday = screen.getByText("Holiday").closest(".group\\/event")!;
    drag(holiday, 0, 100);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      change(new Date("2026-09-11"), new Date("2026-09-12")),
    );
  });

  it("drops no event on a disabled day", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(768);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        maxDate={d(25)}
        onEventDrop={onEventDrop}
      />,
    );

    // Three days right - only the 25th is allowed
    drag(screen.getByText("Review").closest(".group\\/event")!, 0, 300);
    expect(onEventDrop).toHaveBeenCalledWith(change(d(25, 9), d(25, 10)));
  });

  it("moves an event by the keys - Ctrl + X, arrows, Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Editable
        initial={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        onChange={onChange}
      />,
    );

    const button = tileButton("Review");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+X");
    act(() => button.focus());

    await user.keyboard("{Control>}x{/Control}");
    expect(announcement(container)).toMatch(/^Review picked up\./);

    // A day on and a week down - the tile moves, the focus with it
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(announcement(container)).toMatch(
      /^Friday, October 2, 2026, 9:00\s–\s10:00\sAM$/,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(tileButton("Review"));
    expect(document.activeElement?.closest(".date-cell")).toHaveTextContent(
      /^2/,
    );

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(change(d(32, 9), d(32, 10)));
    expect(announcement(container)).toMatch(
      /^Review moved to Friday, October 2, 2026, 9:00\s–\s10:00\sAM\.$/,
    );
    expect(document.activeElement).toBe(tileButton("Review"));
  });

  it("puts an event back with Escape", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    const { container } = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        onEventDrop={onEventDrop}
      />,
    );

    act(() => tileButton("Review").focus());
    await user.keyboard("{Control>}x{/Control}{ArrowLeft}{Escape}");
    expect(onEventDrop).not.toHaveBeenCalled();
    expect(announcement(container)).toBe("Review put back.");
    expect(document.activeElement).toBe(tileButton("Review"));
    expect(document.activeElement?.closest(".date-cell")).toHaveTextContent(
      /^24/,
    );
  });

  it("picks up a tile that opens nothing with Enter", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    const onEventClick = vi.fn();
    const { rerender } = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        onEventDrop={onEventDrop}
      />,
    );

    act(() => tileButton("Review").focus());
    await user.keyboard("{Enter}{ArrowRight}{Enter}");
    expect(onEventDrop).toHaveBeenCalledWith(change(d(25, 9), d(25, 10)));

    // A tile that opens its event keeps Enter for that
    rerender(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        onEventClick={onEventClick}
        onEventDrop={onEventDrop}
      />,
    );
    act(() => tileButton("Review").focus());
    await user.keyboard("{Enter}");
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the moved event visible on a crowded day", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        events={[
          event("A", d(25, 8), d(25, 9)),
          event("B", d(25, 9), d(25, 10)),
          event("C", d(25, 10), d(25, 11)),
          event("D", d(25, 11), d(25, 12)),
          event("Late", d(24, 20), d(24, 21)),
        ]}
        initialDate={d(24)}
        onEventDrop={() => {}}
      />,
    );

    act(() => tileButton("Late").focus());
    await user.keyboard("{Control>}x{/Control}{ArrowRight}");
    // In the cell of the 25th, not in its "+2 more"
    expect(tileButton("Late").closest(".date-cell")).toHaveTextContent(/^25/);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});

describe("Calendar moving all-day events in the week and day views", () => {
  it("drags an all-day event to another day of the week", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Offsite", d(24), d(25), { allDay: true })]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    const tile = screen.getByTitle("Offsite");
    expect(tile).toHaveClass("cursor-move");
    drag(tile, 40, -300);
    // All day still, three days earlier - a vertical move changes nothing
    expect(onEventDrop).toHaveBeenCalledWith(change(d(21), d(22)));
  });

  it("moves an all-day event to another resource of the day", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[
          event("Holiday", d(24), d(25), { allDay: true, resourceId: "a" }),
        ]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
        resources={[
          { id: "a", title: "Room A" },
          { id: "b", title: "Room B" },
        ]}
      />,
    );

    act(() => tileButton("Holiday").focus());
    // Up and down do nothing in the row of all-day events
    await user.keyboard("{Control>}x{/Control}{ArrowDown}{ArrowRight}{Enter}");
    expect(onEventDrop).toHaveBeenCalledWith({
      event: expect.objectContaining({ id: "Holiday" }),
      newEnd: d(25),
      newResourceId: "b",
      newStart: d(24),
    });
  });

  it("does not move the all-day events of the day view without resources", () => {
    render(
      <Calendar
        events={[event("Offsite", d(24), d(25), { allDay: true })]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={() => {}}
      />,
    );

    expect(screen.getByTitle("Offsite")).not.toHaveClass("cursor-move");
  });
});

describe("Calendar moving timed events by the keys", () => {
  it("moves by slots and days, and resizes with Shift", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Editable
        initial={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onChange={onChange}
      />,
    );

    act(() => tileButton("Review").focus());
    await user.keyboard("{Control>}x{/Control}{ArrowDown}{ArrowDown}");
    expect(announcement(container)).toMatch(
      /^Thursday, September 24, 2026, 10:00\s–\s11:00\sAM$/,
    );
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(tileButton("Review"));
    expect(document.activeElement?.closest(".day-column")).toBe(
      container.querySelectorAll(".day-column")[3],
    );

    // One kind of change at a time - Shift waits until it is put down
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(change(d(23, 10), d(23, 11)));

    await user.keyboard(
      "{Control>}x{/Control}{Shift>}{ArrowDown}{ArrowDown}{/Shift}{Enter}",
    );
    expect(onChange).toHaveBeenLastCalledWith(change(d(23, 10), d(23, 12)));
    expect(announcement(container)).toMatch(
      /^Review changed to Wednesday, September 23, 2026, 10:00\sAM\s–\s12:00\sPM\.$/,
    );
  });

  it("resizes by the plain arrows an event that can only be resized", async () => {
    const user = userEvent.setup();
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[
          event("Review", d(24, 9), d(24, 10)),
          event("Past", d(23, 9), d(23, 10)),
        ]}
        initialDate={d(24)}
        initialView="week"
        minDate={d(24)}
        onEventResize={onEventResize}
      />,
    );

    // The events of a disabled day stay as they are - no button to pick
    expect(screen.queryByRole("button", { name: /^Past,/ })).toBeNull();

    act(() => tileButton("Review").focus());
    // Across is no change of the length
    await user.keyboard("{Control>}x{/Control}{ArrowRight}{ArrowDown}{Enter}");
    expect(onEventResize).toHaveBeenCalledWith(change(d(24, 9), d(24, 10, 30)));
  });

  it("goes no further than the hours shown", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    render(
      <Calendar
        dayStartHour={8}
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
      />,
    );

    act(() => tileButton("Review").focus());
    await user.keyboard(
      "{Control>}x{/Control}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}",
    );
    expect(onEventDrop).toHaveBeenCalledWith(change(d(24, 8), d(24, 9)));
  });

  it("ends the move when the focus leaves the tile", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    render(
      <>
        <Calendar
          events={[event("Review", d(24, 9), d(24, 10))]}
          initialDate={d(24)}
          initialView="day"
          onEventDrop={onEventDrop}
        />
        <button type="button">Elsewhere</button>
      </>,
    );

    act(() => tileButton("Review").focus());
    await user.keyboard("{Control>}x{/Control}{ArrowDown}");
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    await user.keyboard("{Enter}");
    expect(onEventDrop).not.toHaveBeenCalled();
    // The tile is back where it was
    expect(screen.getByTitle("Review")).toHaveStyle({ top: "256px" });
  });

  it("flips the arrows across in a right-to-left page", async () => {
    const user = userEvent.setup();
    const onEventDrop = vi.fn();
    mockRightToLeft();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    act(() => tileButton("Review").focus());
    await user.keyboard("{Control>}x{/Control}{ArrowLeft}{Enter}");
    expect(onEventDrop).toHaveBeenCalledWith(change(d(25, 9), d(25, 10)));
  });
});
