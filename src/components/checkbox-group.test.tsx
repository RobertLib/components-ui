import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CheckboxGroup from "./checkbox-group";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const channels = [
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "Push", value: "push" },
];

const checkbox = (name: string) =>
  screen.getByRole<HTMLInputElement>("checkbox", { name });

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe("CheckboxGroup", () => {
  it("is a fieldset named by its legend, with checkboxes sharing the name", () => {
    render(
      <CheckboxGroup label="Channels" name="channels" options={channels} />,
    );

    const group = screen.getByRole("group", { name: "Channels:" });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    for (const input of screen.getAllByRole<HTMLInputElement>("checkbox")) {
      expect(input.name).toBe("channels");
      expect(input).not.toBeRequired();
    }
  });

  it("is a named group without a label", () => {
    render(<CheckboxGroup aria-label="Channels" options={channels} />);

    const group = screen.getByRole("group", { name: "Channels" });
    expect(group.tagName).toBe("DIV");
  });

  it("reports the picked values in the order of the options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CheckboxGroup
        defaultValue={["push"]}
        label="Channels"
        onChange={onChange}
        options={channels}
      />,
    );

    expect(checkbox("Push")).toBeChecked();
    await user.click(checkbox("Email"));

    expect(onChange).toHaveBeenLastCalledWith(["email", "push"]);
    expect(checkbox("Email")).toBeChecked();

    await user.click(checkbox("Push"));
    expect(onChange).toHaveBeenLastCalledWith(["email"]);
    expect(checkbox("Push")).not.toBeChecked();
  });

  it("keeps numeric values numbers, and compares them as strings", async () => {
    const user = userEvent.setup();

    function Rooms() {
      const [rooms, setRooms] = useState<number[]>([2]);
      return (
        <>
          <CheckboxGroup
            label="Rooms"
            onChange={setRooms}
            options={[
              { label: "One", value: 1 },
              { label: "Two", value: 2 },
            ]}
            value={rooms}
          />
          <output>{JSON.stringify(rooms)}</output>
        </>
      );
    }

    render(<Rooms />);
    await user.click(checkbox("One"));

    expect(document.querySelector("output")).toHaveTextContent("[1,2]");
    expect(checkbox("One")).toBeChecked();
    expect(checkbox("Two")).toBeChecked();
  });

  it("shows the value of a controlled group only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CheckboxGroup
        label="Channels"
        onChange={onChange}
        options={channels}
        value={["sms"]}
      />,
    );

    await user.click(checkbox("Email"));

    expect(onChange).toHaveBeenCalledWith(["email", "sms"]);
    expect(checkbox("Email")).not.toBeChecked();
    expect(checkbox("SMS")).toBeChecked();
  });

  it("keeps values no option has", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CheckboxGroup
        label="Channels"
        onChange={onChange}
        options={channels}
        value={["fax", "sms"]}
      />,
    );

    await user.click(checkbox("Email"));

    expect(onChange).toHaveBeenCalledWith(["email", "sms", "fax"]);
  });

  it("submits every picked value under its name", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings">
        <CheckboxGroup
          defaultValue={["sms"]}
          label="Channels"
          name="channels"
          options={channels}
        />
        <CheckboxGroup
          defaultValue={["b"]}
          label="Unnamed"
          options={[
            { label: "A", value: "a" },
            { label: "B", value: "b" },
          ]}
        />
      </form>,
    );

    await user.click(checkbox("Push"));

    const data = new FormData(getForm());
    expect(data.getAll("channels")).toEqual(["sms", "push"]);
    expect([...data.keys()]).toEqual(["channels", "channels"]);
  });

  it("brings back the defaultValue on a form reset", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <form aria-label="Settings">
        <CheckboxGroup label="Channels" name="channels" options={channels} />
      </form>,
    );
    // A default that arrives after the first render (data of an edit form)
    rerender(
      <form aria-label="Settings">
        <CheckboxGroup
          defaultValue={["email"]}
          label="Channels"
          name="channels"
          options={channels}
        />
      </form>,
    );
    expect(checkbox("Email")).toBeChecked();

    await user.click(checkbox("Email"));
    await user.click(checkbox("Push"));
    act(() => getForm().reset());

    expect(checkbox("Email")).toBeChecked();
    expect(checkbox("Push")).not.toBeChecked();
    expect(new FormData(getForm()).getAll("channels")).toEqual(["email"]);
  });

  it("leaves a controlled group showing its value after a form reset", async () => {
    const user = userEvent.setup();

    function Settings() {
      const [picked, setPicked] = useState<string[]>([]);
      return (
        <form aria-label="Settings">
          <CheckboxGroup
            label="Channels"
            name="channels"
            onChange={setPicked}
            options={channels}
            value={picked}
          />
        </form>
      );
    }

    render(<Settings />);
    await user.click(checkbox("SMS"));
    act(() => getForm().reset());

    expect(checkbox("SMS")).toBeChecked();
    expect(new FormData(getForm()).getAll("channels")).toEqual(["sms"]);
  });

  it("belongs to the form given by id", async () => {
    const user = userEvent.setup();
    render(
      <>
        <form aria-label="Settings" id="settings" />
        <CheckboxGroup
          defaultValue={["email"]}
          form="settings"
          label="Channels"
          name="channels"
          options={channels}
        />
      </>,
    );

    await user.click(checkbox("SMS"));
    expect(new FormData(getForm()).getAll("channels")).toEqual([
      "email",
      "sms",
    ]);

    act(() => getForm().reset());
    expect(checkbox("SMS")).not.toBeChecked();
    expect(checkbox("Email")).toBeChecked();
  });

  it("requires one option, with a message the browser shows", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings">
        <CheckboxGroup
          label="Channels"
          name="channels"
          options={channels}
          required
        />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    expect(checkbox("Email").validationMessage).toBe(
      "Select at least one option.",
    );
    expect(checkbox("SMS").validationMessage).toBe("");
    // The star is only for the eye
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");

    await user.click(checkbox("Push"));
    expect(getForm().checkValidity()).toBe(true);
  });

  it("counts min in the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Nastavení">
          <CheckboxGroup label="Kanály" min={2} options={channels} />
        </form>
      </UIProvider>,
    );

    expect(checkbox("Email").validationMessage).toBe(
      "Vyberte alespoň 2 možnosti.",
    );

    await user.click(checkbox("Email"));
    expect(getForm().checkValidity()).toBe(false);
    await user.click(checkbox("SMS"));
    expect(getForm().checkValidity()).toBe(true);
  });

  it("disables the other options once max are picked, and says so", async () => {
    const user = userEvent.setup();
    render(<CheckboxGroup label="Channels" max={2} options={channels} />);

    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await user.click(checkbox("Email"));
    await user.click(checkbox("Push"));

    expect(checkbox("SMS")).toBeDisabled();
    expect(checkbox("Email")).toBeEnabled();
    expect(status).toHaveTextContent("You can select up to 2 options.");

    await user.click(checkbox("Email"));
    expect(checkbox("SMS")).toBeEnabled();
    expect(status).toBeEmptyDOMElement();
  });

  it("refuses to submit more values than max", () => {
    render(
      <form aria-label="Settings">
        <CheckboxGroup
          label="Channels"
          max={1}
          options={channels}
          value={["email", "sms"]}
        />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    expect(checkbox("Email").validationMessage).toBe(
      "You can select only one option.",
    );
  });

  it("counts only the values of its options for required, min and max", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings">
        <CheckboxGroup
          // A channel that is gone - the form would submit nothing for it
          defaultValue={["fax"]}
          label="Channels"
          max={1}
          name="channels"
          options={channels}
          required
        />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    expect(checkbox("Email").validationMessage).toBe(
      "Select at least one option.",
    );
    // The value no option has does not use up max
    expect(checkbox("SMS")).toBeEnabled();

    await user.click(checkbox("SMS"));
    expect(getForm().checkValidity()).toBe(true);
    expect(checkbox("Email")).toBeDisabled();
    expect(new FormData(getForm()).getAll("channels")).toEqual(["sms"]);
  });

  it("neither submits nor validates a disabled group", () => {
    render(
      <form aria-label="Settings">
        <CheckboxGroup
          defaultValue={["email"]}
          disabled
          label="Channels"
          min={2}
          name="channels"
          options={channels}
        />
      </form>,
    );

    for (const input of screen.getAllByRole("checkbox")) {
      expect(input).toBeDisabled();
    }
    expect(getForm().checkValidity()).toBe(true);
    expect(new FormData(getForm()).getAll("channels")).toEqual([]);
  });

  it("keeps the state of a disabled option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CheckboxGroup
        defaultValue={["sms"]}
        label="Channels"
        onChange={onChange}
        options={[channels[0], { ...channels[1], disabled: true }, channels[2]]}
      />,
    );

    expect(checkbox("SMS")).toBeDisabled();
    expect(checkbox("SMS")).toBeChecked();
    await user.click(checkbox("SMS"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("counts no picked disabled option for required, min or max - it is not submitted", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Notifications">
        <CheckboxGroup
          defaultValue={["sms"]}
          label="Channels"
          max={2}
          name="channels"
          options={[
            channels[0],
            { ...channels[1], disabled: true },
            channels[2],
          ]}
          required
        />
      </form>,
    );

    expect(new FormData(getForm()).getAll("channels")).toEqual([]);
    expect(getForm().checkValidity()).toBe(false);

    await user.click(checkbox("Email"));
    expect(getForm().checkValidity()).toBe(true);
    // Not submitted, it takes no place of max
    expect(checkbox("Push")).toBeEnabled();
    await user.click(checkbox("Push"));
    expect(new FormData(getForm()).getAll("channels")).toEqual([
      "email",
      "push",
    ]);
    expect(getForm().checkValidity()).toBe(true);
  });

  it("can be valid with a picked disabled option and min equal to max", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <CheckboxGroup
          defaultValue={["included", "b"]}
          label="Pick exactly 2"
          max={2}
          min={2}
          name="extras"
          options={[
            { disabled: true, label: "Included", value: "included" },
            { label: "B", value: "b" },
            { label: "C", value: "c" },
          ]}
        />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    expect(checkbox("C")).toBeEnabled();
    await user.click(checkbox("C"));
    expect(new FormData(getForm()).getAll("extras")).toEqual(["b", "c"]);
    expect(getForm().checkValidity()).toBe(true);
  });

  describe("select all", () => {
    it("picks and clears the options that can be changed", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Export">
          <CheckboxGroup
            label="Columns"
            name="columns"
            onChange={onChange}
            options={[
              { label: "Name", value: "name" },
              { disabled: true, label: "Id", value: "id" },
              { label: "Email", value: "email" },
            ]}
            selectAll
          />
        </form>,
      );

      const all = checkbox("Select all");
      expect(all).not.toBeChecked();
      expect(all).not.toBePartiallyChecked();

      await user.click(checkbox("Name"));
      expect(all).toBePartiallyChecked();

      await user.click(all);
      expect(onChange).toHaveBeenLastCalledWith(["name", "email"]);
      expect(all).toBeChecked();
      expect(all).not.toBePartiallyChecked();
      expect(checkbox("Id")).not.toBeChecked();

      await user.click(all);
      expect(onChange).toHaveBeenLastCalledWith([]);
      expect(all).not.toBeChecked();

      // It is not submitted
      await user.click(all);
      expect(new FormData(getForm()).getAll("columns")).toEqual([
        "name",
        "email",
      ]);
      expect([...new FormData(getForm()).keys()]).toEqual([
        "columns",
        "columns",
      ]);
    });

    it("takes a label and speaks the language of the locale", () => {
      const { rerender } = render(
        <UIProvider locale={cs}>
          <CheckboxGroup label="Sloupce" options={channels} selectAll />
        </UIProvider>,
      );
      expect(checkbox("Vybrat vše")).toBeInTheDocument();

      rerender(
        <UIProvider locale={cs}>
          <CheckboxGroup
            label="Sloupce"
            options={channels}
            selectAll="Všechny kanály"
          />
        </UIProvider>,
      );
      expect(checkbox("Všechny kanály")).toBeInTheDocument();
    });

    it("is left out when max would not let all options be picked", () => {
      const { rerender } = render(
        <CheckboxGroup label="Channels" max={2} options={channels} selectAll />,
      );
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);

      rerender(
        <CheckboxGroup label="Channels" max={3} options={channels} selectAll />,
      );
      expect(checkbox("Select all")).toBeInTheDocument();
    });

    it("comes back partly checked after a click while partly picked", async () => {
      const user = userEvent.setup();
      render(
        <CheckboxGroup
          label="Channels"
          onChange={() => {}}
          options={channels}
          selectAll
          value={["email"]}
        />,
      );

      // The parent refuses the change
      await user.click(checkbox("Select all"));
      expect(checkbox("Select all")).toBePartiallyChecked();
    });
  });

  it("is described by its error first, then its description", () => {
    render(
      <>
        <p id="hint">Hint</p>
        <CheckboxGroup
          aria-describedby="hint"
          description="We never share your number."
          error="Pick a channel"
          label="Channels"
          options={[
            { description: "Once a day at most", label: "Email", value: "e" },
            { label: "SMS", value: "s" },
          ]}
        />
      </>,
    );

    expect(screen.getByRole("group")).toHaveAccessibleDescription(
      "Pick a channel We never share your number. Hint",
    );
    expect(checkbox("Email")).toHaveAccessibleDescription("Once a day at most");
    expect(checkbox("Email")).toHaveAttribute("aria-invalid", "true");
    expect(checkbox("SMS")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a channel");
  });

  it("marks the options invalid, not its select all", () => {
    render(
      <CheckboxGroup
        error="Pick a channel"
        label="Channels"
        options={channels}
        selectAll
      />,
    );

    expect(checkbox("Email")).toHaveAttribute("aria-invalid", "true");
    expect(checkbox("Select all")).not.toHaveAttribute("aria-invalid");
  });

  it("derives the ids of its messages from its id", () => {
    render(
      <CheckboxGroup
        description="Help"
        error="Error"
        id="channels"
        label="Channels"
        options={channels}
      />,
    );

    expect(screen.getByRole("group")).toHaveAttribute("id", "channels");
    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-describedby",
      "channels-error channels-description",
    );
  });

  it("points its ref at the group and calls the focus handlers", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLElement>();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <CheckboxGroup
          label="Channels"
          onBlur={onBlur}
          onFocus={onFocus}
          options={channels}
          ref={ref}
        />
        <button type="button">After</button>
      </>,
    );

    expect(ref.current?.tagName).toBe("FIELDSET");

    await user.click(checkbox("Email"));
    expect(onFocus).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "After" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const group = (
      <CheckboxGroup
        defaultValue={["sms"]}
        description="Help"
        label="Channels"
        max={3}
        name="channels"
        options={channels}
        required
        selectAll
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(group);
    document.body.append(container);

    expect(container.querySelector("fieldset")).not.toBeNull();
    expect(container).toHaveTextContent("Select all");
    expect(
      container.querySelector<HTMLInputElement>("input[value='sms']")
        ?.defaultChecked,
    ).toBe(true);

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, group, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    // A DOM property only - set once the page is hydrated
    expect(checkbox("Select all")).toBePartiallyChecked();
    expect(checkbox("SMS")).toBeChecked();

    act(() => root.unmount());
    container.remove();
  });
});
