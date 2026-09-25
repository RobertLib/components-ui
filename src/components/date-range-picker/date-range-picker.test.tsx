import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DateRangePicker, { type DateRange, type DateRangePickerProps } from ".";
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

// Today is Thursday, September 24, 2026 - only `Date` is faked, the timers
// of the popup and of user-event run
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24, 12));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const september: DateRange = { end: "2026-09-30", start: "2026-09-01" };

function renderPicker(props: DateRangePickerProps = {}) {
  const onChange = vi.fn();
  render(
    <>
      <DateRangePicker label="Period" onChange={onChange} {...props} />
      <input aria-label="Next field" />
    </>,
  );
  return {
    input: screen.getByRole<HTMLInputElement>("combobox", { name: /Period/ }),
    onChange,
    user: userEvent.setup(),
  };
}

/** Renders a picker and opens it from the keyboard - the focus goes in. */
async function openByKeyboard(props: DateRangePickerProps = {}) {
  const rendered = renderPicker(props);
  act(() => rendered.input.focus());
  await rendered.user.keyboard("{Enter}");
  await settle();
  return rendered;
}

/** Presses keys and waits for the focus to follow. */
async function press(user: ReturnType<typeof userEvent.setup>, keys: string) {
  await user.keyboard(keys);
  await settle();
}

const day = (name: string) => screen.getByRole("button", { name });

/** Whether the grid shows the day as part of the range. */
const isInRange = (name: string) =>
  day(name).closest("[role=gridcell]")?.getAttribute("aria-selected") ===
  "true";

