import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import Calendar, { type CalendarEvent, type CalendarView } from ".";
import { getVisibleRange, atMinutes } from "./date-utils";
import { expandRecurringEvents } from "./recurrence";
import { inTimeZone } from "../../../utils/time-zone";

/** Runs the tests of a block with the browser in `timeZone`. */
function withHostZone(timeZone: string) {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = timeZone;
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });
}

describe("Calendar named time zones", () => {
  it.each([
    ["Europe/Prague", "2026-03-29T12:00:00Z", "2026-03-28T23:00:00.000Z", 23],
    ["Europe/Prague", "2026-10-25T12:00:00Z", "2026-10-24T22:00:00.000Z", 25],
    [
      "America/New_York",
      "2026-03-08T12:00:00Z",
      "2026-03-08T05:00:00.000Z",
      23,
    ],
    [
      "America/New_York",
      "2026-11-01T12:00:00Z",
      "2026-11-01T04:00:00.000Z",
      25,
    ],
  ])(
    "computes midnight and DST day length in %s (%s)",
    (timeZone, instant, start, hours) => {
      const range = getVisibleRange(new Date(instant), "day", 1, { timeZone });
      expect(range.start.toISOString()).toBe(start);
      expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(
        hours,
      );
      expect(range.start.getHours()).toBe(0);
    },
  );

  it("keeps a weekly Prague meeting at 9:00 across the DST transition", () => {
    const events = expandRecurringEvents(
      [
        {
          id: "meeting",
          title: "Meeting",
          start: new Date("2026-03-22T08:00:00Z"),
          end: new Date("2026-03-22T09:00:00Z"),
          recurrence: { freq: "weekly" },
        },
      ],
      {
        start: new Date("2026-03-21T00:00:00Z"),
        end: new Date("2026-04-10T00:00:00Z"),
      },
      { timeZone: "Europe/Prague" },
    );
    expect(events.map(({ start }) => start.toISOString())).toEqual([
      "2026-03-22T08:00:00.000Z",
      "2026-03-29T07:00:00.000Z",
      "2026-04-05T07:00:00.000Z",
    ]);
    expect(
      events.every(
        ({ start, end }) => start.getHours() === 9 && end.getHours() === 10,
      ),
    ).toBe(true);
  });

  it("interprets a local RRULE UNTIL in the calendar's zone", () => {
    const events = expandRecurringEvents(
      [
        {
          id: "meeting",
          title: "Meeting",
          start: new Date("2026-03-22T08:00:00Z"),
          end: new Date("2026-03-22T09:00:00Z"),
          recurrence: "FREQ=WEEKLY;UNTIL=20260329T090000",
        },
      ],
      {
        start: new Date("2026-03-21T00:00:00Z"),
        end: new Date("2026-04-10T00:00:00Z"),
      },
      { timeZone: "Europe/Prague" },
    );
    expect(events).toHaveLength(2);
    expect(events[1].start.toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("clamps a clock slot in the spring gap to the first valid minute", () => {
    const day = inTimeZone(new Date("2026-03-29T12:00:00Z"), "Europe/Prague");
    expect(atMinutes(day, 150).toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(atMinutes(day, 210).getHours()).toBe(3);
    expect(atMinutes(day, 210).getMinutes()).toBe(30);
  });

  it.each(["month", "week", "day", "agenda", "timelineDay"] as const)(
    "labels events in Prague in the %s view",
    (view) => {
      render(
        <Calendar
          onEventClick={() => {}}
          events={[
            {
              id: "meeting",
              title: "Meeting",
              start: new Date("2026-03-29T07:00:00Z"),
              end: new Date("2026-03-29T08:00:00Z"),
            },
          ]}
          initialDate={new Date("2026-03-29T12:00:00Z")}
          initialView={view}
          timeZone="Europe/Prague"
        />,
      );
      expect(
        screen.getByRole("button", { name: /^Meeting,/ }),
      ).toHaveAccessibleName(/9:00.*10:00/);
    },
  );
});

// Tokyo is ahead of Los Angeles - the browser's midnight of a day is the
// afternoon of the day before there
describe("Calendar in a zone behind the browser's", () => {
  withHostZone("Asia/Tokyo");
  const timeZone = "America/Los_Angeles";

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pages the month view by the days of the calendar", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        // September 1, noon in Los Angeles
        initialDate={new Date("2026-09-01T19:00:00Z")}
        onDateClick={() => {}}
        timeZone={timeZone}
      />,
    );

    act(() =>
      screen
        .getByRole("button", { name: "Tuesday, September 1, 2026" })
        .focus(),
    );
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Thursday, October 1, 2026" }),
    ).toHaveFocus();
  });

  it("moves the focus to the first and not past the last day of the grid", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Calendar
        initialDate={new Date("2026-09-10T19:00:00Z")}
        onDateClick={() => {}}
        timeZone={timeZone}
      />,
    );

    // The first row starts on Sunday, August 30
    act(() =>
      screen.getByRole("button", { name: "Sunday, September 6, 2026" }).focus(),
    );
    await user.keyboard("{ArrowUp}");
    expect(
      screen.getByRole("button", { name: "Sunday, August 30, 2026" }),
    ).toHaveFocus();

    // Saturday, October 10 is the last day - the tab stop stays on it
    const last = screen.getByRole("button", {
      name: "Saturday, October 10, 2026",
    });
    act(() => last.focus());
    await user.keyboard("{ArrowRight}");
    expect(last).toHaveFocus();
    expect(container.querySelectorAll("[data-day][tabindex='0']")).toEqual(
      expect.objectContaining({ length: 1 }),
    );
    expect(last).toHaveAttribute("tabindex", "0");
  });

  it("opens the agenda at today of the calendar", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Thursday, September 24, 1 PM in Los Angeles - Friday in Tokyo
    vi.setSystemTime(new Date("2026-09-24T20:00:00Z"));
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(2000);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const date = this.getAttribute("data-date");
        // Each day 100px lower, the list 50px from the top of the page
        const top = date ? 50 + (Number(date.slice(-2)) - 22) * 100 : 50;
        return { top } as DOMRect;
      },
    );
    // 10 AM in Los Angeles on the 22nd, 24th and 26th
    const events = [22, 24, 26].map((day): CalendarEvent => ({
      end: new Date(`2026-09-${day}T18:00:00Z`),
      id: `${day}`,
      start: new Date(`2026-09-${day}T17:00:00Z`),
      title: `Event ${day}`,
    }));

    const { container } = render(
      <Calendar
        events={events}
        initialDate={new Date("2026-09-24T20:00:00Z")}
        initialView="agenda"
        timeZone={timeZone}
      />,
    );
    expect(container.querySelector(".agenda-view")!.scrollTop).toBe(200);
  });

  it("picks today of the calendar by the Today of its date field", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Thursday, September 24 in Los Angeles - Friday in Tokyo
    vi.setSystemTime(new Date("2026-09-24T20:00:00Z"));
    const user = userEvent.setup();
    render(
      <Calendar
        initialDate={new Date("2026-09-10T19:00:00Z")}
        timeZone={timeZone}
      />,
    );

    const field = screen.getByRole("combobox", { name: "Go to date" });
    await user.click(field);
    const popup = screen.getByRole("dialog", { name: "Select date" });
    expect(
      within(popup).getByRole("button", { name: "September 24, 2026" }),
    ).toHaveAttribute("aria-current", "date");

    await user.click(within(popup).getByRole("button", { name: "Today" }));
    expect(field).toHaveValue("09/24/2026");
  });
});

