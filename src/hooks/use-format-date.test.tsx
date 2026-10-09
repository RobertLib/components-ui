import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useFormatDate from "./use-format-date";
import { cs } from "../i18n/ui/cs";
import { createLocale } from "../i18n/ui/format";
import { en } from "../i18n/ui/en";
import UIProvider from "../providers/ui-provider";

const formatterOf = (locale = en) =>
  renderHook(() => useFormatDate(), {
    wrapper: ({ children }) => (
      <UIProvider locale={locale}>{children}</UIProvider>
    ),
  }).result.current;

describe("useFormatDate", () => {
  it("writes a date by the pattern of the locale - as the pickers do", () => {
    const format = formatterOf(
      createLocale(cs, { formats: { date: "D. M. YYYY" } }),
    );

    expect(format("2026-10-01")).toBe("1. 10. 2026");
    expect(format(new Date(2026, 9, 1, 14, 5), "dateTime")).toBe(
      "01.10.2026 14:05",
    );
  });

  it("keeps a date alone on its day, wherever the browser is", () => {
    // Midnight of UTC would be the day before west of Greenwich
    expect(formatterOf()("2026-10-01")).toBe("10/01/2026");
  });

  it("writes a time in the time zone given", () => {
    const format = formatterOf(
      createLocale(en, { formats: { dateTime: "DD/MM/YYYY HH:mm" } }),
    );

    expect(
      format("2026-10-01T22:30:00Z", "dateTime", { timeZone: "Europe/Prague" }),
    ).toBe("02/10/2026 00:30");
  });

  it("writes nothing for no date or an invalid one", () => {
    const format = formatterOf();

    expect(format(null)).toBe("");
    expect(format(undefined)).toBe("");
    expect(format("")).toBe("");
    expect(format("not a date")).toBe("");
    expect(format("2026-02-30")).toBe("");
  });
});
