import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ColorInput from "./color-input";
import DateRangePicker from "./date-range-picker";
import DateTimePicker, { type DateTimePickerType } from "./datetime-picker";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const cases = [
  {
    kind: "date",
    draft: "25.9.2026",
    initial: "24.09.2026",
    initialData: { value: "2026-09-24" },
    draftData: { value: "2026-09-25" },
  },
  {
    kind: "color",
    draft: "rgb(0 0 255)",
    initial: "#ff0000",
    initialData: { value: "#ff0000" },
    draftData: { value: "#0000ff" },
  },
  {
    kind: "range",
    draft: "25.9.2026 – 27.9.2026",
    initial: "24.09.2026 – 26.09.2026",
    initialData: {
      value: "2026-09-24/2026-09-26",
      start: "2026-09-24",
      end: "2026-09-26",
    },
    draftData: {
      value: "2026-09-25/2026-09-27",
      start: "2026-09-25",
      end: "2026-09-27",
    },
  },
] as const;

function renderField(
  kind: (typeof cases)[number]["kind"],
  {
    controlled = false,
    external = false,
    empty = false,
    required = true,
    onReset,
  }: {
    controlled?: boolean;
    external?: boolean;
    empty?: boolean;
    required?: boolean;
    onReset?: React.FormEventHandler<HTMLFormElement>;
  } = {},
) {
  const onChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget));
  });
  const common = {
    "aria-label": "Value",
    form: external ? "draft-form" : undefined,
    name: "value",
    onChange,
    required,
  };
  const valueProp = controlled ? "value" : "defaultValue";
  const field =
    kind === "color" ? (
      <ColorInput {...common} {...{ [valueProp]: empty ? "" : "#ff0000" }} />
    ) : kind === "date" ? (
      <DateTimePicker
        {...common}
        {...{ [valueProp]: empty ? "" : "2026-09-24" }}
      />
    ) : (
      <DateRangePicker
        {...common}
        {...{
          [valueProp]: empty
            ? null
            : { start: "2026-09-24", end: "2026-09-26" },
        }}
        startName="start"
        endName="end"
      />
    );
  render(
    <UIProvider locale={cs}>
      <form
        aria-label="Draft form"
        id="draft-form"
        onReset={onReset}
        onSubmit={onSubmit}
      >
        {!external && field}
      </form>
      {external && field}
    </UIProvider>,
  );
  const input = screen.getByLabelText<HTMLInputElement>("Value");
  act(() => input.focus());
  return {
    form: screen.getByRole<HTMLFormElement>("form"),
    input,
    onChange,
    onSubmit,
  };
}

