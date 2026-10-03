import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import { normalizeBusinessHours, getOffHours } from "./business-hours";
import { cs } from "../../../i18n/ui/cs";
import { en } from "../../../i18n/ui/en";
import { createLocale } from "../../../i18n/ui/format";
import UIProvider from "../../../providers/ui-provider";

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

/** The slot rows of a day column of the week or day view. */
const slotsOf = (container: HTMLElement, column = 0) =>
  container
    .querySelectorAll(".day-column")
    [column].querySelectorAll<HTMLElement>(":scope > [data-slot]");

const labelsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".time-column span")).map(
    (label) => label.textContent,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("Calendar month labels", () => {
  it.each(["week", "timelineWeek"] as const)(
    "uses Gregorian months beside the day numbers in %s",
    (view) => {
      const onDateClick = vi.fn();
      render(
        <UIProvider locale={createLocale(en, { code: "en-US-u-ca-persian" })}>
          <Calendar
            initialDate={d(24)}
            initialView={view}
            onDateClick={onDateClick}
            resources={[{ id: "room", title: "Room" }]}
            viewOptions={[view]}
          />
        </UIProvider>,
      );

      expect(screen.getAllByText("Sep")).toHaveLength(7);
      const day = screen.getByRole("button", {
        name: "Thursday, September 24, 2026",
      });
      expect(day).toHaveTextContent("24");
      fireEvent.click(day);
      expect(onDateClick).toHaveBeenCalledWith(d(24));
    },
  );
});

describe("Calendar slot duration", () => {
  it("keeps half hours in the week and hours in the day by default", () => {
    const { container, unmount } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onDateClick={() => {}}
      />,
    );
    // 7:00 - 22:00 and the row of the end hour
    expect(slotsOf(container)).toHaveLength(31);
    expect(slotsOf(container)[0]).toHaveClass("h-16");
    unmount();

    const day = render(
      <Calendar initialDate={d(24)} initialView="day" onDateClick={() => {}} />,
    );
    expect(slotsOf(day.container)).toHaveLength(16);
    expect(slotsOf(day.container)[0]).toHaveClass("h-32");
  });

  it("makes slots of the given length, the hours 128 pixels", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const { container } = render(
      <Calendar
        dayEndHour={9}
        dayStartHour={8}
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        slotDuration={15}
      />,
    );

    const slots = slotsOf(container);
    expect(slots).toHaveLength(5);
    expect(slots[0]).toHaveStyle({ height: "32px" });
    expect(slots[1]).toHaveAccessibleName(
      "Thursday, September 24, 2026 at 8:15 AM",
    );

    // The time column writes the half hours
    expect(labelsOf(container)).toEqual(["8:00 AM", "8:30 AM", "9:00 AM"]);

    await user.click(slots[3]);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 8, 45));
  });

  it("writes the time of every slot while they are tall enough", () => {
    const { container } = render(
      <Calendar
        dayEndHour={9}
        dayStartHour={8}
        initialDate={d(24)}
        initialView="week"
        slotDuration={60}
      />,
    );
    expect(labelsOf(container)).toEqual(["8:00 AM", "9:00 AM"]);
  });

  it("writes whole hours beside slots of 20 minutes, a quarter of 5", () => {
    const twenty = render(
      <Calendar
        dayEndHour={9}
        dayStartHour={8}
        initialDate={d(24)}
        initialView="day"
        slotDuration={20}
      />,
    );
    expect(labelsOf(twenty.container)).toEqual(["8:00 AM", "9:00 AM"]);
    twenty.unmount();

    const five = render(
      <Calendar
        dayEndHour={9}
        dayStartHour={8}
        initialDate={d(24)}
        initialView="day"
        onDateClick={() => {}}
        slotDuration={5}
      />,
    );
    expect(labelsOf(five.container)).toEqual([
      "8:00 AM",
      "8:15 AM",
      "8:30 AM",
      "8:45 AM",
      "9:00 AM",
    ]);
    expect(slotsOf(five.container)).toHaveLength(13);
  });

  it("moves and resizes events by the slots", () => {
    const onEventDrop = vi.fn();
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        slotDuration={15}
      />,
    );

    // 32 pixels a quarter - three of them down
    drag(screen.getByTitle("Review"), 96);
    expect(onEventDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        newEnd: d(24, 10, 45),
        newStart: d(24, 9, 45),
      }),
    );

    const [, bottom] = screen
      .getByTitle("Review")
      .querySelectorAll(".cursor-ns-resize");
    drag(bottom, -32);
    expect(onEventResize).toHaveBeenCalledWith(
      expect.objectContaining({ newEnd: d(24, 9, 45), newStart: d(24, 9) }),
    );
  });

  it("picks a range of the slots", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onSlotDragEnd={onSlotDragEnd}
        slotDuration={10}
      />,
    );

    // 24 pixels a slot of 10 minutes - from 7:30, four slots down
    const slot = slotsOf(container, 4)[3];
    drag(slot, 96);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 8, 20),
      start: d(24, 7, 30),
    });
  });

  it("leaves a slot duration it does not know for the default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onDateClick={() => {}}
        // @ts-expect-error - not a length of the slots
        slotDuration={45}
      />,
    );
    expect(slotsOf(container)).toHaveLength(31);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/slotDuration 45/));
  });
});

