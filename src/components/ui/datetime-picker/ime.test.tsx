import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DateTimePicker from ".";
import DateRangePicker from "../date-range-picker";

describe.each([
  { name: "during composition", event: { isComposing: true } },
  { name: "after Safari compositionend", event: { keyCode: 229 } },
])("Picker IME keys $name", ({ event }) => {
  describe.each([false, true])("with the popup open: %s", (open) => {
    it.each(["Enter", "Escape", "ArrowDown"])(
      "leaves %s to the IME without committing or discarding the draft",
      async (key) => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const onKeyDown = vi.fn();
        render(
          <DateTimePicker
            defaultValue="2026-09-24"
            label="Day"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
          />,
        );
        const input = screen.getByRole("combobox", { name: /Day/ });
        if (open) await user.click(input);
        else act(() => input.focus());

        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: "09/25/2026" } });
        if ("keyCode" in event) fireEvent.compositionEnd(input);

        expect(fireEvent.keyDown(input, { key, ...event })).toBe(true);
        expect(onKeyDown).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
        expect(input).toHaveValue("09/25/2026");
        expect(input).toHaveFocus();
        expect(input).toHaveAttribute("aria-expanded", String(open));

        if ("isComposing" in event) fireEvent.compositionEnd(input);
        await user.keyboard("{Enter}");
        expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-25");
        expect(input).toHaveAttribute("aria-expanded", "false");
      },
    );
  });

  it("keeps a range draft until Enter after composition", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker label="Period" onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: /Period/ });
    await user.click(input);
    fireEvent.compositionStart(input);
    const draft = "09/24/2026 – 09/30/2026";
    fireEvent.change(input, { target: { value: draft } });
    if ("keyCode" in event) fireEvent.compositionEnd(input);

    for (const key of ["ArrowDown", "Escape", "Enter"]) {
      expect(fireEvent.keyDown(input, { key, ...event })).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveValue(draft);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute("aria-expanded", "true");
    }

    if ("isComposing" in event) fireEvent.compositionEnd(input);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      start: "2026-09-24",
      end: "2026-09-30",
    });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