describe("DateRangePicker with the mouse", () => {
  it("picks the first day, then the last, and closes", async () => {
    const { input, onChange, user } = renderPicker();

    await user.click(input);
    expect(screen.getByRole("dialog", { name: "Select date range" }));
    expect(screen.getByText("Select the first day")).toBeInTheDocument();

    await user.click(day("September 24, 2026"));
    expect(onChange).not.toHaveBeenCalled();
    expect(isInRange("September 24, 2026")).toBe(true);
    expect(screen.getByText("Select the last day")).toBeInTheDocument();

    await user.click(day("September 30, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-30",
      start: "2026-09-24",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("09/24/2026 – 09/30/2026");
    // A click in the popup keeps the focus in the field
    expect(input).toHaveFocus();
  });

  it("swaps a pair picked backwards", async () => {
    const { input, onChange, user } = renderPicker();

    await user.click(input);
    await user.click(day("September 30, 2026"));
    await user.click(day("September 24, 2026"));

    expect(onChange).toHaveBeenCalledWith({
      end: "2026-09-30",
      start: "2026-09-24",
    });
  });

  it("previews the range to the day under the pointer and counts its days", async () => {
    const { input, user } = renderPicker();

    await user.click(input);
    await user.click(day("September 24, 2026"));
    await user.hover(day("September 27, 2026"));

    expect(isInRange("September 23, 2026")).toBe(false);
    expect(isInRange("September 24, 2026")).toBe(true);
    expect(isInRange("September 26, 2026")).toBe(true);
    expect(isInRange("September 27, 2026")).toBe(true);
    expect(isInRange("September 28, 2026")).toBe(false);
    expect(screen.getByText("4 days")).toBeInTheDocument();

    // Backwards too
    await user.hover(day("September 20, 2026"));
    expect(isInRange("September 20, 2026")).toBe(true);
    expect(isInRange("September 27, 2026")).toBe(false);
    expect(screen.getByText("5 days")).toBeInTheDocument();
  });

  it("goes on from the picked day with the keyboard", async () => {
    const { input, onChange, user } = renderPicker({ defaultValue: september });

    await user.click(input);
    await user.click(day("September 10, 2026"));
    // ArrowDown moves from the field into the calendar - at the picked day
    await press(user, "{ArrowDown}");
    expect(day("September 10, 2026")).toHaveFocus();
    await press(user, "{ArrowRight}");
    await press(user, "{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      end: "2026-09-11",
      start: "2026-09-10",
    });
  });

  it("picks one day with two clicks on it", async () => {
    const { input, onChange, user } = renderPicker();

    await user.click(input);
    await user.click(day("September 24, 2026"));
    await user.click(day("September 24, 2026"));

    expect(onChange).toHaveBeenCalledWith({
      end: "2026-09-24",
      start: "2026-09-24",
    });
    expect(input).toHaveValue("09/24/2026 – 09/24/2026");
  });

  it("shows the selected range when it opens", async () => {
    const { input, user } = renderPicker({
      defaultValue: { end: "2026-10-02", start: "2026-09-28" },
    });

    await user.click(input);
    expect(isInRange("September 27, 2026")).toBe(false);
    expect(isInRange("September 28, 2026")).toBe(true);
    expect(isInRange("October 2, 2026")).toBe(true);
    expect(isInRange("October 3, 2026")).toBe(false);
    expect(screen.getByText("5 days")).toBeInTheDocument();
  });
});

describe("DateRangePicker from the keyboard", () => {
  it("picks with Enter and moves on into the second month", async () => {
    const { input, onChange, user } = await openByKeyboard();

    expect(day("September 24, 2026")).toHaveFocus();
    await press(user, "{Enter}");
    expect(screen.getByText("Select the last day")).toBeInTheDocument();

    await press(user, "{ArrowDown}");
    const [, october] = screen.getAllByRole("grid");
    expect(
      within(october).getByRole("button", { name: "October 1, 2026" }),
    ).toHaveFocus();
    // The range follows the focus
    expect(isInRange("September 28, 2026")).toBe(true);
    expect(isInRange("October 1, 2026")).toBe(true);

    await press(user, "{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      end: "2026-10-01",
      start: "2026-09-24",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("moves the months as the focus leaves them", async () => {
    const { user } = await openByKeyboard({ defaultValue: september });

    const shownMonths = () =>
      screen
        .getAllByRole("grid")
        .map((grid) => grid.getAttribute("aria-label"));
    expect(day("September 1, 2026")).toHaveFocus();
    expect(shownMonths()).toEqual(["September 2026", "October 2026"]);

    await press(user, "{PageDown}");
    expect(day("October 1, 2026")).toHaveFocus();
    expect(shownMonths()).toEqual(["September 2026", "October 2026"]);

    // Past the second month - it becomes the first
    await press(user, "{PageDown}");
    expect(day("November 1, 2026")).toHaveFocus();
    expect(shownMonths()).toEqual(["October 2026", "November 2026"]);

    await press(user, "{ArrowLeft}");
    expect(day("October 31, 2026")).toHaveFocus();
    expect(shownMonths()).toEqual(["October 2026", "November 2026"]);

    // The same date of a shorter month is its last day
    await press(user, "{PageUp}");
    expect(day("September 30, 2026")).toHaveFocus();
    await press(user, "{PageUp}");
    expect(day("August 30, 2026")).toHaveFocus();
    expect(shownMonths()).toEqual(["August 2026", "September 2026"]);
  });

  it("pages both months with the month buttons", async () => {
    const { input, user } = renderPicker({ defaultValue: september });

    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen
        .getAllByRole("grid")
        .map((grid) => grid.getAttribute("aria-label")),
    ).toEqual(["October 2026", "November 2026"]);
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveDisplayValue(
      "October",
    );
    // One tab stop in both months
    const tabStops = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("tabindex") === "0");
    expect(tabStops).toHaveLength(1);
  });

  it("moves over the days that cannot end the range, and picks none of them", async () => {
    const { onChange, user } = await openByKeyboard({ minDays: 3 });

    await press(user, "{Enter}");
    await press(user, "{ArrowRight}");
    const tooNear = day("September 25, 2026");
    expect(tooNear).toHaveFocus();
    expect(tooNear).toHaveAttribute("aria-disabled", "true");
    expect(tooNear).toBeEnabled();

    await press(user, "{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await press(user, "{ArrowRight}");
    await press(user, "{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      end: "2026-09-26",
      start: "2026-09-24",
    });
  });

  it("drops a half picked range on Escape", async () => {
    const { input, onChange, user } = await openByKeyboard();

    await press(user, "{Enter}");
    await press(user, "{ArrowRight}");
    await press(user, "{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveFocus();

    await press(user, "{Enter}");
    expect(screen.getByText("Select the first day")).toBeInTheDocument();
    expect(isInRange("September 24, 2026")).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves on with Tab from the end of the popup and reports one blur", async () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const { user } = await openByKeyboard({ onBlur, onFocus, presets: true });

    // Back through the calendar and the presets to the field
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Next month" })).toHaveFocus();

    act(() => day("September 24, 2026").focus());
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Next field" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("DateRangePicker months", () => {
  it("shows two months side by side, from the month of the range", async () => {
    const { input, user } = renderPicker({
      defaultValue: { end: "2027-01-05", start: "2026-12-28" },
    });

    await user.click(input);
    expect(
      screen
        .getAllByRole("grid")
        .map((grid) => grid.getAttribute("aria-label")),
    ).toEqual(["December 2026", "January 2027"]);
    expect(isInRange("December 31, 2026")).toBe(true);
    expect(isInRange("January 5, 2027")).toBe(true);
  });

  it("shows the month before when the next one has no day to pick", async () => {
    const { input, user } = renderPicker({ max: "2026-09-24" });

    await user.click(input);
    expect(
      screen
        .getAllByRole("grid")
        .map((grid) => grid.getAttribute("aria-label")),
    ).toEqual(["August 2026", "September 2026"]);
    expect(day("September 25, 2026")).toBeDisabled();
  });

  it("shows one month on phones, with the presets above it", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: () => {},
        matches: true,
        media: query,
        removeEventListener: () => {},
      })),
    );
    const { input, user } = renderPicker({ presets: true });

    await user.click(input);
    const grids = screen.getAllByRole("grid");
    expect(grids).toHaveLength(1);
    expect(grids[0]).toHaveAccessibleName("September 2026");
    const presets = screen.getByRole("group", { name: "Presets" });
    expect(
      presets.compareDocumentPosition(grids[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No keyboard of the phone over the calendar
    expect(input).toHaveAttribute("inputmode", "none");
  });

  it("starts the week on the first day of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DateRangePicker label="Období" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("combobox", { name: /Období/ }));
    for (const grid of screen.getAllByRole("grid")) {
      expect(within(grid).getAllByRole("columnheader")[0]).toHaveAccessibleName(
        "Pondělí",
      );
    }
  });
});

describe("DateRangePicker typing", () => {
  const renderCzech = (props: DateRangePickerProps = {}) => {
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateRangePicker label="Období" onChange={onChange} {...props} />
        <input aria-label="Další pole" />
      </UIProvider>,
    );
    return {
      input: screen.getByRole("combobox", { name: /Období/ }),
      onChange,
      user: userEvent.setup(),
    };
  };

  it("takes a range typed in the date format of the locale", async () => {
    const { input, onChange, user } = renderCzech();

    expect(input).toHaveAttribute("placeholder", "DD.MM.RRRR – DD.MM.RRRR");
    await user.type(input, "1.9.2026 – 30.9.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(september);
    expect(input).toHaveValue("01.09.2026 – 30.09.2026");

    // Also on leaving the field
    await user.clear(input);
    await user.type(input, "5.10.2026 - 9.10.2026");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2026-10-09",
      start: "2026-10-05",
    });
  });

  it("takes the days typed without their year or with two digits of it", async () => {
    const { input, onChange, user } = renderCzech();

    // Of this year - today is in 2026
    await user.type(input, "1.9. – 30.9.{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(september);
    expect(input).toHaveValue("01.09.2026 – 30.09.2026");

    await user.clear(input);
    await user.type(input, "1.10.25 - 5.10.25{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2025-10-05",
      start: "2025-10-01",
    });
  });

  it("swaps a reversed pair, and takes one day as a range of it", async () => {
    const { input, onChange, user } = renderCzech();

    await user.type(input, "30.9.2026 1.9.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(september);

    await user.clear(input);
    await user.type(input, "15.9.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2026-09-15",
      start: "2026-09-15",
    });
    expect(input).toHaveValue("15.09.2026 – 15.09.2026");
  });

  it("drops a text that is no allowed range", async () => {
    const { input, onChange, user } = renderCzech({
      defaultValue: september,
      max: "2026-12-31",
      maxDays: 31,
    });

    for (const text of [
      "31.2.2026 – 5.3.2026",
      "1.12.2026 – 5.1.2027",
      "1.9.2026 – 31.10.2026",
      "next week",
    ]) {
      await user.clear(input);
      await user.type(input, `${text}{Enter}`);
      expect(input).toHaveValue("01.09.2026 – 30.09.2026");
    }
    expect(onChange).not.toHaveBeenCalled();

    // An emptied field clears the range
    await user.clear(input);
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("says why a typed range was dropped", async () => {
    const { input, user } = renderCzech({
      defaultValue: september,
      maxDays: 31,
    });

    await user.clear(input);
    await user.type(input, "next week{Enter}");
    expect(input).toHaveValue("01.09.2026 – 30.09.2026");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "„next week“ není platná hodnota. Použijte formát DD.MM.RRRR – DD.MM.RRRR.",
    );

    await user.clear(input);
    await user.type(input, "1.9.2026 – 31.10.2026{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "„1.9.2026 – 31.10.2026“ je mimo povolený rozsah.",
    );
  });

  it("takes a range over the new year typed without its years", async () => {
    const { input, onChange, user } = renderCzech();

    await user.type(input, "28.12. – 3.1.{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2027-01-03",
      start: "2026-12-28",
    });
    expect(input).toHaveValue("28.12.2026 – 03.01.2027");
  });

  it("opens the calendar on a typed range", async () => {
    const { input, onChange, user } = renderCzech();

    await user.type(input, "3.2.2025 – 6.2.2025{ArrowDown}");
    await settle();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(day("3. února 2025")).toHaveFocus();
    expect(isInRange("6. února 2025")).toBe(true);
    expect(screen.getByText("4 dny")).toBeInTheDocument();
  });
});

