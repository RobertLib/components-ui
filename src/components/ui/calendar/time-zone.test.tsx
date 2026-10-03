import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Calendar from ".";
import { getVisibleRange, atMinutes } from "./date-utils";
import { expandRecurringEvents } from "./recurrence";
import { inTimeZone } from "../../../utils/time-zone";

describe("Calendar named time zones", () => {
  it.each([
    ["Europe/Prague", "2026-03-29T12:00:00Z", "2026-03-28T23:00:00.000Z", 23],
    ["Europe/Prague", "2026-10-25T12:00:00Z", "2026-10-24T22:00:00.000Z", 25],
    [
      "America/New_York",
      "2026-03-08T12:00:00Z",
      "2026-03-08T05:00:00.000Z",
      23,
    ],
    [
      "America/New_York",
      "2026-11-01T12:00:00Z",
      "2026-11-01T04:00:00.000Z",
      25,
    ],
  ])(
    "computes midnight and DST day length in %s (%s)",
    (timeZone, instant, start, hours) => {
      const range = getVisibleRange(new Date(instant), "day", 1, { timeZone });
      expect(range.start.toISOString()).toBe(start);
      expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(
        hours,
      );
      expect(range.start.getHours()).toBe(0);
    },
  );

  it("keeps a weekly Prague meeting at 9:00 across the DST transition", () => {
    const events = expandRecurringEvents(
      [
        {
          id: "meeting",
          title: "Meeting",
          start: new Date("2026-03-22T08:00:00Z"),
          end: new Date("2026-03-22T09:00:00Z"),
          recurrence: { freq: "weekly" },
        },
      ],
      {
        start: new Date("2026-03-21T00:00:00Z"),
        end: new Date("2026-04-10T00:00:00Z"),
      },
      { timeZone: "Europe/Prague" },
    );
    expect(events.map(({ start }) => start.toISOString())).toEqual([
      "2026-03-22T08:00:00.000Z",
      "2026-03-29T07:00:00.000Z",
      "2026-04-05T07:00:00.000Z",
    ]);
    expect(
      events.every(
        ({ start, end }) => start.getHours() === 9 && end.getHours() === 10,
      ),
    ).toBe(true);
  });

  it("interprets a local RRULE UNTIL in the calendar's zone", () => {
    const events = expandRecurringEvents(
      [
        {
          id: "meeting",
          title: "Meeting",
          start: new Date("2026-03-22T08:00:00Z"),
          end: new Date("2026-03-22T09:00:00Z"),
          recurrence: "FREQ=WEEKLY;UNTIL=20260329T090000",
        },
      ],
      {
        start: new Date("2026-03-21T00:00:00Z"),
        end: new Date("2026-04-10T00:00:00Z"),
      },
      { timeZone: "Europe/Prague" },
    );
    expect(events).toHaveLength(2);
    expect(events[1].start.toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("clamps a clock slot in the spring gap to the first valid minute", () => {
    const day = inTimeZone(new Date("2026-03-29T12:00:00Z"), "Europe/Prague");
    expect(atMinutes(day, 150).toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(atMinutes(day, 210).getHours()).toBe(3);
    expect(atMinutes(day, 210).getMinutes()).toBe(30);
  });

  it.each(["month", "week", "day", "agenda", "timelineDay"] as const)(
    "labels events in Prague in the %s view",
    (view) => {
      render(
        <Calendar
          onEventClick={() => {}}
          events={[
            {
              id: "meeting",
              title: "Meeting",
              start: new Date("2026-03-29T07:00:00Z"),
              end: new Date("2026-03-29T08:00:00Z"),
            },
          ]}
          initialDate={new Date("2026-03-29T12:00:00Z")}
          initialView={view}
          timeZone="Europe/Prague"
        />,
      );
      expect(
        screen.getByRole("button", { name: /^Meeting,/ }),
      ).toHaveAccessibleName(/9:00.*10:00/);
    },
  );
});
