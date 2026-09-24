import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "./types";
import { createLocale } from "../../i18n/format";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import {
  formatEventLabel,
  formatTimeRange,
  getVisibleMinutes,
  layoutEvents,
  sortEvents,
} from "./utils";

const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (id: string, start: Date, end: Date): CalendarEvent => ({
  end,
  id,
  start,
  title: id,
});

/** An item of `layoutEvents` from clock times, e.g. `item("A", 9, 10.5)`. */
const item = (id: string, from: number, to: number) => ({
  from: from * 60,
  id,
  to: to * 60,
});

describe("layoutEvents", () => {
  it("groups the events overlapping directly or through others", () => {
    const layout = layoutEvents([
      item("C", 10.5, 12),
      item("A", 9, 10),
      item("B", 9.5, 11),
      item("D", 14, 15),
    ]);

    // C goes back into the column A has left
    expect(layout.get("A")).toEqual({ column: 0, columns: 2, span: 1 });
    expect(layout.get("B")).toEqual({ column: 1, columns: 2, span: 1 });
    expect(layout.get("C")).toEqual({ column: 0, columns: 2, span: 1 });
    expect(layout.get("D")).toEqual({ column: 0, columns: 1, span: 1 });
  });

  it("puts the longer of events starting together first", () => {
    const layout = layoutEvents([item("Short", 9, 10), item("Long", 9, 12)]);

    expect(layout.get("Long")?.column).toBe(0);
    expect(layout.get("Short")?.column).toBe(1);
  });

  it("does not take events touching at an end for overlapping", () => {
    const layout = layoutEvents([item("A", 9, 10), item("B", 10, 11)]);

    expect(layout.get("B")).toEqual({ column: 0, columns: 1, span: 1 });
    expect(layoutEvents([]).size).toBe(0);
  });

  it("gives simultaneous events a column each", () => {
    const layout = layoutEvents(
      ["A", "B", "C", "D", "E", "F"].map((id) => item(id, 9, 10)),
    );

    expect(["A", "B", "C", "D", "E", "F"].map((id) => layout.get(id))).toEqual(
      [0, 1, 2, 3, 4, 5].map((column) => ({ column, columns: 6, span: 1 })),
    );
  });

  it("needs as many columns as events overlap at once, also in a long chain", () => {
    // Every event overlaps the next one by half an hour
    const chain = Array.from({ length: 12 }, (_, index) =>
      item(`E${index}`, 8 + index * 0.5, 9 + index * 0.5),
    );
    const layout = layoutEvents(chain);

    for (const [index, { id }] of chain.entries()) {
      expect(layout.get(id)).toEqual({
        column: index % 2,
        columns: 2,
        span: 1,
      });
    }
  });

  it("widens a tile into the columns free for its whole time", () => {
    const layout = layoutEvents([
      item("A", 9, 11),
      item("B", 9, 9.5),
      item("C", 9, 9.5),
      item("D", 9.5, 10),
    ]);

    expect(layout.get("A")).toEqual({ column: 0, columns: 3, span: 1 });
    expect(layout.get("B")).toEqual({ column: 1, columns: 3, span: 1 });
    expect(layout.get("C")).toEqual({ column: 2, columns: 3, span: 1 });
    // Column 2 is free again after 9:30
    expect(layout.get("D")).toEqual({ column: 1, columns: 3, span: 2 });
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

  it("shows an event without a length where it starts", () => {
    expect(getVisibleMinutes(d(24, 7), d(24, 7), d(24), 7, 22)).toEqual({
      from: 420,
      to: 420,
    });
    expect(getVisibleMinutes(d(24, 9), d(24, 9), d(24), 7, 22)).toEqual({
      from: 540,
      to: 540,
    });
    expect(getVisibleMinutes(d(24, 22), d(24, 22), d(24), 7, 22)).toBeNull();
  });
});

describe("sortEvents", () => {
  it("puts all-day events first, then orders by start, longer first", () => {
    const sorted = sortEvents([
      event("Evening", d(24, 18), d(24, 19)),
      event("Short", d(24, 9), d(24, 10)),
      { ...event("Offsite", d(24), d(25)), allDay: true },
      event("Long", d(24, 9), d(24, 12)),
    ]);

    expect(sorted.map(({ id }) => id)).toEqual([
      "Offsite",
      "Long",
      "Short",
      "Evening",
    ]);
  });
});

describe("formatEventLabel", () => {
  it("names an event by its title, day and times on the locale's clock", () => {
    const standup = event("Standup", d(24, 9), d(24, 10));

    expect(formatEventLabel(standup, en)).toMatch(
      /^Standup, Thursday, September 24, 2026,? 9:00\s–\s10:00\sAM$/,
    );
    expect(formatEventLabel(standup, cs)).toMatch(
      /^Standup, čtvrtek 24\. září 2026,? 9:00\s?–\s?10:00$/,
    );
    // English on the 24-hour clock
    expect(
      formatEventLabel(
        standup,
        createLocale(en, { formats: { time: "HH:mm" } }),
      ),
    ).toMatch(/09:00\s–\s10:00$/);
  });

  it("names an event over several days by both its days", () => {
    expect(
      formatEventLabel(event("Night shift", d(22, 20), d(23, 6)), en),
    ).toMatch(/^Night shift, Tuesday, .* 8:00\sPM\s–\sWednesday, .* 6:00\sAM$/);
  });

  it("names an all-day event by its days - the end is exclusive", () => {
    expect(
      formatEventLabel({ ...event("Offsite", d(22), d(24)), allDay: true }, en),
    ).toMatch(
      /^Offsite, Tuesday, September 22\s–\sWednesday, September 23, 2026, all day$/,
    );
    expect(
      formatEventLabel({ ...event("Release", d(24), d(25)), allDay: true }, en),
    ).toBe("Release, Thursday, September 24, 2026, all day");
  });
});

describe("formatTimeRange", () => {
  it("falls back for a locale code Intl does not understand", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const locale = createLocale(en, { code: "en_GB" });

    expect(formatTimeRange(d(24, 9), d(24, 10), locale)).toMatch(
      /^Thursday, September 24, 2026,? 9:00\s–\s10:00\sAM$/,
    );
    expect(
      formatEventLabel(
        { ...event("Release", d(24), d(25)), allDay: true },
        locale,
      ),
    ).toBe("Release, Thursday, September 24, 2026, all day");

    warn.mockRestore();
  });
});
