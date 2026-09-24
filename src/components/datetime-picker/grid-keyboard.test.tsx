import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import DateTimePicker from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

/** Lets the frames the popup schedules (focus, scrolling) run. */
const settle = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

/** Renders a picker and opens it from the keyboard - the focus goes in. */
async function openByKeyboard(
  props: React.ComponentProps<typeof DateTimePicker>,
) {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <DateTimePicker
      label="Pick"
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />,
  );

  act(() => screen.getByRole("combobox", { name: /Pick/ }).focus());
  await user.keyboard("{Enter}");
  await settle();
  return { onChange, user };
}

/** Presses keys and waits for the focus to follow. */
async function press(user: ReturnType<typeof userEvent.setup>, keys: string) {
  await user.keyboard(keys);
  await settle();
}

describe("Day grid with min and max", () => {
  it("never moves the focus onto a disabled day", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-09-10",
      max: "2026-09-12",
      min: "2026-09-08",
      type: "date",
    });

    const day = (date: number) =>
      screen.getByRole("button", { name: `September ${date}, 2026` });
    expect(day(10)).toHaveFocus();

    await press(user, "{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(day(8)).toHaveFocus();
    await press(user, "{ArrowUp}");
    expect(day(8)).toHaveFocus();
    await press(user, "{End}");
    expect(day(12)).toHaveFocus();
    await press(user, "{Home}");
    expect(day(8)).toHaveFocus();
    await press(user, "{PageDown}");
    expect(day(12)).toHaveFocus();
    expect(day(12)).toHaveAttribute("tabindex", "0");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-12");
  });

  it("keeps the tab stop on a day that can be picked", async () => {
    const user = userEvent.setup();
    render(
      <DateTimePicker
        defaultValue="2026-10-10"
        label="Pick"
        min="2026-09-15"
        type="date"
      />,
    );

    const input = screen.getByRole("combobox", { name: /Pick/ });
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Previous month" }));

    // The 10th is disabled - the 15th, the first day allowed, takes over
    expect(
      screen.getByRole("button", { name: "September 10, 2026" }),
    ).toHaveAttribute("tabindex", "-1");
    const first = screen.getByRole("button", { name: "September 15, 2026" });
    expect(first).toHaveAttribute("tabindex", "0");

    act(() => input.focus());
    await user.keyboard("{ArrowDown}");
    expect(first).toHaveFocus();
  });

  it("has a row for each week and marks the selected day", async () => {
    await openByKeyboard({ defaultValue: "2026-09-10", type: "date" });

    const grid = screen.getByRole("grid");
    const rows = within(grid).getAllByRole("row");
    // The weekday names and five weeks of September 2026 (Sunday first)
    expect(rows).toHaveLength(6);
    for (const row of rows.slice(1)) {
      expect(within(row).getAllByRole("gridcell")).toHaveLength(7);
    }

    const selected = within(grid)
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("10");
  });
});

describe("Month grid from the keyboard", () => {
  it("moves on into the next year and stops at min and max", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-03",
      max: "2027-01",
      min: "2026-02",
      type: "month",
    });

    const month = (name: string) => screen.getByRole("button", { name });
    expect(month("March 2026")).toHaveFocus();

    await press(user, "{ArrowLeft}{ArrowLeft}");
    expect(month("February 2026")).toHaveFocus();
    await press(user, "{ArrowUp}");
    expect(month("February 2026")).toHaveFocus();

    // December, then on into January of the next year
    await press(user, "{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
    expect(month("December 2026")).toHaveFocus();
    await press(user, "{ArrowRight}");
    expect(month("January 2027")).toHaveFocus();
    await press(user, "{ArrowDown}");
    expect(month("January 2027")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2027-01");
  });

  it("leaves the arrow keys of the year buttons alone", async () => {
    const { user } = await openByKeyboard({
      defaultValue: "2026-03",
      type: "month",
    });

    const nextYear = screen.getByRole("button", { name: "Next year" });
    act(() => nextYear.focus());
    await press(user, "{ArrowLeft}");
    expect(nextYear).toHaveFocus();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("puts the tab stop on an allowed month", async () => {
    const user = userEvent.setup();
    render(
      <DateTimePicker
        defaultValue="2026-03"
        label="Pick"
        min="2026-06"
        type="month"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Pick/ }));
    expect(screen.getByRole("button", { name: "March 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "June 2026" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(within(screen.getByRole("grid")).getAllByRole("row")).toHaveLength(
      4,
    );
  });
});

describe("Week grid from the keyboard", () => {
  it("moves over the new year and stops at min and max", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-W52",
      max: "2027-W02",
      min: "2026-W50",
      type: "week",
    });

    const week = (week: number, year: number) =>
      screen.getByRole("button", { name: `Week ${week}, ${year}` });
    expect(week(52, 2026)).toHaveFocus();

    // 2026 has 53 weeks
    await press(user, "{ArrowRight}");
    expect(week(53, 2026)).toHaveFocus();
    await press(user, "{ArrowRight}");
    expect(week(1, 2027)).toHaveFocus();
    await press(user, "{ArrowDown}");
    expect(week(2, 2027)).toHaveFocus();
    await press(user, "{ArrowUp}");
    expect(week(51, 2026)).toHaveFocus();
    await press(user, "{ArrowUp}");
    expect(week(50, 2026)).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-W50");
  });
});

