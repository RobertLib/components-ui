import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useFormatRelativeTime from "./use-format-relative-time";
import { cs } from "../i18n/ui/cs";
import { en } from "../i18n/ui/en";
import UIProvider from "../providers/ui-provider";
import type { Locale } from "../i18n/ui/types";

const NOW = new Date(2026, 9, 15, 12, 0, 0);

function setup(locale: Locale = en) {
  const { result } = renderHook(() => useFormatRelativeTime(), {
    wrapper: ({ children }) => (
      <UIProvider locale={locale}>{children}</UIProvider>
    ),
  });
  return result.current;
}

describe("useFormatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing for no value or an invalid one", () => {
    const format = setup();
    expect(format(null)).toBe("");
    expect(format(undefined)).toBe("");
    expect(format("")).toBe("");
    expect(format("not a date")).toBe("");
  });

  it("writes a moment less than 45 seconds away as now", () => {
    const format = setup();
    expect(format(new Date(NOW.getTime() - 30_000))).toBe("now");
    expect(format(new Date(NOW.getTime() + 30_000))).toBe("now");
  });

  it("writes minutes, hours, days, weeks, months and years", () => {
    const format = setup();
    expect(format(new Date(2026, 9, 15, 11, 55))).toBe("5 minutes ago");
    expect(format(new Date(2026, 9, 15, 15, 0))).toBe("in 3 hours");
    expect(format(new Date(2026, 9, 14, 8, 0))).toBe("yesterday");
    expect(format(new Date(2026, 9, 12, 8, 0))).toBe("3 days ago");
    expect(format(new Date(2026, 9, 1, 8, 0))).toBe("2 weeks ago");
    expect(format(new Date(2026, 6, 1, 8, 0))).toBe("3 months ago");
    expect(format(new Date(2024, 6, 1, 8, 0))).toBe("2 years ago");
  });

  it("counts calendar days - late yesterday evening is yesterday", () => {
    const format = setup();
    // 23 hours ago would round to "1 day" by hours, by days it is yesterday
    expect(format(new Date(2026, 9, 14, 13, 0))).toBe("yesterday");
  });

  it("writes a moment of today in hours - also seen late in the evening", () => {
    vi.setSystemTime(new Date(2026, 9, 15, 23, 0));
    expect(setup()(new Date(2026, 9, 15, 0, 30))).toBe("22 hours ago");

    vi.setSystemTime(new Date(2026, 9, 15, 1, 0));
    expect(setup()(new Date(2026, 9, 15, 23, 30))).toBe("in 23 hours");
  });

  it("counts weeks and years as they pass - not as the calendar ones before", () => {
    const format = setup();
    // 10 days ago is in the week before last
    expect(format(new Date(2026, 9, 5, 12, 0))).toBe("1 week ago");
    expect(format(new Date(2026, 9, 22, 12, 0))).toBe("in 1 week");
    expect(format(new Date(2026, 8, 1, 12, 0))).toBe("last month");
    expect(format(new Date(2025, 8, 1, 12, 0))).toBe("1 year ago");

    // 4 weeks of this month are no month ago
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0));
    expect(setup()(new Date(2026, 9, 1, 12, 0))).toBe("4 weeks ago");
  });

  it("counts the days in the browser's zone for a zone it does not know", () => {
    const { result } = renderHook(
      () => useFormatRelativeTime("Europe/Atlantis"),
      {
        wrapper: ({ children }) => (
          <UIProvider locale={en}>{children}</UIProvider>
        ),
      },
    );
    expect(result.current(new Date(2026, 9, 13, 8, 0))).toBe("2 days ago");
  });

  it("writes in the language of the locale", () => {
    const format = setup(cs);
    expect(format(new Date(2026, 9, 15, 11, 55))).toBe("před 5 minutami");
    expect(format(new Date(2026, 9, 14, 8, 0))).toBe("včera");
  });

  it("takes ISO strings and timestamps", () => {
    const format = setup();
    expect(format(new Date(2026, 9, 15, 11, 0).toISOString())).toBe(
      "1 hour ago",
    );
    expect(format(new Date(2026, 9, 15, 11, 0).getTime())).toBe("1 hour ago");
  });

  it("writes the date and time past absoluteAfterDays", () => {
    const format = setup(cs);
    expect(
      format(new Date(2026, 2, 12, 14, 30), { absoluteAfterDays: 7 }),
    ).toBe("12.03.2026 14:30");
    expect(format(new Date(2026, 9, 12, 8, 0), { absoluteAfterDays: 7 })).toBe(
      "před 3 dny",
    );
  });

  it("writes short units", () => {
    const format = setup(en);
    expect(format(new Date(2026, 9, 15, 11, 55), { style: "short" })).toBe(
      "5 min. ago",
    );
  });
});