describe("DateRangePicker presets", () => {
  it("offers the default presets and picks one", async () => {
    const { input, onChange, user } = renderPicker({ presets: true });

    await user.click(input);
    const presets = screen.getByRole("group", { name: "Presets" });
    expect(
      within(presets)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "Today",
      "Yesterday",
      "Last 7 days",
      "Last 30 days",
      "This month",
      "Last month",
    ]);

    await user.click(
      within(presets).getByRole("button", { name: "Last 7 days" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      end: "2026-09-24",
      start: "2026-09-18",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("09/18/2026 – 09/24/2026");

    // The preset of the selected range is marked
    await user.click(input);
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("picks a preset from the keyboard", async () => {
    const { input, onChange, user } = await openByKeyboard({
      presets: ["lastMonth", "thisYear"],
    });

    act(() => screen.getByRole("button", { name: "Last month" }).focus());
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      end: "2026-08-31",
      start: "2026-08-01",
    });
    expect(input).toHaveFocus();
  });

  it("cuts presets to min and max", async () => {
    const { input, onChange, user } = renderPicker({
      max: "2026-09-24",
      presets: [
        "thisMonth",
        { label: "Q3 2026", range: { end: "2026-09-30", start: "2026-07-01" } },
      ],
    });

    await user.click(input);
    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2026-09-24",
      start: "2026-09-01",
    });

    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Q3 2026" }));
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2026-09-24",
      start: "2026-07-01",
    });
  });

  it("disables the presets with no day to pick or of a length not allowed", async () => {
    const { input, user } = renderPicker({
      maxDays: 7,
      min: "2026-09-01",
      presets: ["today", "last7Days", "last30Days", "lastMonth"],
    });

    await user.click(input);
    expect(screen.getByRole("button", { name: "Today" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeEnabled();
    // September 1 - 24 is too long, August before min
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last month" })).toBeDisabled();
  });

  it("is labeled in the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DateRangePicker
          defaultValue={{ end: "2026-09-30", start: "2026-09-24" }}
          label="Období"
          presets={["last7Days", "thisWeek"]}
        />
      </UIProvider>,
    );

    await user.click(screen.getByRole("combobox", { name: /Období/ }));
    const presets = screen.getByRole("group", { name: "Rychlý výběr" });
    expect(within(presets).getAllByRole("button")[0]).toHaveTextContent(
      "Posledních 7 dní",
    );
    expect(screen.getByText("Vyberte první den")).toBeInTheDocument();
    expect(screen.getByText("7 dní")).toBeInTheDocument();

    // The week of the locale starts on Monday
    await user.click(screen.getByRole("button", { name: "Tento týden" }));
    expect(screen.getByRole("combobox", { name: /Období/ })).toHaveValue(
      "21.09.2026 – 27.09.2026",
    );
  });
});

