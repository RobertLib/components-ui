import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DurationInput from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";

const spinbutton = (name: RegExp | string = /Time/) =>
  screen.getByRole<HTMLInputElement>("spinbutton", { name });

const formData = (name = "Report") =>
  Object.fromEntries(
    new FormData(screen.getByRole<HTMLFormElement>("form", { name })),
  );

// Intl puts plain or no-break spaces in by the version of its data
const plain = (text: string | null | undefined) =>
  text?.replace(/\s/g, " ") ?? null;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DurationInput", () => {
  it("is a spinbutton with its minutes, bounds and spoken value", () => {
    render(<DurationInput defaultValue={90} label="Time" max={480} />);

    const input = spinbutton();
    expect(input).toHaveValue("1:30");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("aria-valuenow", "90");
    // No negative durations
    expect(input).toHaveAttribute("aria-valuemin", "0");
    expect(input).toHaveAttribute("aria-valuemax", "480");
    expect(plain(input.getAttribute("aria-valuetext"))).toBe(
      "1 hour, 30 minutes",
    );
  });

  it.each([
    [0, "0:00"],
    [45, "0:45"],
    [480, "8:00"],
    [7500, "125:00"],
  ])("shows %i minutes as %s", (minutes, text) => {
    render(<DurationInput defaultValue={minutes} label="Time" />);
    expect(spinbutton()).toHaveValue(text);
  });

  it("shows units as the locale writes them", () => {
    const { rerender } = render(
      <DurationInput defaultValue={90} display="units" label="Time" />,
    );
    expect(plain(spinbutton().value)).toBe("1 hr 30 min");

    rerender(
      <UIProvider locale={cs}>
        <DurationInput defaultValue={90} display="units" label="Doba" />
      </UIProvider>,
    );
    const input = spinbutton(/Doba/);
    expect(plain(input.value)).toBe("1 h 30 min");
    expect(plain(input.getAttribute("aria-valuetext"))).toBe(
      "1 hodina a 30 minut",
    );

    rerender(
      <UIProvider locale={cs}>
        <DurationInput defaultValue={0} display="units" label="Doba" />
      </UIProvider>,
    );
    expect(plain(spinbutton(/Doba/).value)).toBe("0 min");
  });

  it("is empty without a value", () => {
    render(<DurationInput label="Time" />);

    const input = spinbutton();
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("aria-valuenow");
    expect(input).not.toHaveAttribute("aria-valuetext");
  });

  it.each([
    ["1:30", 90, "1:30"],
    [":45", 45, "0:45"],
    ["1,5", 90, "1:30"],
    ["1.5", 90, "1:30"],
    ["1.5h", 90, "1:30"],
    ["90", 90, "1:30"],
    ["90m", 90, "1:30"],
    ["1h 30m", 90, "1:30"],
    ["1h30", 90, "1:30"],
    ["1 h 30 min", 90, "1:30"],
    ["2 hours 15 minutes", 135, "2:15"],
    ["1 hodina 30 minut", 90, "1:30"],
    ["2 hodiny a 5 minut", 125, "2:05"],
    ["PT1H30M", 90, "1:30"],
    ["PT90M", 90, "1:30"],
    // Fractions of a minute round
    ["0.33 h", 20, "0:20"],
  ])(
    "reads %j as %i minutes when the focus leaves",
    async (typed, minutes, shown) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DurationInput label="Time" onChange={onChange} />);

      await user.type(spinbutton(), typed);
      // Taken as the value when the focus leaves, or on Enter
      expect(onChange).not.toHaveBeenCalled();
      expect(spinbutton()).toHaveValue(typed);

      await user.tab();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(minutes);
      expect(spinbutton()).toHaveValue(shown);
      expect(spinbutton()).toHaveAttribute("aria-valuenow", String(minutes));
    },
  );

  it("reads a whole number as hours with defaultUnit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DurationInput defaultUnit="hours" label="Time" onChange={onChange} />,
    );

    await user.type(spinbutton(), "8");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(480);
    expect(spinbutton()).toHaveValue("8:00");

    // A unit says what it is
    await user.clear(spinbutton());
    await user.type(spinbutton(), "45 min");
    await user.tab();
    expect(spinbutton()).toHaveValue("0:45");
  });

  it("reads the units it shows in Czech", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <DurationInput
          defaultValue={60}
          display="units"
          label="Doba"
          onChange={onChange}
        />
      </UIProvider>,
    );

    const input = spinbutton(/Doba/);
    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.type(input, "1,5 hodiny");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(90);
    expect(plain(input.value)).toBe("1 h 30 min");

    // Its own text is read back as it is
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(plain(input.value)).toBe("1 h 45 min");
    await user.type(input, "{End} ");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(105);
  });

  it("puts the typed duration into the form before it is taken", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DurationInput defaultValue={30} label="Time" name="time" />
      </form>,
    );

    expect(formData()).toEqual({ time: "30" });
    await user.clear(spinbutton());
    await user.type(spinbutton(), "1h 15m");
    // A submit from a script while the field has the focus gets it
    expect(formData()).toEqual({ time: "75" });
    expect(spinbutton()).not.toHaveAttribute("name");
  });

  it("drops a text that is no duration and says why", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DurationInput
          defaultValue={90}
          description="Time spent"
          label="Time"
          name="time"
          onChange={onChange}
        />
      </form>,
    );

    const input = spinbutton();
    const form = screen.getByRole<HTMLFormElement>("form");
    await user.clear(input);
    await user.type(input, "abc");

    // Invalid while typed - a submit is refused
    expect(form.checkValidity()).toBe(false);
    expect(plain(input.validationMessage)).toBe(
      "“abc” is not a valid duration. Enter it as, e.g., 1:30 or 1 hr 30 min.",
    );
    expect(formData()).toEqual({ time: "" });

    await user.tab();
    // The field shows its value again - emptying it took it away
    expect(input).toHaveValue("");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "“abc” is not a valid duration. Enter it as, e.g., 1:30 or 1 hr 30 min.",
    );
    expect(input).toHaveAccessibleDescription(
      /^Time spent “abc” is not a valid duration\./,
    );
    expect(form.checkValidity()).toBe(true);

    // Typing again takes the message away
    await user.type(input, "2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the value when a text that is no duration replaces it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DurationInput defaultValue={90} label="Time" onChange={onChange} />,
    );

    const input = spinbutton();
    await user.tripleClick(input);
    await user.keyboard("1:75");
    await user.tab();

    expect(input).toHaveValue("1:30");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/“1:75”/);
  });

  it("refuses a negative duration with a message of the language", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DurationInput defaultValue={30} label="Doba" />
      </UIProvider>,
    );

    const input = spinbutton(/Doba/);
    await user.tripleClick(input);
    await user.keyboard("-1:00");
    expect(input.validationMessage).toBe(
      "„-1:00“ není platná doba. Doba nemůže být záporná.",
    );
    await user.tab();
    expect(input).toHaveValue("0:30");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "„-1:00“ není platná doba. Doba nemůže být záporná.",
    );

    await user.tripleClick(input);
    await user.keyboard("x");
    await user.tab();
    expect(plain(screen.getByRole("alert").textContent)).toBe(
      "„x“ není platná doba. Zadejte ji např. jako 1:30 nebo 1 h 30 min.",
    );
  });

  it("takes the typed duration on Enter and submits it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return Object.fromEntries(new FormData(event.currentTarget));
    });
    render(
      <form onSubmit={onSubmit}>
        <DurationInput label="Time" max={480} name="time" />
        <button type="submit">Save</button>
      </form>,
    );

    await user.type(spinbutton(), "10h{Enter}");

    // Moved into the bounds first
    expect(onSubmit).toHaveReturnedWith({ time: "480" });
    expect(spinbutton()).toHaveValue("8:00");
  });

  it("does not submit on Enter a text it drops", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DurationInput defaultValue={60} label="Time" name="time" />
        <button type="submit">Save</button>
      </form>,
    );

    await user.tripleClick(spinbutton());
    await user.keyboard("soon{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(spinbutton()).toHaveValue("1:00");
    expect(screen.getByRole("alert")).toHaveTextContent(/“soon”/);
    expect(spinbutton()).toHaveFocus();
  });

  it("goes back to its value on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <DurationInput defaultValue={60} label="Time" onChange={onChange} />
      </div>,
    );

    await user.tripleClick(spinbutton());
    await user.keyboard("2:00{Escape}");
    expect(spinbutton()).toHaveValue("1:00");
    // A dialog around does not close with it
    expect(onKeyDown.mock.lastCall?.[0].defaultPrevented).toBe(true);

    // Without a typed text it is left alone
    await user.keyboard("{Escape}");
    expect(onKeyDown.mock.lastCall?.[0].defaultPrevented).toBe(false);
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps with the arrow keys, Page Up / Down and Home / End", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DurationInput
        defaultValue={60}
        label="Time"
        max={480}
        min={30}
        onChange={onChange}
      />,
    );

    const input = spinbutton();
    await user.click(input);

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("1:15");
    expect(onChange).toHaveBeenLastCalledWith(75);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveValue("0:45");
    // An hour - four steps of 15 minutes
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("1:45");
    await user.keyboard("{PageDown}{PageDown}");
    expect(input).toHaveValue("0:30");
    await user.keyboard("{End}");
    expect(input).toHaveValue("8:00");
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("8:00");
    await user.keyboard("{Home}");
    expect(input).toHaveValue("0:30");
    expect(input).toHaveAttribute("aria-valuenow", "30");
  });

  it("steps on the grid of the step from a typed duration", async () => {
    const user = userEvent.setup();
    render(<DurationInput label="Time" />);

    const input = spinbutton();
    await user.type(input, "1:10");
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("1:15");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveValue("0:45");
  });

  it("steps by its step, and pages by about an hour", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DurationInput defaultValue={0} label="Time" step={5} />,
    );

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveValue("0:10");
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("1:10");

    // A step longer than an hour - on its grid from 0
    rerender(<DurationInput defaultValue={0} label="Time" step={90} />);
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("1:30");
    await user.keyboard("{PageUp}{PageDown}{PageDown}");
    expect(input).toHaveValue("0:00");
  });

  it("starts the steps of an empty field at min", async () => {
    const user = userEvent.setup();
    render(<DurationInput label="Time" />);

    await user.click(spinbutton());
    await user.keyboard("{ArrowUp}");
    expect(spinbutton()).toHaveValue("0:00");
    await user.keyboard("{ArrowUp}");
    expect(spinbutton()).toHaveValue("0:15");
    // Never below 0
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(spinbutton()).toHaveValue("0:00");
  });

  it("leaves Home and End to the caret without the bounds given", async () => {
    const user = userEvent.setup();
    render(<DurationInput defaultValue={90} label="Time" />);

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{Home}");

    expect(input).toHaveValue("1:30");
    expect(input.selectionStart).toBe(0);
  });

  it("leaves the keys with modifiers and of an input method editor alone", () => {
    const onChange = vi.fn();
    render(
      <DurationInput defaultValue={60} label="Time" onChange={onChange} />,
    );

    const input = spinbutton();
    input.focus();
    fireEvent.keyDown(input, { altKey: true, key: "ArrowUp" });
    fireEvent.keyDown(input, { ctrlKey: true, key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp", metaKey: true });
    fireEvent.keyDown(input, { isComposing: true, key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp", keyCode: 229 });

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("1:00");
  });

  it("moves a typed duration into min - max when the focus leaves", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DurationInput
          label="Time"
          max={480}
          min={15}
          name="time"
          onChange={onChange}
        />
      </form>,
    );

    const input = spinbutton();
    const form = screen.getByRole<HTMLFormElement>("form");
    await user.type(input, "9h");
    // Invalid until then, with the limit as the field shows it
    expect(form.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe(
      "Enter a duration of 8:00 or shorter.",
    );
    expect(formData()).toEqual({ time: "540" });

    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(480);
    expect(input).toHaveValue("8:00");
    expect(form.checkValidity()).toBe(true);

    await user.clear(input);
    await user.type(input, "5");
    expect(input.validationMessage).toBe("Enter a duration of 0:15 or longer.");
    await user.tab();
    expect(input).toHaveValue("0:15");
  });

  it("is invalid with a value out of min - max from the parent", () => {
    const { rerender } = render(
      <DurationInput
        display="units"
        label="Time"
        max={480}
        onChange={() => {}}
        value={600}
      />,
    );
    expect(plain(spinbutton().validationMessage)).toBe(
      "Enter a duration of 8 hr or shorter.",
    );

    rerender(
      <UIProvider locale={cs}>
        <DurationInput label="Time" min={30} onChange={() => {}} value={-15} />
      </UIProvider>,
    );
    expect(spinbutton()).toHaveValue("-0:15");
    expect(spinbutton().validationMessage).toBe(
      "Zadejte dobu 0:30 nebo delší.",
    );

    // Also an excess the whole minutes hide
    rerender(
      <DurationInput
        label="Time"
        max={60}
        onChange={() => {}}
        value={60.2}
        valueFormat="minutes"
      />,
    );
    expect(spinbutton()).toHaveValue("1:00");
    expect(spinbutton().validity.valid).toBe(false);
  });

  it("works controlled - also when the parent refuses a value", async () => {
    const user = userEvent.setup();

    function Report() {
      const [time, setTime] = useState<number | null>(60);
      return (
        <>
          <DurationInput
            label="Time"
            // Only up to 4 hours
            onChange={(value) => {
              if (value === null || value <= 240) setTime(value);
            }}
            value={time}
          />
          <output>{JSON.stringify(time)}</output>
          <button onClick={() => setTime(150)} type="button">
            Set
          </button>
        </>
      );
    }

    render(<Report />);
    const input = spinbutton();

    await user.tripleClick(input);
    await user.keyboard("3:00");
    expect(screen.getByRole("status")).toHaveTextContent("60");
    await user.tab();
    expect(screen.getByRole("status")).toHaveTextContent("180");
    expect(input).toHaveValue("3:00");

    // 5 hours are refused - the field shows the parent's value
    await user.tripleClick(input);
    await user.keyboard("5:00");
    await user.tab();
    expect(input).toHaveValue("3:00");

    // A value of the parent replaces a typed text
    await user.tripleClick(input);
    await user.keyboard("1:00");
    await user.click(screen.getByRole("button", { name: "Set" }));
    expect(input).toHaveValue("2:30");
  });

  it("reports an emptied field at once", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DurationInput
          defaultValue={60}
          label="Time"
          name="time"
          onChange={onChange}
        />
      </form>,
    );

    await user.clear(spinbutton());
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(formData()).toEqual({ time: "" });
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("holds the value of an uncontrolled field in the form by onChange", async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    render(
      <form aria-label="Report">
        <DurationInput
          label="Time"
          name="time"
          onChange={() => seen.push(formData().time)}
        />
      </form>,
    );

    await user.type(spinbutton(), "1:30");
    await user.keyboard("{ArrowUp}");
    await user.tab();
    await user.clear(spinbutton());
    expect(seen).toEqual(["105", ""]);
  });

  describe("valueFormat", () => {
    it("seconds - edited in whole minutes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Report">
          <DurationInput
            defaultValue={5400}
            label="Time"
            max={120}
            name="time"
            onChange={onChange}
            valueFormat="seconds"
          />
        </form>,
      );

      const input = spinbutton();
      expect(input).toHaveValue("1:30");
      expect(input).toHaveAttribute("aria-valuenow", "90");
      expect(input).toHaveAttribute("aria-valuemax", "120");
      expect(formData()).toEqual({ time: "5400" });

      await user.click(input);
      await user.keyboard("{ArrowUp}");
      expect(onChange).toHaveBeenLastCalledWith(6300);
      expect(formData()).toEqual({ time: "6300" });

      await user.clear(input);
      await user.type(input, "45s");
      await user.tab();
      expect(onChange).toHaveBeenLastCalledWith(60);
      expect(input).toHaveValue("0:01");
    });

    it("seconds - a value between whole minutes is rounded", () => {
      render(
        <form aria-label="Report">
          <DurationInput
            defaultValue={5430}
            label="Time"
            name="time"
            valueFormat="seconds"
          />
        </form>,
      );

      expect(spinbutton()).toHaveValue("1:31");
      expect(formData()).toEqual({ time: "5460" });
    });

    it("iso - reads and writes ISO 8601 durations", async () => {
      const user = userEvent.setup();

      function Sla() {
        const [time, setTime] = useState<string | null>("PT90M");
        return (
          <form aria-label="Report">
            <DurationInput
              label="Time"
              name="time"
              onChange={setTime}
              value={time}
              valueFormat="iso"
            />
            <output>{JSON.stringify(time)}</output>
          </form>
        );
      }

      render(<Sla />);
      const input = spinbutton();
      expect(input).toHaveValue("1:30");
      expect(formData()).toEqual({ time: "PT1H30M" });

      await user.click(input);
      await user.keyboard("{ArrowUp}");
      expect(screen.getByRole("status")).toHaveTextContent('"PT1H45M"');

      await user.tripleClick(input);
      await user.keyboard("P1DT2H");
      await user.tab();
      expect(screen.getByRole("status")).toHaveTextContent('"PT26H"');
      expect(input).toHaveValue("26:00");

      await user.tripleClick(input);
      await user.keyboard("0");
      await user.tab();
      expect(screen.getByRole("status")).toHaveTextContent('"PT0S"');

      await user.clear(input);
      expect(screen.getByRole("status")).toHaveTextContent("null");
      expect(formData()).toEqual({ time: "" });
    });

    it("iso - an equal duration written otherwise is no change", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <DurationInput
          label="Time"
          onChange={onChange}
          value="PT90M"
          valueFormat="iso"
        />,
      );

      await user.tripleClick(spinbutton());
      await user.keyboard("1h 30m");
      await user.tab();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("iso - warns of a value it cannot read", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <DurationInput defaultValue="P1M" label="Time" valueFormat="iso" />,
      );

      expect(spinbutton()).toHaveValue("");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"P1M"'));
    });
  });

  it("brings back the defaultValue on a form reset, dropping a typed text", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DurationInput defaultValue={45} label="Time" name="time" />
        <button type="reset">Reset</button>
      </form>,
    );

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveValue("1:15");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("0:45");
    expect(formData()).toEqual({ time: "45" });

    // A rejected text and its message go too
    await user.tripleClick(input);
    await user.keyboard("abc");
    await user.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.tripleClick(input);
    await user.keyboard("2:00");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("0:45");
    expect(formData()).toEqual({ time: "45" });
  });

  it("submits an empty value for an empty field, and nothing while disabled", () => {
    const { rerender } = render(
      <form aria-label="Report">
        <DurationInput label="Time" name="time" />
      </form>,
    );
    expect(formData()).toEqual({ time: "" });

    rerender(
      <form aria-label="Report">
        <DurationInput defaultValue={30} disabled label="Time" name="time" />
      </form>,
    );
    expect(formData()).toEqual({});
    expect(spinbutton()).toBeDisabled();
  });

  it("is required like a native field", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <DurationInput label="Time" name="time" required />
      </form>,
    );

    const input = spinbutton();
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(input).toBeRequired();
    expect(input.validity.valueMissing).toBe(true);
    // Spaces alone leave it empty
    await user.type(input, " ");
    expect(input).toHaveValue("");
    expect(input.validity.valueMissing).toBe(true);
    await user.type(input, "30");
    expect(form.checkValidity()).toBe(true);
    await user.tab();
    expect(form.checkValidity()).toBe(true);
  });

  it("ignores the keys and is not submitted in a disabled fieldset", () => {
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <fieldset disabled>
          <DurationInput
            changeOnWheel
            defaultValue={60}
            label="Time"
            max={480}
            min={0}
            name="time"
            onChange={onChange}
          />
        </fieldset>
      </form>,
    );

    const input = spinbutton();
    expect(input).toBeDisabled();
    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
    ]) {
      fireEvent.keyDown(input, { key });
    }
    fireEvent.wheel(input, { deltaY: -100 });

    expect(input).toHaveAttribute("aria-valuenow", "60");
    expect(onChange).not.toHaveBeenCalled();
    expect(formData()).toEqual({});
  });

  it("steps with the wheel only when asked to, and only with the focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DurationInput defaultValue={60} label="Time" />,
    );

    const input = spinbutton();
    await user.click(input);
    fireEvent.wheel(input, { deltaY: -100 });
    expect(input).toHaveValue("1:00");

    rerender(<DurationInput changeOnWheel defaultValue={60} label="Time" />);
    fireEvent.wheel(input, { deltaY: -100 });
    expect(input).toHaveValue("1:15");
    fireEvent.wheel(input, { deltaY: 100 });
    fireEvent.wheel(input, { deltaY: 100 });
    expect(input).toHaveValue("0:45");

    await user.tab();
    fireEvent.wheel(input, { deltaY: -100 });
    expect(input).toHaveValue("0:45");
  });

  it("describes itself with its error and description", () => {
    render(
      <DurationInput
        description="Hours and minutes"
        error="Too long"
        label="Time"
        required
      />,
    );

    const input = spinbutton();
    expect(input).toHaveAccessibleDescription("Too long Hours and minutes");
    expect(input).toBeInvalid();
    expect(input).toBeRequired();
  });

  it("keeps the caller's handlers, props and ref", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      if (event.key === "ArrowUp") event.preventDefault();
    });
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <DurationInput
        className="w-24"
        defaultValue={60}
        dim="sm"
        label="Time"
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder="0:00"
        ref={ref}
      />,
    );

    const input = spinbutton();
    expect(ref.current).toBe(input);
    expect(input).toHaveClass("w-24");
    expect(input).toHaveAttribute("placeholder", "0:00");
    await user.click(input);
    expect(onFocus).toHaveBeenCalledTimes(1);
    // A handler that prevents the default skips the step
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("1:00");
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("leaves a validity message of the page alone", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <DurationInput defaultValue={60} label="Time" max={480} ref={ref} />,
    );

    ref.current!.setCustomValidity("Over the weekly limit");
    rerender(
      <DurationInput
        defaultValue={60}
        description="Up to 8 hours"
        label="Time"
        max={480}
        ref={ref}
      />,
    );
    expect(ref.current!.validationMessage).toBe("Over the weekly limit");
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const field = (
      <UIProvider locale={cs}>
        <DurationInput
          defaultValue="PT1H30M"
          display="units"
          label="Reakční doba"
          name="responseTime"
          valueFormat="iso"
        />
      </UIProvider>
    );

    const html = renderToString(field);
    expect(html).toContain('value="PT1H30M"');
    expect(html).toContain('aria-valuenow="90"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});

describe("DurationInput clearable", () => {
  it("empties the field, reports null and keeps the focus in it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DurationInput
          clearable
          defaultValue={90}
          label="Time"
          name="time"
          onChange={onChange}
        />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(spinbutton()).toHaveValue("");
    expect(spinbutton()).toHaveFocus();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(formData()).toEqual({ time: "" });
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("clears a controlled ISO value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Sla() {
      const [value, setValue] = useState<string | null>("PT4H");
      return (
        <DurationInput
          clearable
          label="Time"
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          value={value}
          valueFormat="iso"
        />
      );
    }
    render(<Sla />);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(spinbutton()).toHaveValue("");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("is not offered while disabled or read-only", () => {
    render(
      <>
        <DurationInput clearable defaultValue={1} disabled label="Time" />
        <DurationInput clearable defaultValue={1} label="Break" readOnly />
      </>,
    );

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("DurationInput readOnly", () => {
  it("keeps its value from the keys and the wheel and is submitted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Report">
        <DurationInput
          changeOnWheel
          defaultValue={240}
          label="Time"
          max={480}
          min={0}
          name="time"
          onChange={onChange}
          readOnly
        />
      </form>,
    );

    const input = spinbutton();
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("data-readonly");
    await user.click(input);
    await user.keyboard("{ArrowUp}{PageUp}{End}{Home}");
    fireEvent.wheel(input, { deltaY: -100 });

    expect(input).toHaveValue("4:00");
    expect(onChange).not.toHaveBeenCalled();
    expect(formData()).toEqual({ time: "240" });
  });
});

describe("DurationInput label", () => {
  it("takes content, and an aria-label without one", () => {
    render(
      <>
        <DurationInput
          label={
            <>
              Time <small>(h:mm)</small>
            </>
          }
          required
        />
        <DurationInput aria-label="Break" />
      </>,
    );

    expect(spinbutton("Time (h:mm):")).toBeRequired();
    expect(spinbutton("Break")).toBeInTheDocument();
  });
});
