import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Today is Thursday, September 24, 2026 - only `Date` is faked, the timers
// of the popup and of user-event run
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;

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

  const input = screen.getByRole<HTMLInputElement>("combobox", {
    name: /Pick/,
  });
  act(() => input.focus());
  await user.keyboard("{Enter}");
  await settle();
  return { input, onChange, user };
}

/** Presses keys and waits for the focus to follow. */
async function press(user: ReturnType<typeof userEvent.setup>, keys: string) {
  await user.keyboard(keys);
  await settle();
}

const day = (name: string) => screen.getByRole("button", { name });

describe("DateTimePicker isDateDisabled - days", () => {
  it("marks the disabled days as unavailable and struck through", async () => {
    await openByKeyboard({
      defaultValue: "2026-09-24",
      isDateDisabled: isWeekend,
      type: "date",
    });

    const saturday = day("September 26, 2026");
    expect(saturday).toHaveAttribute("aria-disabled", "true");
    expect(saturday).toHaveClass("line-through");
    expect(saturday.closest("[role=gridcell]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Not a native disabled button - it can take the focus
    expect(saturday).toBeEnabled();

    const friday = day("September 25, 2026");
    expect(friday).not.toHaveAttribute("aria-disabled");
    expect(friday).not.toHaveClass("line-through");
  });

  it("lets the keys land on a disabled day, which Enter does not pick", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-09-25",
      isDateDisabled: isWeekend,
      type: "date",
    });

    expect(day("September 25, 2026")).toHaveFocus();
    await press(user, "{ArrowRight}");
    expect(day("September 26, 2026")).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await press(user, "{ArrowRight}{ArrowRight}");
    expect(day("September 28, 2026")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-28");
  });

  it("does not pick a disabled day on a click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        isDateDisabled={isWeekend}
        label="Pick"
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Pick/ }));
    await user.click(day("September 27, 2026"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("takes a typed disabled day and makes the field invalid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Order">
        <DateTimePicker
          isDateDisabled={isWeekend}
          label="Pick"
          name="day"
          onChange={(event) => onChange(event.target.value)}
          type="date"
        />
      </form>,
    );

    const input = screen.getByRole<HTMLInputElement>("combobox", {
      name: /Pick/,
    });
    await user.type(input, "09/26/2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-26");
    expect(input).toHaveValue("09/26/2026");
    expect(input.validationMessage).toBe("09/26/2026 cannot be selected.");
    expect(screen.getByRole<HTMLFormElement>("form").checkValidity()).toBe(
      false,
    );

    // Another day makes it valid again
    await user.clear(input);
    await user.type(input, "09/28/2026{Enter}");
    expect(input.validationMessage).toBe("");
    expect(screen.getByRole<HTMLFormElement>("form").checkValidity()).toBe(
      true,
    );
  });

  it("makes a default or controlled value on a disabled day invalid, in the language of the locale", () => {
    function Controlled() {
      const [value, setValue] = useState("2026-09-27");
      return (
        <>
          <DateTimePicker
            isDateDisabled={isWeekend}
            label="Den"
            onChange={(event) => setValue(event.target.value)}
            type="date"
            value={value}
          />
          <button onClick={() => setValue("2026-09-29")} type="button">
            Úterý
          </button>
        </>
      );
    }

    render(
      <UIProvider locale={cs}>
        <Controlled />
      </UIProvider>,
    );

    const input = screen.getByRole<HTMLInputElement>("combobox", {
      name: /Den/,
    });
    expect(input.validationMessage).toBe("27.09.2026 nelze vybrat.");

    fireEvent.click(screen.getByRole("button", { name: "Úterý" }));
    expect(input.validationMessage).toBe("");
  });

  it("keeps a message of min / max first", () => {
    render(
      <DateTimePicker
        defaultValue="2026-09-26"
        isDateDisabled={isWeekend}
        label="Pick"
        min="2026-09-28"
        type="date"
      />,
    );

    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: /Pick/ })
        .validationMessage,
    ).toBe("Enter a value of 09/28/2026 or later.");
  });

  it("leaves a message the page set alone", async () => {
    const user = userEvent.setup();
    render(
      <DateTimePicker
        defaultValue="2026-09-28"
        isDateDisabled={isWeekend}
        label="Pick"
        type="date"
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("combobox", {
      name: /Pick/,
    });
    input.setCustomValidity("Taken by the server");
    await user.clear(input);
    await user.type(input, "09/29/2026{Enter}");
    expect(input.validationMessage).toBe("Taken by the server");
  });
});

describe("DateTimePicker isDateDisabled - date and time", () => {
  it("disables the days of the date-time popup and invalidates a value on one", async () => {
    const { input, onChange, user } = await openByKeyboard({
      defaultValue: "2026-09-26T10:00",
      isDateDisabled: isWeekend,
      type: "datetime-local",
    });

    expect(day("September 26, 2026")).toHaveAttribute("aria-disabled", "true");
    expect(input.validationMessage).toBe(
      "09/26/2026 10:00 AM cannot be selected.",
    );

    await press(user, "{ArrowRight}{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-28T10:00");
    expect(input.validationMessage).toBe("");
  });

  it("sets the time of the nearest day that can be picked without a day", async () => {
    // Saturday - the time lists set a time of Monday
    vi.setSystemTime(new Date(2026, 8, 26, 12));
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        isDateDisabled={isWeekend}
        label="Pick"
        onChange={(event) => onChange(event.target.value)}
        type="datetime-local"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Pick/ }));
    await user.click(screen.getByRole("option", { name: "10 AM" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-09-28T10:00");
  });
});

