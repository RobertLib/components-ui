import { act, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import useFormatDate from "./use-format-date";
import { cs } from "../i18n/ui/cs";
import { createLocale } from "../i18n/ui/format";
import { en } from "../i18n/ui/en";
import UIProvider from "../providers/ui-provider";
import { inTimeZone } from "../utils/time-zone";

const formatterOf = (locale = en) =>
  renderHook(() => useFormatDate(), {
    wrapper: ({ children }) => (
      <UIProvider locale={locale}>{children}</UIProvider>
    ),
  }).result.current;

describe("useFormatDate", () => {
  // West of Greenwich - where midnight of UTC is the day before
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

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
    expect(formatterOf(cs)("2026-10-01")).toBe("01.10.2026");
  });

  it("writes the values of the other pickers as they show them", () => {
    const format = formatterOf();

    // By the pattern of their picker - a month not the one before
    expect(format("2026-10")).toBe("10/2026");
    expect(format("2026-W40")).toBe("W40 2026");
    expect(format("14:30")).toBe("2:30 PM");
    expect(format("14:30:15")).toBe("2:30 PM");
    expect(formatterOf(cs)("2026-W40")).toBe("W40.2026");

    // A date and time without a zone is on the clock - also in another
    // time zone, and at an hour the clocks of New York skip
    expect(format("2026-10-01T14:30", "dateTime")).toBe("10/01/2026 2:30 PM");
    expect(
      format("2026-10-01T14:30", "dateTime", { timeZone: "Asia/Tokyo" }),
    ).toBe("10/01/2026 2:30 PM");
    expect(format("2026-03-08T02:30", "dateTime")).toBe("03/08/2026 2:30 AM");
    expect(format("2026-10-01T14:30")).toBe("10/01/2026");
    // Also with a lowercase t, which RFC 3339 allows
    expect(
      format("2026-10-01t14:30", "dateTime", { timeZone: "Asia/Tokyo" }),
    ).toBe("10/01/2026 2:30 PM");
    expect(format("2026-03-08t02:30:15", "dateTime")).toBe(
      "03/08/2026 2:30 AM",
    );
  });

  it("writes no part a value lacks as a zero", () => {
    const format = formatterOf();

    // A date and time has its ISO week too - of the year the week is in
    expect(format("2026-10-01T14:30", "week")).toBe("W40 2026");
    expect(format("2024-12-30T10:00", "week")).toBe("W01 2025");
    expect(format("2026-10-01T14:30", "time")).toBe("2:30 PM");

    // A month, a week and a time by the pattern of their picker instead -
    // not 10/00/2026
    expect(format("2026-10", "date")).toBe("10/2026");
    expect(format("2026-W40", "date")).toBe("W40 2026");
    expect(format("14:30", "dateTime")).toBe("2:30 PM");
    // A date by its own - no midnight it does not have
    expect(format("2026-10-01", "dateTime")).toBe("10/01/2026");
    expect(format("2026-10-01", "time")).toBe("10/01/2026");
    expect(format("2024-12-30", "week")).toBe("W01 2025");
    // Saturday, January 1 of the year 0 is in the last week of the year -1
    expect(format("0000-01-01", "week")).toBe("W52 -0001");
  });

  it("keeps a date on its day also where a clock change skips its midnight", () => {
    const previous = process.env.TZ;
    // Samoa skipped December 30, 2011 - and midnight of a day in Santiago
    // de Chile, where the clocks go from 0:00 to 1:00
    process.env.TZ = "Pacific/Apia";
    try {
      expect(formatterOf()("2011-12-30")).toBe("12/30/2011");
      process.env.TZ = "America/Santiago";
      expect(formatterOf()("2026-09-06T00:30", "dateTime")).toBe(
        "09/06/2026 12:30 AM",
      );
    } finally {
      process.env.TZ = previous;
    }
  });

  it("writes a date of useToday or inTimeZone in its own zone", () => {
    const format = formatterOf();
    // 22:00 on October 1 in New York - October 2 in Prague
    const today = inTimeZone(new Date("2026-10-02T02:00:00Z"), "Europe/Prague");

    expect(format(today)).toBe("10/02/2026");
    expect(format(today, "dateTime")).toBe("10/02/2026 4:00 AM");
    // The zone given wins
    expect(format(today, "dateTime", { timeZone: "UTC" })).toBe(
      "10/02/2026 2:00 AM",
    );
  });

  it("writes a time in the time zone given", () => {
    const format = formatterOf(
      createLocale(en, { formats: { dateTime: "DD/MM/YYYY HH:mm" } }),
    );

    expect(
      format("2026-10-01T22:30:00Z", "dateTime", { timeZone: "Europe/Prague" }),
    ).toBe("02/10/2026 00:30");
    // The browser's by default
    expect(format("2026-10-01T22:30:00Z", "dateTime")).toBe("01/10/2026 18:30");
  });

  it("writes nothing for no date or an invalid one", () => {
    const format = formatterOf();

    expect(format(null)).toBe("");
    expect(format(undefined)).toBe("");
    expect(format("")).toBe("");
    expect(format("not a date")).toBe("");
    expect(format(new Date(Number.NaN))).toBe("");
    // `Date` would take them for days of March
    expect(format("2026-02-30")).toBe("");
    expect(format("2026-02-30T10:00", "dateTime")).toBe("");
    expect(format("2026-13")).toBe("");
    expect(format("2026-W54")).toBe("");
    expect(format("24:00")).toBe("");
    // Like an invalid date - not an error of the render, also for a value
    // of a picker, which it would not change
    expect(
      format("2026-10-01T22:30:00Z", "dateTime", {
        timeZone: "Europe/Nowhere",
      }),
    ).toBe("");
    expect(format("2026-10-01", "date", { timeZone: "Europe/Nowhere" })).toBe(
      "",
    );
  });

  it("writes a moment in the browser's zone once the page hydrates", async () => {
    function Dates() {
      const formatDate = useFormatDate();
      return (
        <p>
          {formatDate("2026-10-01")} | {formatDate("2026-10-01T14:30")} |{" "}
          {formatDate("2026-10-01t14:30", "dateTime")} |{" "}
          {formatDate("2026-10-01T22:30:00Z", "dateTime")}
        </p>
      );
    }
    const page = (
      <UIProvider locale={en}>
        <Dates />
      </UIProvider>
    );

    // The server's clock is another - it writes the values of the pickers
    process.env.TZ = "UTC";
    const html = renderToString(page);
    process.env.TZ = "America/New_York";

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    expect(container).toHaveTextContent(
      /^10\/01\/2026 \| 10\/01\/2026 \| 10\/01\/2026 2:30 PM \|$/,
    );
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent(
      "10/01/2026 | 10/01/2026 | 10/01/2026 2:30 PM | 10/01/2026 6:30 PM",
    );

    act(() => root.unmount());
    container.remove();
  });

  it("writes a moment from the first render of a page without a server", () => {
    function FirstRender() {
      const formatDate = useFormatDate();
      const [first] = useState(() =>
        formatDate("2026-10-01T22:30:00Z", "dateTime"),
      );
      return <p>{first}</p>;
    }
    render(<FirstRender />);

    expect(screen.getByText("10/01/2026 6:30 PM")).toBeInTheDocument();
  });
});
