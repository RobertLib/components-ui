import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RangeCalendar from ".";
import type { DateRange } from "../date-range-picker";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

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

const day = (name: string) => screen.getByRole("button", { name });
const isInRange = (name: string) =>
  day(name).closest("[role=gridcell]")?.getAttribute("aria-selected") ===
  "true";
const getForm = () => screen.getByRole<HTMLFormElement>("form");
const september: DateRange = { end: "2026-09-12", start: "2026-09-08" };

describe("RangeCalendar", () => {
  it("picks the first day, then the last, and submits the range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Booking">
        <RangeCalendar
          endName="to"
          label="Stay"
          name="stay"
          onChange={onChange}
          startName="from"
        />
      </form>,
    );

    expect(screen.getByRole("group", { name: "Stay:" })).toBeInTheDocument();
    expect(screen.getByText("Select the first day")).toBeInTheDocument();
    await user.click(day("September 24, 2026"));
    expect(screen.getByText("Select the last day")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.hover(day("September 27, 2026"));
    expect(isInRange("September 26, 2026")).toBe(true);
    expect(screen.getByText("4 days")).toBeInTheDocument();

    await user.click(day("September 27, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-27",
      start: "2026-09-24",
    });
    // Ready for the next range
    expect(screen.getByText("Select the first day")).toBeInTheDocument();

    const data = new FormData(getForm());
    expect(data.get("stay")).toBe("2026-09-24/2026-09-27");
    expect(data.get("from")).toBe("2026-09-24");
    expect(data.get("to")).toBe("2026-09-27");
  });

  it("picks a range with the keyboard, and Escape drops one picked halfway", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const prevented: boolean[] = [];
    render(
      <div onKeyDown={(event) => prevented.push(event.defaultPrevented)}>
        <RangeCalendar
          defaultValue={september}
          label="Stay"
          onChange={onChange}
        />
      </div>,
    );

    act(() => day("September 8, 2026").focus());
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}");
    await settle();
    // The range follows the focus
    expect(isInRange("September 14, 2026")).toBe(true);
    await user.keyboard("{Escape}");
    // Enter is the button's, the arrow and Escape the calendar's
    expect(prevented).toEqual([false, true, true]);
    expect(screen.getByText("Select the first day")).toBeInTheDocument();
    expect(isInRange("September 14, 2026")).toBe(false);
    expect(isInRange("September 12, 2026")).toBe(true);

    // Nothing picked halfway - Escape is left alone
    await user.keyboard("{Escape}");
    expect(prevented.at(-1)).toBe(false);

    await user.keyboard("{Enter}{ArrowRight}");
    await settle();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-16",
      start: "2026-09-15",
    });
  });

  it("follows a controlled value and brings back the default on a reset", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = useState<DateRange | null>(september);
      return (
        <>
          <RangeCalendar label="Controlled" onChange={setValue} value={value} />
          <button onClick={() => setValue(null)} type="button">
            Clear
          </button>
        </>
      );
    }

    const { unmount } = render(<Controlled />);
    expect(isInRange("September 10, 2026")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(isInRange("September 10, 2026")).toBe(false);
    unmount();

    render(
      <form aria-label="Booking">
        <RangeCalendar defaultValue={september} label="Stay" name="stay" />
      </form>,
    );
    await user.click(day("September 20, 2026"));
    await user.click(day("September 21, 2026"));
    expect(new FormData(getForm()).get("stay")).toBe("2026-09-20/2026-09-21");
    act(() => getForm().reset());
    expect(new FormData(getForm()).get("stay")).toBe("2026-09-08/2026-09-12");
  });

  it("shows two months with months={2}", () => {
    render(<RangeCalendar label="Stay" months={2} />);
    expect(
      screen
        .getAllByRole("grid")
        .map((grid) => grid.getAttribute("aria-label")),
    ).toEqual(["September 2026", "October 2026"]);
  });

  it("stops a range before a disabled day, and makes a range over one invalid", async () => {
    const user = userEvent.setup();
    const isBooked = (date: Date) =>
      date.getMonth() === 8 && date.getDate() === 29;
    render(
      <form aria-label="Booking">
        <RangeCalendar
          defaultValue={{ end: "2026-09-30", start: "2026-09-27" }}
          isDateDisabled={isBooked}
          label="Stay"
          name="stay"
        />
      </form>,
    );

    const validation = () =>
      getForm().querySelector<HTMLInputElement>("input[type=text]");
    expect(validation()?.validationMessage).toBe(
      "The range includes 09/29/2026, which cannot be selected.",
    );
    expect(getForm().checkValidity()).toBe(false);

    await user.click(day("September 26, 2026"));
    expect(day("September 30, 2026")).toHaveAttribute("aria-disabled", "true");
    await user.click(day("September 28, 2026"));
    expect(new FormData(getForm()).get("stay")).toBe("2026-09-26/2026-09-28");
    expect(validation()).toBeNull();
    expect(getForm().checkValidity()).toBe(true);
  });

  it("allows disabled days inside a range with allowDisabledInRange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeCalendar
        allowDisabledInRange
        isDateDisabled={(date) => date.getDay() === 0 || date.getDay() === 6}
        label="Working days"
        onChange={onChange}
      />,
    );

    await user.click(day("September 24, 2026"));
    await user.click(day("September 29, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-29",
      start: "2026-09-24",
    });
  });

  it("enforces required and the limits of min, max and the length", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Booking">
        <RangeCalendar
          label="Stay"
          max="2026-09-28"
          maxDays={3}
          min="2026-09-10"
          name="stay"
          required
        />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    expect(day("September 9, 2026")).toBeDisabled();
    expect(day("September 29, 2026")).toBeDisabled();

    await user.click(day("September 20, 2026"));
    expect(day("September 23, 2026")).toHaveAttribute("aria-disabled", "true");
    await user.click(day("September 22, 2026"));
    expect(getForm().checkValidity()).toBe(true);
  });

  it("offers presets beside the days", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RangeCalendar
        label="Period"
        onChange={onChange}
        presets={[
          "last7Days",
          { label: "Q3", range: { end: "2026-09-30", start: "2026-07-01" } },
        ]}
      />,
    );

    const presets = screen.getByRole("group", { name: "Presets" });
    await user.click(
      within(presets).getByRole("button", { name: "Last 7 days" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      end: "2026-09-24",
      start: "2026-09-18",
    });
    expect(
      within(presets).getByRole("button", { name: "Last 7 days" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("is read-only - browsed but not changed - or disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Booking">
        <RangeCalendar
          defaultValue={september}
          label="Read-only"
          name="readOnly"
          onChange={onChange}
          presets={["today"]}
          readOnly
        />
        <RangeCalendar
          defaultValue={september}
          disabled
          label="Disabled"
          name="disabled"
        />
      </form>,
    );

    const readOnly = screen.getByRole("group", { name: /Read-only/ });
    expect(readOnly).toHaveAttribute("data-readonly");
    expect(within(readOnly).getByRole("grid")).toHaveAttribute(
      "aria-readonly",
      "true",
    );
    expect(
      within(readOnly).getByRole("button", { name: "Today" }),
    ).toBeDisabled();
    await user.click(
      within(readOnly).getByRole("button", { name: "September 20, 2026" }),
    );
    await user.click(
      within(readOnly).getByRole("button", { name: "September 21, 2026" }),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(within(readOnly).queryByText("Select the last day")).toBeNull();

    const disabled = screen.getByRole("group", { name: /Disabled/ });
    for (const button of within(disabled).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }

    const data = new FormData(getForm());
    expect(data.get("readOnly")).toBe("2026-09-08/2026-09-12");
    expect(data.has("disabled")).toBe(false);
  });
});

describe("RangeCalendar on the server", () => {
  it("renders without the browser, then hydrates without a mismatch", async () => {
    const calendar = (
      <UIProvider locale={cs}>
        <form>
          <RangeCalendar
            defaultValue={{ end: "2026-09-30", start: "2026-09-24" }}
            label="Pobyt"
            months={2}
            name="stay"
            presets
          />
        </form>
      </UIProvider>
    );

    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("navigator", undefined);
    const html = renderToString(calendar);
    vi.unstubAllGlobals();

    expect(html).toContain('name="stay" value="2026-09-24/2026-09-30"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, calendar, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    // The built-in presets count from today of the browser
    expect(
      within(container).getByRole("button", { name: "Dnes" }),
    ).toBeEnabled();

    act(() => root.unmount());
    container.remove();
  });
});
