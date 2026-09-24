import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import { createLocale } from "../../i18n/format";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import UIProvider from "../../providers/ui-provider";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (
  title: string,
  start: Date,
  end: Date,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({ end, id: title, start, title, ...extra });

const events: CalendarEvent[] = [
  event("Review", d(24, 13), d(24, 14)),
  event("Standup", d(24, 9), d(24, 9, 30)),
  event("Offsite", d(24), d(25), { allDay: true }),
  // Tuesday to Thursday
  event("Conference", d(22), d(25), { allDay: true }),
  // Friday night to Saturday morning
  event("Night shift", d(25, 22), d(26, 6)),
];

/** The list of the events of a day, named by its heading. */
const dayList = (name: RegExp) => screen.getByRole("list", { name });

/** The row of an event - its button and what it shows. */
const row = (list: HTMLElement, name: RegExp) =>
  within(list).getByRole("button", { name }).parentElement!;

// "Today" is Thursday, September 24th, 2026 at noon
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(d(24, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Calendar agenda", () => {
  it("lists the events of the month by day, all-day events first", () => {
    render(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={() => {}}
      />,
    );

    // Only the days with events
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent?.replace("Today", "")),
    ).toEqual([
      "Tuesday, September 22, 2026",
      "Wednesday, September 23, 2026",
      "Thursday, September 24, 2026",
      "Friday, September 25, 2026",
      "Saturday, September 26, 2026",
    ]);

    const thursday = dayList(/^Thursday, September 24/);
    expect(
      within(thursday)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")?.split(",")[0]),
    ).toEqual(["Conference", "Offsite", "Standup", "Review"]);
    expect(row(thursday, /^Standup/)).toHaveTextContent(
      /^9:00\s–\s9:30\sAMStandup$/,
    );
    expect(row(thursday, /^Offsite/)).toHaveTextContent(/^All dayOffsite$/);
  });

  it("marks the days of an event over several days", () => {
    render(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={() => {}}
      />,
    );

    expect(row(dayList(/^Tuesday/), /^Conference/)).toHaveTextContent(
      /^All dayConferenceDay 1\/3$/,
    );
    expect(row(dayList(/^Thursday/), /^Conference/)).toHaveTextContent(
      "Day 3/3",
    );
    // From its start on the first day, until its end on the last
    expect(row(dayList(/^Friday/), /^Night shift/)).toHaveTextContent(
      /^from 10:00\sPMNight shiftDay 1\/2$/,
    );
    expect(row(dayList(/^Saturday/), /^Night shift/)).toHaveTextContent(
      /^until 6:00\sAMNight shiftDay 2\/2$/,
    );
    // The name tells the whole time and the day
    expect(
      within(dayList(/^Saturday/)).getByRole("button", {
        name: /^Night shift, Friday, September 25, 2026.* 10:00\sPM\s–\sSaturday, September 26, 2026.* 6:00\sAM, Day 2\/2$/,
      }),
    ).toBeInTheDocument();
  });

  it("shows an event ending at midnight by its times only", () => {
    render(
      <Calendar
        events={[
          event("Late", d(24, 23), d(25)),
          event("Whole day", d(23), d(24)),
          event("Reminder", d(24, 8), d(24, 8)),
        ]}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={() => {}}
      />,
    );

    const thursday = dayList(/^Thursday/);
    expect(row(thursday, /^Late/)).toHaveTextContent(
      /^11:00\sPM – 12:00\sAMLate$/,
    );
    expect(row(thursday, /^Reminder/)).toHaveTextContent(/^8:00\sAMReminder$/);
    // Midnight to midnight
    expect(row(dayList(/^Wednesday/), /^Whole day/)).toHaveTextContent(
      /^All dayWhole day$/,
    );
    // Over at the midnight - not on Friday
    expect(screen.queryByRole("list", { name: /^Friday/ })).toBeNull();
  });

  it("opens an event with Enter and by a click", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={onEventClick}
      />,
    );

    const standup = screen.getByRole("button", { name: /^Standup,/ });
    expect(standup).toHaveAttribute("tabindex", "0");
    standup.focus();
    await user.keyboard("{Enter}");
    expect(onEventClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "Standup" }),
    );

    await user.click(screen.getByText("Review"));
    expect(onEventClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "Review" }),
    );
  });

  it("names the events that open nothing in text", () => {
    render(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        isEventClickable={(item) => item.id !== "Review"}
        onEventClick={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Review/ })).toBeNull();
    expect(screen.getByText(/^Review, Thursday/)).toHaveClass("sr-only");
  });

  it("runs an action without opening the event", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={onEventClick}
        renderEventActions={(item) =>
          item.id === "Standup" ? (
            <button onClick={() => onDelete(item.id)} type="button">
              Delete {item.title}
            </button>
          ) : null
        }
        renderEventIcon={(item) =>
          item.id === "Standup" ? <svg data-testid="icon" /> : null
        }
      />,
    );

    expect(
      within(row(dayList(/^Thursday/), /^Standup/)).getByTestId("icon"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Standup" }));
    expect(onDelete).toHaveBeenCalledWith("Standup");
    expect(onEventClick).not.toHaveBeenCalled();
  });

  it("shows the tooltip of an event on hover", () => {
    render(
      <Calendar
        events={[event("Standup", d(24, 9), d(24, 10), { tooltip: "Daily" })]}
        initialDate={d(24)}
        initialView="agenda"
      />,
    );

    expect(screen.getByTitle("Daily")).toHaveTextContent("Standup");
  });

  it("marks today", () => {
    render(
      <Calendar events={events} initialDate={d(24)} initialView="agenda" />,
    );

    const today = document.querySelector('[aria-current="date"]');
    expect(today).toHaveTextContent(/^Thursday, September 24, 2026$/);
    expect(today?.closest("h3")).toHaveTextContent(/Today$/);
    expect(screen.getAllByText("Today", { selector: "h3 span" })).toHaveLength(
      1,
    );
  });

  it("picks a day by its heading", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        minDate={d(23)}
        onDateClick={onDateClick}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Thursday, September 24, 2026" }),
    );
    expect(onDateClick).toHaveBeenCalledWith(d(24));

    // A day before `minDate` cannot be picked
    expect(
      screen.queryByRole("button", { name: "Tuesday, September 22, 2026" }),
    ).toBeNull();
    expect(screen.getByText("Tuesday, September 22, 2026")).toBeVisible();
  });

  it("says when the period has no events", () => {
    const { rerender } = render(
      <Calendar events={[]} initialDate={d(24)} initialView="agenda" />,
    );
    expect(screen.getByText("No events")).toBeVisible();

    // Not while they load
    rerender(
      <Calendar events={[]} initialDate={d(24)} initialView="agenda" loading />,
    );
    expect(screen.queryByText("No events")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("lists the occurrences of recurring events", () => {
    render(
      <Calendar
        events={[
          event("Weekly", d(3, 10), d(3, 11), { recurrence: "FREQ=WEEKLY" }),
        ]}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={() => {}}
      />,
    );

    expect(screen.getAllByRole("button", { name: /^Weekly,/ })).toHaveLength(4);
    expect(dayList(/^Thursday, September 17/)).toHaveTextContent("Weekly");
  });

  it("shows the resource of an event", () => {
    render(
      <Calendar
        events={[
          event("Standup", d(24, 9), d(24, 10), { resourceId: "a" }),
          event("Call", d(24, 11), d(24, 12)),
        ]}
        initialDate={d(24)}
        initialView="agenda"
        onEventClick={() => {}}
        resources={[{ color: "green", id: "a", title: "Room A" }]}
      />,
    );

    const standup = screen.getByRole("button", {
      name: /^Standup, Room A, Thursday, September 24, 2026/,
    });
    expect(standup.parentElement).toHaveTextContent(/StandupRoom A$/);
    // In the color of its resource
    expect(
      standup.parentElement?.querySelector(".border-green-500"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /^Call, Thursday/ }),
    ).toBeVisible();
  });

  it("uses the texts and the clock of the locale", () => {
    const { unmount } = render(
      <UIProvider locale={cs}>
        <Calendar
          events={events}
          initialDate={d(24)}
          initialView="agenda"
          viewOptions={["agenda", "month"]}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dnes" })).toBeVisible();
    expect(screen.getByText("Pátek 25. září 2026")).toBeVisible();
    expect(screen.getByText("od 22:00")).toBeVisible();
    expect(screen.getByText("do 6:00")).toBeVisible();
    expect(screen.getAllByText("Celý den").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Den 2/2")).toHaveLength(1);
    unmount();

    render(
      <UIProvider locale={createLocale(en, { formats: { time: "HH:mm" } })}>
        <Calendar events={events} initialDate={d(24)} initialView="agenda" />
      </UIProvider>,
    );
    expect(screen.getByText(/^09:00\s–\s09:30$/)).toBeVisible();
  });

  it("says in Czech that there are no events", () => {
    render(
      <UIProvider locale={cs}>
        <Calendar events={[]} initialDate={d(24)} initialView="agenda" />
      </UIProvider>,
    );

    expect(screen.getByText("Žádné události")).toBeVisible();
  });

  it("opens a period with today at today", () => {
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(2000);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const date = this.getAttribute("data-date");
        // Each day 100px lower, the list 50px from the top of the page -
        // not scrolled in jsdom
        const top = date ? 50 + (Number(date.slice(-2)) - 22) * 100 : 50;
        return { top } as DOMRect;
      },
    );

    const { container, rerender } = render(
      <Calendar events={events} initialDate={d(24)} initialView="agenda" />,
    );
    const scroller = container.querySelector<HTMLElement>(".agenda-view")!;
    // Thursday is the third day with events
    expect(scroller.scrollTop).toBe(200);

    // A period without today opens at its top
    rerender(
      <Calendar
        currentDate={new Date(2026, 9, 10)}
        events={events}
        initialView="agenda"
        setCurrentDate={() => {}}
      />,
    );
    expect(scroller.scrollTop).toBe(0);

    // Back in September - at today again
    rerender(
      <Calendar
        currentDate={d(1)}
        events={events}
        initialView="agenda"
        setCurrentDate={() => {}}
      />,
    );
    expect(scroller.scrollTop).toBe(200);
  });

  it("scrolls once the events of a new period are loaded", () => {
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(2000);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const date = this.getAttribute("data-date");
        return { top: date ? Number(date.slice(-2)) * 10 : 0 } as DOMRect;
      },
    );

    const { container, rerender } = render(
      <Calendar events={[]} initialDate={d(24)} initialView="agenda" loading />,
    );
    const scroller = container.querySelector<HTMLElement>(".agenda-view")!;
    expect(scroller.scrollTop).toBe(0);

    rerender(
      <Calendar events={events} initialDate={d(24)} initialView="agenda" />,
    );
    expect(scroller.scrollTop).toBe(240);

    // Not again - the user may have scrolled
    scroller.scrollTop = 0;
    rerender(
      <Calendar
        events={events}
        initialDate={d(24)}
        initialView="agenda"
        loading
      />,
    );
    rerender(
      <Calendar events={events} initialDate={d(24)} initialView="agenda" />,
    );
    expect(scroller.scrollTop).toBe(0);
  });
});

