import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DateCalendar from ".";
import { cs } from "../../../i18n/cs";
import { en } from "../../../i18n/en";
import { createLocale } from "../../../i18n/format";
import UIProvider from "../../../providers/ui-provider";

/** Lets the frames the grid schedules (focus) run. */
const settle = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

// Today is Thursday, September 24, 2026 - only `Date` is faked, the timers
// of user-event run
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24, 12));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lays the page out right to left - jsdom knows no `dir`. */
function mockRightToLeft() {
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return new Proxy(style, {
      get: (target, property) => {
        if (property === "direction") return "rtl";
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

const day = (name: string) => screen.getByRole("button", { name });
const isSelected = (name: string) =>
  day(name).closest("[role=gridcell]")?.getAttribute("aria-selected") ===
  "true";
const getForm = () => screen.getByRole<HTMLFormElement>("form");
const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

describe("DateCalendar", () => {
  it("keeps month names, day labels and selected values in the same calendar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={createLocale(en, { code: "en-US-u-ca-persian" })}>
        <DateCalendar defaultValue="2026-09-10" onChange={onChange} />
      </UIProvider>,
    );

    expect(screen.getByRole("combobox", { name: "Month" })).toHaveDisplayValue(
      "September",
    );
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveDisplayValue(
      "2026",
    );
    const grid = screen.getByRole("grid", { name: "September 2026" });
    const target = within(grid).getByRole("button", {
      name: "September 24, 2026",
    });
    expect(target).toHaveTextContent("24");
    await user.click(target);
    expect(onChange).toHaveBeenCalledWith("2026-09-24");
  });

  it("is a group named by its label, with the grid of a month", () => {
    render(
      <DateCalendar
        defaultValue="2026-09-10"
        description="Any working day."
        error="Pick a day."
        label={
          <>
            Delivery <em>day</em>
          </>
        }
      />,
    );

    const group = screen.getByRole("group", { name: "Delivery day:" });
    expect(group).toHaveAccessibleDescription("Pick a day. Any working day.");
    expect(
      within(group).getByRole("grid", { name: "September 2026" }),
    ).toBeInTheDocument();
    expect(isSelected("September 10, 2026")).toBe(true);
    expect(day("September 24, 2026")).toHaveAttribute("aria-current", "date");
  });

  it("is named by aria-label without a label - or says what it is for", () => {
    const { unmount } = render(<DateCalendar aria-label="Due date" />);
    expect(screen.getByRole("group", { name: "Due date" })).toBeInTheDocument();
    unmount();

    render(<DateCalendar />);
    expect(
      screen.getByRole("group", { name: "Select date" }),
    ).toBeInTheDocument();
  });

  it("picks a day with a click, uncontrolled, and submits it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Order">
        <DateCalendar label="Day" name="day" onChange={onChange} />
      </form>,
    );

    expect(new FormData(getForm()).get("day")).toBe("");
    await user.click(day("September 28, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-28");
    expect(isSelected("September 28, 2026")).toBe(true);
    expect(day("September 28, 2026")).toHaveFocus();
    expect(new FormData(getForm()).get("day")).toBe("2026-09-28");

    // The same day again changes nothing
    await user.click(day("September 28, 2026"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is operated with the keyboard like the date popup", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <DateCalendar
          defaultValue="2026-09-10"
          label="Day"
          onChange={onChange}
        />
      </>,
    );

    act(() => screen.getByRole("button", { name: "Before" }).focus());
    // The month navigation, then the selected day
    await user.tab();
    expect(day("Previous month")).toHaveFocus();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(day("Next month")).toHaveFocus();
    await user.tab();
    expect(day("September 10, 2026")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    await settle();
    expect(day("September 17, 2026")).toHaveFocus();
    await user.keyboard("{PageDown}");
    await settle();
    expect(day("October 17, 2026")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-17");
  });

  it("leaves Escape to what it is in", async () => {
    const user = userEvent.setup();
    const prevented: boolean[] = [];
    render(
      <div onKeyDown={(event) => prevented.push(event.defaultPrevented)}>
        <DateCalendar defaultValue="2026-09-10" label="Day" />
      </div>,
    );

    act(() => day("September 10, 2026").focus());
    await user.keyboard("{Escape}");
    expect(prevented).toEqual([false]);
  });

  it("follows a controlled value, and keeps it when the parent does not change it", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = useState<string | null>("2026-09-10");
      return (
        <>
          <DateCalendar label="Day" onChange={setValue} value={value} />
          <button onClick={() => setValue("2026-11-05")} type="button">
            November
          </button>
          <DateCalendar label="Fixed" onChange={() => {}} value="2026-09-10" />
        </>
      );
    }

    render(<Controlled />);
    const [calendar, fixed] = screen.getAllByRole("group");

    await user.click(screen.getByRole("button", { name: "November" }));
    // The grid moves to the month of the new value
    expect(
      within(calendar).getByRole("grid", { name: "November 2026" }),
    ).toBeInTheDocument();
    expect(
      within(calendar)
        .getByRole("button", { name: "November 5, 2026" })
        .closest("[role=gridcell]"),
    ).toHaveAttribute("aria-selected", "true");

    await user.click(
      within(fixed).getByRole("button", { name: "September 12, 2026" }),
    );
    expect(
      within(fixed)
        .getByRole("button", { name: "September 10, 2026" })
        .closest("[role=gridcell]"),
    ).toHaveAttribute("aria-selected", "true");
  });

  it.each([false, true])(
    "clears a controlled value to null despite a default (multiple=%s)",
    async (multiple) => {
      const user = userEvent.setup();

      function Controlled() {
        const [value, setValue] = useState<string | null>("2026-09-10");
        const props = multiple
          ? {
              defaultValue: ["2026-09-10"],
              multiple: true as const,
              value: value ? [value] : null,
            }
          : { defaultValue: "2026-09-10", value };
        return (
          <form aria-label="Order">
            <DateCalendar {...props} label="Day" name="day" required />
            <button onClick={() => setValue(null)} type="button">
              Clear
            </button>
          </form>
        );
      }

      render(<Controlled />);
      expect(isSelected("September 10, 2026")).toBe(true);
      await user.click(screen.getByRole("button", { name: "Clear" }));
      expect(
        screen.queryAllByRole("gridcell", { selected: true }),
      ).toHaveLength(0);
      expect(new FormData(getForm()).getAll("day")).toEqual(
        multiple ? [] : [""],
      );
      expect(getForm().checkValidity()).toBe(false);
    },
  );

  it("brings back the default value on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <DateCalendar defaultValue="2026-09-10" label="Day" name="day" />
      </form>,
    );

    await user.click(day("September 15, 2026"));
    expect(new FormData(getForm()).get("day")).toBe("2026-09-15");
    act(() => getForm().reset());
    await waitFor(() => expect(isSelected("September 10, 2026")).toBe(true));
    expect(new FormData(getForm()).get("day")).toBe("2026-09-10");
  });

  it("belongs to the form of its form attribute", async () => {
    const user = userEvent.setup();
    render(
      <>
        <form aria-label="Order" id="order" />
        <DateCalendar
          defaultValue="2026-09-10"
          form="order"
          label="Day"
          name="day"
        />
      </>,
    );

    await user.click(day("September 15, 2026"));
    expect(new FormData(getForm()).get("day")).toBe("2026-09-15");
    act(() => getForm().reset());
    await waitFor(() =>
      expect(new FormData(getForm()).get("day")).toBe("2026-09-10"),
    );
  });

  it("disables the days out of min and max and those of isDateDisabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateCalendar
        defaultValue="2026-09-25"
        isDateDisabled={isWeekend}
        label="Day"
        max="2026-09-29"
        min="2026-09-08"
        onChange={onChange}
      />,
    );

    expect(day("September 7, 2026")).toBeDisabled();
    expect(day("September 30, 2026")).toBeDisabled();
    const saturday = day("September 26, 2026");
    expect(saturday).toBeEnabled();
    expect(saturday).toHaveAttribute("aria-disabled", "true");
    expect(saturday).toHaveClass("line-through");

    await user.click(saturday);
    expect(onChange).not.toHaveBeenCalled();

    // The keys land on it, Enter does not pick it
    act(() => day("September 25, 2026").focus());
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(saturday).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the form from being submitted with a value it cannot pick", () => {
    const { rerender } = render(
      <form aria-label="Order">
        <DateCalendar
          defaultValue="2026-09-26"
          isDateDisabled={isWeekend}
          label="Day"
          name="day"
        />
      </form>,
    );

    const validation = () =>
      getForm().querySelector<HTMLInputElement>("input[type=text]");
    expect(getForm().checkValidity()).toBe(false);
    expect(validation()?.validationMessage).toBe(
      "09/26/2026 cannot be selected.",
    );

    rerender(
      <UIProvider locale={cs}>
        <form aria-label="Order">
          <DateCalendar
            defaultValue="2026-10-01"
            label="Day"
            max="2026-09-30"
            name="day"
          />
        </form>
      </UIProvider>,
    );
    expect(validation()?.validationMessage).toBe(
      "Zadejte hodnotu 30.09.2026 nebo dřívější.",
    );
  });

  it("restores validity when a read-only calendar becomes editable", () => {
    const calendar = (readOnly: boolean) => (
      <form aria-label="Order">
        <DateCalendar
          defaultValue="2026-09-01"
          min="2026-09-10"
          name="day"
          readOnly={readOnly}
        />
      </form>
    );
    const { rerender } = render(calendar(true));
    expect(getForm().checkValidity()).toBe(true);

    for (let cycle = 0; cycle < 2; cycle++) {
      rerender(calendar(false));
      expect(getForm().checkValidity()).toBe(false);
      expect(
        getForm().querySelector<HTMLInputElement>("input[type=text]")
          ?.validationMessage,
      ).toBe("Enter a value of 09/10/2026 or later.");
      rerender(calendar(true));
      expect(getForm().checkValidity()).toBe(true);
    }
  });

  it("checks the value against the days of min and max the grid shows", () => {
    const calendar = (min: string) => (
      <form aria-label="Order">
        <DateCalendar
          defaultValue="2026-09-24"
          label="Day"
          min={min}
          name="day"
        />
      </form>
    );

    // The day of a limit with a time - it can be picked, and is valid
    const { rerender } = render(calendar("2026-09-24T10:00"));
    expect(day("September 23, 2026")).toBeDisabled();
    expect(day("September 24, 2026")).toBeEnabled();
    expect(getForm().checkValidity()).toBe(true);

    // No day at all - no limit, in the grid nor for the form
    rerender(calendar("2026-9-1"));
    expect(day("September 1, 2026")).toBeEnabled();
    expect(getForm().checkValidity()).toBe(true);
  });

  it("marks the new today after midnight, in a calendar left open", () => {
    render(<DateCalendar label="Day" />);
    const today = () => document.querySelector('[aria-current="date"]');
    expect(today()).toHaveAccessibleName("September 24, 2026");

    // Only `Date` is faked - the page getting the focus looks at the day
    // again, as after a device slept through midnight
    vi.setSystemTime(new Date(2026, 8, 25, 0, 1));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(today()).toHaveAccessibleName("September 25, 2026");
  });

  it("enforces required and gives the focus to the calendar", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <DateCalendar label="Day" name="day" required />
      </form>,
    );

    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
    const validation =
      getForm().querySelector<HTMLInputElement>("input[type=text]");
    // Out of the tab order and of the accessibility tree
    expect(validation).toHaveAttribute("inert");
    expect(validation).toHaveAttribute("tabindex", "-1");
    expect(getForm().checkValidity()).toBe(false);

    // The browser focuses the invalid input - the calendar takes it
    fireEvent.invalid(validation!);
    act(() => validation!.focus());
    expect(day("September 24, 2026")).toHaveFocus();

    await user.click(day("September 28, 2026"));
    expect(getForm().checkValidity()).toBe(true);
  });

  it("rings a day only while it has the keyboard focus", () => {
    render(<DateCalendar defaultValue="2026-09-10" label="Day" />);

    // Not the day in the tab order without the focus, as in a popup
    const tabStop = day("September 10, 2026");
    expect(tabStop).toHaveAttribute("tabindex", "0");
    expect(tabStop).not.toHaveClass("ring-2");
    expect(tabStop).toHaveClass("focus-visible:ring-2");
    expect(day("September 11, 2026")).toHaveClass("focus-visible:ring-2");
  });

  it("focuses the day in the tab order when its label is clicked", async () => {
    const user = userEvent.setup();
    render(<DateCalendar defaultValue="2026-09-10" label="Day" />);

    await user.click(screen.getByText("Day:"));
    expect(day("September 10, 2026")).toHaveFocus();
  });

  it("is disabled - also by a disabled fieldset - and then not submitted", () => {
    render(
      <form aria-label="Order">
        <fieldset disabled>
          <DateCalendar defaultValue="2026-09-10" label="Day" name="day" />
        </fieldset>
        <DateCalendar
          defaultValue="2026-09-10"
          disabled
          label="Other"
          name="other"
        />
      </form>,
    );

    for (const group of screen.getAllByRole("group", { name: /Day|Other/ })) {
      for (const button of within(group).getAllByRole("button")) {
        expect(button).toBeDisabled();
      }
      for (const select of within(group).getAllByRole("combobox")) {
        expect(select).toBeDisabled();
      }
    }
    const data = new FormData(getForm());
    expect(data.has("day")).toBe(false);
    expect(data.has("other")).toBe(false);
  });

  it("is read-only - browsed but not changed, and submitted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Order">
        <DateCalendar
          defaultValue="2026-09-10"
          label="Day"
          name="day"
          onChange={onChange}
          readOnly
          required
        />
      </form>,
    );

    const group = screen.getByRole("group", { name: /Day/ });
    expect(group).toHaveAttribute("data-readonly");
    expect(screen.getByRole("grid")).toHaveAttribute("aria-readonly", "true");

    await user.click(day("September 15, 2026"));
    expect(onChange).not.toHaveBeenCalled();
    expect(isSelected("September 10, 2026")).toBe(true);
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(day("September 16, 2026")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(day("Next month"));
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(new FormData(getForm()).get("day")).toBe("2026-09-10");
  });

  it("starts the week as the locale does", () => {
    render(
      <UIProvider locale={cs}>
        <DateCalendar label="Den" />
      </UIProvider>,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveAccessibleName("Pondělí");
    expect(day("24. září 2026")).toBeInTheDocument();
  });

  it("reports the focus entering and leaving the calendar as a whole", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <DateCalendar
          defaultValue="2026-09-10"
          label="Day"
          onBlur={onBlur}
          onFocus={onFocus}
        />
        <button type="button">After</button>
      </>,
    );

    await user.click(day("September 10, 2026"));
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "After" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("moves forward with the left arrow in a right-to-left page", async () => {
    mockRightToLeft();
    const user = userEvent.setup();
    render(<DateCalendar defaultValue="2026-09-10" label="Day" />);

    act(() => day("September 10, 2026").focus());
    await user.keyboard("{ArrowLeft}");
    await settle();
    expect(day("September 11, 2026")).toHaveFocus();
  });
});

