import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import DateTimePicker from ".";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import { createLocale } from "../../i18n/format";
import UIProvider from "../../providers/ui-provider";

/** Lets the frames the popup schedules (focus, scrolling) run. */
const settle = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

describe("DateTimePicker keyboard", () => {
  it("pages with Enter and Space on the month and year buttons", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(
      <DateTimePicker
        defaultValue="2026-09-24"
        label="Day"
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />,
    );

    const day = screen.getByRole("combobox", { name: /Day/ });
    await user.click(day);
    await settle();
    // A click leaves the focus in the field, for typing - ArrowDown moves
    // into the grid
    expect(day).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(
      screen.getByRole("button", { name: "September 24, 2026" }),
    ).toHaveFocus();
    act(() => screen.getByRole("button", { name: "Next month" }).focus());
    await user.keyboard("{Enter}");
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveDisplayValue(
      "October",
    );
    unmount();

    render(
      <DateTimePicker
        defaultValue="2026-09"
        label="Month"
        onChange={(event) => onChange(event.target.value)}
        type="month"
      />,
    );
    await user.click(screen.getByRole("combobox", { name: /Month/ }));
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(
      screen.getByRole("button", { name: "September 2026" }),
    ).toHaveFocus();
    act(() => screen.getByRole("button", { name: "Next year" }).focus());
    await user.keyboard(" ");
    expect(screen.getByText("2027")).toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the value with its button and keeps the focus in the field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="2026-09-24"
        label="Day"
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />,
    );

    const clear = screen.getByRole("button", { name: "Clear value" });
    // Big enough to hit - 24px square (WCAG 2.5.8)
    expect(clear).toHaveClass("size-6");
    await user.click(clear);

    expect(onChange).toHaveBeenCalledWith("");
    const input = screen.getByRole("combobox", { name: /Day/ });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no clear button when required, like the native inputs", () => {
    render(
      <>
        <DateTimePicker defaultValue="2026-09-24" label="Day" required />
        <DateTimePicker
          defaultValue="10:30"
          label="Time"
          required
          type="time"
        />
      </>,
    );

    expect(screen.getByRole("combobox", { name: /Day/ })).toHaveValue(
      "09/24/2026",
    );
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();
  });

  it("moves into the time lists when opened from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="10:30"
        label="Time"
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    act(() => screen.getByRole("combobox", { name: /Time/ }).focus());
    await user.keyboard("{Enter}");
    const hours = await screen.findByRole("listbox", { name: "Hours" });
    await settle();
    expect(hours).toHaveFocus();

    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("11:30");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollIntoView.mock.contexts[0]).toHaveTextContent("11");

    await user.tab();
    expect(screen.getByRole("listbox", { name: "Minutes" })).toHaveFocus();
  });

  it("keeps the focus in the field when opened with the mouse", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DateTimePicker label="Time" type="time" />
        <input aria-label="Next field" />
      </>,
    );

    const input = screen.getByRole("combobox", { name: /Time/ });
    await user.click(input);
    const hours = await screen.findByRole("listbox", { name: "Hours" });
    expect(input).toHaveFocus();

    // ArrowDown moves into the open popup
    await user.keyboard("{ArrowDown}");
    expect(hours).toHaveFocus();

    // Escape comes back, Tab moves on and closes the popup
    await user.keyboard("{Escape}");
    expect(input).toHaveFocus();
    await user.click(input);
    await screen.findByRole("listbox", { name: "Hours" });
    await user.tab();

    expect(screen.getByRole("textbox", { name: "Next field" })).toHaveFocus();
    expect(
      screen.queryByRole("listbox", { name: "Hours" }),
    ).not.toBeInTheDocument();
  });
});

