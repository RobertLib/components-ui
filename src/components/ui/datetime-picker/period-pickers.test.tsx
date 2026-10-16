import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DateTimePicker from ".";
import { cs } from "../../../i18n/ui/cs";
import { en } from "../../../i18n/ui/en";
import { createLocale } from "../../../i18n/ui/format";
import type { Locale } from "../../../i18n/ui/types";
import UIProvider from "../../../providers/ui-provider";

/** Lets the frames the popup schedules (focus, scrolling) run. */
const settle = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

// Today is Thursday, September 24, 2026 - in the third quarter. Only `Date`
// is faked, the timers of the popup and of user-event run.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPicker(
  props: React.ComponentProps<typeof DateTimePicker>,
  locale?: Locale,
) {
  const onChange = vi.fn();
  const picker = (
    <DateTimePicker
      label="Period"
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  );
  render(locale ? <UIProvider locale={locale}>{picker}</UIProvider> : picker);
  return {
    input: screen.getByRole<HTMLInputElement>("combobox", { name: /Period/ }),
    onChange,
    user: userEvent.setup(),
  };
}

/** Renders a picker and opens it from the keyboard - the focus goes in. */
async function openByKeyboard(
  props: React.ComponentProps<typeof DateTimePicker>,
) {
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

const button = (name: string) => screen.getByRole("button", { name });

describe("DateTimePicker type year", () => {
  it("shows the year and picks one of a page of twelve", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026",
      type: "year",
    });
    expect(input).toHaveValue("2026");
    expect(input).toHaveAttribute("placeholder", "YYYY");

    await user.click(input);
    const dialog = screen.getByRole("dialog", { name: "Select year" });
    // The decade of the value, with the two years after it
    const grid = within(dialog).getByRole("grid", { name: "2020 – 2031" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(12);
    expect(within(grid).getAllByRole("row")).toHaveLength(4);
    expect(
      button("2026").closest("[role=gridcell]")?.getAttribute("aria-selected"),
    ).toBe("true");

    await user.click(button("2029"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2029");
    expect(input).toHaveValue("2029");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pages by twelve years", async () => {
    const { input, user } = renderPicker({ type: "year" });

    await user.click(input);
    // Without a value at this year
    expect(button("2026")).toHaveAttribute("tabindex", "0");
    await user.click(button("Next years"));
    expect(screen.getByRole("grid", { name: "2032 – 2043" })).toBeVisible();
    // The focused place on the page stays
    expect(button("2038")).toHaveAttribute("tabindex", "0");
    await user.click(button("Previous years"));
    await user.click(button("Previous years"));
    expect(screen.getByRole("grid", { name: "2008 – 2019" })).toBeVisible();
  });

  it("moves with the keys over the pages and stops at min and max", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2029",
      max: 2045,
      min: 2025,
      type: "year",
    });
    expect(button("2029")).toHaveFocus();

    // On into the next page
    await press(user, "{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(button("2032")).toHaveFocus();
    expect(screen.getByRole("grid", { name: "2032 – 2043" })).toBeVisible();
    await press(user, "{ArrowUp}");
    expect(button("2029")).toHaveFocus();
    expect(screen.getByRole("grid", { name: "2020 – 2031" })).toBeVisible();
    await press(user, "{Home}");
    expect(button("2025")).toHaveFocus();
    await press(user, "{ArrowLeft}");
    expect(button("2025")).toHaveFocus();
    expect(button("2024")).toBeDisabled();

    await press(user, "{PageDown}");
    expect(button("2037")).toHaveFocus();
    await press(user, "{PageDown}");
    expect(button("2045")).toHaveFocus();
    expect(screen.getByRole("grid", { name: "2044 – 2055" })).toBeVisible();
    await press(user, "{End}");
    expect(button("2045")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2045");
  });

  it("reads a typed year, also of two digits", async () => {
    const { input, onChange, user } = renderPicker({ type: "year" });

    await user.type(input, "2031{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2031");
    await user.clear(input);
    await user.type(input, "85{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("1985");
    expect(input).toHaveValue("1985");

    await user.clear(input);
    await user.type(input, "198{Enter}");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(input).toHaveValue("1985");
    expect(input).toHaveAccessibleDescription(
      "“198” is not a valid value. Use the format YYYY.",
    );
  });

  it("makes a year out of min and max invalid", () => {
    renderPicker({ defaultValue: "2019", min: "2020", type: "year" });
    const input = screen.getByRole<HTMLInputElement>("combobox");
    expect(input.validationMessage).toBe("Enter a value of 2020 or later.");
  });

  it("submits the value and brings back the default on reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DateTimePicker
          defaultValue="2026"
          label="Fiscal year"
          name="year"
          type="year"
        />
        <button type="reset">Reset</button>
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    const input = screen.getByRole("combobox", { name: /Fiscal year/ });

    await user.click(input);
    await user.click(button("2024"));
    expect(new FormData(form).get("year")).toBe("2024");
    await user.click(button("Reset"));
    expect(new FormData(form).get("year")).toBe("2026");
    expect(input).toHaveValue("2026");
  });

  it("is a number input in native mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DateTimePicker
          defaultValue="2026"
          label="Year"
          max={2030}
          min={2020}
          mode="native"
          name="year"
          onChange={(event) => onChange(event.target.value)}
          type="year"
        />
      </form>,
    );
    const input = screen.getByRole<HTMLInputElement>("spinbutton", {
      name: /Year/,
    });
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("min", "2020");
    expect(input).toHaveAttribute("max", "2030");

    await user.clear(input);
    await user.type(input, "2027");
    expect(onChange).toHaveBeenLastCalledWith("2027");
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("year"),
    ).toBe("2027");
  });

  it.each(["26", "-5", "12345", "2026.5"])(
    "refuses %s in native mode - no year of four digits",
    async (text) => {
      const user = userEvent.setup();
      render(
        <form aria-label="Report">
          <DateTimePicker label="Year" mode="native" name="year" type="year" />
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form");
      const input = screen.getByRole<HTMLInputElement>("spinbutton", {
        name: /Year/,
      });

      await user.type(input, text);
      expect(form.checkValidity()).toBe(false);
      expect(input.validationMessage).toBe(
        `“${text}” is not a valid value. Use the format YYYY.`,
      );

      await user.clear(input);
      await user.type(input, "2026");
      expect(form.checkValidity()).toBe(true);
    },
  );

  it("disables a year without a day that can be picked", async () => {
    const { input, user } = renderPicker({
      defaultValue: "2027",
      // Nothing of 2027 can be picked
      isDateDisabled: (date) => date.getFullYear() === 2027,
      type: "year",
    });
    expect(input.validationMessage).toBe("2027 cannot be selected.");

    await user.click(input);
    expect(button("2027")).toHaveAttribute("aria-disabled", "true");
    expect(button("2027")).toHaveClass("line-through");
    expect(button("2026")).not.toHaveAttribute("aria-disabled");
  });
});

