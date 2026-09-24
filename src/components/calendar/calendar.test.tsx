import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import { createLocale } from "../../i18n/format";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import { UIContext } from "../../providers/ui-context";
import UIProvider from "../../providers/ui-provider";

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
    buttons: 1,
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

  it("takes a drag back to where the event was for no click", () => {
    const onEventClick = vi.fn();
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
        onEventDrop={onEventDrop}
      />,
    );

    const tile = screen.getByTitle("Review");
    fireEvent.pointerDown(tile, press);
    // A slot down, and back up
    fireEvent.pointerMove(document, { buttons: 1, clientX: 400, clientY: 164 });
    fireEvent.pointerMove(document, { buttons: 1, clientX: 400, clientY: 100 });
    fireEvent.pointerUp(document);
    fireEvent.click(tile);

    expect(onEventDrop).not.toHaveBeenCalled();
    expect(onEventClick).not.toHaveBeenCalled();

    // The next click is one again
    fireEvent.pointerDown(tile, press);
    fireEvent.pointerUp(document);
    fireEvent.click(tile);
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

  it("gives the row of the end hour the last slot before it (dayEndHour 22)", () => {
    const onDateClick = vi.fn();
    const { container, unmount } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onDateClick={onDateClick}
      />,
    );

    // The 22:00 row of Thursday - an event at 22:00 would not show
    const slots = weekSlots(container, 4);
    fireEvent.click(slots[slots.length - 1]);
    expect(onDateClick).toHaveBeenLastCalledWith(d(24, 21, 30));
    expect(slots[slots.length - 1]).toHaveAccessibleName(
      slots[slots.length - 2].getAttribute("aria-label")!,
    );
    unmount();

    const { container: dayContainer } = render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
      />,
    );
    const rows = daySlots(dayContainer);
    fireEvent.click(rows[rows.length - 1]);
    expect(onDateClick).toHaveBeenLastCalledWith(d(24, 21));
  });

  it("names the slots on the clock of the locale", () => {
    render(
      <UIProvider locale={createLocale(en, { formats: { time: "HH:mm" } })}>
        <Calendar
          initialDate={d(24)}
          initialView="week"
          onDateClick={() => {}}
        />
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: /September 24, 2026.* 15:00$/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /September 24, 2026.*PM$/ }),
    ).not.toBeInTheDocument();
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

  it("keeps the shown date when the date field is emptied", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={d(24)} />);

    // The calendar always shows a date - nothing to clear
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();

    const field = screen.getByRole("combobox", { name: "Go to date" });
    await user.clear(field);
    await user.tab();
    expect(field).toHaveValue("09/24/2026");
  });

  it("says the day the navigation moved to in the day view", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={d(24)} initialView="day" />);

    // The date field shows it - the heading says it to screen readers
    const period = screen.getByRole("heading", { level: 2 });
    expect(period).toHaveAttribute("aria-live", "polite");
    expect(period).toHaveClass("sr-only");
    expect(period).toHaveTextContent("Thursday, September 24, 2026");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(period).toHaveTextContent("Friday, September 25, 2026");
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(period).not.toHaveClass("sr-only");
    expect(period).toHaveTextContent("09/20/2026 - 09/26/2026");
  });

  it("offers the days from minDate to maxDate in the date field", async () => {
    const user = userEvent.setup();
    render(
      <Calendar initialDate={d(24)} maxDate={d(26, 12)} minDate={d(20, 12)} />,
    );

    const field = screen.getByRole("combobox", { name: "Go to date" });
    await user.clear(field);
    await user.type(field, "09/27/2026{Enter}");
    expect(field).toHaveValue("09/24/2026");

    await user.clear(field);
    await user.type(field, "09/26/2026{Enter}");
    expect(field).toHaveValue("09/26/2026");
  });

  it("marks today and the selected day of the month grid", () => {
    const today = new Date();
    const selected = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() === 1 ? 2 : 1,
    );
    render(<Calendar initialDate={selected} onDateClick={() => {}} />);

    // The days - not the view switcher
    const pressed = screen
      .getAllByRole("button", { pressed: true })
      .filter((button) => button.hasAttribute("data-day"));
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent(String(selected.getDate()));
    expect(pressed[0]).not.toHaveAttribute("aria-current");

    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(String(today.getDate()));
    expect(current[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("marks today also without onDateClick", () => {
    render(<Calendar />);

    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  it("renders with a locale code Intl does not understand", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const locale = createLocale(en, { code: "en_GB" });

    for (const view of ["month", "week", "day"] as const) {
      const { unmount } = render(
        // Without the provider, which would fix the code
        <UIContext value={{ locale }}>
          <Calendar
            events={[
              event("Standup", d(24, 9), d(24, 10)),
              { ...event("Trip", d(24), d(25)), allDay: true },
            ]}
            initialDate={d(24)}
            initialView={view}
            onDateClick={() => {}}
            onEventClick={() => {}}
            onSlotDragEnd={() => {}}
          />
        </UIContext>,
      );
      expect(
        screen.getAllByRole("button", { name: /Standup, Thursday/ }).length,
      ).toBeGreaterThan(0);
      unmount();
    }

    warn.mockRestore();
  });

  it("warns about a controlled date that cannot be navigated", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { unmount } = render(<Calendar currentDate={d(24)} />);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("`currentDate` without `setCurrentDate`"),
    );
    unmount();

    warn.mockClear();
    render(<Calendar currentDate={d(24)} setCurrentDate={() => {}} />);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});

// `new Date("2026-09-24")` is the evening before in New York and 2:00 of
// the day in Prague
describe.each(["America/New_York", "Europe/Prague"])(
  "Calendar all-day events of date strings (%s)",
  (timeZone) => {
    let previousTZ: string | undefined;

    beforeAll(() => {
      previousTZ = process.env.TZ;
      process.env.TZ = timeZone;
    });

    afterAll(() => {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    });

    const trip = {
      ...event("Trip", new Date("2026-09-24"), new Date("2026-09-25")),
      allDay: true,
    };

    it("shows them on their day only", () => {
      render(
        <Calendar
          events={[trip]}
          initialDate={d(24)}
          onEventClick={() => {}}
        />,
      );

      const tiles = screen.getAllByRole("button", {
        name: /^Trip, Thursday, September 24, 2026, all day$/,
      });
      expect(tiles).toHaveLength(1);
      expect(screen.getAllByText("Trip")).toHaveLength(1);
    });

    it("shows them in the header of their day of the week view", () => {
      const { container } = render(
        <Calendar events={[trip]} initialDate={d(24)} initialView="week" />,
      );

      expect(screen.getAllByTitle("Trip")).toHaveLength(1);
      // Thursday - the fifth day
      expect(
        container.querySelectorAll(".sticky.top-0 .grid-cols-7 > div")[4],
      ).toHaveTextContent("Trip");
    });

    it("takes local midnights as they are", () => {
      render(
        <Calendar
          events={[{ ...trip, end: d(25), start: d(24) }]}
          initialDate={d(24)}
        />,
      );

      expect(screen.getAllByText("Trip")).toHaveLength(1);
    });
  },
);

// In London a date string is a local midnight in winter time and 1:00 in
// summer time - a range over the change has one of each
describe("Calendar all-day events of date strings over a clock change", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Europe/London";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  const weekend = {
    ...event("Weekend", new Date("2026-03-28"), new Date("2026-03-30")),
    allDay: true,
  };

  it("shows them on their days only", () => {
    const { unmount } = render(
      <Calendar
        events={[weekend]}
        initialDate={new Date(2026, 2, 29)}
        initialView="day"
      />,
    );
    expect(screen.getByText("Weekend")).toBeInTheDocument();
    unmount();

    render(
      <Calendar
        events={[weekend]}
        initialDate={new Date(2026, 2, 30)}
        initialView="day"
      />,
    );
    expect(screen.queryByText("Weekend")).toBeNull();
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
    expect(screen.getByText("Conference")).toBeInTheDocument();
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

    screen.getByRole("button", { name: /^Standup,/ }).focus();
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
    expect(within(list).getByRole("button", { name: /^A,/ })).toHaveFocus();

    within(list).getByRole("button", { name: /^D,/ }).focus();
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

  it("starts with the first of the views offered", () => {
    render(<Calendar initialDate={d(24)} viewOptions={["week", "day"]} />);

    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps the all-day note after an htmlTitle in the day view", () => {
    render(
      <Calendar
        events={[
          {
            ...event("Offsite", d(24), d(25)),
            allDay: true,
            htmlTitle: "<b>Offsite</b>",
          },
        ]}
        initialDate={d(24)}
        initialView="day"
      />,
    );

    expect(screen.getByText("Offsite", { selector: "b" })).toBeVisible();
    expect(screen.getByText("(all day)")).toBeVisible();
  });

  it.each(["week", "day"] as const)(
    "labels the midnight ending the day 12:00 AM (%s view)",
    (view) => {
      const { container } = render(
        <Calendar dayEndHour={24} initialDate={d(24)} initialView={view} />,
      );

      const labels = container.querySelectorAll(".time-column span");
      expect(labels[labels.length - 1]).toHaveTextContent(/^12:00 AM$/);
    },
  );

  it.each(["week", "day"] as const)(
    "labels the midnight ending the day 24:00 on the 24-hour clock (%s view)",
    (view) => {
      const { container } = render(
        <UIProvider locale={cs}>
          <Calendar dayEndHour={24} initialDate={d(24)} initialView={view} />
        </UIProvider>,
      );

      const labels = container.querySelectorAll(".time-column span");
      expect(labels[labels.length - 1]).toHaveTextContent(/^24:00$/);
    },
  );

  it("keeps month tiles as wide as their cell, a long title cut off", async () => {
    const user = userEvent.setup();
    const busy = ["A", "B", "C", "A title too long for a day of a month"].map(
      (title, index) => event(title, d(24, 8 + index), d(24, 9 + index)),
    );
    render(<Calendar events={busy} initialDate={d(24)} />);

    // jsdom has no layout - the classes that fit the tile into the cell: the
    // tooltip around it takes the width of the cell and lets it shrink
    const tile = screen.getByText("A").closest(".group\\/event");
    expect(tile).toHaveClass("w-full", "truncate");
    expect(tile?.parentElement).toHaveClass("min-w-0", "grow");
    expect(tile?.parentElement?.parentElement).toHaveClass("w-full");

    // In the list of the day as wide as their text - at most as the list
    await user.click(screen.getByRole("button", { name: "+1 more" }));
    const listed = within(screen.getByRole("dialog"))
      .getByText("A title too long for a day of a month")
      .closest(".group\\/event");
    expect(listed?.parentElement?.parentElement).toHaveClass("max-w-full");
    expect(listed?.parentElement?.parentElement).not.toHaveClass("w-full");
  });

  it("keeps the icon of a month tile on the line of its title", () => {
    render(
      <Calendar
        events={[event("Standup", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        renderEventIcon={() => <svg data-testid="icon" />}
      />,
    );

    expect(screen.getByTestId("icon").parentElement?.tagName).toBe("SPAN");
  });

  it.each(["week", "day"] as const)(
    "keeps the icon of a timed tile on the line of its title (%s view)",
    (view) => {
      render(
        <Calendar
          events={[
            event("Standup", d(24, 9), d(24, 9, 15)),
            {
              ...event("Planning", d(24, 11), d(24, 12)),
              htmlTitle: "<b>Planning</b> of the sprint",
            },
          ]}
          initialDate={d(24)}
          initialView={view}
          renderEventIcon={(item) => <svg data-testid={`icon-${item.id}`} />}
        />,
      );

      // A row of the icon and the title - the title is cut off after it
      const icon = screen.getByTestId("icon-Standup");
      expect(icon.parentElement).toHaveClass("flex", "items-center");
      expect(icon.nextElementSibling).toHaveTextContent("Standup");
      expect(icon.nextElementSibling).toHaveClass("truncate", "min-w-0");
      expect(icon.nextElementSibling).not.toHaveClass("block");
      // A rich title wraps next to the icon
      const rich = screen.getByTestId("icon-Planning").nextElementSibling;
      expect(rich).toHaveTextContent("Planning of the sprint");
      expect(rich).toHaveClass("min-w-0");
      expect(rich).not.toHaveClass("truncate");
    },
  );

  it("keeps the sticky header over the time column and the crowded tiles", () => {
    const { container } = render(
      <Calendar
        events={Array.from({ length: 12 }, (_, index) =>
          event(`E${index}`, d(24, 9), d(24, 10)),
        )}
        initialDate={d(24)}
        initialView="week"
      />,
    );

    // The later of equal layers paints on top - the header is a higher one
    expect(container.querySelector(".week-view > .sticky")).toHaveClass("z-20");
    expect(container.querySelector(".time-column")).toHaveClass("z-10");
    // A day column is a layer of its own - no tile climbs out of it
    for (const column of container.querySelectorAll(".day-column")) {
      expect(column).toHaveClass("isolate");
    }
  });
});

describe("Calendar order of events", () => {
  it("shows all-day events first, then by start", () => {
    render(
      <Calendar
        events={[
          event("Evening", d(24, 18), d(24, 19)),
          event("Morning", d(24, 8), d(24, 9)),
          event("Noon", d(24, 12), d(24, 13)),
          { ...event("Offsite", d(24), d(25)), allDay: true },
        ]}
        initialDate={d(24)}
      />,
    );

    // The latest is the one behind "+1 more"
    expect(screen.getByText("Offsite")).toBeInTheDocument();
    expect(screen.queryByText("Evening")).toBeNull();
    expect(screen.getByRole("button", { name: "+1 more" })).toBeVisible();
  });

  it("tabs through the events of a day by their start", () => {
    render(
      <Calendar
        events={[
          event("Later", d(24, 12), d(24, 13)),
          event("Earlier", d(24, 9), d(24, 10)),
        ]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={() => {}}
      />,
    );

    expect(
      screen
        .getAllByRole("button", { name: /^(Earlier|Later),/ })
        .map((button) => button.getAttribute("aria-label")?.split(",")[0]),
    ).toEqual(["Earlier", "Later"]);
  });

  it("shows only a few all-day events in the week header", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        events={["A", "B", "C", "D"].map((title) => ({
          ...event(title, d(24), d(25)),
          allDay: true,
        }))}
        initialDate={d(24)}
        initialView="week"
      />,
    );

    expect(screen.queryByText("C")).toBeNull();
    await user.click(screen.getByRole("button", { name: "+2 more" }));
    expect(within(screen.getByRole("dialog")).getByText("D")).toBeVisible();
  });
});

describe("Calendar event names", () => {
  it("names the tiles by their title and time", () => {
    render(
      <Calendar
        events={[
          event("Standup", d(24, 9), d(24, 10)),
          { ...event("Offsite", d(22), d(24)), allDay: true },
        ]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /^Standup, Thursday, September 24, 2026,? 9:00\s–\s10:00\sAM$/,
      }),
    ).toBeInTheDocument();
    // On both of its days
    expect(
      screen.getAllByRole("button", {
        name: /^Offsite, Tuesday, September 22\s–\sWednesday, September 23, 2026, all day$/,
      }),
    ).toHaveLength(2);
  });

  it("names a tile that opens nothing in text", () => {
    render(
      <Calendar
        events={[event("Standup", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Standup/ })).toBeNull();
    expect(
      screen.getByText(/^Standup, Thursday, September 24, 2026/),
    ).toHaveClass("sr-only");
  });

  it("puts the actions and the links of a title beside the tile's button", () => {
    render(
      <Calendar
        events={[
          {
            ...event("Planning", d(24, 9), d(24, 10)),
            htmlTitle:
              'Planning <a href="https://example.com/agenda">agenda</a>',
          },
        ]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={() => {}}
        renderEventActions={(item) => (
          <button type="button">Delete {item.title}</button>
        )}
      />,
    );

    const tile = screen.getByRole("button", { name: /^Planning, Thursday/ });
    const action = screen.getByRole("button", { name: "Delete Planning" });
    const link = screen.getByRole("link", { name: "agenda" });
    expect(tile).not.toContainElement(action);
    expect(tile).not.toContainElement(link);
  });

  it("opens no event by a link of its title", () => {
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[
          {
            ...event("Planning", d(24, 9), d(24, 10)),
            htmlTitle: 'Planning <a href="#agenda">agenda</a>',
          },
        ]}
        initialDate={d(24)}
        onEventClick={onEventClick}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "agenda" }));
    expect(onEventClick).not.toHaveBeenCalled();
  });

  it("names the tiles in the language and clock of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <Calendar
          events={[event("Porada", d(24, 9), d(24, 10))]}
          initialDate={d(24)}
          initialView="week"
          onEventClick={() => {}}
        />
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: /^Porada, čtvrtek 24\. září 2026,? 9:00\s?–\s?10:00$/,
      }),
    ).toBeInTheDocument();
  });
});