describe("Keys stopped at min or max", () => {
  it("leave the focus on the year buttons of the month grid", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-02",
      min: "2026-02",
      type: "month",
    });

    expect(screen.getByRole("button", { name: "February 2026" })).toHaveFocus();
    // Stopped at min - nothing moves
    await press(user, "{ArrowLeft}");
    const nextYear = screen.getByRole("button", { name: "Next year" });
    act(() => nextYear.focus());
    await press(user, " ");
    expect(screen.getByText("2027")).toBeInTheDocument();
    expect(nextYear).toHaveFocus();
    await press(user, " ");
    expect(screen.getByText("2028")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leave the focus on the year buttons of the week grid", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-W50",
      min: "2026-W50",
      type: "week",
    });

    await press(user, "{ArrowLeft}");
    const nextYear = screen.getByRole("button", { name: "Next year" });
    act(() => nextYear.focus());
    await press(user, " ");
    expect(nextYear).toHaveFocus();
    await press(user, " ");
    expect(screen.getByText("2028")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leave the focus on the month buttons of the day grid", async () => {
    const { user } = await openByKeyboard({
      defaultValue: "2026-09-08",
      min: "2026-09-08",
      type: "date",
    });

    await press(user, "{ArrowLeft}");
    const nextMonth = screen.getByRole("button", { name: "Next month" });
    act(() => nextMonth.focus());
    await press(user, "{Enter}");
    expect(nextMonth).toHaveFocus();
  });
});

describe("Home, End, Page Up and Page Down", () => {
  it("move in the month grid like in the day grid", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-05",
      max: "2028-10",
      type: "month",
    });

    const month = (name: string) => screen.getByRole("button", { name });
    await press(user, "{Home}");
    expect(month("January 2026")).toHaveFocus();
    await press(user, "{End}");
    expect(month("December 2026")).toHaveFocus();
    await press(user, "{PageDown}");
    expect(month("December 2027")).toHaveFocus();
    // Stopped at max
    await press(user, "{PageDown}");
    expect(month("October 2028")).toHaveFocus();
    await press(user, "{Shift>}{PageUp}{/Shift}");
    expect(month("October 2018")).toHaveFocus();
    await press(user, "{PageUp}");
    expect(month("October 2017")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2017-10");
  });

  it("move in the week grid like in the day grid", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-W20",
      min: "2025-W10",
      type: "week",
    });

    const week = (week: number, year: number) =>
      screen.getByRole("button", { name: `Week ${week}, ${year}` });
    await press(user, "{Home}");
    expect(week(1, 2026)).toHaveFocus();
    // 2026 has 53 weeks
    await press(user, "{End}");
    expect(week(53, 2026)).toHaveFocus();
    // 2027 has 52
    await press(user, "{PageDown}");
    expect(week(52, 2027)).toHaveFocus();
    await press(user, "{PageUp}{PageUp}");
    expect(week(52, 2025)).toHaveFocus();
    await press(user, "{Home}");
    expect(week(10, 2025)).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2025-W10");
  });

  it("move in the time lists", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "10:30",
      max: "20:00",
      min: "07:00",
      type: "time",
    });

    expect(screen.getByRole("listbox", { name: "Hours" })).toHaveFocus();
    await press(user, "{Home}");
    expect(onChange).toHaveBeenLastCalledWith("07:30");
    await press(user, "{End}");
    expect(onChange).toHaveBeenLastCalledWith("20:00");
    await press(user, "{PageUp}");
    expect(onChange).toHaveBeenLastCalledWith("15:00");
    await press(user, "{PageUp}{PageUp}");
    // Stopped at the first allowed hour
    expect(onChange).toHaveBeenLastCalledWith("07:00");

    await user.tab();
    await press(user, "{End}");
    expect(onChange).toHaveBeenLastCalledWith("07:59");
    await press(user, "{PageUp}");
    expect(onChange).toHaveBeenLastCalledWith("07:54");
  });
});

describe("Typing and the popup", () => {
  it("takes the typed text when the focus moves on into the popup", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          label="Birth date"
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          type="date"
        />
        <input aria-label="Next field" />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Birth date/ });
    await user.type(input, "3.7.1985");
    await user.keyboard("{ArrowDown}");
    await settle();

    expect(onChange).toHaveBeenLastCalledWith("1985-07-03");
    // Still in the picker
    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue("03.07.1985");
  });
});

// Samoa went from Thursday, December 29, 2011 to Saturday, December 31
describe("Day grid where the time zone skips a day (Pacific/Apia)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Apia";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  it("shows the day as an empty cell and moves over it", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2011-12-31",
      type: "date",
    });

    const day = (date: number) =>
      screen.getByRole("button", { name: `December ${date}, 2011` });
    expect(
      screen.getAllByRole("button", { name: /^December 31/ }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "December 30, 2011" }),
    ).toBeNull();
    expect(day(31)).toHaveFocus();

    await press(user, "{ArrowLeft}");
    expect(day(29)).toHaveFocus();
    await press(user, "{ArrowRight}");
    expect(day(31)).toHaveFocus();

    await press(user, "{ArrowLeft}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2011-12-29");
  });
});
