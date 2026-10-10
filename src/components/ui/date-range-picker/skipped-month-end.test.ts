import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPresetRange, toDateRange } from "./range";

// Kiritimati went from Friday, December 30, 1994 to Sunday, January 1 - the
// last day of the month and of the year skipped
describe("Range presets where the time zone skipped the last day of a month (Pacific/Kiritimati)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  const preset = (key: Parameters<typeof getPresetRange>[0], today: Date) =>
    toDateRange(getPresetRange(key, today, 1));

  it("ends the month and the year on their last day - not on January 1", () => {
    const december = new Date(1994, 11, 15);
    expect(preset("thisMonth", december)).toEqual({
      end: "1994-12-30",
      start: "1994-12-01",
    });
    expect(preset("thisYear", december)).toEqual({
      end: "1994-12-30",
      start: "1994-01-01",
    });

    const january = new Date(1995, 0, 15);
    expect(preset("lastMonth", january)).toEqual({
      end: "1994-12-30",
      start: "1994-12-01",
    });
    expect(preset("lastYear", january)).toEqual({
      end: "1994-12-30",
      start: "1994-01-01",
    });
  });
});

// Samoa went from Thursday, December 29, 2011 to Saturday, December 31 - the
// last day of a week starting on Saturday skipped
describe("Range presets where the time zone skipped the last day of a week (Pacific/Apia)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Apia";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  const preset = (key: Parameters<typeof getPresetRange>[0], today: Date) =>
    toDateRange(getPresetRange(key, today, 6));

  it("ends the week on its last day - not on the first of the next one", () => {
    expect(preset("thisWeek", new Date(2011, 11, 29))).toEqual({
      end: "2011-12-29",
      start: "2011-12-24",
    });
    expect(preset("lastWeek", new Date(2011, 11, 31))).toEqual({
      end: "2011-12-29",
      start: "2011-12-24",
    });
  });
});
