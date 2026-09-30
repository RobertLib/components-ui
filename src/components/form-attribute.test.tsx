import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vitest";
import Checkbox from "./checkbox";
import DateRangePicker from "./date-range-picker";
import DateTimePicker from "./datetime-picker";
import FileUpload from "./file-upload";
import Input from "./input";
import RadioGroup from "./radio-group";
import RichTextEditor from "./rich-text-editor";
import SegmentedControl from "./segmented-control";
import Select from "./select";
import Switch from "./switch";
import TagsInput from "./tags-input";
import Textarea from "./textarea";

const sizes = [
  { label: "Small", value: "s" },
  { label: "Large", value: "l" },
];

describe("Fields outside their form", () => {
  it.each([false, true])(
    "omits generated names with late or replaced forms (shadow root: %s)",
    (inShadow) => {
      const host = document.createElement("div");
      document.body.append(host);
      onTestFinished(() => host.remove());
      const root = inShadow ? host.attachShadow({ mode: "open" }) : host;
      const container = document.createElement("div");
      root.append(container);
      const fields = (form: string, named = false) => (
        <>
          <RadioGroup
            defaultValue="s"
            form={form}
            name={named ? "size" : undefined}
            options={sizes}
          />
          <SegmentedControl
            defaultValue="l"
            form={form}
            name={named ? "period" : undefined}
            options={sizes}
          />
        </>
      );
      const { rerender, unmount } = render(fields("later"), { container });
      const readForm = (form: HTMLFormElement) => {
        const formData = new FormData(form);
        // jsdom does not fire the browser's formdata event itself.
        form.dispatchEvent(Object.assign(new Event("formdata"), { formData }));
        return Object.fromEntries(formData);
      };
      const first = document.createElement("form");
      first.id = "later";
      root.append(first);
      expect(readForm(first)).toEqual({});

      const replacement = document.createElement("form");
      replacement.id = "later";
      first.replaceWith(replacement);
      expect(readForm(replacement)).toEqual({});

      replacement.id = "renamed";
      rerender(fields("renamed"));
      expect(readForm(replacement)).toEqual({});
      rerender(fields("renamed", true));
      expect(readForm(replacement)).toEqual({ size: "s", period: "l" });
      rerender(fields("renamed"));
      expect(readForm(replacement)).toEqual({});

      // An unrelated form keeps even a field with the same generated name.
      const generatedName =
        within(container).getAllByRole<HTMLInputElement>("radio")[0].name;
      const other = document.createElement("form");
      const input = document.createElement("input");
      input.name = generatedName;
      input.value = "keep";
      other.append(input);
      root.append(other);
      expect(readForm(other)).toEqual({ [generatedName]: "keep" });

      unmount();
      replacement.append(input);
      expect(readForm(replacement)).toEqual({ [generatedName]: "keep" });
    },
  );

  it.each(["", "missing"])(
    "leaves edits alone when form=%j detaches a field from its surrounding form",
    (form) => {
      render(
        <form aria-label="Outer">
          <TagsInput defaultValue={["original"]} form={form} label="Tags" />
        </form>,
      );
      const input = screen.getByRole<HTMLInputElement>("textbox");
      expect(input.form).toBeNull();
      fireEvent.change(input, { target: { value: "added" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(
        screen.getByRole("button", { name: "Remove added" }),
      ).toBeInTheDocument();

      act(() => screen.getByRole<HTMLFormElement>("form").reset());
      expect(
        screen.getByRole("button", { name: "Remove added" }),
      ).toBeInTheDocument();
    },
  );

  it("resets fields when their external form is mounted later or replaced", async () => {
    const fields = (formKey?: string, cancelReset = false) => (
      <>
        <Input defaultValue="Ada" form="later" label="Name" />
        <Textarea defaultValue="Hello" form="later" label="Note" />
        <Select defaultValue="s" form="later" label="Size" options={sizes} />
        <RadioGroup defaultValue="s" form="later" name="plan" options={sizes} />
        <SegmentedControl
          defaultValue="s"
          form="later"
          name="period"
          options={sizes}
        />
        <Checkbox form="later" label="Enabled" />
        <Switch form="later" label="Notifications" />
        <TagsInput defaultValue={["original"]} form="later" label="Tags" />
        {formKey && (
          <form
            aria-label="Later"
            id="later"
            key={formKey}
            onReset={(event) => cancelReset && event.preventDefault()}
          />
        )}
      </>
    );
    const { rerender } = render(fields());
    const name = screen.getByRole("textbox", { name: "Name:" });
    const note = screen.getByRole("textbox", { name: "Note:" });
    const size = screen.getByRole("combobox");
    const checkbox = screen.getByRole("checkbox");
    const toggle = screen.getByRole("switch");
    const tags = screen.getByRole("textbox", { name: "Tags:" });
    const edit = () => {
      fireEvent.change(name, { target: { value: "Grace" } });
      fireEvent.change(note, { target: { value: "Changed" } });
      fireEvent.change(size, { target: { value: "l" } });
      for (const radio of screen.getAllByRole("radio", { name: "Large" }))
        fireEvent.click(radio);
      fireEvent.click(checkbox);
      fireEvent.click(toggle);
      fireEvent.change(tags, { target: { value: "added" } });
      fireEvent.keyDown(tags, { key: "Enter" });
    };
    const expectEdited = () => {
      expect(name).toHaveValue("Grace");
      expect(note).toHaveValue("Changed");
      expect(size).toHaveValue("l");
      for (const radio of screen.getAllByRole("radio", { name: "Large" }))
        expect(radio).toBeChecked();
      expect(checkbox).toBeChecked();
      expect(toggle).toBeChecked();
      expect(
        screen.getByRole("button", { name: "Remove added" }),
      ).toBeInTheDocument();
    };
    const expectReset = async () => {
      await waitFor(() => expect(name).toHaveValue("Ada"));
      expect(note).toHaveValue("Hello");
      expect(size).toHaveValue("s");
      for (const radio of screen.getAllByRole("radio", { name: "Small" }))
        expect(radio).toBeChecked();
      expect(checkbox).not.toBeChecked();
      expect(toggle).not.toBeChecked();
      expect(
        screen.queryByRole("button", { name: "Remove added" }),
      ).not.toBeInTheDocument();
      await waitFor(() => {
        expect(checkbox).toHaveAttribute("data-state", "unchecked");
        expect(toggle).toHaveAttribute("data-state", "unchecked");
      });
    };

    edit();
    rerender(fields("first", true));
    const first = screen.getByRole<HTMLFormElement>("form");
    act(() => first.reset());
    expectEdited();
    rerender(fields("first"));
    act(() => first.reset());
    rerender(fields("first"));
    await expectReset();

    edit();
    rerender(fields("second"));
    act(() => first.reset());
    expectEdited();
    act(() => screen.getByRole<HTMLFormElement>("form").reset());
    rerender(fields("second"));
    await expectReset();
  });

  it("finds the new form in the field's shadow root", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    onTestFinished(() => host.remove());
    const container = document.createElement("div");
    host.attachShadow({ mode: "open" }).append(container);
    const fields = (form: string) => (
      <>
        <form aria-label="First" id="first" />
        <form aria-label="Second" id="second" />
        <Input defaultValue="Ada" form={form} label="Name" />
      </>
    );
    const { rerender } = render(fields("first"), { container });
    const input = within(container).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Grace" } });
    rerender(fields("second"));
    act(() =>
      within(container)
        .getByRole<HTMLFormElement>("form", { name: "First" })
        .reset(),
    );
    expect(input).toHaveValue("Grace");
    act(() =>
      within(container)
        .getByRole<HTMLFormElement>("form", { name: "Second" })
        .reset(),
    );
    await waitFor(() => expect(input).toHaveValue("Ada"));
  });

  it.each([
    ["Checkbox", Checkbox, "checkbox"],
    ["Switch", Switch, "switch"],
  ] as const)(
    "updates the %s state after a reset of its new form",
    async (_name, Control, role) => {
      const field = (form: string) => (
        <>
          <form id="first" />
          <form aria-label="Second" id="second" />
          <Control form={form} label="Enabled" />
        </>
      );
      const { rerender } = render(field("first"));
      const input = screen.getByRole(role);
      fireEvent.click(input);
      rerender(field("second"));
      expect(input).toHaveAttribute("data-state", "checked");

      act(() =>
        screen.getByRole<HTMLFormElement>("form", { name: "Second" }).reset(),
      );
      expect(input).not.toBeChecked();
      await waitFor(() =>
        expect(input).toHaveAttribute("data-state", "unchecked"),
      );
    },
  );

  it("resets date pickers with their new form", async () => {
    const fields = (form: string) => (
      <>
        <form aria-label="First" id="first" />
        <form aria-label="Second" id="second" />
        <DateTimePicker
          defaultValue="2026-09-01"
          form={form}
          label="Native day"
          mode="native"
          name="native"
        />
        <DateTimePicker
          defaultValue="2026-09-01"
          form={form}
          label="Day"
          name="day"
        />
        <DateRangePicker
          defaultValue={{ start: "2026-09-01", end: "2026-09-30" }}
          form={form}
          label="Range"
          name="range"
        />
      </>
    );
    const { rerender } = render(fields("first"));
    const first = screen.getByRole<HTMLFormElement>("form", { name: "First" });
    const second = screen.getByRole<HTMLFormElement>("form", {
      name: "Second",
    });
    fireEvent.change(screen.getByLabelText(/Native day/), {
      target: { value: "2026-09-15" },
    });
    for (const button of screen.getAllByRole("button", { name: "Clear value" }))
      fireEvent.click(button);
    rerender(fields("second"));

    act(() => first.reset());
    expect(Object.fromEntries(new FormData(second))).toEqual({
      native: "2026-09-15",
      day: "",
      range: "",
    });
    act(() => second.reset());
    await waitFor(() =>
      expect(new FormData(second).get("day")).toBe("2026-09-01"),
    );
    rerender(fields("second"));
    expect(Object.fromEntries(new FormData(second))).toEqual({
      native: "2026-09-01",
      day: "2026-09-01",
      range: "2026-09-01/2026-09-30",
    });
  });

  it("follow a changed form attribute without resetting with the old form", async () => {
    const fields = (form: string, cancelReset = false) => (
      <>
        <form aria-label="First" id="first" />
        <form
          aria-label="Second"
          id="second"
          onReset={(event) => cancelReset && event.preventDefault()}
        />
        <Input defaultValue="Ada" form={form} label="Name" name="name" />
        <Textarea defaultValue="Hello" form={form} label="Note" name="note" />
        <Select
          defaultValue="s"
          form={form}
          label="Size"
          name="size"
          options={sizes}
        />
        <RadioGroup
          defaultValue="s"
          form={form}
          label="Plan"
          name="plan"
          options={sizes}
        />
        <SegmentedControl
          defaultValue="s"
          form={form}
          label="Period"
          name="period"
          options={sizes}
        />
      </>
    );
    const { rerender } = render(fields("first"));
    const first = screen.getByRole<HTMLFormElement>("form", { name: "First" });
    const second = screen.getByRole<HTMLFormElement>("form", {
      name: "Second",
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "Grace" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), {
      target: { value: "Changed" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Size/ }), {
      target: { value: "l" },
    });
    for (const radio of screen.getAllByRole("radio", { name: "Large" }))
      fireEvent.click(radio);
    const edited = {
      name: "Grace",
      note: "Changed",
      size: "l",
      plan: "l",
      period: "l",
    };

    rerender(fields("second", true));
    act(() => first.reset());
    expect(Object.fromEntries(new FormData(second))).toEqual(edited);
    // A canceled reset of the new form still leaves the edits alone.
    act(() => second.reset());
    expect(Object.fromEntries(new FormData(second))).toEqual(edited);

    rerender(fields("second"));
    act(() => second.reset());
    await waitFor(() => expect(new FormData(second).get("name")).toBe("Ada"));
    // Another render must keep the reset values, not bring back stale state.
    rerender(fields("second"));
    expect(Object.fromEntries(new FormData(second))).toEqual({
      name: "Ada",
      note: "Hello",
      size: "s",
      plan: "s",
      period: "s",
    });
    expect([...new FormData(first)]).toEqual([]);
  });

  it("submit and reset with the form of their `form` attribute", async () => {
    render(
      <>
        <form id="order" />
        <RadioGroup defaultValue="s" form="order" name="size" options={sizes} />
        <RichTextEditor
          defaultValue="<p>Hello</p>"
          form="order"
          label="Note"
          name="note"
        />
        <FileUpload
          defaultAttachments={[{ filename: "a.pdf", id: "1", value: "file-1" }]}
          form="order"
          name="files"
          upload={async () => ({})}
        />
      </>,
    );
    const form = document.getElementById("order") as HTMLFormElement;

    fireEvent.click(screen.getByRole("radio", { name: "Large" }));
    const data = new FormData(form);
    expect(data.get("size")).toBe("l");
    expect(data.get("note")).toBe("<p>Hello</p>");
    expect(data.getAll("files")).toEqual(["file-1"]);

    act(() => form.reset());
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Small" })).toBeChecked(),
    );
  });

  it("leave the generated name of a RadioGroup out of the data of that form", () => {
    render(
      <>
        {/* Inside one form, of another */}
        <form aria-label="Cart">
          <RadioGroup
            defaultValue="l"
            form="order"
            label="Size"
            options={sizes}
          />
        </form>
        <form aria-label="Order" id="order" />
      </>,
    );

    // jsdom builds a FormData without firing the event browsers fire
    for (const name of ["Order", "Cart"]) {
      const form = screen.getByRole<HTMLFormElement>("form", { name });
      const formData = new FormData(form);
      form.dispatchEvent(Object.assign(new Event("formdata"), { formData }));
      expect([...formData.entries()]).toEqual([]);
    }
  });
});

describe("RichTextEditor ids", () => {
  it("derives the ids of its messages from its id", () => {
    render(
      <RichTextEditor
        description="Visible to the team."
        error="Too short"
        id="note"
        label="Note"
      />,
    );

    expect(document.getElementById("note-description")).toHaveTextContent(
      "Visible to the team.",
    );
    expect(document.getElementById("note-error")).toHaveTextContent(
      "Too short",
    );
  });
});
