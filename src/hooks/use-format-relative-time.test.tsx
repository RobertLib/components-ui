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