describe("DateCalendar with multiple", () => {
  it("adds and removes days, and submits each", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Order">
        <DateCalendar
          defaultValue={["2026-09-10"]}
          label="Days"
          multiple
          name="days"
          onChange={onChange}
        />
      </form>,
    );

    expect(screen.getByRole("grid")).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
    expect(screen.getByText("1 day selected")).toBeInTheDocument();

    await user.click(day("September 3, 2026"));
    expect(onChange).toHaveBeenLastCalledWith(["2026-09-03", "2026-09-10"]);
    expect(screen.getByText("2 days selected")).toBeInTheDocument();
    expect(isSelected("September 3, 2026")).toBe(true);
    expect(isSelected("September 10, 2026")).toBe(true);

    await user.keyboard("{ArrowRight}");
    await settle();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith([
      "2026-09-03",
      "2026-09-04",
      "2026-09-10",
    ]);

    await user.click(day("September 10, 2026"));
    expect(onChange).toHaveBeenLastCalledWith(["2026-09-03", "2026-09-04"]);
    expect(new FormData(getForm()).getAll("days")).toEqual([
      "2026-09-03",
      "2026-09-04",
    ]);

    act(() => getForm().reset());
    await waitFor(() =>
      expect(new FormData(getForm()).getAll("days")).toEqual(["2026-09-10"]),
    );
  });

  it("stays in the month where the picking goes on", async () => {
    const user = userEvent.setup();
    render(
      <DateCalendar
        defaultValue={["2026-09-10", "2026-11-03"]}
        label="Days"
        multiple
      />,
    );

    expect(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    // Removing the first day does not jump to November
    await user.click(day("September 10, 2026"));
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
  });

  it("follows an external value after a local pick", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DateCalendar multiple onChange={onChange} value={["2026-09-10"]} />,
    );

    await user.click(day("September 11, 2026"));
    expect(onChange).toHaveBeenLastCalledWith(["2026-09-10", "2026-09-11"]);
    rerender(
      <DateCalendar
        multiple
        onChange={onChange}
        value={["2026-09-10", "2026-09-11"]}
      />,
    );

    rerender(
      <DateCalendar multiple onChange={onChange} value={["2027-02-20"]} />,
    );
    expect(screen.getByRole("grid", { name: "February 2027" })).toBeVisible();
    expect(isSelected("February 20, 2027")).toBe(true);

    // Returning to the earlier selection must not revive the old pick.
    rerender(
      <DateCalendar
        multiple
        onChange={onChange}
        value={["2026-09-10", "2026-09-11"]}
      />,
    );
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    expect(day("September 10, 2026")).toHaveAttribute("tabindex", "0");
  });

  it("keeps the picking month when the parent accepts a removal later", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DateCalendar
        multiple
        onChange={onChange}
        value={["2026-09-10", "2026-11-03"]}
      />,
    );

    await user.click(day("September 10, 2026"));
    expect(onChange).toHaveBeenLastCalledWith(["2026-11-03"]);
    rerender(
      <DateCalendar multiple onChange={onChange} value={["2026-11-03"]} />,
    );
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();

    // An equivalent array on a later render is not a new selection.
    rerender(
      <DateCalendar multiple onChange={onChange} value={["2026-11-03"]} />,
    );
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();

    rerender(
      <DateCalendar
        multiple
        onChange={onChange}
        value={["2026-09-10", "2026-11-03"]}
      />,
    );
    rerender(
      <DateCalendar multiple onChange={onChange} value={["2026-11-03"]} />,
    );
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeVisible();
  });

  it("returns to the default month when the form resets after a pick", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <DateCalendar defaultValue={["2026-09-10"]} multiple name="days" />
      </form>,
    );

    await user.click(day("Next month"));
    await user.click(day("October 15, 2026"));
    expect(new FormData(getForm()).getAll("days")).toEqual([
      "2026-09-10",
      "2026-10-15",
    ]);
    act(() => getForm().reset());
    await waitFor(() =>
      expect(
        screen.getByRole("grid", { name: "September 2026" }),
      ).toBeVisible(),
    );
    expect(isSelected("September 10, 2026")).toBe(true);
    expect(new FormData(getForm()).getAll("days")).toEqual(["2026-09-10"]);
  });

  it("says how many days are selected in the language of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <DateCalendar
          defaultValue={["2026-09-10", "2026-09-11", "2026-09-12"]}
          label="Dny"
          multiple
        />
      </UIProvider>,
    );

    expect(screen.getByText("Vybrány 3 dny")).toBeInTheDocument();
  });

  it("submits nothing without a day, and requires one when required", () => {
    render(
      <form aria-label="Order">
        <DateCalendar label="Days" multiple name="days" required />
      </form>,
    );

    expect(new FormData(getForm()).getAll("days")).toEqual([]);
    expect(getForm().checkValidity()).toBe(false);
  });
});

