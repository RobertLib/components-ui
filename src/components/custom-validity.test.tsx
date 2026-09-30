import { render, screen } from "@testing-library/react";
import { Activity, StrictMode } from "react";
import { describe, expect, it } from "vitest";
import Input from "./input";
import NumberInput from "./number-input";
import DateTimePicker from "./datetime-picker";
import DateRangePicker from "./date-range-picker";

interface FieldProps {
  disabled: boolean;
  readOnly: boolean;
  valid: boolean;
}

const fields = [
  {
    name: "NumberInput",
    render: ({ valid, ...props }: FieldProps) => (
      <NumberInput
        {...props}
        label="Value"
        max={100}
        value={valid ? 50 : 150}
      />
    ),
  },
  {
    name: "masked Input",
    render: ({ valid, ...props }: FieldProps) => (
      <Input
        {...props}
        label="Value"
        mask="####"
        onChange={() => {}}
        value={valid ? "1234" : "12"}
      />
    ),
  },
  ...(["custom", "native"] as const).map((mode) => ({
    name: `${mode} DateTimePicker`,
    render: ({ valid, ...props }: FieldProps) => (
      <DateTimePicker
        {...props}
        isDateDisabled={(date) => date.getDate() === 10}
        label="Value"
        mode={mode}
        onChange={() => {}}
        type="date"
        value={valid ? "2026-09-11" : "2026-09-10"}
      />
    ),
  })),
  {
    name: "DateRangePicker",
    render: ({ valid, ...props }: FieldProps) => (
      <DateRangePicker
        {...props}
        label="Value"
        min="2026-09-10"
        value={{
          start: valid ? "2026-09-10" : "2026-09-09",
          end: "2026-09-12",
        }}
      />
    ),
  },
];

describe.each(fields)("$name custom validity", ({ render: field }) => {
  it.each([false, true])(
    "updates after Activity hides a field whose value changes (app error: %s)",
    (appError) => {
      const content = (valid: boolean, mode: "hidden" | "visible") => (
        <StrictMode>
          <Activity mode={mode}>
            {field({ disabled: false, readOnly: false, valid })}
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(content(false, "visible"));
      const input = screen.getByLabelText<HTMLInputElement>(/^Value/);
      expect(input.checkValidity()).toBe(false);
      if (appError) input.setCustomValidity("Rejected by the server");

      rerender(content(false, "hidden"));
      rerender(content(true, "hidden"));
      rerender(content(true, "visible"));

      expect(screen.getByLabelText(/^Value/)).toBe(input);
      expect(input.checkValidity()).toBe(!appError);
      expect(input.validationMessage).toBe(
        appError ? "Rejected by the server" : "",
      );
    },
  );

  describe.each(["disabled", "readOnly", "fieldset"] as const)(
    "while %s",
    (mode) => {
      const form = (valid: boolean, inactive: boolean) => (
        <form aria-label="Edit">
          <fieldset disabled={mode === "fieldset" && inactive}>
            {field({
              disabled: mode === "disabled" && inactive,
              readOnly: mode === "readOnly" && inactive,
              valid,
            })}
          </fieldset>
        </form>
      );

      it("clears an old component error when the value becomes valid", () => {
        const { rerender } = render(form(false, false));
        const input = screen.getByLabelText<HTMLInputElement>(/^Value/);
        expect(input.checkValidity()).toBe(false);

        rerender(form(false, true));
        expect(input.validationMessage).toBe("");
        rerender(form(true, true));

        if (mode === "fieldset") {
          // The native field must be valid even before an observer causes a render.
          input.closest("fieldset")!.disabled = false;
        } else {
          rerender(form(true, false));
        }
        expect(input.validity.customError).toBe(false);
        expect(screen.getByRole<HTMLFormElement>("form").checkValidity()).toBe(
          true,
        );
      });

      it("preserves an error set by the app while validation messages are hidden", () => {
        const { rerender } = render(form(false, false));
        const input = screen.getByLabelText<HTMLInputElement>(/^Value/);

        rerender(form(false, true));
        input.setCustomValidity("Rejected by the server");
        rerender(form(true, true));
        rerender(form(true, false));

        expect(input.checkValidity()).toBe(false);
        expect(input.validationMessage).toBe("Rejected by the server");
      });
    },
  );
});