describe("DateRangePicker limits", () => {
  it("disables the days out of min and max", async () => {
    const { input, user } = renderPicker({
      max: "2026-09-20",
      min: "2026-09-10",
    });

    await user.click(input);
    expect(day("September 9, 2026")).toBeDisabled();
    expect(day("September 10, 2026")).toBeEnabled();
    expect(day("September 20, 2026")).toBeEnabled();
    expect(day("September 21, 2026")).toBeDisabled();
  });

  it("lets only ranges of minDays to maxDays end on a day", async () => {
    const { input, onChange, user } = renderPicker({ maxDays: 7, minDays: 3 });

    await user.click(input);
    // Before the first pick, any day can start a range
    expect(day("September 11, 2026")).not.toHaveAttribute("aria-disabled");
    await user.click(day("September 10, 2026"));

    const unavailable = (name: string) =>
      day(name).getAttribute("aria-disabled") === "true";
    expect(unavailable("September 3, 2026")).toBe(true);
    expect(unavailable("September 4, 2026")).toBe(false);
    expect(unavailable("September 11, 2026")).toBe(true);
    expect(unavailable("September 12, 2026")).toBe(false);
    expect(unavailable("September 16, 2026")).toBe(false);
    expect(unavailable("September 17, 2026")).toBe(true);

    // No preview to a day that cannot end the range, and no pick
    await user.hover(day("September 20, 2026"));
    expect(isInRange("September 12, 2026")).toBe(false);
    await user.click(day("September 20, 2026"));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(day("September 14, 2026"));
    expect(onChange).toHaveBeenCalledWith({
      end: "2026-09-14",
      start: "2026-09-10",
    });
  });
});

