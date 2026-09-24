import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import { expandRecurringEvents } from "./recurrence";
import { getVisibleRange } from "./date-utils";

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