describe("Calendar now indicator", () => {
  it("draws the current time in the column of today, moved every minute", () => {
    vi.useFakeTimers({ now: d(24, 10, 30) });
    const { container } = render(
      <Calendar initialDate={d(24)} initialView="week" />,
    );

    const line = () =>
      container.querySelector<HTMLElement>("[data-now-indicator]");
    expect(line()).toHaveAttribute("aria-hidden", "true");
    // Red also in forced colors mode - not a line of the grid
    expect(line()).toHaveClass("forced-color-adjust-none");
    // Thursday, three and a half hours below 7:00 - 128 pixels an hour
    expect(line()?.closest(".day-column")).toBe(
      container.querySelectorAll(".day-column")[4],
    );
    expect(line()).toHaveStyle({ top: "448px" });

    act(() => vi.advanceTimersByTime(30 * 60_000));
    expect(line()).toHaveStyle({ top: "512px" });
  });

  it("draws nothing out of the hours shown, another week or when off", () => {
    vi.useFakeTimers({ now: d(24, 23) });
    const late = render(<Calendar initialDate={d(24)} initialView="day" />);
    expect(late.container.querySelector("[data-now-indicator]")).toBeNull();
    late.unmount();

    vi.setSystemTime(d(24, 12));
    const other = render(<Calendar initialDate={d(10)} initialView="week" />);
    expect(other.container.querySelector("[data-now-indicator]")).toBeNull();
    other.unmount();

    const off = render(
      <Calendar initialDate={d(24)} initialView="day" nowIndicator={false} />,
    );
    expect(off.container.querySelector("[data-now-indicator]")).toBeNull();
  });

  it("draws the line in each resource column of today", () => {
    vi.useFakeTimers({ now: d(24, 8) });
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        resources={[
          { id: "a", title: "Room A" },
          { id: "b", title: "Room B" },
        ]}
      />,
    );
    expect(container.querySelectorAll("[data-now-indicator]")).toHaveLength(2);
  });

  it("draws the line in a view of tomorrow once midnight comes", () => {
    vi.useFakeTimers({ now: d(24, 23, 59) });
    const { container } = render(
      <Calendar
        dayEndHour={24}
        dayStartHour={0}
        initialDate={d(25)}
        initialView="day"
      />,
    );

    const line = () => container.querySelector("[data-now-indicator]");
    expect(line()).toBeNull();
    // No timer of the minutes runs for another day - the day changes at
    // midnight
    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(line()).not.toBeNull();
  });
});

describe("Calendar today", () => {
  const current = () => document.querySelector('[aria-current="date"]');

  it("moves the mark of today at midnight, in a month left open", () => {
    vi.useFakeTimers({ now: d(24, 23, 59) });
    render(<Calendar initialDate={d(24)} initialView="month" />);
    expect(current()).toHaveTextContent("24");

    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(current()).toHaveTextContent("25");
  });

  it("looks at the day again when the page shows - after the device slept", () => {
    // Only `Date` is faked - the timers wait, as on a sleeping device
    vi.useFakeTimers({ now: d(24, 12), toFake: ["Date"] });
    render(<Calendar initialDate={d(24)} initialView="month" />);

    vi.setSystemTime(d(26, 8));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(current()).toHaveTextContent("26");
  });
});

