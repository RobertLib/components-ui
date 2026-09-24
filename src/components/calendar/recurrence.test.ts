import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarEvent, CalendarRecurrence } from "./types";
import { expandRecurringEvents } from "./recurrence";

const event = (
  start: Date,
  end: Date,
  recurrence?: CalendarRecurrence | string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  end,
  id: "series",
  recurrence,
  start,
  title: "Series",
  ...extra,
});

/** A range of whole days from `start` to `end` (exclusive). */
const range = (start: Date, end: Date) => ({ end, start });

/** The local dates of occurrences, e.g. `2026-09-24 09:00`. */
const starts = (events: CalendarEvent[]) =>
  events.map(({ start }) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}`;
  });

/** A whole year - 2026. */
const year2026 = range(new Date(2026, 0, 1), new Date(2027, 0, 1));

describe("expandRecurringEvents", () => {
  it("keeps events without a recurrence as they are", () => {
    const single = event(new Date(2026, 8, 24, 9), new Date(2026, 8, 24, 10));
    const [result] = expandRecurringEvents([single], year2026);

    expect(result).toBe(single);
  });

  it("repeats an event weekly with its time and length", () => {
    const [first, second, third] = expandRecurringEvents(
      [
        event(new Date(2026, 8, 3, 9), new Date(2026, 8, 3, 10, 30), {
          freq: "weekly",
        }),
      ],
      range(new Date(2026, 8, 1), new Date(2026, 9, 1)),
    );

    expect(starts([first, second, third])).toEqual([
      "2026-09-03 09:00",
      "2026-09-10 09:00",
      "2026-09-17 09:00",
    ]);
    expect(third.end).toEqual(new Date(2026, 8, 17, 10, 30));
    // Each occurrence tells its series and its place in it
    expect(second).toMatchObject({
      id: `series@${new Date(2026, 8, 10, 9).toISOString()}`,
      occurrenceStart: new Date(2026, 8, 10, 9),
      recurringEventId: "series",
      title: "Series",
    });
  });

  it("gives only the occurrences overlapping the range", () => {
    const shifts = expandRecurringEvents(
      [
        // 22:00 - 6:00 every day
        event(new Date(2026, 0, 1, 22), new Date(2026, 0, 2, 6), {
          freq: "daily",
        }),
      ],
      range(new Date(2026, 8, 24), new Date(2026, 8, 26)),
    );

    // Also the one of the night before, running into the range
    expect(starts(shifts)).toEqual([
      "2026-09-23 22:00",
      "2026-09-24 22:00",
      "2026-09-25 22:00",
    ]);
  });

  it("repeats every `interval` periods", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 5, 8), new Date(2026, 0, 5, 9), {
          freq: "daily",
          interval: 10,
        }),
      ],
      range(new Date(2026, 0, 1), new Date(2026, 1, 1)),
    );

    expect(starts(events)).toEqual([
      "2026-01-05 08:00",
      "2026-01-15 08:00",
      "2026-01-25 08:00",
    ]);
  });

  it("skips the months without the day of a monthly event", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 31, 12), new Date(2026, 0, 31, 13), {
          freq: "monthly",
        }),
      ],
      year2026,
    );

    // Not moved to February 28 or April 30
    expect(starts(events)).toEqual([
      "2026-01-31 12:00",
      "2026-03-31 12:00",
      "2026-05-31 12:00",
      "2026-07-31 12:00",
      "2026-08-31 12:00",
      "2026-10-31 12:00",
      "2026-12-31 12:00",
    ]);
  });

  it("repeats a yearly event of February 29 in leap years only", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2024, 1, 29), new Date(2024, 2, 1), "FREQ=YEARLY", {
          allDay: true,
        }),
      ],
      range(new Date(2024, 0, 1), new Date(2033, 0, 1)),
    );

    expect(starts(events)).toEqual([
      "2024-02-29 00:00",
      "2028-02-29 00:00",
      "2032-02-29 00:00",
    ]);
    // Each a whole day - to the next midnight
    expect(events[1].end).toEqual(new Date(2028, 2, 1));
  });

  it("takes the last day of the month for -1", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 31, 17), new Date(2026, 0, 31, 18), {
          byMonthDay: [-1],
          count: 4,
          freq: "monthly",
        }),
      ],
      year2026,
    );

    expect(starts(events)).toEqual([
      "2026-01-31 17:00",
      "2026-02-28 17:00",
      "2026-03-31 17:00",
      "2026-04-30 17:00",
    ]);
  });

  it("repeats on the days of the week of byWeekday, every other week", () => {
    const events = expandRecurringEvents(
      [
        // Monday, September 7th
        event(new Date(2026, 8, 7, 9), new Date(2026, 8, 7, 9, 15), {
          byWeekday: [1, 3, 5],
          freq: "weekly",
          interval: 2,
        }),
      ],
      range(new Date(2026, 8, 1), new Date(2026, 9, 1)),
    );

    expect(starts(events)).toEqual([
      "2026-09-07 09:00",
      "2026-09-09 09:00",
      "2026-09-11 09:00",
      "2026-09-21 09:00",
      "2026-09-23 09:00",
      "2026-09-25 09:00",
    ]);
  });

  it("takes whole weeks from weekStart (RFC 5545 examples)", () => {
    const expand = (rule: string) =>
      expandRecurringEvents(
        [
          event(
            new Date(1997, 7, 5, 9),
            new Date(1997, 7, 5, 10),
            `RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;${rule}`,
          ),
        ],
        range(new Date(1997, 7, 1), new Date(1997, 9, 1)),
      );

    expect(starts(expand("WKST=MO"))).toEqual([
      "1997-08-05 09:00",
      "1997-08-10 09:00",
      "1997-08-19 09:00",
      "1997-08-24 09:00",
    ]);
    expect(starts(expand("WKST=SU"))).toEqual([
      "1997-08-05 09:00",
      "1997-08-17 09:00",
      "1997-08-19 09:00",
      "1997-08-31 09:00",
    ]);
  });

  it("repeats on working days only with a daily byWeekday", () => {
    const events = expandRecurringEvents(
      [
        // Friday
        event(
          new Date(2026, 8, 18, 8),
          new Date(2026, 8, 18, 8, 15),
          "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
        ),
      ],
      range(new Date(2026, 8, 18), new Date(2026, 8, 25)),
    );

    expect(starts(events)).toEqual([
      "2026-09-18 08:00",
      "2026-09-21 08:00",
      "2026-09-22 08:00",
      "2026-09-23 08:00",
      "2026-09-24 08:00",
    ]);
  });

  it("picks the nth weekday of the month", () => {
    const firstMonday = expandRecurringEvents(
      [
        event(new Date(2026, 0, 5, 10), new Date(2026, 0, 5, 11), {
          byWeekday: [{ day: 1, nth: 1 }],
          count: 4,
          freq: "monthly",
        }),
      ],
      year2026,
    );
    expect(starts(firstMonday)).toEqual([
      "2026-01-05 10:00",
      "2026-02-02 10:00",
      "2026-03-02 10:00",
      "2026-04-06 10:00",
    ]);

    const lastFriday = expandRecurringEvents(
      [
        event(
          new Date(2026, 0, 30, 15),
          new Date(2026, 0, 30, 16),
          "FREQ=MONTHLY;BYDAY=-1FR;COUNT=3",
        ),
      ],
      year2026,
    );
    expect(starts(lastFriday)).toEqual([
      "2026-01-30 15:00",
      "2026-02-27 15:00",
      "2026-03-27 15:00",
    ]);
  });

  it("picks positions of the days of a period with bySetPos", () => {
    // The last working day of each month
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 30, 16), new Date(2026, 0, 30, 17), {
          byWeekday: [1, 2, 3, 4, 5],
          bySetPos: [-1],
          count: 4,
          freq: "monthly",
        }),
      ],
      year2026,
    );

    expect(starts(events)).toEqual([
      "2026-01-30 16:00",
      "2026-02-27 16:00",
      "2026-03-31 16:00",
      "2026-04-30 16:00",
    ]);
  });

  it("repeats yearly in a month on the nth weekday", () => {
    // Thanksgiving - the fourth Thursday of November
    const events = expandRecurringEvents(
      [
        event(
          new Date(2025, 10, 27),
          new Date(2025, 10, 28),
          "FREQ=YEARLY;BYMONTH=11;BYDAY=4TH",
          { allDay: true },
        ),
      ],
      range(new Date(2025, 0, 1), new Date(2029, 0, 1)),
    );

    expect(starts(events)).toEqual([
      "2025-11-27 00:00",
      "2026-11-26 00:00",
      "2027-11-25 00:00",
      "2028-11-23 00:00",
    ]);
  });

  it("limits a rule to the months of byMonth", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 15, 9), new Date(2026, 0, 15, 10), {
          byMonth: [1, 7],
          freq: "monthly",
        }),
      ],
      year2026,
    );

    expect(starts(events)).toEqual(["2026-01-15 09:00", "2026-07-15 09:00"]);
  });

  it("counts the event itself, also when it does not fit the rule", () => {
    // A Tuesday - the rule gives Mondays and Wednesdays
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 8, 1, 9), new Date(2026, 8, 1, 10), {
          byWeekday: [1, 3],
          count: 3,
          freq: "weekly",
        }),
      ],
      year2026,
    );

    expect(starts(events)).toEqual([
      "2026-09-01 09:00",
      "2026-09-02 09:00",
      "2026-09-07 09:00",
    ]);
  });
});

describe("expandRecurringEvents count and until", () => {
  const monday = (day: number) => new Date(2026, 8, day, 9);

  it("stops after count occurrences", () => {
    const events = expandRecurringEvents(
      [event(monday(7), monday(7), { count: 3, freq: "weekly" })],
      year2026,
    );

    expect(starts(events)).toEqual([
      "2026-09-07 09:00",
      "2026-09-14 09:00",
      "2026-09-21 09:00",
    ]);
  });

  it("counts the occurrences before the range too", () => {
    const events = expandRecurringEvents(
      [event(monday(7), monday(7), { count: 3, freq: "weekly" })],
      range(new Date(2026, 8, 20), new Date(2026, 9, 31)),
    );

    expect(starts(events)).toEqual(["2026-09-21 09:00"]);
  });

  it("takes an until without a time as the whole day", () => {
    const expand = (until: Date) =>
      starts(
        expandRecurringEvents(
          [event(monday(7), monday(7), { freq: "weekly", until })],
          year2026,
        ),
      );

    // The day of the last occurrence - its 9:00 is after the midnight
    expect(expand(new Date(2026, 8, 21))).toEqual([
      "2026-09-07 09:00",
      "2026-09-14 09:00",
      "2026-09-21 09:00",
    ]);
    // A moment - inclusive
    expect(expand(new Date(2026, 8, 21, 9))).toHaveLength(3);
    expect(expand(new Date(2026, 8, 21, 8, 59))).toHaveLength(2);
  });

  it("reads UNTIL as a date or a moment in UTC", () => {
    const expand = (until: string) =>
      expandRecurringEvents(
        [event(monday(7), monday(7), `FREQ=WEEKLY;UNTIL=${until}`)],
        year2026,
      ).length;

    expect(expand("20260921")).toBe(3);
    // Long after 9:00 of the day in any time zone
    expect(expand("20260921T235959Z")).toBe(3);
    expect(expand("20260920T000000Z")).toBe(2);
  });

  it("leaves out the exdates - they still count", () => {
    const events = expandRecurringEvents(
      [
        event(monday(7), monday(7), {
          count: 4,
          freq: "weekly",
        }),
      ].map((item) => ({ ...item, exdates: [monday(14)] })),
      year2026,
    );

    expect(starts(events)).toEqual([
      "2026-09-07 09:00",
      "2026-09-21 09:00",
      "2026-09-28 09:00",
    ]);
  });

  it("leaves out the first occurrence by an exdate", () => {
    const events = expandRecurringEvents(
      [
        event(
          monday(7),
          monday(7),
          { count: 2, freq: "weekly" },
          {
            exdates: [monday(7)],
          },
        ),
      ],
      year2026,
    );

    expect(starts(events)).toEqual(["2026-09-14 09:00"]);
  });

  it("leaves out an occurrence the app keeps as an edited event", () => {
    const series = event(monday(7), new Date(2026, 8, 7, 10), {
      count: 3,
      freq: "weekly",
    });
    const edited: CalendarEvent = {
      end: new Date(2026, 8, 15, 11),
      id: "edited",
      occurrenceStart: monday(14),
      recurrence: series.recurrence,
      recurringEventId: "series",
      start: new Date(2026, 8, 15, 10),
      title: "Moved to Tuesday",
    };

    const events = expandRecurringEvents([series, edited], year2026);

    expect(events.map(({ id }) => id)).toEqual([
      `series@${monday(7).toISOString()}`,
      `series@${monday(21).toISOString()}`,
      // Not repeated itself
      "edited",
    ]);
  });

  it("expands occurrences only once", () => {
    const once = expandRecurringEvents(
      [event(monday(7), monday(7), { count: 3, freq: "weekly" })],
      year2026,
    );

    expect(expandRecurringEvents(once, year2026)).toEqual(once);
  });
});

describe("expandRecurringEvents all-day events", () => {
  it("repeats whole days - the end is exclusive", () => {
    const [first, second] = expandRecurringEvents(
      [
        // Friday to Sunday
        event(new Date(2026, 8, 4), new Date(2026, 8, 7), "FREQ=WEEKLY", {
          allDay: true,
        }),
      ],
      range(new Date(2026, 8, 1), new Date(2026, 8, 14)),
    );

    expect(first.start).toEqual(new Date(2026, 8, 4));
    expect(first.end).toEqual(new Date(2026, 8, 7));
    expect(second.start).toEqual(new Date(2026, 8, 11));
    expect(second.end).toEqual(new Date(2026, 8, 14));
  });

  it("leaves out the day of an exdate given at any time of it", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 8, 1), new Date(2026, 8, 2), "FREQ=DAILY", {
          allDay: true,
          exdates: [new Date(2026, 8, 2, 13, 45)],
        }),
      ],
      range(new Date(2026, 8, 1), new Date(2026, 8, 4)),
    );

    expect(starts(events)).toEqual(["2026-09-01 00:00", "2026-09-03 00:00"]);
  });
});

describe("expandRecurringEvents of unreadable rules", () => {
  const start = new Date(2026, 8, 7, 9);
  const end = new Date(2026, 8, 7, 10);

  it.each([
    "FREQ=HOURLY",
    "FREQ=DAILY;BYHOUR=9,15",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=WEEKLY;COUNT=0",
    "INTERVAL=2",
    "",
  ])("shows the event of %j once", (rule) => {
    const single = event(start, end, rule);
    expect(expandRecurringEvents([single], year2026)).toEqual([single]);
  });

  it("shows an event with an unknown freq once", () => {
    const single = event(start, end, {
      freq: "hourly",
    } as unknown as CalendarRecurrence);
    expect(expandRecurringEvents([single], year2026)).toEqual([single]);
  });

  it("ignores values out of range", () => {
    const events = expandRecurringEvents(
      [
        event(start, end, {
          byMonthDay: [0, 32],
          count: 2,
          freq: "monthly",
          interval: -3,
        }),
      ],
      year2026,
    );

    expect(starts(events)).toEqual(["2026-09-07 09:00", "2026-10-07 09:00"]);
  });
});

describe("expandRecurringEvents of long series", () => {
  it("gives the same occurrences without walking the years before the range", () => {
    const rule: CalendarRecurrence = {
      byWeekday: [2, 4],
      freq: "weekly",
      interval: 3,
    };
    const since2000 = event(
      new Date(2000, 0, 4, 7, 30),
      new Date(2000, 0, 4, 8),
      rule,
    );
    const september = range(new Date(2026, 8, 1), new Date(2026, 9, 1));

    const before = performance.now();
    const skipped = expandRecurringEvents([since2000], september);
    expect(performance.now() - before).toBeLessThan(50);

    // A count too high to end it walks every week from the start
    const walked = expandRecurringEvents(
      [{ ...since2000, recurrence: { ...rule, count: 1_000_000 } }],
      september,
    );
    expect(starts(skipped)).toEqual(starts(walked));
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("stops at the end of the range for a rule no day fits", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 1, 1), new Date(2026, 1, 2), {
          byMonth: [2],
          byMonthDay: [30],
          freq: "yearly",
        }),
      ],
      range(new Date(2026, 0, 1), new Date(3026, 0, 1)),
    );

    expect(events).toHaveLength(1);
  });
});

// Europe/Prague: the clocks jump from 2:00 to 3:00 on March 29th 2026 and
// back from 3:00 to 2:00 on October 25th 2026
describe.each(["Europe/Prague", "America/New_York"])(
  "expandRecurringEvents over a daylight saving change (%s)",
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

    it("keeps the clock time of the occurrences", () => {
      const events = expandRecurringEvents(
        [
          event(new Date(2026, 0, 5, 9), new Date(2026, 0, 5, 10), {
            freq: "weekly",
          }),
        ],
        year2026,
      );

      expect(events).toHaveLength(52);
      for (const { end, start } of events) {
        expect([start.getHours(), start.getMinutes()]).toEqual([9, 0]);
        expect([end.getHours(), end.getMinutes()]).toEqual([10, 0]);
      }
    });

    it("keeps the clock times of an occurrence on the day of the change", () => {
      // The night of March 29th (Europe) and of March 8th (America)
      const change = timeZone === "Europe/Prague" ? 29 : 8;
      const [occurrence] = expandRecurringEvents(
        [
          event(new Date(2026, 0, 1, 1), new Date(2026, 0, 1, 4), {
            freq: "daily",
          }),
        ],
        range(new Date(2026, 2, change), new Date(2026, 2, change + 1)),
      );

      // 1:00 - 4:00 on the clock, two hours long
      expect(occurrence.start.getHours()).toBe(1);
      expect(occurrence.end.getHours()).toBe(4);
      expect(occurrence.end.getTime() - occurrence.start.getTime()).toBe(
        2 * 3_600_000,
      );
    });

    it("moves an occurrence in the skipped hour to after it", () => {
      const change = timeZone === "Europe/Prague" ? 29 : 8;
      const [occurrence] = expandRecurringEvents(
        [
          event(new Date(2026, 0, 1, 2, 30), new Date(2026, 0, 1, 5), {
            freq: "daily",
          }),
        ],
        range(new Date(2026, 2, change), new Date(2026, 2, change + 1)),
      );

      expect([
        occurrence.start.getHours(),
        occurrence.start.getMinutes(),
      ]).toEqual([3, 30]);
      expect(occurrence.end.getHours()).toBe(5);
    });

    it("repeats all-day events of date strings on their days", () => {
      const events = expandRecurringEvents(
        [
          event(
            new Date("2026-03-27"),
            new Date("2026-03-28"),
            { freq: "daily" },
            { allDay: true },
          ),
        ],
        range(new Date(2026, 2, 27), new Date(2026, 3, 2)),
      );

      expect(starts(events)).toEqual([
        "2026-03-27 00:00",
        "2026-03-28 00:00",
        "2026-03-29 00:00",
        "2026-03-30 00:00",
        "2026-03-31 00:00",
        "2026-04-01 00:00",
      ]);
      // Local midnights - 23 or 25 hours long around the change
      for (const { end, start } of events) {
        expect([end.getHours(), end.getDate()]).toEqual([
          0,
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + 1,
          ).getDate(),
        ]);
      }
    });

    it("leaves out an all-day exdate of a date string", () => {
      const events = expandRecurringEvents(
        [
          event(new Date(2026, 8, 1), new Date(2026, 8, 2), "FREQ=DAILY", {
            allDay: true,
            exdates: [new Date("2026-09-02")],
          }),
        ],
        range(new Date(2026, 8, 1), new Date(2026, 8, 4)),
      );

      expect(starts(events)).toEqual(["2026-09-01 00:00", "2026-09-03 00:00"]);
    });

    it("takes an until of a date string as its day", () => {
      const events = expandRecurringEvents(
        [
          event(new Date(2026, 8, 7, 9), new Date(2026, 8, 7, 10), {
            freq: "weekly",
            until: new Date("2026-09-21"),
          }),
        ],
        year2026,
      );

      expect(events).toHaveLength(3);
    });
  },
);

// There the clocks jump from 0:00 to 1:00 - the day of the change starts at
// 1:00, the days after it at midnight again
describe.each([
  "America/Havana",
  "America/Santiago",
  "Asia/Beirut",
  "Africa/Cairo",
  "Atlantic/Azores",
])("expandRecurringEvents where the clocks skip midnight (%s)", (timeZone) => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = timeZone;
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  /** The start of the `index`-th day of 2026 - each made on its own. */
  const dayOf2026 = (index: number) => new Date(2026, 0, 1 + index);

  /** 2026 in the time zone of the test - not in that of the file's load. */
  const localYear = () => range(dayOf2026(0), dayOf2026(365));

  it("runs in a time zone with a day starting at 1:00", () => {
    const days = Array.from({ length: 365 }, (_, index) => dayOf2026(index));
    expect(days.some((day) => day.getHours() === 1)).toBe(true);
  });

  it("keeps the last weekday of every month", () => {
    const events = expandRecurringEvents(
      [
        event(
          new Date(2026, 0, 27, 9),
          new Date(2026, 0, 27, 10),
          "FREQ=MONTHLY;BYDAY=-1TU",
        ),
      ],
      localYear(),
    );

    // The last Tuesdays of 2026 - also of the months with the change
    expect(starts(events)).toEqual([
      "2026-01-27 09:00",
      "2026-02-24 09:00",
      "2026-03-31 09:00",
      "2026-04-28 09:00",
      "2026-05-26 09:00",
      "2026-06-30 09:00",
      "2026-07-28 09:00",
      "2026-08-25 09:00",
      "2026-09-29 09:00",
      "2026-10-27 09:00",
      "2026-11-24 09:00",
      "2026-12-29 09:00",
    ]);
  });

  it("repeats all-day events by whole days after the change", () => {
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 1), new Date(2026, 0, 2), "FREQ=DAILY", {
          allDay: true,
        }),
      ],
      localYear(),
    );

    expect(events).toHaveLength(365);
    events.forEach(({ end, start }, index) => {
      expect(start).toEqual(dayOf2026(index));
      expect(end).toEqual(dayOf2026(index + 1));
    });
  });

  it("gives all-day occurrences by weekday one day each", () => {
    // Every Monday of every month - and every Friday
    const weekdays = [1, 5] as const;
    for (const day of weekdays) {
      const events = expandRecurringEvents(
        [
          {
            ...event(new Date(2026, 0, 1), new Date(2026, 0, 2), {
              byWeekday: [day],
              freq: "monthly",
            }),
            allDay: true,
          },
        ],
        localYear(),
      );

      for (const { end, start } of events.slice(1)) {
        expect(start.getDay()).toBe(day);
        expect(start).toEqual(
          new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        );
        expect(end).toEqual(
          new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1),
        );
      }
    }
  });

  it("repeats weekly from a week starting on the day of the change", () => {
    // All the days of the week of each change - one day each
    const events = expandRecurringEvents(
      [
        event(new Date(2026, 0, 1), new Date(2026, 0, 2), {
          byWeekday: [0, 1, 2, 3, 4, 5, 6],
          freq: "weekly",
          weekStart: 0,
        }),
      ].map((item) => ({ ...item, allDay: true })),
      localYear(),
    );

    expect(events.map(({ start }) => start)).toEqual(
      Array.from({ length: 365 }, (_, index) => dayOf2026(index)),
    );
  });
});