describe.each(cases)("$kind draft form values", (example) => {
  it.each([false, true])(
    "submits the parsed draft without blur or onChange, external form: %s",
    (external) => {
      const { form, input, onChange, onSubmit } = renderField(example.kind, {
        external,
        empty: true,
      });
      expect(form.checkValidity()).toBe(false);
      fireEvent.change(input, { target: { value: example.draft } });

      act(() => form.requestSubmit());

      expect(input).toHaveFocus();
      expect(onSubmit).toHaveReturnedWith(example.draftData);
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it.each(["not a value", "   "])(
    "blocks an invalid draft (%j) instead of submitting the previous value",
    (draft) => {
      const { form, input, onChange, onSubmit } = renderField(example.kind);
      fireEvent.change(input, { target: { value: draft } });

      act(() => form.requestSubmit());

      expect(form.checkValidity()).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(Object.values(Object.fromEntries(new FormData(form)))).toEqual(
        Object.keys(example.initialData).map(() => ""),
      );

      fireEvent.change(input, { target: { value: example.draft } });
      act(() => form.requestSubmit());
      expect(onSubmit).toHaveReturnedWith(example.draftData);
    },
  );

  it("validates optional drafts and submits an emptied draft", () => {
    const { form, input, onSubmit } = renderField(example.kind, {
      required: false,
    });
    fireEvent.change(input, { target: { value: "not a value" } });
    act(() => form.requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "   " } });
    act(() => form.requestSubmit());
    expect(onSubmit).toHaveReturnedWith(
      Object.fromEntries(
        Object.keys(example.initialData).map((key) => [key, ""]),
      ),
    );
  });

  it.each(["Enter", "blur"])(
    "restores the controlled value when its parent rejects the draft on %s",
    (commit) => {
      const { form, input, onChange } = renderField(example.kind, {
        controlled: true,
      });
      fireEvent.change(input, { target: { value: example.draft } });
      expect(Object.fromEntries(new FormData(form))).toEqual(example.draftData);

      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      else fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(input).toHaveValue(example.initial);
      expect(Object.fromEntries(new FormData(form))).toEqual(
        example.initialData,
      );
    },
  );

  it.each([false, true])(
    "discards a draft when reset restores the same value, external form: %s",
    async (external) => {
      const { form, input, onChange } = renderField(example.kind, { external });
      fireEvent.change(input, { target: { value: example.draft } });

      act(() => form.reset());
      await waitFor(() => expect(input).toHaveValue(example.initial));
      fireEvent.blur(input);

      expect(onChange).not.toHaveBeenCalled();
      expect(Object.fromEntries(new FormData(form))).toEqual(
        example.initialData,
      );
    },
  );

  it("clears draft validation on reset without overwriting an application's error", async () => {
    const { form, input } = renderField(example.kind);
    fireEvent.change(input, { target: { value: "not a value" } });
    expect(form.checkValidity()).toBe(false);
    act(() => form.reset());
    await waitFor(() => expect(form.checkValidity()).toBe(true));

    fireEvent.change(input, { target: { value: "not a value" } });
    input.setCustomValidity("The server rejected this value.");
    act(() => form.reset());
    await waitFor(() => expect(input).toHaveValue(example.initial));
    expect(input.validationMessage).toBe("The server rejected this value.");
  });

  it.each(["Enter", "blur"])(
    "preserves an application error through temporary draft errors and a valid %s commit",
    (commit) => {
      const { input } = renderField(example.kind);
      input.setCustomValidity("The server rejected this value.");
      fireEvent.change(input, { target: { value: "not a value" } });
      expect(input.validationMessage).toBe("The server rejected this value.");
      fireEvent.change(input, { target: { value: example.draft } });
      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      else fireEvent.blur(input);
      expect(input.validationMessage).toBe("The server rejected this value.");
    },
  );

  it("keeps a draft when the form reset is canceled", async () => {
    const { form, input } = renderField(example.kind, {
      onReset: (event) => event.preventDefault(),
    });
    fireEvent.change(input, { target: { value: example.draft } });
    act(() => form.reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));

    expect(input).toHaveValue(example.draft);
    expect(Object.fromEntries(new FormData(form))).toEqual(example.draftData);
  });

  it("discards a controlled draft on reset and clears a rejected draft's message", async () => {
    const { form, input, onChange } = renderField(example.kind, {
      controlled: true,
    });
    fireEvent.change(input, { target: { value: example.draft } });
    act(() => form.reset());
    await waitFor(() => expect(input).toHaveValue(example.initial));
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "not a value" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => form.reset());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(Object.fromEntries(new FormData(form))).toEqual(example.initialData);
  });
});

