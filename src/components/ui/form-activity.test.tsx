import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Activity, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import Input from "./input";
import TagsInput from "./tags-input";
import FileUpload, { type UploadedFile } from "./file-upload";
import NumberInput from "./number-input";
import RadioGroup from "./radio-group";
import SegmentedControl from "./segmented-control";
import Select from "./select";
import Checkbox from "./checkbox";
import CheckboxGroup from "./checkbox-group";
import Switch from "./switch";

const settleReset = async (form: HTMLFormElement) => {
  await act(async () => {
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe("Form fields hidden by Activity", () => {
  const options = [
    { label: "First", value: "first" },
    { label: "Second", value: "second" },
    { label: "Third", value: "third" },
  ];
  const selections = (form: HTMLFormElement) => {
    const data = new FormData(form);
    return {
      select: data.get("select"),
      multiple: data.getAll("multiple"),
      radio: data.get("radio"),
      segmented: data.get("segmented"),
    };
  };

  it.each([false, true])(
    "updates reset defaults in hidden commits without an entered value (controlled: %s)",
    async (controlled) => {
      const onChange = vi.fn();
      const view = (mode: "hidden" | "visible", selected: string) => {
        const selection = controlled
          ? { value: selected }
          : { defaultValue: selected };
        const multipleSelection = controlled
          ? { value: [selected, "third"] }
          : { defaultValue: [selected, "third"] };
        return (
          <StrictMode>
            <form aria-label="Choices">
              <Activity mode={mode}>
                <Select
                  {...selection}
                  label="Select"
                  name="select"
                  onChange={onChange}
                  options={options}
                />
                <Select
                  {...multipleSelection}
                  label="Multiple"
                  multiple
                  name="multiple"
                  onChange={onChange}
                  options={options}
                />
                <RadioGroup
                  {...selection}
                  label="Radio"
                  name="radio"
                  onChange={onChange}
                  options={options}
                />
                <SegmentedControl
                  {...selection}
                  label="Segmented"
                  name="segmented"
                  onChange={onChange}
                  options={options}
                />
              </Activity>
            </form>
          </StrictMode>
        );
      };
      const { rerender } = render(view("visible", "first"));
      const form = screen.getByRole<HTMLFormElement>("form");

      await act(async () => rerender(view("hidden", "second")));
      const expected = {
        select: "second",
        multiple: ["second", "third"],
        radio: "second",
        segmented: "second",
      };
      expect(selections(form)).toEqual(expected);

      await settleReset(form);
      expect(selections(form)).toEqual(expected);
      expect(onChange).not.toHaveBeenCalled();

      rerender(view("visible", "second"));
      expect(selections(form)).toEqual(expected);
    },
  );

  it.each([false, true])(
    "preserves entered selections while updating hidden defaults and honors reset cancellation (canceled: %s)",
    async (canceled) => {
      const onChange = vi.fn();
      const view = (mode: "hidden" | "visible", selected: string) => (
        <StrictMode>
          <form
            aria-label="Choices"
            onReset={canceled ? (event) => event.preventDefault() : undefined}
          >
            <Activity mode={mode}>
              <Select
                defaultValue={selected}
                label="Select"
                name="select"
                onChange={onChange}
                options={options}
              />
              <Select
                defaultValue={[selected]}
                label="Multiple"
                multiple
                name="multiple"
                onChange={onChange}
                options={options}
              />
              <RadioGroup
                defaultValue={selected}
                label="Radio"
                name="radio"
                onChange={onChange}
                options={options}
              />
              <SegmentedControl
                defaultValue={selected}
                label="Segmented"
                name="segmented"
                onChange={onChange}
                options={options}
              />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender } = render(view("visible", "first"));
      const form = screen.getByRole<HTMLFormElement>("form");
      fireEvent.change(screen.getByRole("combobox", { name: "Select:" }), {
        target: { value: "third" },
      });
      const multiple = screen.getByRole<HTMLSelectElement>("listbox");
      for (const option of multiple.options) {
        option.selected = option.value === "third";
      }
      fireEvent.change(multiple);
      for (const name of ["Radio:", "Segmented:"]) {
        fireEvent.click(
          within(screen.getByRole("radiogroup", { name })).getByRole("radio", {
            name: "Third",
          }),
        );
      }
      const entered = {
        select: "third",
        multiple: ["third"],
        radio: "third",
        segmented: "third",
      };
      expect(selections(form)).toEqual(entered);

      await act(async () => rerender(view("hidden", "second")));
      expect(selections(form)).toEqual(entered);
      await settleReset(form);
      expect(selections(form)).toEqual(
        canceled
          ? entered
          : {
              select: "second",
              multiple: ["second"],
              radio: "second",
              segmented: "second",
            },
      );
      expect(onChange).toHaveBeenCalledTimes(4);
    },
  );

  it.each([false, true])(
    "updates hidden checkbox reset defaults and indeterminate state (initially checked: %s)",
    async (initiallyChecked) => {
      const onChange = vi.fn();
      const view = (mode: "hidden" | "visible", checked: boolean) => (
        <StrictMode>
          <form aria-label="Choices">
            <Activity mode={mode}>
              <Checkbox
                checked={checked}
                indeterminate={checked || undefined}
                label="Checkbox"
                name="checkbox"
                onChange={onChange}
              />
              <Switch
                checked={checked}
                label="Switch"
                name="switch"
                onChange={onChange}
              />
              <CheckboxGroup
                label="Group"
                name="group"
                onChange={onChange}
                options={options}
                value={checked ? ["second"] : []}
              />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender } = render(view("visible", initiallyChecked));
      const form = screen.getByRole<HTMLFormElement>("form");
      const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
        name: "Checkbox",
      });
      const toggle = screen.getByRole<HTMLInputElement>("switch");

      for (const checked of [!initiallyChecked, initiallyChecked]) {
        await act(async () => rerender(view("hidden", checked)));
        expect(checkbox.indeterminate).toBe(checked);
        await settleReset(form);
        const data = new FormData(form);
        expect(data.get("checkbox")).toBe(checked ? "on" : null);
        expect(data.get("switch")).toBe(checked ? "on" : null);
        expect(data.getAll("group")).toEqual(checked ? ["second"] : []);
        expect(checkbox).toHaveAttribute(
          "data-state",
          checked ? "indeterminate" : "unchecked",
        );
        expect(toggle).toHaveAttribute(
          "data-state",
          checked ? "checked" : "unchecked",
        );
      }
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "keeps hidden uncontrolled checkbox state in sync with script writes and resets (canceled: %s)",
    async (canceled) => {
      const view = (mode: "hidden" | "visible", defaultChecked: boolean) => (
        <StrictMode>
          <form
            aria-label="Choices"
            onReset={canceled ? (event) => event.preventDefault() : undefined}
          >
            <Activity mode={mode}>
              <Checkbox defaultChecked={defaultChecked} label="Checkbox" />
              <Switch defaultChecked={defaultChecked} label="Switch" />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender, unmount } = render(view("visible", true));
      const form = screen.getByRole<HTMLFormElement>("form");
      const inputs = [
        screen.getByRole<HTMLInputElement>("checkbox"),
        screen.getByRole<HTMLInputElement>("switch"),
      ];
      inputs.forEach((input) => fireEvent.click(input));
      await act(async () => rerender(view("hidden", false)));
      inputs.forEach((input) => {
        expect(input).not.toBeChecked();
        expect(input.defaultChecked).toBe(false);
        input.checked = true;
        expect(input).toHaveAttribute("data-state", "checked");
      });

      await settleReset(form);
      inputs.forEach((input) => {
        expect(input.checked).toBe(canceled);
        expect(input).toHaveAttribute(
          "data-state",
          canceled ? "checked" : "unchecked",
        );
      });
      const properties = inputs.map((input) =>
        Object.getOwnPropertyDescriptor(input, "checked"),
      );
      unmount();
      inputs.forEach((input, index) => {
        expect(Object.getOwnPropertyDescriptor(input, "checked")).not.toEqual(
          properties[index],
        );
      });
    },
  );

  it("adds and clears a checkbox group's constraints in hidden commits", async () => {
    const view = (mode: "hidden" | "visible", selected: string[]) => (
      <StrictMode>
        <form aria-label="Choices">
          <Activity mode={mode}>
            <CheckboxGroup
              label="Group"
              name="group"
              onChange={() => {}}
              options={options}
              required
              value={selected}
            />
          </Activity>
        </form>
      </StrictMode>
    );
    const { rerender } = render(view("visible", []));
    const form = screen.getByRole<HTMLFormElement>("form");
    const input = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "First",
    });
    expect(form.checkValidity()).toBe(false);

    await act(async () => rerender(view("hidden", ["second"])));
    expect(form.checkValidity()).toBe(true);
    await act(async () => rerender(view("hidden", [])));
    expect(form.checkValidity()).toBe(false);

    input.setCustomValidity("The server rejected this selection");
    await act(async () => rerender(view("hidden", ["second"])));
    expect(input.validationMessage).toBe("The server rejected this selection");
    rerender(view("visible", ["second"]));
    expect(input.validationMessage).toBe("The server rejected this selection");
  });

  it("follows a hidden checkbox's updated external form association", async () => {
    const view = (mode: "hidden" | "visible", form: string) => (
      <StrictMode>
        <form aria-label="First form" id="first-form" />
        <form aria-label="Second form" id="second-form" />
        <Activity mode={mode}>
          <Checkbox form={form} label="Checkbox" name="checkbox" />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible", "first-form"));
    const input = screen.getByRole<HTMLInputElement>("checkbox");
    const firstForm = screen.getByRole<HTMLFormElement>("form", {
      name: "First form",
    });
    const secondForm = screen.getByRole<HTMLFormElement>("form", {
      name: "Second form",
    });
    await act(async () => rerender(view("hidden", "second-form")));
    input.checked = true;
    await settleReset(firstForm);
    expect(input).toBeChecked();
    await settleReset(secondForm);
    expect(input).not.toBeChecked();
    expect(input).toHaveAttribute("data-state", "unchecked");
  });

  it("keeps custom field constraints while their submitted controls are hidden", () => {
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <form aria-label="Profile">
          <Activity mode={mode}>
            <Input
              label="Postal code"
              defaultValue="12"
              mask="### ##"
              name="zip"
            />
            <NumberInput
              label="Amount"
              defaultValue={11}
              max={10}
              name="amount"
            />
            <TagsInput label="Tags" required name="tags" />
          </Activity>
        </form>
      </StrictMode>
    );
    const { rerender, unmount } = render(view("visible"));
    const form = screen.getByRole<HTMLFormElement>("form");
    const fields = [
      screen.getByRole<HTMLInputElement>("textbox", { name: "Postal code:" }),
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "Amount:" }),
      screen.getByRole<HTMLInputElement>("textbox", { name: "Tags:" }),
    ];
    fields.forEach((field) => expect(field.checkValidity()).toBe(false));

    rerender(view("hidden"));

    fields.forEach((field) => expect(field.checkValidity()).toBe(false));
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).get("amount")).toBe("11");
    expect(new FormData(form).get("zip")).toBe("12");
    unmount();
    fields.forEach((field) => {
      expect(field.validity.customError).toBe(false);
      expect(Object.hasOwn(field, "setCustomValidity")).toBe(false);
    });
  });

  it("applies constraints added and cleared by hidden commits", async () => {
    const view = (mode: "hidden" | "visible", valid: boolean) => (
      <form aria-label="Profile">
        <Activity mode={mode}>
          <NumberInput
            label="Amount"
            value={valid ? 10 : 11}
            max={10}
            name="amount"
          />
          <TagsInput
            label="Tags"
            required
            value={valid ? ["first"] : []}
            name="tags"
          />
        </Activity>
      </form>
    );
    const { rerender } = render(view("visible", true));
    const form = screen.getByRole<HTMLFormElement>("form");
    const amount = screen.getByRole<HTMLInputElement>("spinbutton");
    const tags = screen.getByRole<HTMLInputElement>("textbox");
    expect(form.checkValidity()).toBe(true);

    await act(async () => rerender(view("hidden", false)));
    expect(amount.checkValidity()).toBe(false);
    expect(tags.checkValidity()).toBe(false);
    expect(new FormData(form).get("amount")).toBe("11");

    await act(async () => rerender(view("hidden", true)));
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).getAll("tags")).toEqual(["first"]);
  });

  it("preserves an application's custom error across hidden constraint changes", async () => {
    const view = (mode: "hidden" | "visible", value: number) => (
      <form aria-label="Profile">
        <Activity mode={mode}>
          <NumberInput label="Amount" value={value} max={10} name="amount" />
        </Activity>
      </form>
    );
    const { rerender, unmount } = render(view("visible", 11));
    const input = screen.getByRole<HTMLInputElement>("spinbutton");
    input.setCustomValidity("The app refused this amount");

    await act(async () => rerender(view("hidden", 10)));
    expect(input.validationMessage).toBe("The app refused this amount");
    rerender(view("visible", 10));
    expect(input.validationMessage).toBe("The app refused this amount");
    unmount();
    expect(input.validationMessage).toBe("The app refused this amount");
    expect(Object.hasOwn(input, "setCustomValidity")).toBe(false);
  });

  it.each([false, true])(
    "resets preserved native and composite fields only when not canceled (canceled: %s)",
    async (canceled) => {
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <form
            aria-label="Profile"
            onReset={canceled ? (event) => event.preventDefault() : undefined}
          >
            <Activity mode={mode}>
              <Input label="Name" defaultValue="Ada" name="name" />
              <TagsInput label="Tags" defaultValue={["first"]} name="tags" />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const form = screen.getByRole<HTMLFormElement>("form");
      fireEvent.change(screen.getByRole("textbox", { name: "Name:" }), {
        target: { value: "Grace" },
      });
      const input = screen.getByRole("textbox", { name: "Tags:" });
      fireEvent.change(input, { target: { value: "second" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(new FormData(form).getAll("tags")).toEqual(["first", "second"]);

      rerender(view("hidden"));
      await settleReset(form);
      rerender(view("visible"));

      expect(screen.getByRole("textbox", { name: "Name:" })).toHaveValue(
        canceled ? "Grace" : "Ada",
      );
      expect(new FormData(form).getAll("tags")).toEqual(
        canceled ? ["first", "second"] : ["first"],
      );
    },
  );

  it("keeps a script write made after the reset of a hidden native field", async () => {
    const view = (mode: "hidden" | "visible") => (
      <form aria-label="Profile">
        <Activity mode={mode}>
          <Input label="Name" defaultValue="Ada" name="name" />
        </Activity>
      </form>
    );
    const { rerender } = render(view("visible"));
    const input = screen.getByRole<HTMLInputElement>("textbox");
    const form = screen.getByRole<HTMLFormElement>("form");
    fireEvent.change(input, { target: { value: "Grace" } });
    rerender(view("hidden"));

    await act(async () => {
      form.reset();
      input.value = "Katherine";
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    rerender(view("visible"));
    expect(input).toHaveValue("Katherine");
    expect(new FormData(form).get("name")).toBe("Katherine");
  });

  it.each([false, true])(
    "cancels pending uploads and ignores their later outcome after a hidden reset (rejects: %s)",
    async (rejects) => {
      let signal!: AbortSignal;
      let resolve!: (result: UploadedFile) => void;
      let reject!: (error: Error) => void;
      const onUpload = vi.fn();
      const onError = vi.fn();
      const upload = (_file: File, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return new Promise<UploadedFile>((done, fail) => {
          resolve = done;
          reject = fail;
        });
      };
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <form aria-label="Profile">
            <Activity mode={mode}>
              <FileUpload
                defaultAttachments={[{ value: "original" }]}
                name="files"
                onError={onError}
                onUpload={onUpload}
                upload={upload}
              />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const form = screen.getByRole<HTMLFormElement>("form");
      fireEvent.drop(screen.getByRole("group"), {
        dataTransfer: {
          files: [new File(["new"], "report.pdf")],
          types: ["Files"],
        },
      });
      expect(form.checkValidity()).toBe(false);
      rerender(view("hidden"));
      await settleReset(form);
      expect(signal.aborted).toBe(true);

      await act(async () => {
        if (rejects) reject(new Error("Late failure"));
        else resolve({ value: "new" });
      });
      rerender(view("visible"));
      expect(onUpload).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(new FormData(form).getAll("files")).toEqual(["original"]);
      expect(form.checkValidity()).toBe(true);
    },
  );
});