describe("Calendar keys from the focused slot", () => {
  it("goes on from a slot of the week view focused by a click", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onDateClick={onDateClick}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /September 25, 2026.*3:00\sPM/ }),
    );
    await user.keyboard("{Enter}");
    expect(onDateClick).toHaveBeenLastCalledWith(d(25, 15));

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("button", { name: /September 25, 2026.*3:30\sPM/ }),
    ).toHaveFocus();
  });

  it("goes on from a day of the month view focused by a click", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={d(24)} onDateClick={() => {}} />);

    await user.click(
      screen.getByRole("button", { name: "Monday, September 7, 2026" }),
    );
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("button", { name: "Tuesday, September 8, 2026" }),
    ).toHaveFocus();
    // The tab stop moved along
    expect(
      screen.getByRole("button", { name: "Tuesday, September 8, 2026" }),
    ).toHaveAttribute("tabindex", "0");
  });
});

describe("Calendar ranges without a pointer", () => {
  it("selects slots with Shift + arrow keys and creates the range", async () => {
    const user = userEvent.setup();
    const onSlotDragEnd = vi.fn();
    render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const first = screen.getByRole("button", {
      name: /September 24, 2026.*7:00\sAM/,
    });
    expect(first).toHaveAttribute("tabindex", "0");
    first.focus();

    // The focused slot alone
    await user.keyboard("{Enter}");
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 7, 30),
      start: d(24, 7),
    });

    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(screen.getByText(/^Selected: /)).toHaveTextContent(
      /Thursday, September 24, 2026,? 7:00\s–\s8:30\sAM/,
    );
    await user.keyboard("{Enter}");
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 8, 30),
      start: d(24, 7),
    });

    // Escape drops a selection
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}{Escape}{Enter}");
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 8),
      start: d(24, 7, 30),
    });
  });

  it("creates a range of one slot on a tap, not on a mouse click", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const nine = daySlots(container)[2];
    fireEvent.pointerDown(nine, { ...press, pointerType: "mouse" });
    fireEvent.pointerUp(nine);
    fireEvent.click(nine);
    expect(onSlotDragEnd).not.toHaveBeenCalled();

    fireEvent.pointerDown(nine, { ...press, pointerType: "touch" });
    fireEvent.pointerUp(nine);
    fireEvent.click(nine);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 10),
      start: d(24, 9),
    });
  });
});
