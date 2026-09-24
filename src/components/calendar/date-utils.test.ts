import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  atHour,
  daysBetween,
  getSlotStart,
  getVisibleRange,
  minutesIntoDay,
} from "./date-utils";
import { toTimeRange } from "./use-slot-drag";

describe("getVisibleRange", () => {
  // Thursday, September 24th 2026
  const date = new Date(2026, 8, 24, 15, 30);

  it("covers the day of the day view", () => {
    expect(getVisibleRange(date, "day", 1)).toEqual({
      end: new Date(2026, 8, 25),
      start: new Date(2026, 8, 24),
    });
  });

  it("covers the week of the locale", () => {
    expect(getVisibleRange(date, "week", 1)).toEqual({
      end: new Date(2026, 8, 28),
      start: new Date(2026, 8, 21),
    });
    expect(getVisibleRange(date, "week", 0)).toEqual({
      end: new Date(2026, 8, 27),
      start: new Date(2026, 8, 20),
    });
  });

  it("covers the six weeks of the month view", () => {
    // September 1st 2026 is a Tuesday
    expect(getVisibleRange(date, "month", 1)).toEqual({
      end: new Date(2026, 9, 12),
      start: new Date(2026, 7, 31),
    });
    expect(getVisibleRange(date, "month", 0)).toEqual({
      end: new Date(2026, 9, 11),
      start: new Date(2026, 7, 30),
    });
  });

  it("covers the month of the agenda - or its period", () => {
    expect(getVisibleRange(date, "agenda", 1)).toEqual({
      end: new Date(2026, 9, 1),
      start: new Date(2026, 8, 1),
    });
    expect(
      getVisibleRange(date, "agenda", 1, { agendaPeriod: "week" }),
    ).toEqual({ end: new Date(2026, 8, 28), start: new Date(2026, 8, 21) });
    expect(getVisibleRange(date, "agenda", 1, { agendaPeriod: "day" })).toEqual(
      { end: new Date(2026, 8, 25), start: new Date(2026, 8, 24) },
    );
    // Days from the date on
    expect(getVisibleRange(date, "agenda", 1, { agendaPeriod: 14 })).toEqual({
      end: new Date(2026, 9, 8),
      start: new Date(2026, 8, 24),
    });
    // One day is the day, what is no period the month
    expect(getVisibleRange(date, "agenda", 1, { agendaPeriod: 1 })).toEqual(
      getVisibleRange(date, "day", 1),
    );
    expect(getVisibleRange(date, "agenda", 1, { agendaPeriod: 0 })).toEqual(
      getVisibleRange(date, "agenda", 1),
    );
  });

  it("stays in the years 0 - 99", () => {
    const date = new Date(2026, 8, 24);
    date.setFullYear(50);
    const { end, start } = getVisibleRange(date, "month", 1);
    expect(start.getFullYear()).toBe(50);
    expect(end.getFullYear()).toBe(50);

    const agenda = getVisibleRange(date, "agenda", 1);
    expect(agenda.start.getFullYear()).toBe(50);
    expect(agenda.end.getFullYear()).toBe(50);
  });
});

describe("slot times", () => {
  it("gives the 24:00 row the last slot of its day", () => {
    const day = new Date(2026, 8, 24);
    expect(getSlotStart(day, 24, 0, 30, 24)).toEqual(
      new Date(2026, 8, 24, 23, 30),
    );
    expect(getSlotStart(day, 9, 30, 30, 24)).toEqual(
      new Date(2026, 8, 24, 9, 30),
    );
    expect(atHour(day, 24)).toEqual(new Date(2026, 8, 25));
    expect(minutesIntoDay(day, new Date(2026, 8, 25))).toBe(1440);
  });

  it("gives the row of an earlier end hour the last slot before it", () => {
    const day = new Date(2026, 8, 24);
    expect(getSlotStart(day, 22, 0, 30, 22)).toEqual(
      new Date(2026, 8, 24, 21, 30),
    );
    expect(getSlotStart(day, 22, 0, 60, 22)).toEqual(new Date(2026, 8, 24, 21));
    expect(getSlotStart(day, 21, 30, 30, 22)).toEqual(
      new Date(2026, 8, 24, 21, 30),
    );
  });
});

// Europe/Prague: the clocks jump from 2:00 to 3:00 on March 29th 2026 and
// back from 3:00 to 2:00 on October 25th 2026
describe("slot times over a daylight saving change", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Europe/Prague";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  it("runs in the time zone with the change", () => {
    // 23 hours from midnight to midnight
    const springForward = new Date(2026, 2, 29);
    expect(new Date(2026, 2, 30).getTime() - springForward.getTime()).toBe(
      23 * 3_600_000,
    );
  });

  it("never comes out earlier for a later slot in the skipped hour", () => {
    const day = new Date(2026, 2, 29);
    const slots = [1, 1.5, 2, 2.5, 3, 3.5].map((hours) =>
      getSlotStart(day, Math.floor(hours), (hours % 1) * 60, 30, 24),
    );

    for (let index = 1; index < slots.length; index++) {
      expect(slots[index].getTime()).toBeGreaterThanOrEqual(
        slots[index - 1].getTime(),
      );
    }
    // 2:00 and 2:30 do not exist - they are 3:00
    expect(slots[2].getHours()).toBe(3);
    expect(slots[3].getHours()).toBe(3);
    expect(slots[3].getMinutes()).toBe(0);
    expect(slots[5].getMinutes()).toBe(30);
    expect(atHour(day, 2).getHours()).toBe(3);
  });

  it("measures the day in clock minutes", () => {
    const day = new Date(2026, 9, 25);
    expect(minutesIntoDay(day, atHour(day, 4))).toBe(240);
    expect(minutesIntoDay(day, atHour(day, 24))).toBe(1440);
    expect(daysBetween(day, new Date(2026, 9, 26))).toBe(1);
  });

  it("gives a range of skipped rows its length after the gap", () => {
    const day = new Date(2026, 2, 29);
    const length = (from: number, to: number) => {
      const { end, start } = toTimeRange({ day, from, to });
      return [start.getHours(), (end.getTime() - start.getTime()) / 60_000];
    };

    // Rows the clocks skip all - from 3:00 on, never empty
    expect(length(120, 150)).toEqual([3, 30]);
    expect(length(150, 180)).toEqual([3, 30]);
    expect(length(120, 180)).toEqual([3, 60]);
    // A range reaching out of the gap ends where it does on the clock
    expect(length(60, 180)).toEqual([1, 60]);
    expect(length(120, 240)).toEqual([3, 60]);
  });

  it("gives a range in the repeated hour both of its runs", () => {
    const day = new Date(2026, 9, 25);
    const { end, start } = toTimeRange({ day, from: 150, to: 180 });
    expect([start.getHours(), start.getMinutes(), end.getHours()]).toEqual([
      2, 30, 3,
    ]);
    // 2:30 before the clocks go back to 3:00 after it
    expect(end.getTime() - start.getTime()).toBe(90 * 60_000);
  });
});