describe("Calendar hidden days", () => {
  it("leaves the weekend out of the week", () => {
    const { container } = render(
      <Calendar hiddenDays={[0, 6]} initialDate={d(24)} initialView="week" />,
    );

    const columns = container.querySelectorAll(".day-column");
    expect(columns).toHaveLength(5);
    const header = container.querySelector(".week-view > .sticky")!;
    expect(header).toHaveTextContent(/^Mon21Sep.*Fri25Sep$/);
    expect(header).not.toHaveTextContent(/Sun|Sat/);
  });

  it("leaves the columns of the weekend out of the month", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(
      <Calendar
        events={[event("Saturday event", d(26, 9), d(26, 10))]}
        hiddenDays={[0, 6]}
        initialDate={d(25)}
        onDateClick={onDateClick}
      />,
    );

    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(screen.queryByText("Saturday event")).toBeNull();

    // From Friday to Monday - over the weekend
    const friday = screen.getByRole("button", {
      name: "Friday, September 25, 2026",
    });
    act(() => friday.focus());
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toHaveAccessibleName(
      "Monday, September 28, 2026",
    );
    await user.keyboard("{ArrowLeft}{End}");
    expect(document.activeElement).toHaveAccessibleName(
      "Friday, September 25, 2026",
    );
    await user.keyboard("{Home}");
    expect(document.activeElement).toHaveAccessibleName(
      "Monday, September 21, 2026",
    );
  });

  it("focuses the next day shown after a Page Up / Down onto a hidden day", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        hiddenDays={[0, 6]}
        initialDate={d(25)}
        // A Sunday
        minDate={new Date(2026, 7, 30)}
        onDateClick={() => {}}
      />,
    );
    act(() =>
      screen
        .getByRole("button", { name: "Friday, September 25, 2026" })
        .focus(),
    );

    // October 25 is a Sunday
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(document.activeElement).toHaveAccessibleName(
      "Monday, October 26, 2026",
    );
    expect(document.activeElement).toHaveAttribute("tabindex", "0");

    // September 26 is a Saturday
    await user.keyboard("{PageUp}");
    expect(document.activeElement).toHaveAccessibleName(
      "Monday, September 28, 2026",
    );

    // August 28 is before minDate - the calendar stops on it, a Sunday
    await user.keyboard("{PageUp}");
    expect(screen.getByRole("grid", { name: "August 2026" })).toBeVisible();
    expect(document.activeElement).toHaveAccessibleName(
      "Monday, August 31, 2026",
    );
    expect(document.activeElement).toHaveAttribute("tabindex", "0");
  });

  it("skips the hidden days in the day view and its navigation", async () => {
    const user = userEvent.setup();
    render(
      <Calendar hiddenDays={[0, 6]} initialDate={d(26)} initialView="day" />,
    );

    // A Saturday shows the Monday after it
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Monday, September 28, 2026",
    );
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Friday, September 25, 2026",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Monday, September 28, 2026",
    );
  });

  it.each(["day", "timelineDay", "agenda"] as const)(
    "keeps a hidden day picked in the %s header inside the date limits",
    (view) => {
      render(
        <Calendar
          agendaPeriod="day"
          hiddenDays={[0, 6]}
          initialDate={d(25)}
          initialView={view}
          maxDate={d(26)}
          minDate={d(25, 12)}
        />,
      );

      const field = screen.getByRole("combobox", { name: "Go to date" });
      fireEvent.change(field, { target: { value: "2026-09-26" } });
      fireEvent.keyDown(field, { key: "Enter" });

      expect(field).toHaveValue("09/25/2026");
      expect(field).toBeValid();
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Friday, September 25, 2026",
      );
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    },
  );

  it.each(["day", "timelineDay", "agenda"] as const)(
    "resolves an initial or controlled hidden upper-bound day in %s without changing the parent's date",
    (view) => {
      const setCurrentDate = vi.fn();
      const currentDate = d(26);
      const props = {
        agendaPeriod: "day" as const,
        hiddenDays: [0, 6] as (0 | 6)[],
        initialView: view,
        maxDate: d(26),
        minDate: d(25, 12),
      };
      const { rerender } = render(
        <Calendar {...props} initialDate={currentDate} />,
      );
      const field = screen.getByRole("combobox", { name: "Go to date" });
      expect(field).toHaveValue("09/25/2026");

      rerender(
        <Calendar
          {...props}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
        />,
      );
      expect(field).toHaveValue("09/25/2026");
      expect(setCurrentDate).not.toHaveBeenCalled();
      expect(currentDate).toEqual(d(26));

      fireEvent.change(field, { target: { value: "2026-09-26" } });
      fireEvent.keyDown(field, { key: "Enter" });
      expect(setCurrentDate).toHaveBeenCalledExactlyOnceWith(d(25));
      expect(field).toHaveValue("09/25/2026");
    },
  );

  it.each(["day", "timelineDay", "agenda"] as const)(
    "keeps Today inside the date limits of %s when today is hidden",
    (view) => {
      vi.useFakeTimers({ now: d(26, 12), toFake: ["Date"] });
      render(
        <Calendar
          agendaPeriod="day"
          hiddenDays={[0, 6]}
          initialDate={d(24)}
          initialView={view}
          maxDate={d(27)}
        />,
      );

      const today = screen.getByRole("button", { name: "Today" });
      expect(today).toBeEnabled();
      fireEvent.click(today);
      expect(screen.getByRole("combobox", { name: "Go to date" })).toHaveValue(
        "09/25/2026",
      );
    },
  );

  it("refuses hidden destinations when the limits contain no visible day", () => {
    vi.useFakeTimers({ now: d(26, 12), toFake: ["Date"] });
    const setCurrentDate = vi.fn();
    render(
      <Calendar
        currentDate={d(25)}
        hiddenDays={[0, 6]}
        initialView="day"
        maxDate={d(27)}
        minDate={d(26)}
        setCurrentDate={setCurrentDate}
      />,
    );

    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
    const field = screen.getByRole("combobox", { name: "Go to date" });
    fireEvent.change(field, { target: { value: "2026-09-26" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(setCurrentDate).not.toHaveBeenCalled();
    expect(field).toHaveValue("09/25/2026");
  });

  it("lists no events of the hidden days in the agenda", () => {
    render(
      <Calendar
        agendaPeriod="week"
        events={[
          event("Friday event", d(25, 9), d(25, 10)),
          event("Saturday event", d(26, 9), d(26, 10)),
        ]}
        hiddenDays={[6]}
        initialDate={d(24)}
        initialView="agenda"
      />,
    );

    expect(screen.getByText("Friday event")).toBeInTheDocument();
    expect(screen.queryByText("Saturday event")).toBeNull();
  });

  it("hides no day when all of them are hidden", () => {
    const { container } = render(
      <Calendar
        hiddenDays={[0, 1, 2, 3, 4, 5, 6]}
        initialDate={d(24)}
        initialView="week"
      />,
    );
    expect(container.querySelectorAll(".day-column")).toHaveLength(7);
  });
});

describe("Calendar business hours", () => {
  it("reads the hours - true, one entry or several", () => {
    const { schedule } = normalizeBusinessHours(true);
    expect(schedule?.get(1)).toEqual([{ from: 540, to: 1020 }]);
    expect(schedule?.get(0)).toBeUndefined();

    const split = normalizeBusinessHours([
      { days: [1], end: "12:00", start: "08:00" },
      { days: [1], end: "17:30", start: "13:00" },
      { days: [6], end: "12:00", start: "9:00" },
    ]).schedule!;
    expect(split.get(1)).toEqual([
      { from: 480, to: 720 },
      { from: 780, to: 1050 },
    ]);
    expect(getOffHours(split, d(21), 420, 1320)).toEqual([
      { from: 420, to: 480 },
      { from: 720, to: 780 },
      { from: 1050, to: 1320 },
    ]);

    expect(
      normalizeBusinessHours({ end: "8:00", start: "17:00" }).invalid,
    ).toHaveLength(1);
  });

  it("shades the time out of the working hours", () => {
    const { container } = render(
      <Calendar
        businessHours={{ end: "17:00", start: "09:00" }}
        initialDate={d(24)}
        initialView="week"
      />,
    );

    const columns = container.querySelectorAll(".day-column");
    // Thursday: 7:00 - 9:00 and 17:00 - 22:00 with the row of the end hour
    const thursday =
      columns[4].querySelectorAll<HTMLElement>("[data-off-hours]");
    expect(thursday).toHaveLength(2);
    expect(thursday[0]).toHaveStyle({ height: "256px", top: "0px" });
    expect(thursday[1]).toHaveStyle({ height: "704px", top: "1280px" });
    // Sunday has no working hours at all
    expect(columns[0].querySelectorAll("[data-off-hours]")).toHaveLength(1);
  });

  it("picks no slot out of them with restrictToBusinessHours", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const onSlotDragEnd = vi.fn();
    const { container, rerender } = render(
      <Calendar
        businessHours
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        restrictToBusinessHours
      />,
    );

    const slots = slotsOf(container);
    // 8:00 is out of them, 9:00 in
    expect(slots[1]).toHaveAttribute("aria-disabled", "true");
    expect(slots[2]).not.toHaveAttribute("aria-disabled");
    await user.click(slots[1]);
    expect(onDateClick).not.toHaveBeenCalled();
    await user.click(slots[2]);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 9));

    // A range stops at their end - from 15:00 five hours down
    rerender(
      <Calendar
        businessHours
        initialDate={d(24)}
        initialView="day"
        onSlotDragEnd={onSlotDragEnd}
        restrictToBusinessHours
      />,
    );
    drag(slotsOf(container)[8], 128 * 5);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 17),
      start: d(24, 15),
    });
  });

  it("selects by the keys only within the working hours", async () => {
    const user = userEvent.setup();
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        businessHours={{ end: "12:00", start: "10:00" }}
        initialDate={d(24)}
        initialView="day"
        onSlotDragEnd={onSlotDragEnd}
        restrictToBusinessHours
      />,
    );

    act(() => slotsOf(container)[4].focus());
    // 11:00, and down to 13:00 - the range ends at 12:00
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}{Enter}");
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 12),
      start: d(24, 11),
    });
  });

  it("shades the days without working hours in the month", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const { container } = render(
      <Calendar
        businessHours
        initialDate={d(24)}
        onDateClick={onDateClick}
        restrictToBusinessHours
      />,
    );

    const saturday = screen.getByRole("button", {
      name: "Saturday, September 26, 2026",
    });
    expect(saturday.closest(".date-cell")).toHaveAttribute("data-off-hours");
    expect(saturday).toHaveAttribute("aria-disabled", "true");
    await user.click(saturday);
    expect(onDateClick).not.toHaveBeenCalled();
    expect(container.querySelectorAll("[data-off-hours]")).toHaveLength(12);
  });
});

