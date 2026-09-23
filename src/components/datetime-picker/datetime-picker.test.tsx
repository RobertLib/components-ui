import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
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

    await user.click(screen.getByRole("button", { name: "Clear value" }));

    expect(onChange).toHaveBeenCalledWith("");
    const input = screen.getByRole("combobox", { name: /Day/ });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