describe("DateTimePicker limits", () => {
  it("offers only the times between min and max", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="10:45"
        label="Time"
        max="17:00"
        min="09:30"
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Time/ }));
    const hours = await screen.findByRole("listbox", { name: "Hours" });
    expect(within(hours).getByRole("option", { name: "8 AM" })).toBeDisabled();
    expect(within(hours).getByRole("option", { name: "6 PM" })).toBeDisabled();

    // 17:45 would be past max, 9:00 before min
    await user.click(within(hours).getByRole("option", { name: "5 PM" }));
    expect(onChange).toHaveBeenLastCalledWith("17:00");
    await user.click(within(hours).getByRole("option", { name: "9 AM" }));
    expect(onChange).toHaveBeenLastCalledWith("09:30");

    const minutes = screen.getByRole("listbox", { name: "Minutes" });
    expect(within(minutes).getByRole("option", { name: "15" })).toBeDisabled();
    expect(within(minutes).getByRole("option", { name: "45" })).toBeEnabled();
  });

  it("keeps a date and time between min and max", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        label="When"
        max="2030-01-31T18:00"
        min="2030-01-01T12:00"
        onChange={(event) => onChange(event.target.value)}
        type="datetime-local"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /When/ }));
    const hours = await screen.findByRole("listbox", { name: "Hours" });

    // No day picked yet - the time goes to the first allowed day, where the
    // time part of min applies
    expect(within(hours).getByRole("option", { name: "10 AM" })).toBeDisabled();
    await user.click(within(hours).getByRole("option", { name: "2 PM" }));
    expect(onChange).toHaveBeenLastCalledWith("2030-01-01T14:00");
  });

  it("clamps the time of a day picked on the min day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="2030-01-05T09:00"
        label="When"
        min="2030-01-01T12:00"
        onChange={(event) => onChange(event.target.value)}
        type="datetime-local"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /When/ }));
    await user.click(
      await screen.findByRole("button", { name: "January 1, 2030" }),
    );
    expect(onChange).toHaveBeenLastCalledWith("2030-01-01T12:00");
  });
});

