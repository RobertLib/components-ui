import { Activity, StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DateCalendar from ".";
import RangeCalendar from "../range-calendar";

const range = { start: "2026-09-10", end: "2026-09-12" };

describe.each(["date", "range"] as const)(
  "%s calendar hidden by Activity",
  (kind) => {
    const view = (
      mode: "hidden" | "visible",
      props: {
        disabled?: boolean;
        isDateDisabled?: (date: Date) => boolean;
        max?: string;
        maxDays?: number;
        readOnly?: boolean;
        required?: boolean;
      },
    ) => (
      <StrictMode>
        <form>
          <Activity mode={mode}>
            {kind === "date" ? (
              <DateCalendar {...props} name="value" value={range.start} />
            ) : (
              <RangeCalendar {...props} name="value" value={range} />
            )}
          </Activity>
        </form>
      </StrictMode>
    );
    const submitted =
      kind === "date" ? range.start : `${range.start}/${range.end}`;

    it.each([false, true])(
      "adds and clears hidden constraints (required: %s)",
      async (required) => {
        const { container, rerender } = render(
          view("visible", { max: "2026-09-30", required }),
        );
        const form = container.querySelector("form")!;
        const validation =
          form.querySelector<HTMLInputElement>('input[type="text"]')!;
        expect(form.checkValidity()).toBe(true);

        await act(async () =>
          rerender(view("hidden", { max: "2026-09-05", required })),
        );
        expect(new FormData(form).get("value")).toBe(submitted);
        expect(validation.validity.customError).toBe(true);
        expect(form.checkValidity()).toBe(false);

        await act(async () =>
          rerender(view("hidden", { max: "2026-09-30", required })),
        );
        expect(validation.validity.customError).toBe(false);
        expect(form.checkValidity()).toBe(true);
      },
    );

    it.each(["disabled", "readOnly"] as const)(
      "restores validation after hidden %s changes",
      async (state) => {
        const { container, rerender } = render(
          view("visible", { max: "2026-09-05", [state]: true }),
        );
        const form = container.querySelector("form")!;
        expect(form.checkValidity()).toBe(true);

        await act(async () =>
          rerender(view("hidden", { max: "2026-09-05", [state]: false })),
        );
        expect(form.checkValidity()).toBe(false);
        await act(async () =>
          rerender(view("hidden", { max: "2026-09-05", [state]: true })),
        );
        expect(form.checkValidity()).toBe(true);
        expect(new FormData(form).get("value")).toBe(
          state === "disabled" ? null : submitted,
        );
      },
    );

    it("blocks an invalid optional value first mounted while hidden", async () => {
      const { container, rerender } = render(
        view("hidden", { max: "2026-09-05" }),
      );
      const form = container.querySelector("form")!;
      expect(new FormData(form).get("value")).toBe(submitted);
      expect(form.checkValidity()).toBe(false);
      await act(async () => rerender(view("hidden", { max: "2026-09-30" })));
      expect(form.checkValidity()).toBe(true);
      await act(async () => rerender(view("visible", { max: "2026-09-05" })));
      expect(
        form.querySelector<HTMLInputElement>('input[type="text"]')!
          .validationMessage,
      ).not.toBe("");
      expect(form.checkValidity()).toBe(false);
    });

    it("preserves application custom errors across hidden constraint updates", async () => {
      const { container, rerender } = render(
        view("visible", { max: "2026-09-05" }),
      );
      const form = container.querySelector("form")!;
      const validation =
        form.querySelector<HTMLInputElement>('input[type="text"]')!;
      validation.setCustomValidity("Unavailable on the server");
      await act(async () =>
        rerender(view("hidden", { isDateDisabled: () => true })),
      );
      expect(validation.validationMessage).toBe("Unavailable on the server");
      await act(async () => rerender(view("hidden", {})));
      expect(validation.validationMessage).toBe("Unavailable on the server");
      validation.setCustomValidity("");
      expect(form.checkValidity()).toBe(true);
    });

    it("applies disabled-day constraints while hidden", async () => {
      const { container, rerender } = render(view("visible", {}));
      const form = container.querySelector("form")!;
      await act(async () =>
        rerender(view("hidden", { isDateDisabled: () => true })),
      );
      expect(form.checkValidity()).toBe(false);
      await act(async () => rerender(view("hidden", {})));
      expect(form.checkValidity()).toBe(true);
    });
  },
);

it("applies a range length constraint while hidden", async () => {
  const view = (mode: "hidden" | "visible", maxDays: number) => (
    <form>
      <Activity mode={mode}>
        <RangeCalendar maxDays={maxDays} name="range" value={range} />
      </Activity>
    </form>
  );
  const { container, rerender } = render(view("visible", 3));
  const form = container.querySelector("form")!;
  await act(async () => rerender(view("hidden", 2)));
  expect(form.checkValidity()).toBe(false);
  await act(async () => rerender(view("hidden", 3)));
  expect(form.checkValidity()).toBe(true);
});
