import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import { expandRecurringEvents } from "./recurrence";
import { daysBetween, getVisibleRange } from "./date-utils";

// Samoa went from Thursday, December 29, 2011 to Saturday, December 31 - the
// Friday between them has no hour
describe("Calendar where the time zone skips a day (Pacific/Apia)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Apia";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  /** A day of December 2011. */
  const d = (day: number, hours = 0) => new Date(2011, 11, day, hours);

  const dayName = (name: string) => ({ name: `${name}, 2011` });

  it("runs in a time zone without December 30, 2011", () => {
    expect(d(30).getDate()).toBe(31);
  });

  it("counts calendar days across the skipped day in both directions", () => {
    expect(daysBetween(d(29, 10), d(31, 11))).toBe(2);
    expect(daysBetween(d(31, 11), d(29, 10))).toBe(-2);
    expect(daysBetween(d(29), new Date(2012, 0, 1))).toBe(3);
  });

  it("leaves the day out of the month view - an empty cell", () => {
    render(<Calendar initialDate={d(15)} onDateClick={() => {}} />);

    const lastDay = screen.getByRole(
      "button",
      dayName("Saturday, December 31"),
    );
    expect(
      screen.queryByRole("button", dayName("Friday, December 30")),
    ).toBeNull();
    // Under its weekday, after the empty cell of the Friday
    const cell = lastDay.closest(".date-cell") as HTMLElement;
    const week = Array.from(cell.parentElement!.children);
    expect(week.indexOf(cell)).toBe(6);
    expect(week[5]).toBeEmptyDOMElement();
    expect(week[4]).toHaveTextContent("29");
  });

  it("moves the focus over the day with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={d(31)} onDateClick={() => {}} />);

    const thursday = screen.getByRole(
      "button",
      dayName("Thursday, December 29"),
    );
    const saturday = screen.getByRole(
      "button",
      dayName("Saturday, December 31"),
    );
    act(() => saturday.focus());
    await user.keyboard("{ArrowLeft}");
    expect(thursday).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(saturday).toHaveFocus();
  });

  it("goes back over the day in the day view", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={d(31, 10)} initialView="day" />);

    const field = screen.getByRole("combobox", { name: "Go to date" });
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(field).toHaveValue("12/29/2011");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(field).toHaveValue("12/31/2011");
  });

  it("gives the week six columns and moves an event over the day", () => {
    // jsdom has no layout - 100px per day column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
    const onEventDrop = vi.fn();
    const { container } = render(
      <Calendar
        events={[{ end: d(31, 11), id: "a", start: d(31, 10), title: "Visit" }]}
        initialDate={d(28)}
        initialView="week"
        onDateClick={() => {}}
        onEventDrop={onEventDrop}
      />,
    );

    expect(container.querySelectorAll(".day-column")).toHaveLength(6);
    expect(
      screen.getAllByRole("button", { name: /December (29|31), 2011$/ }),
    ).toHaveLength(2);

    // One column to the left - to Thursday
    const tile = screen.getByTitle("Visit");
    fireEvent.pointerDown(tile, {
      clientX: 550,
      clientY: 100,
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { buttons: 1, clientX: 450, clientY: 100 });
    fireEvent.pointerUp(document);
    expect(onEventDrop).toHaveBeenCalledWith(
      expect.objectContaining({ newEnd: d(29, 11), newStart: d(29, 10) }),
    );
  });

  it.each([
    [31, 29, -200, 0],
    [29, 32, -400, 128],
  ])(
    "moves a month event from day %i to day %i across the skipped day",
    (from, to, deltaX, deltaY) => {
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        700,
      );
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        768,
      );
      const onEventDrop = vi.fn();
      render(
        <Calendar
          events={[
            { end: d(from, 11), id: "a", start: d(from, 10), title: "Visit" },
          ]}
          initialDate={d(28)}
          onEventDrop={onEventDrop}
        />,
      );

      const tile = screen.getByText("Visit").closest(".group\\/event")!;
      fireEvent.pointerDown(tile, {
        clientX: 500,
        clientY: 100,
        isPrimary: true,
      });
      fireEvent.pointerMove(document, {
        buttons: 1,
        clientX: 500 + deltaX,
        clientY: 100 + deltaY,
      });
      fireEvent.pointerUp(document);
      expect(onEventDrop).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ newEnd: d(to, 11), newStart: d(to, 10) }),
      );
    },
  );

  it("lists every day of the agenda once", () => {
    const events: CalendarEvent[] = [
      { end: d(29, 10), id: "a", start: d(29, 9), title: "Thursday" },
      { end: d(31, 10), id: "b", start: d(31, 9), title: "Saturday" },
    ];
    render(
      <Calendar
        agendaPeriod="week"
        events={events}
        initialDate={d(28)}
        initialView="agenda"
      />,
    );

    const days = screen.getAllByRole("heading", { level: 3 });
    expect(days.map((day) => day.textContent)).toEqual([
      "Thursday, December 29, 2011",
      "Saturday, December 31, 2011",
    ]);
    expect(
      within(days[1].closest("li")!).getAllByRole("listitem"),
    ).toHaveLength(1);
  });

  it("ends the visible week after its six days", () => {
    expect(getVisibleRange(d(31), "week", 5)).toEqual({
      end: new Date(2012, 0, 6),
      // The Friday of the week has no midnight - it starts with the Saturday
      start: d(31),
    });
  });

  it("repeats an event on no day the time zone skips", () => {
    const expand = (recurrence: string, start = d(28, 9)) =>
      expandRecurringEvents(
        [
          {
            end: new Date(start.getTime() + 3_600_000),
            id: "series",
            recurrence,
            start,
            title: "Series",
          },
        ],
        { end: new Date(2012, 1, 1), start: new Date(2011, 10, 1) },
      ).map(({ start }) => start.getDate());

    // COUNT is not used up by it either
    expect(expand("FREQ=DAILY;COUNT=5")).toEqual([28, 29, 31, 1, 2]);
    expect(expand("FREQ=WEEKLY;BYDAY=TH,FR,SA;COUNT=5")).toEqual([
      28, 29, 31, 5, 6,
    ]);
    // The 30th of November and of January - none in December, nor February
    expect(expand("FREQ=MONTHLY;COUNT=3", new Date(2011, 10, 30, 9))).toEqual([
      30, 30,
    ]);
    expect(expand("FREQ=MONTHLY;BYMONTHDAY=30;COUNT=2")).toEqual([28, 30]);

    const ids = expandRecurringEvents(
      [
        {
          end: d(28, 10),
          id: "series",
          recurrence: "FREQ=DAILY",
          start: d(28, 9),
          title: "Series",
        },
      ],
      { end: new Date(2012, 0, 8), start: d(25) },
    ).map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Kiritimati went from Friday, December 30, 1994 to Sunday, January 1 - the
// last day of the month skipped
describe("Calendar where the time zone skipped the last day of a month (Pacific/Kiritimati)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  it("goes a month on to the same day - or the last one of that month", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Calendar initialDate={new Date(1994, 10, 30, 10)} />,
    );

    const field = screen.getByRole("combobox", { name: "Go to date" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(field).toHaveValue("12/30/1994");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(field).toHaveValue("01/30/1995");
    unmount();

    render(<Calendar initialDate={new Date(1995, 0, 15, 10)} />);
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("combobox", { name: "Go to date" })).toHaveValue(
      "12/15/1994",
    );
  });

  it("repeats an event on the last day the month has", () => {
    const expand = (recurrence: string) =>
      expandRecurringEvents(
        [
          {
            end: new Date(1994, 9, 28, 11),
            id: "series",
            recurrence,
            start: new Date(1994, 9, 28, 10),
            title: "Series",
          },
        ],
        { end: new Date(1995, 2, 1), start: new Date(1994, 9, 1) },
      ).map(({ start }) => `${start.getMonth() + 1}/${start.getDate()}`);

    // After the event itself
    expect(expand("FREQ=MONTHLY;BYMONTHDAY=-1")).toEqual([
      "10/28",
      "10/31",
      "11/30",
      "12/30",
      "1/31",
      "2/28",
    ]);
    // Counting back from it
    expect(expand("FREQ=MONTHLY;BYMONTHDAY=-2;COUNT=4")).toEqual([
      "10/28",
      "10/30",
      "11/29",
      "12/29",
    ]);
    expect(expand("FREQ=DAILY;BYMONTHDAY=-1;COUNT=4")).toEqual([
      "10/28",
      "10/31",
      "11/30",
      "12/30",
    ]);
  });

  it("pages from the 31st to the last day of that month", async () => {
    const user = userEvent.setup();
    render(
      <Calendar initialDate={new Date(1995, 0, 31)} onDateClick={() => {}} />,
    );

    act(() =>
      screen.getByRole("button", { name: "Tuesday, January 31, 1995" }).focus(),
    );
    await user.keyboard("{PageUp}");
    expect(screen.getByRole("grid", { name: "December 1994" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Friday, December 30, 1994" }),
    ).toHaveFocus();
  });
});