describe("DateCalendar on the server", () => {
  it.each([
    {
      boundary: "month",
      serverTime: new Date(2026, 8, 30, 23, 59, 59),
      browserTime: new Date(2026, 9, 1, 0, 0, 1),
      todayLabel: "October 1, 2026",
      todayValue: "2026-10-01",
    },
    {
      boundary: "year",
      serverTime: new Date(2026, 11, 31, 23, 59, 59),
      browserTime: new Date(2027, 0, 1, 0, 0, 1),
      todayLabel: "January 1, 2027",
      todayValue: "2027-01-01",
    },
  ])(
    "hydrates an empty calendar across a $boundary boundary",
    async ({ serverTime, browserTime, todayLabel, todayValue }) => {
      const onChange = vi.fn();
      const calendar = (
        <form>
          <DateCalendar name="day" onChange={onChange} />
        </form>
      );
      vi.setSystemTime(serverTime);
      const container = document.createElement("div");
      container.innerHTML = renderToString(calendar);
      document.body.append(container);
      const form = container.querySelector("form")!;
      expect(container.querySelector("[role='grid']")).toBeNull();

      vi.setSystemTime(browserTime);
      const onRecoverableError = vi.fn();
      const root = await act(async () =>
        hydrateRoot(container, calendar, { onRecoverableError }),
      );
      try {
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(container.querySelector("form")).toBe(form);
        const today = container.querySelector<HTMLButtonElement>(
          "[aria-current='date']",
        )!;
        expect(today).toHaveAccessibleName(todayLabel);
        expect(today).toHaveAttribute("tabindex", "0");
        expect(new FormData(form).get("day")).toBe("");
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(today);
        expect(new FormData(form).get("day")).toBe(todayValue);
        expect(onChange).toHaveBeenCalledTimes(1);
      } finally {
        act(() => root.unmount());
        container.remove();
      }
    },
  );

  it("keeps the selected month when the browser hydrates in another year", async () => {
    const calendar = <DateCalendar defaultValue="2000-05-10" name="day" />;
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    const container = document.createElement("div");
    container.innerHTML = renderToString(calendar);
    document.body.append(container);
    const grid = within(container).getByRole("grid", { name: "May 2000" });

    vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 1));
    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, calendar, { onRecoverableError }),
    );
    try {
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(within(container).getByRole("grid", { name: "May 2000" })).toBe(
        grid,
      );
      expect(
        within(grid)
          .getByRole("button", { name: "May 10, 2000" })
          .closest("[role='gridcell']"),
      ).toHaveAttribute("aria-selected", "true");
      expect(container.querySelector("input[name='day']")).toHaveValue(
        "2000-05-10",
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("renders without the browser, then hydrates without a mismatch", async () => {
    const calendar = (
      <UIProvider locale={cs}>
        <form>
          <DateCalendar
            description="Pracovní dny"
            isDateDisabled={isWeekend}
            label="Den"
            name="day"
            required
          />
          <DateCalendar
            defaultValue={["2026-09-10"]}
            label="Dny"
            multiple
            name="days"
          />
        </form>
      </UIProvider>
    );

    // Nothing of the browser is touched while rendering
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("navigator", undefined);
    const html = renderToString(calendar);
    vi.unstubAllGlobals();

    expect(html).toContain("Pracovní dny");
    expect(html).toContain('name="days" value="2026-09-10"');
    // Today is marked in the browser only
    expect(html).not.toContain('aria-current="date"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, calendar, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(
      container.querySelector("[aria-current='date']"),
    ).toHaveAccessibleName("24. září 2026");

    act(() => root.unmount());
    container.remove();
  });
});