describe("DateTimePicker in forms", () => {
  it("neither submits nor validates a disabled picker", () => {
    render(
      <form aria-label="Filters">
        <DateTimePicker
          disabled
          name="from"
          onChange={() => {}}
          type="date"
          value="2026-09-24"
        />
        <DateTimePicker disabled name="to" required type="date" />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Filters" });
    expect([...new FormData(form).keys()]).toEqual([]);
    expect(form.checkValidity()).toBe(true);
  });

  it("is invalid with a value out of min and max, like a native input", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Booking">
          <DateTimePicker
            defaultValue="2026-09-01"
            label="Day"
            min="2026-09-10"
            name="day"
            type="date"
          />
          <DateTimePicker
            label="At"
            max="2026-09-30T18:00"
            onChange={() => {}}
            type="datetime-local"
            value="2026-09-30T19:00"
          />
          <DateTimePicker
            defaultValue="2027-01"
            label="Month"
            max="2026-12"
            type="month"
          />
          <DateTimePicker
            defaultValue="2026-W01"
            label="Week"
            min="2026-W10"
            type="week"
          />
          <DateTimePicker
            defaultValue="12:00"
            label="Shift"
            max="06:00"
            min="22:00"
            type="time"
          />
        </form>
      </UIProvider>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Booking" });
    const field = (name: RegExp) => screen.getByRole("combobox", { name });
    expect(form.checkValidity()).toBe(false);
    expect(field(/Day/)).toHaveProperty(
      "validationMessage",
      "Zadejte hodnotu 10.09.2026 nebo pozdější.",
    );
    expect(field(/At/)).toHaveProperty(
      "validationMessage",
      "Zadejte hodnotu 30.09.2026 18:00 nebo dřívější.",
    );
    expect(field(/Month/)).toHaveProperty(
      "validationMessage",
      "Zadejte hodnotu 12.2026 nebo dřívější.",
    );
    expect(field(/Week/)).toHaveProperty(
      "validationMessage",
      "Zadejte hodnotu W10.2026 nebo pozdější.",
    );
    // Out of a range over midnight - its start is said
    expect(field(/Shift/)).toHaveProperty(
      "validationMessage",
      "Zadejte hodnotu 22:00 nebo pozdější.",
    );

    // A value in the range makes the field valid again
    await user.clear(field(/Day/));
    await user.type(field(/Day/), "10.9.2026{Enter}");
    expect(field(/Day/)).toHaveProperty("validationMessage", "");
    expect(field(/Day/)).toBeValid();
  });

  it("keeps a validity message the page set", () => {
    render(
      <DateTimePicker
        defaultValue="2026-09-24"
        label="Day"
        ref={(input) => input?.setCustomValidity("Booked out")}
        type="date"
      />,
    );

    expect(screen.getByRole("combobox", { name: /Day/ })).toHaveProperty(
      "validationMessage",
      "Booked out",
    );
  });

  it("passes readOnly, ref, onFocus and onBlur to the field", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <form aria-label="Order">
        <DateTimePicker
          defaultValue="2026-09-24"
          label="Delivery"
          name="delivery"
          onBlur={onBlur}
          onFocus={onFocus}
          readOnly
          ref={ref}
          required
          type="date"
        />
        <input aria-label="Next field" />
      </form>,
    );

    const input = screen.getByRole("combobox", { name: /Delivery/ });
    expect(ref.current).toBe(input);

    // Read-only: shown and submitted, but no popup and no clear button
    await user.click(input);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      delivery: "2026-09-24",
    });

    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("reports no blur while the focus is in its popup", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <>
        <DateTimePicker label="Day" onBlur={onBlur} type="date" />
        <input aria-label="Next field" />
      </>,
    );

    const input = screen.getByRole("combobox", { name: /Day/ });
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(document.activeElement).toHaveAttribute("data-focused-day");
    expect(onBlur).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(input).toHaveFocus();
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("DateTimePicker typing", () => {
  const renderDate = (
    props: React.ComponentProps<typeof DateTimePicker> = {},
  ) => {
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Person">
          <DateTimePicker
            label="Birth date"
            name="birth"
            onChange={(event) => onChange(event.target.value)}
            type="date"
            {...props}
          />
          <input aria-label="Next field" />
        </form>
      </UIProvider>,
    );
    return {
      input: screen.getByRole("combobox", { name: /Birth date/ }),
      onChange,
    };
  };

  it("takes a date typed in the format of the locale", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderDate();

    await user.type(input, "3.7.1985{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("1985-07-03");
    expect(input).toHaveValue("03.07.1985");

    // Any separators, and on leaving the field
    await user.clear(input);
    await user.type(input, "24-12-1990");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("1990-12-24");
    expect(input).toHaveValue("24.12.1990");
  });

  it("takes a date typed without its year or with two digits of it", async () => {
    // Today is Friday, September 25, 2026 - only `Date` is faked
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 25, 12));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const user = userEvent.setup();
    const { input, onChange } = renderDate();

    await user.type(input, "24.9.{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-24");
    expect(input).toHaveValue("24.09.2026");

    await user.clear(input);
    await user.type(input, "3.7.85");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("1985-07-03");
  });

  it("drops a text that is no allowed date", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderDate({
      defaultValue: "2026-09-24",
      max: "2026-12-31",
    });

    await user.clear(input);
    await user.type(input, "31.02.2026{Enter}");
    expect(input).toHaveValue("24.09.2026");

    await user.clear(input);
    await user.type(input, "01.01.2027{Enter}");
    expect(input).toHaveValue("24.09.2026");

    // Escape closes the popup, the next one gives up the typing
    await user.clear(input);
    await user.type(input, "1.1.2026{Escape}");
    expect(input).toHaveValue("1.1.2026");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("24.09.2026");
    expect(onChange).not.toHaveBeenCalledWith(
      expect.stringMatching(/2027|02-31/),
    );

    // An emptied field clears the value
    await user.clear(input);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("is validated by the browser when required", async () => {
    const user = userEvent.setup();
    const { input } = renderDate({ required: true });
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Person" });

    expect(form.checkValidity()).toBe(false);
    await user.type(input, "1.2.2000{Enter}");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("birth")).toBe("2000-02-01");
  });

  it("jumps to another month and year with the selects", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderDate({ defaultValue: "2026-09-24" });

    await user.click(input);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Rok" }),
      "1985",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Měsíc" }),
      "Červenec",
    );
    await user.click(screen.getByRole("button", { name: "3. července 1985" }));

    expect(onChange).toHaveBeenLastCalledWith("1985-07-03");
  });
});

