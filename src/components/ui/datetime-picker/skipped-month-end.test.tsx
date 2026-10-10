import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import DateTimePicker from ".";
import RangeCalendar from "../range-calendar";

/** Lets the frames the popup schedules (focus, scrolling) run. */
const settle = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

// Kiritimati went from Friday, December 30, 1994 to Sunday, January 1 - the
// last day of the month skipped
describe("Day grid where the time zone skipped the last day of a month (Pacific/Kiritimati)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  const day = (name: string) => screen.getByRole("button", { name });

  /** Opens a date picker from the keyboard - the focus goes in. */
  async function open(defaultValue: string) {
    const user = userEvent.setup();
    render(
      <DateTimePicker defaultValue={defaultValue} label="Pick" type="date" />,
    );
    act(() => screen.getByRole("combobox", { name: /Pick/ }).focus());
    await user.keyboard("{Enter}");
    await settle();
    return user;
  }

  it("pages from the 31st to the last day of that month", async () => {
    const user = await open("1995-01-31");
    expect(day("January 31, 1995")).toHaveFocus();

    await user.keyboard("{PageUp}");
    await settle();
    expect(day("December 30, 1994")).toHaveFocus();
    await user.keyboard("{PageDown}");
    await settle();
    expect(day("January 30, 1995")).toHaveFocus();
  });

  it("keeps the day in the tab order on the last day of that month", async () => {
    const user = await open("1995-01-31");

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(day("December 30, 1994")).toHaveAttribute("tabindex", "0");
  });

  it("ends the band of a range on the last day of that month", () => {
    render(
      <RangeCalendar
        defaultValue={{ end: "1995-01-05", start: "1994-12-20" }}
        label="Stay"
      />,
    );

    // A Friday - not the end of a week
    expect(day("December 30, 1994").parentElement).toHaveClass("rounded-e");
    expect(day("December 29, 1994").parentElement).not.toHaveClass("rounded-e");
  });
});