describe("DateTimePicker isDateDisabled - months and weeks", () => {
  // Every day of October 2026, and of the week 40 of 2026 (Sep 28 - Oct 4)
  const inOctober = (date: Date) =>
    date.getFullYear() === 2026 && date.getMonth() === 9;
  const inWeek40 = (date: Date) =>
    date >= new Date(2026, 8, 28) && date < new Date(2026, 9, 5);

  it("disables a month without a day that can be picked", async () => {
    const { input, onChange, user } = await openByKeyboard({
      defaultValue: "2026-09",
      isDateDisabled: inOctober,
      type: "month",
    });

    const october = screen.getByRole("button", { name: "October 2026" });
    expect(october).toHaveAttribute("aria-disabled", "true");
    expect(october).toHaveClass("line-through");
    expect(
      screen.getByRole("button", { name: "November 2026" }),
    ).not.toHaveAttribute("aria-disabled");

    // A key lands on it, Enter does not pick it
    await press(user, "{ArrowRight}");
    expect(october).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(october);
    expect(onChange).not.toHaveBeenCalled();

    await press(user, "{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-11");
    expect(input.validationMessage).toBe("");
  });

  it("keeps a month with a day left", async () => {
    await openByKeyboard({
      defaultValue: "2026-09",
      // Every day but the last one of October
      isDateDisabled: (date) => inOctober(date) && date.getDate() < 31,
      type: "month",
    });

    expect(
      screen.getByRole("button", { name: "October 2026" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("makes a typed month without a day invalid", async () => {
    const user = userEvent.setup();
    render(
      <DateTimePicker isDateDisabled={inOctober} label="Pick" type="month" />,
    );

    const input = screen.getByRole<HTMLInputElement>("combobox", {
      name: /Pick/,
    });
    await user.type(input, "10/2026{Enter}");
    expect(input).toHaveValue("10/2026");
    expect(input.validationMessage).toBe("10/2026 cannot be selected.");
  });

  it("disables a week without a day that can be picked", async () => {
    const { input, onChange, user } = await openByKeyboard({
      defaultValue: "2026-W39",
      isDateDisabled: inWeek40,
      type: "week",
    });

    const week40 = screen.getByRole("button", { name: "Week 40, 2026" });
    expect(week40).toHaveAttribute("aria-disabled", "true");
    expect(week40).toHaveClass("line-through");
    expect(
      screen.getByRole("button", { name: "Week 41, 2026" }),
    ).not.toHaveAttribute("aria-disabled");

    await press(user, "{ArrowRight}");
    expect(week40).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();

    await press(user, "{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-W41");
    expect(input.validationMessage).toBe("");
  });

  it("makes a week value without a day invalid", () => {
    render(
      <DateTimePicker
        defaultValue="2026-W40"
        isDateDisabled={inWeek40}
        label="Pick"
        type="week"
      />,
    );

    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: /Pick/ })
        .validationMessage,
    ).toBe("W40 2026 cannot be selected.");
  });

  it("does nothing for a time", () => {
    render(
      <DateTimePicker
        defaultValue="10:00"
        isDateDisabled={() => true}
        label="Pick"
        type="time"
      />,
    );

    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: /Pick/ })
        .validationMessage,
    ).toBe("");
  });
});

describe("DateTimePicker isDateDisabled - native mode", () => {
  it("makes a value on a disabled day invalid", () => {
    const { unmount } = render(
      <DateTimePicker
        defaultValue="2026-09-26"
        isDateDisabled={isWeekend}
        label="Pick"
        mode="native"
        type="date"
      />,
    );

    const input = screen.getByLabelText<HTMLInputElement>(/Pick/);
    expect(input.validationMessage).toBe("09/26/2026 cannot be selected.");

    fireEvent.change(input, { target: { value: "2026-09-28" } });
    expect(input.validationMessage).toBe("");

    // A date-time, in the format of the locale
    unmount();
    render(
      <DateTimePicker
        defaultValue="2026-09-26T14:30"
        isDateDisabled={isWeekend}
        label="Pick"
        mode="native"
        type="datetime-local"
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>(/Pick/).validationMessage,
    ).toBe("09/26/2026 2:30 PM cannot be selected.");
  });

  it("names a disabled month and week as the locale writes them", () => {
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          defaultValue="2026-10"
          isDateDisabled={() => true}
          label="Měsíc"
          mode="native"
          type="month"
        />
        <DateTimePicker
          defaultValue="2026-W40"
          isDateDisabled={() => true}
          label="Týden"
          mode="native"
          type="week"
        />
      </UIProvider>,
    );

    expect(
      screen.getByLabelText<HTMLInputElement>(/Měsíc/).validationMessage,
    ).toBe("10.2026 nelze vybrat.");
    expect(
      screen.getByLabelText<HTMLInputElement>(/Týden/).validationMessage,
    ).toBe("W40.2026 nelze vybrat.");
  });
});