describe("DateTimePicker with a 12-hour clock", () => {
  it("shows and reads the time with AM and PM", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="21:05"
        label="Time"
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    const input = screen.getByRole("combobox", { name: /Time/ });
    expect(input).toHaveValue("9:05 PM");

    await user.clear(input);
    await user.type(input, "7:30 am{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("07:30");

    // The 24-hour clock is understood as well
    await user.clear(input);
    await user.type(input, "18:15{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("18:15");
    expect(input).toHaveValue("6:15 PM");
  });
});

describe("DateTimePicker focus", () => {
  const renderBetweenFields = (
    props: React.ComponentProps<typeof DateTimePicker> = {},
  ) => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <input aria-label="Previous field" />
        <DateTimePicker
          defaultValue="2026-09-24"
          label="Day"
          onBlur={onBlur}
          onFocus={onFocus}
          type="date"
          {...props}
        />
        <input aria-label="Next field" />
      </>,
    );
    return {
      input: screen.getByRole("combobox", { name: /Day/ }),
      onBlur,
      onFocus,
    };
  };

  it("moves on with Tab from the end of the popup and reports the blur", async () => {
    const user = userEvent.setup();
    const { input, onBlur, onFocus } = renderBetweenFields();

    act(() => input.focus());
    await user.keyboard("{Enter}");
    await settle();
    expect(
      screen.getByRole("button", { name: "September 24, 2026" }),
    ).toHaveFocus();

    // Past the clear button too - it belongs to the picker
    await user.tab();
    const nextField = screen.getByRole("textbox", { name: "Next field" });
    expect(nextField).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    // Reported as a blur of the field
    const [blur] = onBlur.mock.calls[0];
    expect(blur.target).toBe(input);
    expect(blur.currentTarget).toBe(input);
    expect(blur.relatedTarget).toBe(nextField);
    expect(blur.type).toBe("blur");
    // A whole event - also when spread, and with React's methods
    const spread = { ...blur };
    expect(spread.target).toBe(input);
    expect(spread.relatedTarget).toBe(nextField);
    expect(() => blur.preventDefault()).not.toThrow();
  });

  it("goes back to the field with Shift+Tab from the start of the popup", async () => {
    const user = userEvent.setup();
    const { input, onBlur, onFocus } = renderBetweenFields();

    act(() => input.focus());
    await user.keyboard("{Enter}");
    await settle();
    act(() => screen.getByRole("button", { name: "Previous month" }).focus());

    await user.tab({ shift: true });
    expect(input).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onBlur).not.toHaveBeenCalled();

    await user.tab({ shift: true });
    expect(
      screen.getByRole("textbox", { name: "Previous field" }),
    ).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("leaves the time lists with Tab to what follows the picker", async () => {
    const user = userEvent.setup();
    const { onBlur } = renderBetweenFields({
      defaultValue: "10:30",
      type: "time",
    });

    act(() => screen.getByRole("combobox", { name: /Day/ }).focus());
    await user.keyboard("{Enter}");
    await settle();
    expect(screen.getByRole("listbox", { name: "Hours" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("listbox", { name: "Minutes" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Next field" })).toHaveFocus();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("reports the blur when the focus leaves the popup any other way", async () => {
    const user = userEvent.setup();
    const { input, onBlur } = renderBetweenFields();

    act(() => input.focus());
    await user.keyboard("{Enter}");
    await settle();
    act(() => screen.getByRole("textbox", { name: "Next field" }).focus());

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("keeps the focus in the field on a click into the popup", async () => {
    const user = userEvent.setup();
    const { input, onBlur } = renderBetweenFields();

    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(input).toHaveFocus();
    await user.click(screen.getByText("Sun"));
    expect(input).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();
  });

  it("names the popup and points the field at it", async () => {
    const user = userEvent.setup();
    const { input } = renderBetweenFields();

    expect(input).not.toHaveAttribute("aria-controls");
    await user.click(input);
    const dialog = screen.getByRole("dialog", { name: "Select date" });
    expect(input).toHaveAttribute("aria-controls", dialog.id);
  });

  it("closes the popup of a picker that becomes disabled - for good", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DateTimePicker label="Day" type="date" />);

    await user.click(screen.getByRole("combobox", { name: /Day/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<DateTimePicker disabled label="Day" type="date" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<DateTimePicker label="Day" type="date" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Day/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("DateTimePicker typed value and the popup", () => {
  it("opens the day grid on a typed date", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          defaultValue="2026-09-24"
          label="Birth date"
          onChange={(event) => onChange(event.target.value)}
          type="date"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Birth date/ });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "3.7.1985");
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(
      screen.getByRole("button", { name: "3. července 1985" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("1985-07-03");
  });

  it("takes a typed date once, whether the popup is open or not", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          label="Birth date"
          onChange={(event) => onChange(event.target.value)}
          type="date"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Birth date/ });
    act(() => input.focus());
    await user.keyboard("3.7.1985{ArrowDown}");
    await settle();
    expect(
      screen.getByRole("button", { name: "3. července 1985" }),
    ).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    await user.click(input);
    await user.clear(input);
    await user.type(input, "4.7.1985");
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(
      screen.getByRole("button", { name: "4. července 1985" }),
    ).toHaveFocus();
    expect(onChange.mock.calls).toEqual([["1985-07-03"], ["1985-07-04"]]);
  });

  it("opens the month grid on a typed month", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          defaultValue="2026-09"
          label="Month"
          onChange={(event) => onChange(event.target.value)}
          type="month"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Month/ });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "3.2020");
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(screen.getByRole("button", { name: "Březen 2020" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2020-03");
  });

  it("opens the week grid on a typed week", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="2026-W39"
        label="Week"
        onChange={(event) => onChange(event.target.value)}
        type="week"
      />,
    );

    const input = screen.getByRole("combobox", { name: /Week/ });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "W05 2020");
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(screen.getByRole("button", { name: "Week 5, 2020" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2020-W05");
  });
});

describe("DateTimePicker onChange event", () => {
  it("has target, currentTarget, type and methods that do nothing", async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    render(
      <DateTimePicker
        defaultValue="2026-09-24"
        label="Day"
        name="day"
        onChange={(event) => {
          event.preventDefault();
          event.stopPropagation();
          seen.push(
            event.target.name,
            event.target.value,
            event.currentTarget.value,
            event.type,
          );
        }}
        type="date"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(seen).toEqual(["day", "", "", "change"]);
  });

  it("takes handlers of native change events and of form libraries", () => {
    // Compile-time checks: a handler shared with native inputs, and what
    // React Hook Form's register() returns
    const shared = (event: React.ChangeEvent<HTMLInputElement>) =>
      event.target.value;
    const registered = {
      name: "day",
      onBlur: async (_event: { target: unknown; type?: unknown }) => {},
      onChange: async (_event: { target: unknown; type?: unknown }) => {},
      ref: (_instance: unknown) => {},
    };
    render(
      <>
        <DateTimePicker label="Shared" onChange={shared} type="date" />
        <DateTimePicker label="Registered" type="date" {...registered} />
      </>,
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });
});

describe("DateTimePicker native attributes", () => {
  it("passes the other input props to the field and the form to the hidden input", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <>
        <form aria-label="Order" id="order" />
        <DateTimePicker
          aria-describedby="hint"
          autoFocus
          data-testid="delivery"
          defaultValue="2026-09-24"
          error="Pick a workday"
          form="order"
          label="Delivery"
          name="delivery"
          onKeyDown={onKeyDown}
          tabIndex={3}
          title="Delivery day"
          type="date"
        />
        <p id="hint">Weekdays only</p>
      </>,
    );

    const input = screen.getByRole("combobox", { name: /Delivery/ });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("data-testid", "delivery");
    expect(input).toHaveAttribute("tabindex", "3");
    expect(input).toHaveAttribute("title", "Delivery day");
    expect(input).toHaveAccessibleDescription("Pick a workday Weekdays only");

    await user.keyboard("x");
    expect(onKeyDown).toHaveBeenCalled();

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      delivery: "2026-09-24",
    });
  });

  it("lets a key handler that prevents the default skip the picker's", async () => {
    const user = userEvent.setup();
    render(
      <DateTimePicker
        label="Day"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        type="date"
      />,
    );

    act(() => screen.getByRole("combobox", { name: /Day/ }).focus());
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the caller's description in native mode", () => {
    render(
      <>
        <DateTimePicker
          aria-describedby="hint"
          error="Too late"
          label="Day"
          mode="native"
          type="date"
        />
        <p id="hint">Until Friday</p>
      </>,
    );

    expect(screen.getByLabelText(/Day/)).toHaveAccessibleDescription(
      "Too late Until Friday",
    );
  });

  it("gives native time inputs the minute step", () => {
    render(
      <>
        <DateTimePicker
          label="Time"
          minuteStep={15}
          mode="native"
          type="time"
        />
        <DateTimePicker
          label="Starts"
          mode="native"
          quarterMinutesOnly
          type="datetime-local"
        />
        <DateTimePicker label="Day" minuteStep={15} mode="native" type="date" />
      </>,
    );

    expect(screen.getByLabelText(/Time/)).toHaveAttribute("step", "900");
    expect(screen.getByLabelText(/Starts/)).toHaveAttribute("step", "900");
    expect(screen.getByLabelText(/Day/)).not.toHaveAttribute("step");
  });

  it("leaves the required asterisk out of the name", () => {
    render(
      <>
        <DateTimePicker label="Day" required type="date" />
        <DateTimePicker label="Native" mode="native" required type="date" />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "Day:" })).toBeRequired();
    const native = screen.getByLabelText(/Native/);
    expect(native).toHaveAccessibleName("Native:");
    expect(native).toBeRequired();
  });
});

describe("DateTimePicker description", () => {
  it("describes the field after its error, in both modes", () => {
    render(
      <>
        <DateTimePicker
          aria-describedby="hint"
          description="Weekdays only"
          error="Pick a day"
          label="Custom"
          type="date"
        />
        <DateTimePicker
          aria-describedby="hint"
          description="Weekdays only"
          error="Pick a day"
          label="Native"
          mode="native"
          type="date"
        />
        <p id="hint">Until Friday</p>
      </>,
    );

    const custom = screen.getByRole("combobox", { name: /Custom/ });
    expect(custom).toHaveAccessibleDescription(
      "Pick a day Weekdays only Until Friday",
    );
    expect(screen.getByLabelText(/Native/)).toHaveAccessibleDescription(
      "Pick a day Weekdays only Until Friday",
    );

    // Under the field, above the error
    const [description] = screen.getAllByText("Weekdays only");
    const [error] = screen.getAllByRole("alert");
    expect(
      custom.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      description.compareDocumentPosition(error) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("takes rich content and leaves the field undescribed without it", () => {
    const { rerender } = render(
      <DateTimePicker
        description={
          <>
            See the <a href="/holidays">holidays</a>
          </>
        }
        id="delivery"
        label="Delivery"
        type="date"
      />,
    );

    const input = screen.getByRole("combobox", { name: /Delivery/ });
    expect(input).toHaveAttribute("aria-describedby", "delivery-description");
    expect(input).toHaveAccessibleDescription("See the holidays");
    expect(screen.getByRole("link", { name: "holidays" })).toBeInTheDocument();

    rerender(<DateTimePicker id="delivery" label="Delivery" type="date" />);
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(document.getElementById("delivery-description")).toBeNull();
  });
});

describe("DateTimePicker years before 1000", () => {
  it("shows and picks the days of the years 0 - 99", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="0050-03-07"
        label="Day"
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Day/ }));
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveDisplayValue(
      "50",
    );
    await user.click(screen.getByRole("button", { name: "March 10, 50" }));
    expect(onChange).toHaveBeenLastCalledWith("0050-03-10");
  });

  it("emits months and weeks with four-digit years", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(
      <DateTimePicker
        defaultValue="0999-05"
        label="Month"
        onChange={(event) => onChange(event.target.value)}
        type="month"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Month/ }));
    await user.click(screen.getByRole("button", { name: "June 999" }));
    expect(onChange).toHaveBeenLastCalledWith("0999-06");
    unmount();

    render(
      <DateTimePicker
        defaultValue="0999-W05"
        label="Week"
        onChange={(event) => onChange(event.target.value)}
        type="week"
      />,
    );
    await user.click(screen.getByRole("combobox", { name: /Week/ }));
    await user.click(screen.getByRole("button", { name: "Week 6, 999" }));
    expect(onChange).toHaveBeenLastCalledWith("0999-W06");
  });
});