// Los Angeles is behind Tokyo - midnight there is the day before in the
// browser
describe("Calendar in a zone ahead of the browser's", () => {
  withHostZone("America/Los_Angeles");

  it.each(["week", "timelineWeek"] as const)(
    "writes the months of the days of the %s view in the zone of the calendar",
    (view) => {
      const { container } = render(
        <Calendar
          // Thursday, October 1, noon in Tokyo
          initialDate={new Date("2026-10-01T03:00:00Z")}
          initialView={view}
          timeZone="Asia/Tokyo"
          viewOptions={[view]}
        />,
      );

      expect(container).toHaveTextContent(/Wed\s*30\s*Sep\s*Thu\s*1\s*Oct/);
    },
  );
});

describe("Calendar switching its time zone", () => {
  const events: CalendarEvent[] = [
    {
      end: new Date("2026-09-24T13:00:00Z"),
      id: "meeting",
      start: new Date("2026-09-24T12:00:00Z"),
      title: "Meeting",
    },
  ];
  const calendar = (view: CalendarView, timeZone: string) => (
    <Calendar
      dayEndHour={24}
      dayStartHour={0}
      events={events}
      initialDate={new Date("2026-09-24T12:00:00Z")}
      initialView={view}
      onEventClick={() => {}}
      onEventDrop={() => {}}
      renderEvent={(_, { timeText }) => <span>{timeText}</span>}
      timeZone={timeZone}
      viewOptions={[view]}
    />
  );

  it.each(["month", "week", "day", "timelineDay"] as const)(
    "writes the times of the %s view in the new zone",
    (view) => {
      const { rerender } = render(calendar(view, "Europe/Prague"));
      expect(screen.getByText("2:00 – 3:00 PM")).toBeInTheDocument();

      rerender(calendar(view, "America/New_York"));
      expect(screen.getByText("8:00 – 9:00 AM")).toBeInTheDocument();
      expect(screen.queryByText("2:00 – 3:00 PM")).toBeNull();
    },
  );

  it("says where an event moved by the keys goes in the new zone", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(calendar("day", "Europe/Prague"));
    const announcement = () =>
      container.querySelector(":scope > div > [aria-live='polite']");
    const moveDown = async () => {
      act(() => screen.getByRole("button", { name: /^Meeting,/ }).focus());
      await user.keyboard("{Control>}x{/Control}{ArrowDown}");
    };

    await moveDown();
    expect(announcement()).toHaveTextContent(/3:00 – 4:00 PM/);
    await user.keyboard("{Escape}");

    rerender(calendar("day", "America/New_York"));
    await moveDown();
    expect(announcement()).toHaveTextContent(/9:00 – 10:00 AM/);
  });
});

describe("Calendar with a time zone the browser does not know", () => {
  it("shows the browser's zone and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Calendar
        initialDate={new Date(2026, 8, 24, 12)}
        timeZone="Europe/Kyev"
      />,
    );

    expect(screen.getByRole("table", { name: "September 2026" })).toBeVisible();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/timeZone "Europe\/Kyev"/),
    );
  });
});
