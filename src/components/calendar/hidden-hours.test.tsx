import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (title: string, start: Date, end: Date): CalendarEvent => ({
  end,
  id: title,
  start,
  title,
});

// With the hours 7 - 22 shown: two before them, one after, one in them
const events = [
  event("Early bird", d(24, 5), d(24, 6)),
  // From the evening before, over at 1:00
  event("Night shift", d(23, 22), d(24, 1)),
  event("Late show", d(24, 22, 30), d(24, 23, 30)),
  event("Standup", d(24, 9), d(24, 9, 15)),
];

describe("Calendar events out of the hours shown", () => {
  it.each(["week", "day"] as const)(
    "offers them in the header of their day (%s view)",
    async (view) => {
      const user = userEvent.setup();
      const onEventClick = vi.fn();
      render(
        <Calendar
          events={events}
          initialDate={d(24)}
          initialView={view}
          onEventClick={onEventClick}
        />,
      );

      // Not in the grid
      expect(screen.queryByText("Early bird")).not.toBeInTheDocument();
      expect(screen.queryByText("Late show")).not.toBeInTheDocument();

      const earlier = screen.getByRole("button", {
        name: "+2 earlier, Thursday, September 24, 2026",
      });
      await user.click(earlier);
      const list = screen.getByRole("dialog");
      expect(within(list).getByText("Early bird")).toBeVisible();
      expect(within(list).getByText("Night shift")).toBeVisible();
      await user.click(within(list).getByRole("button", { name: /^Early/ }));
      expect(onEventClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: "Early bird" }),
      );

      await user.click(
        screen.getByRole("button", {
          name: "+1 later, Thursday, September 24, 2026",
        }),
      );
      expect(
        within(screen.getByRole("dialog")).getByText("Late show"),
      ).toBeVisible();
    },
  );

  it("offers nothing when all the events are in the hours shown", () => {
    render(
      <Calendar
        dayEndHour={24}
        dayStartHour={0}
        events={events}
        initialDate={d(24)}
        initialView="week"
      />,
    );

    expect(screen.getByText("Early bird")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /earlier|later/ }),
    ).not.toBeInTheDocument();
  });

  it("offers them in the column of their resource", () => {
    render(
      <Calendar
        events={events.map((item) => ({ ...item, resourceId: "b" }))}
        initialDate={d(24)}
        initialView="day"
        resources={[
          { id: "a", title: "Room A" },
          { id: "b", title: "Room B" },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "+2 earlier, Room B, Thursday, September 24, 2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Room A/ }),
    ).not.toBeInTheDocument();
  });

  it("says how many in the language of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <Calendar
          events={[
            ...events,
            ...[1, 2, 3, 4].map((index) =>
              event(`Late ${index}`, d(24, 23), d(24, 23, 30)),
            ),
          ]}
          initialDate={d(24)}
          initialView="day"
        />
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: /^\+2 dřívější, čtvrtek/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^\+5 pozdějších, čtvrtek/ }),
    ).toBeInTheDocument();
  });
});

describe("Calendar today in the week view", () => {
  it("marks the day of today in the header", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d(24, 12));
    onTestFinished(() => {
      vi.useRealTimers();
    });

    render(
      <Calendar
        initialDate={d(22)}
        initialView="week"
        onDateClick={() => {}}
      />,
    );

    const today = screen.getByRole("button", {
      name: "Thursday, September 24, 2026",
    });
    expect(today).toHaveAttribute("aria-current", "date");
    expect(
      screen.getByRole("button", { name: "Tuesday, September 22, 2026" }),
    ).not.toHaveAttribute("aria-current");
  });
});

describe("Calendar month grid", () => {
  it("is a grid of the month with its weekdays and days", () => {
    render(<Calendar initialDate={d(24)} onDateClick={() => {}} />);

    const grid = screen.getByRole("grid", { name: "September 2026" });
    expect(within(grid).getAllByRole("row")).toHaveLength(7);
    expect(within(grid).getAllByRole("columnheader")[0]).toHaveAccessibleName(
      "Sunday",
    );
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
  });

  it("is a table without the day buttons", () => {
    render(<Calendar initialDate={d(24)} />);

    const table = screen.getByRole("table", { name: "September 2026" });
    expect(within(table).getAllByRole("cell")).toHaveLength(42);
  });

  it("goes to the same day of another month with Page Up / Down", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(<Calendar initialDate={d(24)} onDateClick={onDateClick} />);

    const day = (name: string) => screen.getByRole("button", { name });
    act(() => day("Thursday, September 24, 2026").focus());

    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(day("Saturday, October 24, 2026")).toHaveFocus();
    await user.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(day("Friday, October 24, 2025")).toHaveFocus();

    // The last day of a shorter month
    act(() => day("Friday, October 31, 2025").focus());
    await user.keyboard("{PageDown}");
    expect(day("Sunday, November 30, 2025")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onDateClick).toHaveBeenLastCalledWith(new Date(2025, 10, 30));
  });
});