describe("Calendar agenda navigation", () => {
  /** The period label of the header. */
  const period = () => screen.queryByRole("heading", { level: 2 });
  const date = () => screen.getByRole("combobox", { name: "Go to date" });

  it("moves by months", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={d(24)} initialView="agenda" />);

    expect(period()).toHaveTextContent("September 2026");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(period()).toHaveTextContent("October 2026");
    expect(date()).toHaveValue("10/24/2026");
  });

  it("moves by weeks or days of agendaPeriod", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Calendar agendaPeriod="week" initialDate={d(24)} initialView="agenda" />,
    );

    expect(period()).toHaveTextContent("09/20/2026 - 09/26/2026");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(period()).toHaveTextContent("09/27/2026 - 10/03/2026");
    unmount();

    render(
      <Calendar agendaPeriod={14} initialDate={d(24)} initialView="agenda" />,
    );
    expect(period()).toHaveTextContent("09/24/2026 - 10/07/2026");
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(period()).toHaveTextContent("09/10/2026 - 09/23/2026");
  });

  it("lists one day of agendaPeriod day", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        agendaPeriod="day"
        events={events}
        initialDate={d(24)}
        initialView="agenda"
      />,
    );

    // The date field shows which - the heading says it to screen readers
    expect(period()).toHaveClass("sr-only");
    expect(period()).toHaveTextContent("Thursday, September 24, 2026");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(date()).toHaveValue("09/25/2026");
    expect(period()).toHaveTextContent("Friday, September 25, 2026");
    expect(screen.getByText("Night shift")).toBeVisible();
  });

  it("goes to today", async () => {
    const user = userEvent.setup();
    const setCurrentDate = vi.fn();
    const { rerender } = render(<Calendar initialDate={d(3)} />);

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(date()).toHaveValue("09/24/2026");

    // A controlled date is set by the parent
    rerender(
      <Calendar
        currentDate={new Date(2025, 0, 1)}
        setCurrentDate={setCurrentDate}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(setCurrentDate).toHaveBeenCalledWith(d(24, 12));
  });
});