describe("DateTimePicker minute steps", () => {
  it("keeps clamped and typed minutes on the step", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        label="Time"
        min="09:10"
        minuteStep={15}
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    const input = screen.getByRole("combobox", { name: /Time/ });
    await user.click(input);
    const hours = await screen.findByRole("listbox", { name: "Hours" });
    // 9:00 is before min - 9:10 is no option of the step, 9:15 is
    await user.click(within(hours).getByRole("option", { name: "9 AM" }));
    expect(onChange).toHaveBeenLastCalledWith("09:15");

    await user.clear(input);
    await user.type(input, "12:34{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("12:30");
  });

  it("moves a kept minute onto the step", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="10:07"
        label="Time"
        minuteStep={15}
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Time/ }));
    const hours = await screen.findByRole("listbox", { name: "Hours" });
    await user.click(within(hours).getByRole("option", { name: "11 AM" }));
    expect(onChange).toHaveBeenLastCalledWith("11:00");
  });

  it("keeps the time of a date-time on the step", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        label="When"
        min="2030-01-01T12:10"
        onChange={(event) => onChange(event.target.value)}
        quarterMinutesOnly
        type="datetime-local"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /When/ }));
    const hours = await screen.findByRole("listbox", { name: "Hours" });
    await user.click(within(hours).getByRole("option", { name: "12 PM" }));
    expect(onChange).toHaveBeenLastCalledWith("2030-01-01T12:15");
  });
});