describe("DateTimePicker type quarter", () => {
  it("shows the quarter as the locale writes it", () => {
    renderPicker({ defaultValue: "2026-Q3", type: "quarter" });
    expect(screen.getByRole("combobox")).toHaveValue("Q3 2026");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Q YYYY",
    );
  });

  it("shows the quarter in Czech", async () => {
    const { input, user } = renderPicker(
      { defaultValue: "2026-Q3", type: "quarter" },
      cs,
    );
    expect(input).toHaveValue("3. čtvrtletí 2026");
    expect(input).toHaveAttribute("placeholder", "Q. RRRR");

    await user.click(input);
    const dialog = screen.getByRole("dialog", { name: "Vyberte čtvrtletí" });
    expect(within(dialog).getByRole("grid", { name: "2026" })).toBeVisible();
    expect(button("1. čtvrtletí 2026")).toHaveTextContent(
      "1. čtvrtletíLed – Bře",
    );
    expect(button("Následující rok")).toBeVisible();
  });

  it("picks a quarter, also of another year", async () => {
    const { input, onChange, user } = renderPicker({ type: "quarter" });

    await user.click(input);
    const grid = screen.getByRole("grid", { name: "2026" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(4);
    expect(within(grid).getAllByRole("row")).toHaveLength(2);
    // Without a value at the quarter of today
    expect(button("Q3 2026")).toHaveAttribute("tabindex", "0");
    expect(button("Q1 2026")).toHaveTextContent("Q1Jan – Mar");

    await user.click(button("Next year"));
    await user.click(button("Q2 2027"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2027-Q2");
    expect(input).toHaveValue("Q2 2027");
  });

  it("moves with the keys into the next year and stops at min and max", async () => {
    const { onChange, user } = await openByKeyboard({
      defaultValue: "2026-Q3",
      max: "2027-Q2",
      min: "2026-Q2",
      type: "quarter",
    });
    expect(button("Q3 2026")).toHaveFocus();

    await press(user, "{ArrowDown}");
    expect(button("Q1 2027")).toHaveFocus();
    // Moved to `max`, no further
    await press(user, "{ArrowDown}");
    expect(button("Q2 2027")).toHaveFocus();
    await press(user, "{ArrowRight}");
    expect(button("Q2 2027")).toHaveFocus();
    await press(user, "{PageUp}");
    expect(button("Q2 2026")).toHaveFocus();
    await press(user, "{ArrowLeft}");
    expect(button("Q2 2026")).toHaveFocus();
    expect(button("Q1 2026")).toBeDisabled();
    await press(user, "{End}");
    expect(button("Q4 2026")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-Q4");
  });

  it.each([
    ["Q4 2027", "2027-Q4"],
    ["4/2027", "2027-Q4"],
    ["2027-Q1", "2027-Q1"],
    ["2027 Q2", "2027-Q2"],
    ["quarter 2 2027", "2027-Q2"],
    // The year left out is the current one
    ["Q1", "2026-Q1"],
  ])("reads the typed %s", async (text, value) => {
    const { input, onChange, user } = renderPicker({ type: "quarter" });

    await user.type(input, `${text}{Enter}`);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(value);
  });

  it.each([
    ["3. čtvrtletí 2026", "2026-Q3"],
    ["3. ctvrtleti 2026", "2026-Q3"],
    ["3/26", "2026-Q3"],
    ["Q2 2027", "2027-Q2"],
    ["Q2/2027", "2027-Q2"],
  ])("reads the typed %s in Czech", async (text, value) => {
    const { input, onChange, user } = renderPicker({ type: "quarter" }, cs);

    await user.type(input, `${text}{Enter}`);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(value);
  });

  it("refuses a fifth quarter and one out of the limits", async () => {
    const { input, onChange, user } = renderPicker({
      max: "2026-Q4",
      type: "quarter",
    });

    await user.type(input, "Q5 2026{Enter}");
    expect(input).toHaveAccessibleDescription(
      "“Q5 2026” is not a valid value. Use the format Q YYYY.",
    );
    await user.clear(input);
    await user.type(input, "Q1 2027{Enter}");
    expect(input).toHaveAccessibleDescription(
      "“Q1 2027” is outside the allowed range.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables a quarter without a day that can be picked", async () => {
    const { input, user } = renderPicker({
      defaultValue: "2026-Q1",
      // The first quarter is closed
      isDateDisabled: (date) => date.getMonth() < 3,
      type: "quarter",
    });
    expect(input.validationMessage).toBe("Q1 2026 cannot be selected.");

    await user.click(input);
    await user.click(button("Q1 2026"));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(button("Q1 2026")).toHaveAttribute("aria-disabled", "true");
    expect(button("Q2 2026")).not.toHaveAttribute("aria-disabled");
  });

  it("offers presets beside the quarters", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026-Q2",
      max: "2026-Q4",
      presets: [
        { label: "Last quarter", value: "2026-Q2" },
        { label: "Next year", value: "2027-Q1" },
        { label: "Broken", value: "2026-Q7" },
      ],
      type: "quarter",
    });

    await user.click(input);
    const presets = screen.getByRole("group", { name: "Presets" });
    const preset = (name: string) =>
      within(presets).getByRole("button", { name });
    expect(preset("Last quarter")).toHaveAttribute("aria-pressed", "true");
    expect(preset("Next year")).toBeDisabled();
    expect(preset("Broken")).toBeDisabled();

    await user.click(preset("Last quarter"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-Q2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the custom picker in native mode", () => {
    renderPicker({ defaultValue: "2026-Q3", mode: "native", type: "quarter" });
    expect(screen.getByRole("combobox")).toHaveValue("Q3 2026");
  });

  it("works as the custom picker in native mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DateTimePicker
          defaultValue="2026-Q3"
          label="Quarter"
          mode="native"
          name="quarter"
          onChange={(event) => onChange(event.target.value)}
          type="quarter"
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    const input = screen.getByRole("combobox", { name: /Quarter/ });

    // The field writing the picked quarter is no value a script wrote
    await user.click(input);
    await user.click(button("Q1 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-Q1");
    expect(input).toHaveValue("Q1 2026");
    expect(new FormData(form).get("quarter")).toBe("2026-Q1");

    await user.clear(input);
    await user.type(input, "Q2 2026{Enter}");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("2026-Q2");
    expect(new FormData(form).get("quarter")).toBe("2026-Q2");
  });

  it("drops a malformed value like a native input", () => {
    render(
      <form aria-label="Report">
        <DateTimePicker
          defaultValue="2026-Q0"
          label="Quarter"
          name="quarter"
          required
          type="quarter"
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(new FormData(form).get("quarter")).toBe("");
    expect(form.checkValidity()).toBe(false);
  });
});

describe("DateTimePicker periods in a locale of an app", () => {
  it("takes the default patterns of a locale without them", () => {
    // A locale written before the quarter and the year formats
    const { quarter: _quarter, year: _year, ...formats } = en.formats;
    const locale = createLocale({ ...en, formats }, { code: "de-DE" });
    renderPicker({ defaultValue: "2026-Q4", type: "quarter" }, locale);
    expect(screen.getByRole("combobox")).toHaveValue("Q4 2026");
  });

  it("writes months as before", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: "2026-09",
      presets: [{ label: "Start", value: "2026-01" }],
      type: "month",
    });
    expect(input).toHaveValue("09/2026");

    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-01");
  });
});
