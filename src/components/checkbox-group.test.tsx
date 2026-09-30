import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, createRef, useState } from "react";
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

    await waitFor(() => expect(checkbox("Email")).toBeChecked());
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
    await waitFor(() => expect(checkbox("SMS")).not.toBeChecked());
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

  it.each([
    { constraints: { required: true }, options: [] },
    { constraints: { min: 2 }, options: [] },
    {
      constraints: { required: true },
      options: channels.map((option) => ({ ...option, disabled: true })),
    },
    {
      constraints: { min: 2 },
      options: channels.map((option) => ({ ...option, disabled: true })),
    },
  ])(
    "enforces $constraints without an enabled option",
    async ({ constraints, options }) => {
      render(
        <form aria-label="Settings">
          <CheckboxGroup
            {...constraints}
            label="Channels"
            name="channels"
            options={options}
            value={["email", "sms"]}
          />
        </form>,
      );

      expect(getForm().checkValidity()).toBe(false);
      expect(new FormData(getForm()).getAll("channels")).toEqual([]);
      const validation =
        getForm().querySelector<HTMLInputElement>("input[type=text]")!;
      expect(validation.validationMessage).toBe(
        constraints.min === 2
          ? "Select at least 2 options."
          : "Select at least one option.",
      );
      // A native invalid control can take focus, then directs it to the group.
      await act(async () => validation.focus());
      expect(screen.getByRole("group", { name: "Channels:" })).toHaveFocus();
    },
  );

  it("does not reclaim focus after an empty group's validation is removed", async () => {
    const field = (required: boolean) => (
      <>
        <CheckboxGroup label="Channels" options={[]} required={required} />
        <button type="button">Next field</button>
      </>
    );
    const { rerender } = render(field(true));
    const validation = screen.getByRole("group").querySelector("input")!;
    const next = screen.getByRole("button", { name: "Next field" });
    await act(async () => {
      validation.focus();
      next.focus();
      rerender(field(false));
    });
    expect(next).toHaveFocus();
    expect(validation).not.toBeInTheDocument();
  });

  it("moves validation between the empty group and its returned options", () => {
    const field = (options: typeof channels) => (
      <form aria-label="Settings">
        <CheckboxGroup
          label="Channels"
          options={options}
          required
          value={["email"]}
        />
      </form>
    );
    const { rerender } = render(field([]));
    expect(getForm().checkValidity()).toBe(false);

    rerender(field(channels));
    expect(getForm().querySelector("input[type=text]")).toBeNull();
    expect(getForm().checkValidity()).toBe(true);

    rerender(field([]));
    expect(getForm().checkValidity()).toBe(false);
  });

  it.each(["disabled", "readOnly"] as const)(
    "does not validate an empty %s group, and restores validation when enabled",
    (state) => {
      const field = (locked: boolean) => (
        <form aria-label="Settings">
          <CheckboxGroup
            {...{ [state]: locked }}
            label="Channels"
            options={[]}
            required
          />
        </form>
      );
      const { rerender } = render(field(true));
      expect(getForm().checkValidity()).toBe(true);
      rerender(field(false));
      expect(getForm().checkValidity()).toBe(false);
      rerender(field(true));
      expect(getForm().checkValidity()).toBe(true);
    },
  );

  it("follows a disabled ancestor fieldset and its first legend exception", () => {
    render(
      <form aria-label="Settings">
        <fieldset aria-label="Parent" disabled>
          <legend>
            <CheckboxGroup label="Exempt" options={[]} required />
          </legend>
          <CheckboxGroup label="Disabled" options={[]} required />
        </fieldset>
      </form>,
    );

    const exempt = screen.getByRole("group", { name: "Exempt:" });
    const disabled = screen.getByRole("group", { name: "Disabled:" });
    expect(exempt.querySelector("input")).toBeEnabled();
    expect(disabled.querySelector("input")).toBeDisabled();
    expect(getForm().checkValidity()).toBe(false);
    getForm().querySelector("fieldset")!.disabled = false;
    expect(disabled.querySelector("input")).toBeEnabled();
    expect(getForm().checkValidity()).toBe(false);
  });

  it("validates an empty group in its explicitly associated form", () => {
    render(
      <>
        <form aria-label="Settings" id="settings" />
        <CheckboxGroup form="settings" label="Channels" options={[]} required />
      </>,
    );

    expect(getForm().checkValidity()).toBe(false);
    expect(getForm().elements).toHaveLength(1);
    expect([...new FormData(getForm())]).toEqual([]);
  });

  it("resets the selection while options are empty, and restores it when they return", async () => {
    const user = userEvent.setup();
    const field = (options: typeof channels) => (
      <form aria-label="Settings">
        <CheckboxGroup
          defaultValue={["email"]}
          label="Channels"
          options={options}
          required
        />
      </form>
    );
    const { rerender } = render(field(channels));
    await user.click(checkbox("Email"));
    await user.click(checkbox("SMS"));
    rerender(field([]));
    expect(getForm().checkValidity()).toBe(false);
    await act(async () => {
      getForm().reset();
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(getForm().checkValidity()).toBe(false);

    rerender(field(channels));
    expect(checkbox("Email")).toBeChecked();
    expect(checkbox("SMS")).not.toBeChecked();
    expect(getForm().checkValidity()).toBe(true);
  });

  it("enforces a missing minimum when Activity empties the options while hidden", async () => {
    const field = (
      hidden: boolean,
      options: typeof channels,
      required = true,
    ) => (
      <form aria-label="Settings">
        <Activity mode={hidden ? "hidden" : "visible"}>
          <CheckboxGroup
            label="Channels"
            options={options}
            required={required}
            value={["email"]}
          />
        </Activity>
      </form>
    );
    const { rerender } = render(field(false, channels));
    expect(getForm().checkValidity()).toBe(true);
    await act(async () => rerender(field(true, [])));
    expect(getForm().checkValidity()).toBe(false);

    await act(async () => rerender(field(true, [], false)));
    expect(getForm().checkValidity()).toBe(true);

    await act(async () => rerender(field(true, channels)));
    expect(getForm().checkValidity()).toBe(true);
    await act(async () => rerender(field(false, channels)));
    expect(checkbox("Email")).toBeChecked();
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

  it.each(["default", "card"] as const)(
    "points no option at a description that renders nothing (%s)",
    (variant) => {
      render(
        <CheckboxGroup
          label="Channels"
          options={[
            // `isPro && "Pro only"`, `count && "…"`
            { description: false, label: "Email", value: "e" },
            { description: 0, label: "SMS", value: "s" },
            { description: "", label: "Push", value: "p" },
          ]}
          variant={variant}
        />,
      );

      for (const name of ["Email", "SMS", "Push"]) {
        expect(checkbox(name)).not.toHaveAttribute("aria-describedby");
      }
    },
  );

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

  describe("read-only", () => {
    it("keeps the picks on a click and on Space, focusable", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <CheckboxGroup
          defaultValue={["sms"]}
          label="Channels"
          onChange={onChange}
          options={channels}
          readOnly
          selectAll
        />,
      );

      await user.click(checkbox("Email"));
      expect(checkbox("Email")).not.toBeChecked();
      expect(checkbox("Email")).toHaveFocus();
      await user.keyboard(" ");
      expect(checkbox("Email")).not.toBeChecked();
      await user.click(screen.getByText("SMS"));
      expect(checkbox("SMS")).toBeChecked();

      // "Select all" is read-only too - and stays partly checked
      await user.click(checkbox("Select all"));
      expect(checkbox("Select all")).toBePartiallyChecked();

      expect(onChange).not.toHaveBeenCalled();
      for (const input of screen.getAllByRole("checkbox")) {
        expect(input).toHaveAttribute("aria-readonly", "true");
        expect(input).toBeEnabled();
      }
    });

    it("submits the picks without validating them", () => {
      render(
        <form aria-label="Settings">
          <CheckboxGroup
            defaultValue={["email", "push"]}
            label="Channels"
            max={1}
            name="channels"
            options={channels}
            readOnly
          />
        </form>,
      );

      const formElement = getForm();
      expect(new FormData(formElement).getAll("channels")).toEqual([
        "email",
        "push",
      ]);
      // More than max - but nothing could be changed about it
      expect(formElement.checkValidity()).toBe(true);
      // No option is disabled for the limit, and nothing is said about it
      expect(checkbox("SMS")).toBeEnabled();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  describe("cards", () => {
    const plans = [
      {
        description: "For one person",
        icon: <svg data-testid="icon" />,
        label: "Personal",
        value: "personal",
      },
      { label: <strong>Team</strong>, value: "team" },
      { disabled: true, label: "Enterprise", value: "enterprise" },
    ];

    it("shows each option as a card named by its label, described by its description", () => {
      render(<CheckboxGroup label="Plans" options={plans} variant="card" />);

      const personal = checkbox("Personal");
      expect(personal).toHaveAccessibleDescription("For one person");
      expect(checkbox("Team")).toHaveAccessibleName("Team");
      // The icon is decorative
      expect(screen.getByTestId("icon").parentElement).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      const card = personal.closest("label")!;
      expect(card).toHaveClass(
        "rounded-lg",
        "border",
        "has-checked:border-primary-500",
      );
      expect(card).toHaveClass("has-focus-visible:outline-2");
      expect(card).toContainElement(screen.getByText("For one person"));
    });

    it("toggles a card by a click anywhere on it and by Space", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <CheckboxGroup
          label="Plans"
          onChange={onChange}
          options={plans}
          variant="card"
        />,
      );

      await user.click(screen.getByText("For one person"));
      expect(checkbox("Personal")).toBeChecked();
      expect(onChange).toHaveBeenLastCalledWith(["personal"]);

      await user.tab();
      expect(checkbox("Team")).toHaveFocus();
      await user.keyboard(" ");
      expect(onChange).toHaveBeenLastCalledWith(["personal", "team"]);

      expect(checkbox("Enterprise")).toBeDisabled();
      expect(checkbox("Enterprise").closest("label")).toHaveClass(
        "cursor-not-allowed",
      );
    });

    it("lays the cards out in a grid - in columns, or in a row that wraps", () => {
      render(
        <>
          <CheckboxGroup
            aria-label="Columns"
            columns={3}
            options={channels}
            variant="card"
          />
          <CheckboxGroup
            aria-label="Row"
            options={channels}
            orientation="horizontal"
            variant="card"
          />
        </>,
      );

      const listOf = (name: string) =>
        within(screen.getByRole("group", { name }))
          .getByRole("checkbox", { name: "Email" })
          .closest("label")!.parentElement!;
      expect(listOf("Columns")).toHaveClass(
        "grid",
        "sm:grid-cols-[repeat(var(--cui-columns),minmax(0,1fr))]",
      );
      expect(listOf("Columns").style.getPropertyValue("--cui-columns")).toBe(
        "3",
      );
      expect(listOf("Row")).toHaveClass(
        "grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]",
      );
    });

    it("marks the cards invalid with an error", () => {
      render(
        <CheckboxGroup
          error="Pick one"
          label="Plans"
          options={plans}
          variant="card"
        />,
      );

      expect(checkbox("Personal").closest("label")).toHaveClass(
        "border-danger-500",
      );
      expect(checkbox("Personal")).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("takes any content as the label of the group and of an option", () => {
    render(
      <CheckboxGroup
        label={
          <>
            Channels <em>(any)</em>
          </>
        }
        options={[{ label: <b>Email</b>, value: "email" }]}
      />,
    );

    expect(screen.getByRole("group")).toHaveAccessibleName("Channels (any):");
    expect(checkbox("Email")).toBeInTheDocument();
  });

  it("puts an icon before the label of a plain option", () => {
    render(
      <CheckboxGroup
        aria-label="Channels"
        options={[
          { icon: <svg data-testid="icon" />, label: "Email", value: "email" },
        ]}
      />,
    );

    expect(checkbox("Email")).toHaveAccessibleName("Email");
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
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
    // The states for styling are in the page before it is hydrated
    expect(
      container.querySelector("input[value='sms']")?.getAttribute("data-state"),
    ).toBe("checked");
    expect(
      container.querySelector("fieldset")?.getAttribute("data-orientation"),
    ).toBe("vertical");

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
