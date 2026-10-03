import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

/** Every Thursday 9:00 - 10:00 since September 3rd. */
const weekly: CalendarEvent = {
  end: d(3, 10),
  id: "weekly",
  recurrence: { freq: "weekly" },
  start: d(3, 9),
  title: "Weekly",
};

/** A press of the primary mouse button. */
const press = { clientX: 400, clientY: 100, isPrimary: true };

describe("Calendar recurring events", () => {
  it("shows the occurrences of the visible range in each view", async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        events={[weekly]}
        initialDate={d(24)}
        onEventClick={() => {}}
        viewOptions={["month", "week", "day"]}
      />,
    );

    // The Thursdays of the six weeks of the month view - from September 3rd
    // to October 8th
    expect(screen.getAllByRole("button", { name: /^Weekly,/ })).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(
      screen.getByRole("button", {
        name: /^Weekly, Thursday, September 24, 2026/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByTitle("Weekly")).toHaveLength(1);
  });

  it("hands a click the occurrence with its series", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[weekly]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
      />,
    );

    await user.click(screen.getByTitle("Weekly"));
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({
        end: d(24, 10),
        id: `weekly@${d(24, 9).toISOString()}`,
        occurrenceStart: d(24, 9),
        recurrence: { freq: "weekly" },
        recurringEventId: "weekly",
        start: d(24, 9),
      }),
    );
  });

  it("hands a drop the occurrence - the app moves it or the series", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[weekly]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    // A slot down
    fireEvent.pointerDown(screen.getByTitle("Weekly"), press);
    fireEvent.pointerMove(document, { buttons: 1, clientX: 400, clientY: 164 });
    fireEvent.pointerUp(document);

    expect(onEventDrop).toHaveBeenCalledWith({
      event: expect.objectContaining({
        occurrenceStart: d(24, 9),
        recurringEventId: "weekly",
      }),
      newEnd: d(24, 10, 30),
      newStart: d(24, 9, 30),
    });
  });

  it("leaves out the exdates and the occurrences the app edited", () => {
    render(
      <Calendar
        events={[
          { ...weekly, exdates: [d(10, 9)] },
          {
            ...weekly,
            end: d(18, 15),
            id: "moved",
            occurrenceStart: d(17, 9),
            recurringEventId: "weekly",
            start: d(18, 14),
            title: "Moved",
          },
        ]}
        initialDate={d(24)}
        onEventClick={() => {}}
      />,
    );

    const names = screen
      .getAllByRole("button", { name: /^(Weekly|Moved),/ })
      .map((button) => button.getAttribute("aria-label")?.split(", 2026")[0]);
    expect(names).toEqual([
      "Weekly, Thursday, September 3",
      "Moved, Friday, September 18",
      "Weekly, Thursday, September 24",
      "Weekly, Thursday, October 1",
      "Weekly, Thursday, October 8",
    ]);
  });
});
