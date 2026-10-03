import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DateRangePicker, { type DateRangePickerProps } from ".";
import { cs } from "../../../i18n/cs";
import UIProvider from "../../../providers/ui-provider";

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
});

// Booked: September 18 and September 29, 2026
const booked = new Set(["2026-09-18", "2026-09-29"]);
const isBooked = (day: Date) =>
  booked.has(
    `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
  );
const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;

function renderPicker(props: DateRangePickerProps = {}) {
  const onChange = vi.fn();
  render(<DateRangePicker label="Stay" onChange={onChange} {...props} />);
  return {
    input: screen.getByRole<HTMLInputElement>("combobox", { name: /Stay/ }),
    onChange,
    user: userEvent.setup(),
  };
}

const day = (name: string) => screen.getByRole("button", { name });

/** Whether the grid shows the day as part of the range. */
const isInRange = (name: string) =>
  day(name).closest("[role=gridcell]")?.getAttribute("aria-selected") ===
  "true";

describe("DateRangePicker isDateDisabled", () => {
  it("does not start a range on a disabled day", async () => {
    const { input, onChange, user } = renderPicker({
      isDateDisabled: isBooked,
    });

    await user.click(input);
    const disabledDay = day("September 18, 2026");
    expect(disabledDay).toHaveAttribute("aria-disabled", "true");
    expect(disabledDay).toHaveClass("line-through");

    await user.click(disabledDay);
    expect(screen.getByText("Select the first day")).toBeInTheDocument();
    await user.click(day("September 20, 2026"));
    expect(screen.getByText("Select the last day")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops a range before the nearest disabled day on either side", async () => {
    const { input, onChange, user } = renderPicker({
      isDateDisabled: isBooked,
    });

    await user.click(input);
    await user.click(day("September 24, 2026"));

    // Up to the day before a booked one - not past it
    for (const name of [
      "September 19, 2026",
      "September 28, 2026",
      "September 22, 2026",
    ]) {
      expect(day(name)).not.toHaveAttribute("aria-disabled");
    }
    for (const name of ["September 17, 2026", "September 30, 2026"]) {
      expect(day(name)).toHaveAttribute("aria-disabled", "true");
      // Not struck through - only the range being picked cannot reach it
      expect(day(name)).not.toHaveClass("line-through");
    }

    // The preview stops too
    await user.hover(day("September 30, 2026"));
    expect(isInRange("September 25, 2026")).toBe(false);
    expect(isInRange("September 24, 2026")).toBe(true);

    await user.click(day("September 30, 2026"));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(day("September 28, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-28",
      start: "2026-09-24",
    });
  });

  it("goes over disabled days with allowDisabledInRange, but never ends on one", async () => {
    const { input, onChange, user } = renderPicker({
      allowDisabledInRange: true,
      isDateDisabled: isWeekend,
    });

    await user.click(input);
    await user.click(day("September 24, 2026"));
    // A weekend day cannot end it
    await user.click(day("September 27, 2026"));
    expect(onChange).not.toHaveBeenCalled();
    expect(day("October 2, 2026")).not.toHaveAttribute("aria-disabled");

    await user.click(day("September 29, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-29",
      start: "2026-09-24",
    });
  });

  it("moves the keys over disabled days, which Enter does not pick", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: { end: "2026-09-17", start: "2026-09-17" },
      isDateDisabled: isBooked,
    });

    act(() => input.focus());
    await user.keyboard("{Enter}");
    await settle();
    expect(day("September 17, 2026")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(day("September 18, 2026")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Select the first day")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    await settle();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Select the last day")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes a typed range over a disabled day and makes the field invalid", async () => {
    const { input, onChange, user } = renderPicker({
      isDateDisabled: isBooked,
    });

    await user.type(input, "9/15/2026 - 9/20/2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2026-09-20",
      start: "2026-09-15",
    });
    expect(input.validationMessage).toBe(
      "The range includes 09/18/2026, which cannot be selected.",
    );

    await user.clear(input);
    await user.type(input, "9/19/2026 - 9/28/2026{Enter}");
    expect(input.validationMessage).toBe("");
  });

  it("allows a range over disabled days with allowDisabledInRange - not one ending on one", () => {
    render(
      <UIProvider locale={cs}>
        <DateRangePicker
          allowDisabledInRange
          defaultValue={{ end: "2026-09-30", start: "2026-09-21" }}
          isDateDisabled={isWeekend}
          label="Týden"
        />
        <DateRangePicker
          allowDisabledInRange
          defaultValue={{ end: "2026-09-27", start: "2026-09-21" }}
          isDateDisabled={isWeekend}
          label="Konec"
        />
      </UIProvider>,
    );

    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: /Týden/ })
        .validationMessage,
    ).toBe("");
    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: /Konec/ })
        .validationMessage,
    ).toBe("Období zahrnuje den 27.09.2026, který nelze vybrat.");
  });
});

describe("DateRangePicker presets with isDateDisabled", () => {
  it("cuts the disabled days off the ends of a preset", async () => {
    const { input, onChange, user } = renderPicker({
      isDateDisabled: isWeekend,
      presets: ["thisWeek"],
    });

    // The week of the locale from Sunday, September 20 - its weekend ends
    // are cut off
    await user.click(input);
    await user.click(
      within(screen.getByRole("group", { name: "Presets" })).getByRole(
        "button",
        { name: "This week" },
      ),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-25",
      start: "2026-09-21",
    });
  });

  it("disables a preset over a disabled day", async () => {
    const { input, user } = renderPicker({
      isDateDisabled: isBooked,
      presets: [
        "last7Days",
        {
          label: "Free week",
          range: { end: "2026-09-28", start: "2026-09-22" },
        },
      ],
    });

    await user.click(input);
    const group = screen.getByRole("group", { name: "Presets" });
    // September 18 - 24 has the booked 18th at its start - cut off, the
    // rest can be picked
    expect(
      within(group).getByRole("button", { name: "Last 7 days" }),
    ).toBeEnabled();
    expect(
      within(group).getByRole("button", { name: "Free week" }),
    ).toBeEnabled();
  });

  it("disables a preset with a disabled day inside", async () => {
    const { input, user } = renderPicker({
      isDateDisabled: isBooked,
      presets: [
        { label: "Over it", range: { end: "2026-09-30", start: "2026-09-27" } },
      ],
    });

    await user.click(input);
    expect(screen.getByRole("button", { name: "Over it" })).toBeDisabled();
  });
});