describe("DateTimePicker without a time", () => {
  it("selects no hour and no minute", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        label="Time"
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    act(() => screen.getByRole("combobox", { name: /Time/ }).focus());
    await user.keyboard("{Enter}");
    await settle();
    const hours = screen.getByRole("listbox", { name: "Hours" });
    const minutes = screen.getByRole("listbox", { name: "Minutes" });
    for (const list of [hours, minutes]) {
      expect(list).not.toHaveAttribute("aria-activedescendant");
      expect(
        within(list)
          .getAllByRole("option")
          .filter((option) => option.getAttribute("aria-selected") === "true"),
      ).toHaveLength(0);
    }

    // The first hour - ArrowUp would start from the last one
    expect(hours).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("00:00");
  });

  it("starts from the last hour with ArrowUp", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        label="Time"
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    act(() => screen.getByRole("combobox", { name: /Time/ }).focus());
    await user.keyboard("{Enter}");
    await settle();
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith("23:00");
  });
});

describe("DateTimePicker time ranges over midnight", () => {
  it("offers and accepts the times of a night shift", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          label="Shift"
          max="06:00"
          min="22:00"
          onChange={(event) => onChange(event.target.value)}
          type="time"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Shift/ });
    await user.click(input);
    const hours = await screen.findByRole("listbox", { name: "Hodiny" });
    expect(within(hours).getByRole("option", { name: "12" })).toBeDisabled();
    expect(within(hours).getByRole("option", { name: "07" })).toBeDisabled();
    expect(within(hours).getByRole("option", { name: "23" })).toBeEnabled();
    expect(within(hours).getByRole("option", { name: "02" })).toBeEnabled();

    await user.click(within(hours).getByRole("option", { name: "23" }));
    expect(onChange).toHaveBeenLastCalledWith("23:00");

    await user.clear(input);
    await user.type(input, "12:00{Enter}");
    expect(input).toHaveValue("23:00");
    await user.clear(input);
    await user.type(input, "5:30{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("05:30");
  });
});

