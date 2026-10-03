import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DateTimePicker from ".";
import DateRangePicker from "../date-range-picker";
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

function renderPicker(props: React.ComponentProps<typeof DateTimePicker>) {
  const onChange = vi.fn();
  render(
    <DateTimePicker
      label="Day"
      onChange={(event) => onChange(event.target.value)}
      type="date"
      {...props}
    />,
  );
  return {
    input: screen.getByRole<HTMLInputElement>("combobox", { name: /Day/ }),
    onChange,
    user: userEvent.setup(),
  };
}

describe("DateTimePicker Today and Clear", () => {
  it("picks today and closes the popup", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026-08-10",
    });

    await user.click(input);
    const dialog = screen.getByRole("dialog", { name: "Select date" });
    await user.click(within(dialog).getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-24");
    expect(input).toHaveValue("09/24/2026");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("clears the value from the popup, back in the field", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026-09-10",
    });

    act(() => input.focus());
    await user.keyboard("{Enter}");
    await settle();
    act(() => screen.getByRole("button", { name: "Clear" }).focus());
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
    expect(input).toHaveValue("");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("offers Clear only for a value that may be cleared", async () => {
    const empty = renderPicker({});
    await empty.user.click(empty.input);
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("has no Clear for a required value, unless clearable", async () => {
    const { input, user } = renderPicker({
      defaultValue: "2026-09-10",
      required: true,
    });
    await user.click(input);
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("disables Today when today cannot be picked", async () => {
    const outOfRange = renderPicker({ min: "2026-10-01" });
    await outOfRange.user.click(outOfRange.input);
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("disables Today on a disabled day", async () => {
    const { input, user } = renderPicker({
      isDateDisabled: (day) => day.getDate() === 24,
    });
    await user.click(input);
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("leaves both out with popupActions={false}", async () => {
    const { input, user } = renderPicker({
      defaultValue: "2026-09-10",
      popupActions: false,
    });
    await user.click(input);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Today" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("is only in the date popup", async () => {
    const { input, user } = renderPicker({
      defaultValue: "2026-09-10T10:00",
      type: "datetime-local",
    });
    await user.click(input);
    expect(
      screen.queryByRole("button", { name: "Today" }),
    ).not.toBeInTheDocument();
  });

  it("speaks the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DateTimePicker defaultValue="2026-09-10" label="Den" type="date" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("combobox", { name: /Den/ }));
    expect(screen.getByRole("button", { name: "Dnes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vymazat" })).toBeInTheDocument();
  });
});

describe("DateTimePicker presets", () => {
  const presets = [
    { label: "Tomorrow", value: "2026-09-25" },
    { label: "In a week", value: "2026-10-01" },
    { label: "Weekend", value: "2026-09-26" },
    { label: "Too late", value: "2026-12-24" },
  ];

  it("picks the day of a preset and marks the current one", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026-09-25",
      isDateDisabled: (day) => day.getDay() === 6,
      max: "2026-10-31",
      presets,
    });

    await user.click(input);
    const group = screen.getByRole("group", { name: "Presets" });
    const tomorrow = within(group).getByRole("button", { name: "Tomorrow" });
    expect(tomorrow).toHaveAttribute("aria-pressed", "true");
    expect(
      within(group).getByRole("button", { name: "In a week" }),
    ).toHaveAttribute("aria-pressed", "false");
    // On a disabled day, and after `max`
    expect(
      within(group).getByRole("button", { name: "Weekend" }),
    ).toBeDisabled();
    expect(
      within(group).getByRole("button", { name: "Too late" }),
    ).toBeDisabled();

    await user.click(within(group).getByRole("button", { name: "In a week" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-01");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("DateTimePicker sizes and labels", () => {
  it("takes the extra small size of Input", () => {
    render(
      <>
        <DateTimePicker aria-label="Custom" dim="xs" type="date" />
        <DateTimePicker aria-label="Native" dim="xs" mode="native" />
        <DateRangePicker aria-label="Range" dim="xs" />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "Custom" })).toHaveClass(
      "px-1",
      "py-0",
      "text-sm",
    );
    expect(screen.getByLabelText("Native")).toHaveClass(
      "px-1",
      "py-0",
      "text-sm",
    );
    expect(screen.getByRole("combobox", { name: "Range" })).toHaveClass(
      "px-1",
      "py-0",
      "text-sm",
    );
  });

  it("takes a label of any content, which names the field", () => {
    render(
      <>
        <DateTimePicker
          label={
            <>
              Delivery <em>day</em>
            </>
          }
          type="date"
        />
        <DateTimePicker label={<span>Native day</span>} mode="native" />
        <DateRangePicker label={<b>Stay</b>} />
      </>,
    );

    expect(
      screen.getByRole("combobox", { name: "Delivery day:" }),
    ).not.toHaveAttribute("aria-label");
    expect(screen.getByLabelText("Native day:")).toHaveAttribute(
      "type",
      "date",
    );
    expect(screen.getByRole("combobox", { name: "Stay:" })).toBeInTheDocument();
  });

  it("marks a read-only field for assistive technology and styles", () => {
    render(<DateTimePicker defaultValue="2026-09-24" label="Day" readOnly />);

    const input = screen.getByRole("combobox", { name: /Day/ });
    expect(input).toHaveAttribute("aria-readonly", "true");
    expect(input).toHaveAttribute("data-readonly");
    expect(
      screen.queryByRole("button", { name: "Clear value" }),
    ).not.toBeInTheDocument();
  });
});

describe("DateTimePicker right to left", () => {
  it("moves forward with the left arrow in the day grid", async () => {
    mockRightToLeft();
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026-09-24",
    });

    act(() => input.focus());
    await user.keyboard("{Enter}");
    await settle();
    await user.keyboard("{ArrowLeft}");
    await settle();
    expect(
      screen.getByRole("button", { name: "September 25, 2026" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await settle();
    expect(
      screen.getByRole("button", { name: "September 23, 2026" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-09-23");
  });

  it("moves forward with the left arrow in the month grid", async () => {
    mockRightToLeft();
    const month = renderPicker({ defaultValue: "2026-09", type: "month" });
    act(() => month.input.focus());
    await month.user.keyboard("{Enter}");
    await settle();
    await month.user.keyboard("{ArrowLeft}");
    await settle();
    expect(screen.getByRole("button", { name: "October 2026" })).toHaveFocus();
    await month.user.keyboard("{Escape}");
  });

  it("moves forward with the left arrow in the week grid", async () => {
    mockRightToLeft();
    const week = renderPicker({ defaultValue: "2026-W39", type: "week" });
    act(() => week.input.focus());
    await week.user.keyboard("{Enter}");
    await settle();
    await week.user.keyboard("{ArrowLeft}");
    await settle();
    expect(screen.getByRole("button", { name: "Week 40, 2026" })).toHaveFocus();
  });

  it("flips the chevrons and the ends of a range band", async () => {
    const user = userEvent.setup();
    render(
      <DateRangePicker
        defaultValue={{ end: "2026-09-10", start: "2026-09-08" }}
        label="Stay"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Stay/ }));
    for (const name of ["Previous month", "Next month"]) {
      expect(
        screen.getByRole("button", { name }).querySelector("svg"),
      ).toHaveClass("rtl:-scale-x-100");
    }
    const cell = (name: string) =>
      screen.getByRole("button", { name }).closest("[role=gridcell]");
    // The start and the end of the band - the start is on the right in a
    // right-to-left page
    expect(cell("September 8, 2026")).toHaveClass("rounded-s");
    expect(cell("September 10, 2026")).toHaveClass("rounded-e");
  });

  it("opens the popup under the start of the field", async () => {
    mockRightToLeft();
    const { input, user } = renderPicker({});

    await user.click(input);
    // Aligned to the start edge of the field - its right one here
    const panel = screen.getByRole("dialog").closest(".inset-s-0");
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveClass("left-0", "right-0");
  });
});
