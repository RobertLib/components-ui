import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  atHour,
  daysBetween,
  getSlotStart,
  getVisibleRange,
  minutesIntoDay,
} from "./date-utils";

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
});

describe("slot times", () => {
  it("gives the 24:00 row the last slot of its day", () => {
    const day = new Date(2026, 8, 24);
    expect(getSlotStart(day, 24, 0, 30)).toEqual(new Date(2026, 8, 24, 23, 30));
    expect(getSlotStart(day, 9, 30, 30)).toEqual(new Date(2026, 8, 24, 9, 30));
    expect(atHour(day, 24)).toEqual(new Date(2026, 8, 25));
    expect(minutesIntoDay(day, new Date(2026, 8, 25))).toBe(1440);
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
      getSlotStart(day, Math.floor(hours), (hours % 1) * 60, 30),
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
});