describe("DateTimePicker texts of the locale", () => {
  it("writes AM and PM of the locale in the time lists", async () => {
    const user = userEvent.setup();
    const cs12 = createLocale(cs, { formats: { time: "h:mm A" } });
    render(
      <UIProvider locale={cs12}>
        <DateTimePicker defaultValue="21:05" label="Čas" type="time" />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Čas/ });
    expect(input).toHaveValue("9:05 odp.");
    await user.click(input);
    expect(
      screen.getByRole("option", { name: "9 odp.", selected: true }),
    ).toBeInTheDocument();
  });

  it("labels the week buttons by the week format of the locale", async () => {
    const user = userEvent.setup();
    const de = createLocale(en, {
      code: "de-DE",
      formats: { week: "[KW] WW YYYY" },
    });
    render(
      <UIProvider locale={de}>
        <DateTimePicker defaultValue="2026-W39" label="Week" type="week" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("combobox", { name: /Week/ }));
    expect(
      screen.getByRole("button", { name: "Week 39, 2026" }),
    ).toHaveTextContent("KW 39");
  });

  it("works with an invalid locale code", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <UIProvider locale={{ ...en, code: "en_GB" }}>
        <DateTimePicker defaultValue="2026-09-24" label="Day" type="date" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("combobox", { name: /Day/ }));
    expect(
      screen.getByRole("button", { name: "September 24, 2026" }),
    ).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });
});

describe("DateTimePicker placeholders", () => {
  it("writes the tokens of the patterns as the locale does", () => {
    render(
      <UIProvider locale={cs}>
        <DateTimePicker label="Den" type="date" />
        <DateTimePicker label="Termín" type="datetime-local" />
        <DateTimePicker label="Měsíc" type="month" />
        <DateTimePicker label="Týden" type="week" />
        <DateTimePicker label="Čas" type="time" />
        <DateTimePicker label="Nativní" mode="native" type="date" />
      </UIProvider>,
    );

    const placeholder = (name: RegExp) =>
      screen.getByLabelText(name).getAttribute("placeholder");
    expect(placeholder(/Den/)).toBe("DD.MM.RRRR");
    expect(placeholder(/Termín/)).toBe("DD.MM.RRRR HH:mm");
    expect(placeholder(/Měsíc/)).toBe("MM.RRRR");
    expect(placeholder(/Týden/)).toBe("TT.RRRR");
    expect(placeholder(/Čas/)).toBe("HH:mm");
    expect(placeholder(/Nativní/)).toBe("DD.MM.RRRR");
  });

  it("names AM / PM in English, and keeps a placeholder of the app", () => {
    render(
      <>
        <DateTimePicker label="Time" type="time" />
        <DateTimePicker label="Start" type="datetime-local" />
        <DateTimePicker label="Due" placeholder="When?" type="date" />
      </>,
    );

    expect(screen.getByLabelText(/Time/)).toHaveAttribute(
      "placeholder",
      "h:mm AM/PM",
    );
    expect(screen.getByLabelText(/Start/)).toHaveAttribute(
      "placeholder",
      "MM/DD/YYYY h:mm AM/PM",
    );
    expect(screen.getByLabelText(/Due/)).toHaveAttribute(
      "placeholder",
      "When?",
    );
  });
});

