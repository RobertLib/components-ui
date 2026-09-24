import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import type { WeekDay } from "../../i18n/types";
import { createLocale } from "../../i18n/format";
import { en } from "../../i18n/en";
import { getVisibleRange } from "./date-utils";
import UIProvider from "../../providers/ui-provider";

// There the clocks jump from 0:00 to 1:00 in 2026 - the day of the change
// starts at 1:00, the days after it at midnight again
describe.each([
  { change: [2026, 2, 8], timeZone: "America/Havana" },
  { change: [2026, 8, 6], timeZone: "America/Santiago" },
  { change: [2026, 2, 29], timeZone: "Asia/Beirut" },
  { change: [2026, 3, 24], timeZone: "Africa/Cairo" },
  { change: [2026, 2, 29], timeZone: "Atlantic/Azores" },
])(
  "Calendar where the clocks skip midnight ($timeZone)",
  ({ change, timeZone }) => {
    let previousTZ: string | undefined;

    beforeAll(() => {
      previousTZ = process.env.TZ;
      process.env.TZ = timeZone;
    });

    afterAll(() => {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    });

    const [year, month, date] = change;
    /** The start of the day `offset` days after the change - made on its own. */
    const day = (offset: number, hours = 0) =>
      new Date(year, month, date + offset, hours);

    /** The full date of a day, e.g. "Tuesday, March 10, 2026". */
    const dayName = (offset: number) =>
      new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(
        day(offset),
      );

    const event = (title: string, start: Date, end: Date): CalendarEvent => ({
      end,
      id: title,
      start,
      title,
    });

    it("runs in a time zone whose day of the change starts at 1:00", () => {
      expect(day(0).getHours()).toBe(1);
      expect(day(1).getHours()).toBe(0);
    });

    it("gives the visible ranges the midnights of their days", () => {
      const weekStartsOn = day(0).getDay() as WeekDay;

      expect(getVisibleRange(day(0), "day", 0)).toEqual({
        end: day(1),
        start: day(0),
      });
      // A week starting on the day of the change
      expect(getVisibleRange(day(3), "week", weekStartsOn)).toEqual({
        end: day(7),
        start: day(0),
      });
      expect(
        getVisibleRange(day(0), "agenda", 0, { agendaPeriod: 10 }),
      ).toEqual({ end: day(10), start: day(0) });
    });

    it("picks the midnights of the days after the change in the month view", () => {
      const onDateClick = vi.fn();
      render(<Calendar initialDate={day(3)} onDateClick={onDateClick} />);

      fireEvent.click(screen.getByRole("button", { name: dayName(3) }));
      expect(onDateClick).toHaveBeenLastCalledWith(day(3));
      expect(onDateClick.mock.lastCall?.[0].getHours()).toBe(0);
    });

    it("keeps the days from minDate to maxDate of the month view", () => {
      render(
        <Calendar
          initialDate={day(3)}
          maxDate={day(4)}
          minDate={day(2)}
          onDateClick={() => {}}
        />,
      );

      const enabled = (offset: number) =>
        screen
          .getByRole("button", { name: dayName(offset) })
          .getAttribute("aria-disabled") !== "true";
      expect([1, 2, 3, 4, 5].map(enabled)).toEqual([
        false,
        true,
        true,
        true,
        false,
      ]);
    });

    it("gives a week starting on the day of the change the midnights of its days", () => {
      const onDateClick = vi.fn();
      render(
        <UIProvider
          locale={createLocale(en, {
            weekStartsOn: day(0).getDay() as WeekDay,
          })}
        >
          <Calendar
            dayStartHour={0}
            events={[event("Early", day(1), day(1, 1))]}
            initialDate={day(3)}
            initialView="week"
            maxDate={day(4)}
            onDateClick={onDateClick}
          />
        </UIProvider>,
      );

      // The header of the day - its midnight
      fireEvent.click(screen.getByRole("button", { name: dayName(2) }));
      expect(onDateClick).toHaveBeenLastCalledWith(day(2));

      // Up to `maxDate` - not the day after it
      expect(
        screen.getByRole("button", { name: dayName(4) }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: dayName(5) })).toBeNull();

      // 0:00 - 1:00 of the day after the change shows on that day only
      const columns = document.querySelectorAll(".day-column");
      expect(screen.getAllByTitle("Early")).toHaveLength(1);
      expect(columns[1]).toContainElement(screen.getByTitle("Early"));
    });

    it("disables the day of the change before minDate in the day view", () => {
      render(
        <Calendar
          initialDate={day(0)}
          initialView="day"
          minDate={day(1)}
          onDateClick={() => {}}
        />,
      );

      const slots = document.querySelectorAll('[role="button"][data-slot]');
      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        expect(slot).toHaveAttribute("aria-disabled", "true");
      }
    });

    it("lists the days of the agenda at their midnights", () => {
      const onDateClick = vi.fn();
      render(
        <Calendar
          agendaPeriod={14}
          events={[
            event("Before", day(-1, 9), day(-1, 10)),
            event("Change", day(0, 9), day(0, 10)),
            event("After", day(1, 9), day(1, 10)),
            event("Later", day(5, 9), day(5, 10)),
          ]}
          initialDate={day(-1)}
          initialView="agenda"
          maxDate={day(5)}
          minDate={day(0)}
          onDateClick={onDateClick}
        />,
      );

      // Before `minDate` no button, up to `maxDate` one
      expect(screen.queryByRole("button", { name: dayName(-1) })).toBeNull();
      for (const offset of [0, 1, 5]) {
        expect(
          screen.getByRole("button", { name: dayName(offset) }),
        ).toBeInTheDocument();
      }

      fireEvent.click(screen.getByRole("button", { name: dayName(5) }));
      expect(onDateClick).toHaveBeenLastCalledWith(day(5));
    });

    it("repeats all-day events after the change on one day each", () => {
      // The weekday of the day after the change, every week
      const weekday = day(1).getDay() as WeekDay;
      render(
        <Calendar
          agendaPeriod={14}
          events={[
            {
              ...event("Weekly", new Date(year, 0, 1), new Date(year, 0, 2)),
              allDay: true,
              recurrence: { byWeekday: [weekday], freq: "monthly" },
            },
          ]}
          initialDate={day(-1)}
          initialView="agenda"
          onEventClick={() => {}}
        />,
      );

      const listed = screen.getAllByRole("button", { name: /^Weekly,/ });
      expect(listed).toHaveLength(2);
      expect(
        within(screen.getByRole("list", { name: dayName(1) })).getByRole(
          "button",
          { name: /^Weekly,/ },
        ),
      ).toHaveAccessibleName(`Weekly, ${dayName(1)}, all day`);
      expect(screen.queryByText(/^Day \d+\/\d+$/)).toBeNull();
    });
  },
);
