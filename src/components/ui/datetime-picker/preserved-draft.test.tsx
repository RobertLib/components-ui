import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DateTimePicker from ".";

describe("DateTimePicker preserved invalid text", () => {
  it.each(["Enter", "blur"])(
    "retains an invalid draft on %s and commits a valid correction",
    async (confirmation) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <>
          <DateTimePicker
            defaultValue="2026-09-24"
            label="Day"
            onChange={(event) => onChange(event.target.value)}
            preserveInvalidText
          />
          <button type="button">Outside</button>
        </>,
      );

      const input = screen.getByRole<HTMLInputElement>("combobox", {
        name: "Day:",
      });
      const outside = screen.getByRole("button", { name: "Outside" });
      await user.click(input);
      await user.keyboard("{Control>}a{/Control}02/31/2026");
      if (confirmation === "Enter") await user.keyboard("{Enter}");
      else await user.click(outside);

      expect(input).toHaveValue("02/31/2026");
      expect(input.validity.valid).toBe(false);
      expect(onChange).not.toHaveBeenCalled();

      await user.click(input);
      await user.keyboard("{Control>}a{/Control}09/26/2026{Enter}");
      expect(input).toHaveValue("09/26/2026");
      expect(input.validity.valid).toBe(true);
      expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-26");
    },
  );

  it("lets ArrowDown open the calendar and a pick replace an invalid draft", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="2026-09-24"
        label="Day"
        onChange={(event) => onChange(event.target.value)}
        preserveInvalidText
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("combobox", {
      name: "Day:",
    });
    await user.click(input);
    await user.keyboard("{Escape}{Control>}a{/Control}02/31/2026{ArrowDown}");
    expect(input).toHaveValue("02/31/2026");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "September 26, 2026" }),
    );
    expect(input).toHaveValue("09/26/2026");
    expect(input.validity.valid).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-26");
  });

  it("clears a retained invalid draft and its validity", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="2026-09-24"
        label="Day"
        onChange={(event) => onChange(event.target.value)}
        preserveInvalidText
      />,
    );
    const input = screen.getByRole<HTMLInputElement>("combobox", {
      name: "Day:",
    });
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}02/31/2026{Enter}");
    await user.click(screen.getByRole("button", { name: "Clear value" }));
    expect(input).toHaveValue("");
    expect(input.validity.valid).toBe(true);
    expect(input).toHaveFocus();
    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  });
});