describe("DateTimePicker texts that give no value", () => {
  const renderCzech = (
    props: React.ComponentProps<typeof DateTimePicker> = {},
  ) => {
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          label="Datum"
          onChange={(event) => onChange(event.target.value)}
          type="date"
          {...props}
        />
      </UIProvider>,
    );
    return {
      input: screen.getByRole("combobox", { name: /Datum/ }),
      onChange,
      user: userEvent.setup(),
    };
  };

  it("says why a typed text was dropped, until the typing goes on", async () => {
    const { input, onChange, user } = renderCzech({
      defaultValue: "2026-09-24",
      max: "2026-12-31",
    });

    await user.clear(input);
    await user.type(input, "31.02.2026{Enter}");
    // The value stays - the message says why
    expect(input).toHaveValue("24.09.2026");
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent(
      "„31.02.2026“ není platná hodnota. Použijte formát DD.MM.RRRR.",
    );
    expect(input).toHaveAccessibleDescription(message.textContent!);

    await user.type(input, "1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "1.1.2027");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "„1.1.2027“ je mimo povolený rozsah.",
    );

    // A value picked or typed takes the message away
    await user.clear(input);
    await user.type(input, "1.10.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-10-01");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes a pasted ISO date", async () => {
    const { input, onChange, user } = renderCzech();

    await user.click(input);
    await user.paste("2026-09-24");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-24");
    expect(input).toHaveValue("24.09.2026");
  });

  it("takes a day alone into a date-time field, with the time it had", async () => {
    const { input, onChange, user } = renderCzech({
      defaultValue: "2026-09-24T14:30",
      type: "datetime-local",
    });

    await user.clear(input);
    await user.type(input, "1.10.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-10-01T14:30");
    expect(input).toHaveValue("01.10.2026 14:30");

    await user.clear(input);
    await user.paste("2026-11-02T08:15");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-02T08:15");
  });

  it("takes a day alone like a day picked in the popup - moved into min", async () => {
    const { input, onChange, user } = renderCzech({
      min: "2026-09-24T10:00",
      minuteStep: 15,
      type: "datetime-local",
    });

    await user.type(input, "24.9.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-24T10:00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // A day before the day of min is still out of the range
    await user.clear(input);
    await user.type(input, "23.9.2026{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "„23.9.2026“ je mimo povolený rozsah.",
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("takes a day alone at midnight into an empty date-time field", async () => {
    const { input, onChange, user } = renderCzech({ type: "datetime-local" });

    await user.type(input, "1.10.2026{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-10-01T00:00");
  });
});

describe("DateTimePicker typed text and a pick of the same value", () => {
  it("drops the typed text for a day picked in the popup", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          defaultValue="2026-09-24"
          label="Day"
          onChange={(event) => onChange(event.target.value)}
          type="date"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Day/ });
    await user.click(input);
    await settle();
    await user.clear(input);
    await user.type(input, "25.9.2026");
    // The day selected already - the value stays, the typed text goes
    await user.click(screen.getByRole("button", { name: "24. září 2026" }));
    expect(input).toHaveValue("24.09.2026");
    await user.tab();
    expect(onChange).not.toHaveBeenCalledWith("2026-09-25");
  });

  it("drops the typed text for a time picked in the lists", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          defaultValue="09:30"
          label="Time"
          onChange={(event) => onChange(event.target.value)}
          type="time"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Time/ });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "14:00");
    const hours = await screen.findByRole("listbox", { name: "Hodiny" });
    await user.click(within(hours).getByRole("option", { name: "09" }));
    expect(input).toHaveValue("09:30");
    await user.tab();
    expect(onChange).not.toHaveBeenCalledWith("14:00");
  });
});
