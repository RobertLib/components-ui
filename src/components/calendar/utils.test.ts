import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "./types";
import { calculateOverlapPositions, getVisibleMinutes } from "./utils";

const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (id: string, start: Date, end: Date): CalendarEvent => ({
  end,
  id,
  start,
  title: id,
});

describe("calculateOverlapPositions", () => {
  it("groups the events overlapping directly or through others", () => {
    const positions = calculateOverlapPositions([
      event("C", d(24, 10, 30), d(24, 12)),
      event("A", d(24, 9), d(24, 10)),
      event("B", d(24, 9, 30), d(24, 11)),
      event("D", d(24, 14), d(24, 15)),
    ]);

    expect(positions.get("A")).toEqual({ index: 0, totalInGroup: 3 });
    expect(positions.get("B")).toEqual({ index: 1, totalInGroup: 3 });
    expect(positions.get("C")).toEqual({ index: 2, totalInGroup: 3 });
    expect(positions.get("D")).toEqual({ index: 0, totalInGroup: 1 });
  });

  it("puts the longer of events starting together first", () => {
    const positions = calculateOverlapPositions([
      event("Short", d(24, 9), d(24, 10)),
      event("Long", d(24, 9), d(24, 12)),
    ]);

    expect(positions.get("Long")?.index).toBe(0);
    expect(positions.get("Short")?.index).toBe(1);
  });

  it("does not take events touching at an end for overlapping", () => {
    const positions = calculateOverlapPositions([
      event("A", d(24, 9), d(24, 10)),
      event("B", d(24, 10), d(24, 11)),
    ]);

    expect(positions.get("B")).toEqual({ index: 0, totalInGroup: 1 });
    expect(calculateOverlapPositions([]).size).toBe(0);
  });
});

describe("getVisibleMinutes", () => {
  it("cuts an event to the hours shown", () => {
    expect(getVisibleMinutes(d(24, 6), d(24, 9), d(24), 7, 22)).toEqual({
      from: 420,
      to: 540,
    });
    expect(getVisibleMinutes(d(24, 21), d(25, 2), d(24), 7, 22)).toEqual({
      from: 1260,
      to: 1320,
    });
  });

  it("shows the part of an event from the day before", () => {
    expect(getVisibleMinutes(d(23, 20), d(24, 9), d(24), 7, 24)).toEqual({
      from: 420,
      to: 540,
    });
    // Ending at midnight - 24:00
    expect(getVisibleMinutes(d(24, 23), d(25), d(24), 0, 24)).toEqual({
      from: 1380,
      to: 1440,
    });
  });

  it("gives nothing for an event out of the hours shown", () => {
    expect(getVisibleMinutes(d(24, 5), d(24, 7), d(24), 7, 22)).toBeNull();
    expect(getVisibleMinutes(d(24, 22), d(24, 23), d(24), 7, 22)).toBeNull();
  });
});