describe("DateRangePicker in forms", () => {
  it("submits the days by startName and endName, the interval by name", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DateRangePicker
          defaultValue={september}
          endName="to"
          label="Period"
          name="period"
          startName="from"
        />
        <button type="reset">Reset</button>
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Report" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      from: "2026-09-01",
      period: "2026-09-01/2026-09-30",
      to: "2026-09-30",
    });

    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(Object.fromEntries(new FormData(form))).toEqual({
      from: "",
      period: "",
      to: "",
    });

    // The reset brings the default back
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(new FormData(form).get("from")).toBe("2026-09-01");
    expect(screen.getByRole("combobox", { name: /Period/ })).toHaveValue(
      "09/01/2026 – 09/30/2026",
    );
  });

  it("neither submits nor validates a disabled picker", () => {
    render(
      <form aria-label="Report">
        <DateRangePicker
          defaultValue={september}
          disabled
          endName="to"
          name="period"
          required
          startName="from"
        />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Report" });
    expect([...new FormData(form).keys()]).toEqual([]);
    expect(form.checkValidity()).toBe(true);
  });

  it("is validated by the browser when required", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DateRangePicker label="Period" required startName="from" />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Report" });
    const input = screen.getByRole("combobox", { name: "Period:" });
    expect(input).toBeRequired();
    expect(form.checkValidity()).toBe(false);

    await user.type(input, "09/01/2026 – 09/30/2026{Enter}");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("from")).toBe("2026-09-01");
    // Required - no clear button
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();
  });

  it("belongs to the form of its form attribute, and is reset with it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <form aria-label="Filters" id="filters">
          <button type="reset">Reset</button>
        </form>
        <DateRangePicker
          defaultValue={september}
          endName="to"
          form="filters"
          label="Period"
          startName="from"
        />
      </>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Filters" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });

    const input = screen.getByRole("combobox", { name: /Period/ });
    await user.clear(input);
    await user.type(input, "10/01/2026 – 10/02/2026{Enter}");
    expect(new FormData(form).get("to")).toBe("2026-10-02");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("09/01/2026 – 09/30/2026");
  });

  it("keeps a controlled range on a reset", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <DateRangePicker label="Period" onChange={() => {}} value={september} />
        <button type="reset">Reset</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("combobox", { name: /Period/ })).toHaveValue(
      "09/01/2026 – 09/30/2026",
    );
  });
});