describe("DateTimePicker draft constraints", () => {
  it("applies an unavailable value's own constraint when its draft is committed", () => {
    render(
      <DateTimePicker
        aria-label="Value"
        defaultValue="2026-09-24"
        isDateDisabled={(day) => day.getDate() === 25}
      />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Value");
    input.setCustomValidity("The server rejected this value.");
    fireEvent.change(input, { target: { value: "2026-09-25" } });
    expect(input.validationMessage).toBe("The server rejected this value.");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.validationMessage).toBe("09/25/2026 cannot be selected.");
  });

  it.each<{
    type: DateTimePickerType;
    initial: string;
    draft: string;
    expected: string;
  }>([
    {
      type: "date",
      initial: "2026-08-24",
      draft: "24.9.2026",
      expected: "2026-09-24",
    },
    { type: "time", initial: "08:00", draft: "0930", expected: "09:30" },
    {
      type: "datetime-local",
      initial: "2026-08-24T08:00",
      draft: "24.9.2026 9:30",
      expected: "2026-09-24T09:30",
    },
    {
      type: "month",
      initial: "2026-08",
      draft: "09/2026",
      expected: "2026-09",
    },
    {
      type: "week",
      initial: "2026-W34",
      draft: "2026-W39",
      expected: "2026-W39",
    },
  ])(
    "checks the serialized $type draft against limits and disabled days",
    ({ type, initial, draft, expected }) => {
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const onChange = vi.fn();
      const { rerender } = render(
        <UIProvider locale={cs}>
          <form aria-label="Draft form" onSubmit={onSubmit}>
            <DateTimePicker
              aria-label="Value"
              defaultValue={initial}
              min={expected}
              name="value"
              onChange={onChange}
              type={type}
            />
          </form>
        </UIProvider>,
      );
      const form = screen.getByRole<HTMLFormElement>("form");
      const input = screen.getByLabelText<HTMLInputElement>("Value");
      expect(form.checkValidity()).toBe(false);
      fireEvent.change(input, { target: { value: draft } });
      act(() => form.requestSubmit());
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(new FormData(form).get("value")).toBe(expected);
      expect(onChange).not.toHaveBeenCalled();

      rerender(
        <UIProvider locale={cs}>
          <form aria-label="Draft form" onSubmit={onSubmit}>
            <DateTimePicker
              aria-label="Value"
              defaultValue={initial}
              isDateDisabled={() => true}
              max={initial}
              name="value"
              onChange={onChange}
              type={type}
            />
          </form>
        </UIProvider>,
      );
      act(() => form.requestSubmit());
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(form.checkValidity()).toBe(false);

      rerender(
        <UIProvider locale={cs}>
          <form aria-label="Draft form" onSubmit={onSubmit}>
            <DateTimePicker
              aria-label="Value"
              defaultValue={initial}
              isDateDisabled={() => true}
              name="value"
              onChange={onChange}
              type={type}
            />
          </form>
        </UIProvider>,
      );
      expect(form.checkValidity()).toBe(type === "time");
      if (type !== "time")
        expect(input.validationMessage).toContain("nelze vybrat");
    },
  );
});

it("validates disabled days inside a typed range before blur", () => {
  const onChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const props = {
    "aria-label": "Value",
    defaultValue: { start: "2026-09-24", end: "2026-09-25" },
    isDateDisabled: (day: Date) => day.getDate() === 26,
    name: "value",
    onChange,
  };
  const { rerender } = render(
    <UIProvider locale={cs}>
      <form aria-label="Draft form" onSubmit={onSubmit}>
        <DateRangePicker {...props} />
      </form>
    </UIProvider>,
  );
  const form = screen.getByRole<HTMLFormElement>("form");
  const input = screen.getByLabelText<HTMLInputElement>("Value");
  fireEvent.change(input, { target: { value: "24.9.2026 – 27.9.2026" } });
  act(() => form.requestSubmit());
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input.validationMessage).toContain("26.09.2026");

  rerender(
    <UIProvider locale={cs}>
      <form aria-label="Draft form" onSubmit={onSubmit}>
        <DateRangePicker {...props} allowDisabledInRange />
      </form>
    </UIProvider>,
  );
  act(() => form.requestSubmit());
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(new FormData(form).get("value")).toBe("2026-09-24/2026-09-27");
  expect(onChange).not.toHaveBeenCalled();
});