describe("Calendar renderEvent", () => {
  it("renders the content of the tiles - the name and actions stay", () => {
    const renderEvent = vi.fn(
      (item: CalendarEvent, { compact, timeText, view }) => (
        <span data-testid="custom">
          {item.title} · {timeText} · {view} · {compact ? "compact" : "full"}
        </span>
      ),
    );
    render(
      <Calendar
        events={[
          event("Review", d(24, 9), d(24, 10)),
          event("Offsite", d(24), d(25), { allDay: true }),
        ]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={() => {}}
        renderEvent={renderEvent}
        renderEventActions={(item) => (
          <button type="button">Delete {item.title}</button>
        )}
        renderEventIcon={() => <svg data-testid="icon" />}
      />,
    );

    const [allDay, timed] = screen.getAllByTestId("custom");
    expect(timed.textContent).toMatch(
      /^Review · 9:00\s–\s10:00\sAM · week · full$/,
    );
    expect(allDay).toHaveTextContent("Offsite · All day · week · compact");
    // For the eye - the button names the tile
    expect(timed.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByRole("button", { name: /^Review, Thursday/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("icon")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Delete Review" })).toBeVisible();
  });

  it("gives the title and the times a moved event would get", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={() => {}}
        renderEvent={(_, { dragging, timeText, title }) => (
          <span data-testid="custom">
            {title} {timeText} {dragging ? "(moving)" : ""}
          </span>
        )}
      />,
    );

    act(() => screen.getByRole("button", { name: /^Review,/ }).focus());
    await user.keyboard("{Control>}x{/Control}{ArrowDown}");
    expect(screen.getByTestId("custom").textContent).toMatch(
      /^Review 10:00\s–\s11:00\sAM \(moving\)$/,
    );
  });

  it("renders the content in the month, the agenda and the lists", async () => {
    const user = userEvent.setup();
    const month = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        renderEvent={(item, { view }) => `${item.title} in ${view}`}
      />,
    );
    expect(screen.getByText("Review in month")).toBeInTheDocument();
    month.unmount();

    const agenda = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="agenda"
        renderEvent={(item, { view }) => `${item.title} in ${view}`}
      />,
    );
    expect(screen.getByText("Review in agenda")).toBeInTheDocument();
    agenda.unmount();

    render(
      <Calendar
        dayStartHour={12}
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        renderEvent={(item, { compact }) =>
          `${item.title} ${compact ? "listed" : "in the grid"}`
        }
      />,
    );
    await user.click(screen.getByRole("button", { name: /1 earlier/ }));
    expect(
      within(screen.getByRole("dialog")).getByText("Review listed"),
    ).toBeVisible();
  });
});

describe("Calendar views in Czech", () => {
  it("names the timeline views in the switcher", () => {
    render(
      <UIProvider locale={cs}>
        <Calendar
          initialDate={d(24)}
          viewOptions={["timelineDay", "timelineWeek"]}
        />
      </UIProvider>,
    );
    expect(screen.getByRole("button", { name: "Denní osa" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Týdenní osa" })).toBeVisible();
  });
});