describe("DateRangePicker states", () => {
  it("shows the range of the parent", async () => {
    function Report() {
      const [period, setPeriod] = useState<DateRange | null>(september);
      return (
        <>
          <DateRangePicker label="Period" onChange={setPeriod} value={period} />
          <output>{period ? `${period.start} / ${period.end}` : "none"}</output>
          <button onClick={() => setPeriod(null)} type="button">
            Reset period
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Report />);

    const input = screen.getByRole("combobox", { name: /Period/ });
    await user.clear(input);
    await user.type(input, "10/05/2026 – 10/09/2026{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "2026-10-05 / 2026-10-09",
    );

    await user.click(screen.getByRole("button", { name: "Reset period" }));
    expect(input).toHaveValue("");
  });

  it("keeps showing a range the parent does not change", async () => {
    const { input, onChange, user } = renderPicker({
      onChange: () => {},
      value: september,
    });

    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("09/01/2026 – 09/30/2026");
  });

  it("clears the range with its button and keeps the focus in the field", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: september,
    });

    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no clear button with clearable={false}", () => {
    renderPicker({ clearable: false, defaultValue: september });
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();
  });

  it("shows and submits a read-only range, but does not open", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DateRangePicker
          defaultValue={september}
          label="Period"
          name="period"
          readOnly
        />
      </form>,
    );

    const input = screen.getByRole("combobox", { name: /Period/ });
    await user.click(input);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();
    expect(
      new FormData(screen.getByRole("form", { name: "Report" })).get("period"),
    ).toBe("2026-09-01/2026-09-30");
  });

  it("is described by its error, its description and the caller's description", () => {
    render(
      <>
        <DateRangePicker
          aria-describedby="hint"
          description="At most one year"
          error="Select a period"
          label="Period"
        />
        <p id="hint">The report counts whole days</p>
      </>,
    );

    const input = screen.getByRole("combobox", { name: /Period/ });
    expect(input).toHaveAccessibleDescription(
      "Select a period At most one year The report counts whole days",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    // Under the field, above the error
    const description = screen.getByText("At most one year");
    expect(
      input.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      description.compareDocumentPosition(screen.getByRole("alert")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("names a field without a label, and its popup", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker />);

    const input = screen.getByRole("combobox", { name: "Select date range" });
    expect(input).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(input);
    const dialog = screen.getByRole("dialog", { name: "Select date range" });
    expect(input).toHaveAttribute("aria-controls", dialog.id);
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("points its ref at the field and passes native attributes to it", () => {
    const ref = createRef<HTMLInputElement>();
    renderPicker({
      "data-testid": "period",
      defaultValue: september,
      ref,
      title: "Report period",
    } as DateRangePickerProps);

    const input = screen.getByRole("combobox", { name: /Period/ });
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute("data-testid", "period");
    expect(input).toHaveAttribute("title", "Report period");
    expect(ref.current?.value).toBe("09/01/2026 – 09/30/2026");
  });

  it("closes its popup when it becomes disabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DateRangePicker label="Period" />);

    await user.click(screen.getByRole("combobox", { name: /Period/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<DateRangePicker disabled label="Period" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Period/ })).toBeDisabled();
  });
});
