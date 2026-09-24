import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TagsInput from "./tags-input";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const input = () => screen.getByRole<HTMLInputElement>("textbox");

const removeButton = (tag: string) =>
  screen.getByRole("button", { name: `Remove ${tag}` });

const shownTags = () =>
  screen
    .queryAllByRole("button", { name: /^Remove / })
    .map((button) => button.getAttribute("aria-label")!.slice(7));

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe("TagsInput", () => {
  it("adds the typed text on Enter and on a comma", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput label="Keywords" onChange={onChange} />);

    await user.type(
      screen.getByRole("textbox", { name: "Keywords:" }),
      " invoice {Enter}",
    );
    expect(onChange).toHaveBeenLastCalledWith(["invoice"]);
    expect(input()).toHaveValue("");

    await user.type(input(), "overdue,reminder");
    expect(onChange).toHaveBeenLastCalledWith(["invoice", "overdue"]);
    expect(input()).toHaveValue("reminder");
    expect(shownTags()).toEqual(["invoice", "overdue"]);
  });

  it("ends values at the separators it is given", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagsInput
        aria-label="Recipients"
        onChange={onChange}
        separators={[";", " "]}
      />,
    );

    await user.type(input(), "a@example.com;b@example.com c,d");

    expect(onChange).toHaveBeenLastCalledWith([
      "a@example.com",
      "b@example.com",
    ]);
    expect(input()).toHaveValue("c,d");
  });

  it("leaves Enter in an empty input to the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form aria-label="Search" onSubmit={onSubmit}>
        <TagsInput aria-label="Keywords" defaultValue={["a"]} />
        <button type="submit">Search</button>
      </form>,
    );

    await user.type(input(), "b{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("splits pasted text at the separators and line breaks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput aria-label="Recipients" onChange={onChange} />);

    await user.click(input());
    await user.paste("anna@example.com, petr@example.com\njan@example.com");
    expect(onChange).toHaveBeenLastCalledWith([
      "anna@example.com",
      "petr@example.com",
      "jan@example.com",
    ]);

    // One value stays text to edit
    await user.paste("eva@example");
    expect(input()).toHaveValue("eva@example");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("refuses a value in the list already, ignoring case", async () => {
    const user = userEvent.setup();
    render(<TagsInput aria-label="Keywords" defaultValue={["Invoice"]} />);

    await user.type(input(), "invoice{Enter}");

    expect(shownTags()).toEqual(["Invoice"]);
    expect(input()).toHaveValue("invoice");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "“invoice” is already in the list.",
    );
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription(
      "“invoice” is already in the list.",
    );

    // Typing takes the message away
    await user.type(input(), "s");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input()).not.toHaveAttribute("aria-invalid");
  });

  it("takes a value twice with allowDuplicates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagsInput
        allowDuplicates
        aria-label="Keywords"
        defaultValue={["a"]}
        onChange={onChange}
      />,
    );

    await user.type(input(), "a{Enter}");

    expect(onChange).toHaveBeenCalledWith(["a", "a"]);
  });

  it("refuses what validate refuses, keeping the rest of a paste", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagsInput
        aria-label="Recipients"
        onChange={onChange}
        validate={(tag) =>
          tag.includes("@") ? undefined : `${tag} is no e-mail address.`
        }
      />,
    );

    await user.click(input());
    await user.paste("anna@example.com, petr, jan");

    expect(onChange).toHaveBeenCalledWith(["anna@example.com"]);
    expect(input()).toHaveValue("petr, jan");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "petr is no e-mail address.",
    );
  });

  it("refuses more values than maxTags, in the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <TagsInput aria-label="Štítky" defaultValue={["a", "b"]} maxTags={3} />
      </UIProvider>,
    );

    await user.type(input(), "c{Enter}d{Enter}");

    expect(screen.getAllByRole("button", { name: /^Odebrat / })).toHaveLength(
      3,
    );
    expect(input()).toHaveValue("d");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Přidat lze nejvýše 3 položky.",
    );
  });

  it("removes a value by its button, keeping the focus in the input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagsInput
        aria-label="Keywords"
        defaultValue={["a", "b", "c"]}
        onChange={onChange}
      />,
    );

    await user.click(input());
    await user.click(removeButton("b"));

    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
    expect(shownTags()).toEqual(["a", "c"]);
    expect(input()).toHaveFocus();
  });

  it("moves to the last value with Backspace, and removes it with the next", async () => {
    const user = userEvent.setup();
    render(<TagsInput aria-label="Keywords" defaultValue={["a", "b", "c"]} />);

    await user.click(input());
    await user.keyboard("{Backspace}");
    expect(removeButton("c")).toHaveFocus();
    expect(shownTags()).toEqual(["a", "b", "c"]);

    await user.keyboard("{Backspace}");
    expect(shownTags()).toEqual(["a", "b"]);
    expect(removeButton("b")).toHaveFocus();

    // Delete removes the focused one - the focus takes its place
    await user.keyboard("{ArrowLeft}{Delete}");
    expect(shownTags()).toEqual(["b"]);
    expect(removeButton("b")).toHaveFocus();

    await user.keyboard("{Backspace}");
    expect(shownTags()).toEqual([]);
    expect(input()).toHaveFocus();
  });

  it("moves between the values and the input with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<TagsInput aria-label="Keywords" defaultValue={["a", "b"]} />);

    await user.type(input(), "x");
    // Not from the middle of the text
    await user.keyboard("{ArrowLeft}");
    expect(input()).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(removeButton("b")).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(removeButton("a")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(input()).toHaveFocus();

    // The caret is still at the start - typing on a value goes on in the
    // input
    await user.keyboard("{ArrowLeft}");
    expect(removeButton("b")).toHaveFocus();
    await user.keyboard("y");
    expect(input()).toHaveFocus();
  });

  it("adds the typed text on blur with addOnBlur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <TagsInput addOnBlur aria-label="With" onChange={onChange} />
        <TagsInput aria-label="Without" />
      </>,
    );

    await user.type(screen.getByRole("textbox", { name: "With" }), "a");
    await user.type(screen.getByRole("textbox", { name: "Without" }), "b");
    expect(onChange).toHaveBeenCalledWith(["a"]);

    await user.tab();
    expect(screen.getByRole("textbox", { name: "Without" })).toHaveValue("b");
  });

  it("shows the value of a controlled field only", async () => {
    const user = userEvent.setup();

    function Recipients() {
      const [tags, setTags] = useState(["a"]);
      return (
        <TagsInput
          aria-label="Recipients"
          onChange={(next) => setTags(next.map((tag) => tag.toUpperCase()))}
          value={tags}
        />
      );
    }

    render(<Recipients />);
    expect(shownTags()).toEqual(["a"]);
    await user.type(input(), "b{Enter}");

    expect(shownTags()).toEqual(["A", "B"]);
  });

  it("submits every value and brings back the default on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Mail">
        <TagsInput aria-label="To" defaultValue={["anna"]} name="to" />
      </form>,
    );

    await user.type(input(), "petr{Enter}jan");
    expect(new FormData(getForm()).getAll("to")).toEqual(["anna", "petr"]);

    act(() => getForm().reset());
    expect(shownTags()).toEqual(["anna"]);
    expect(input()).toHaveValue("");
    expect(new FormData(getForm()).getAll("to")).toEqual(["anna"]);
  });

  it("requires a value when required, with a message the browser shows", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Mail">
        <TagsInput label="To" name="to" required />
      </form>,
    );

    expect(input()).toHaveAttribute("aria-required", "true");
    expect(getForm().checkValidity()).toBe(false);
    expect(input().validationMessage).toBe("Add at least one item.");

    // Text is no value yet
    await user.type(input(), "anna");
    expect(getForm().checkValidity()).toBe(false);
    await user.keyboard("{Enter}");
    expect(getForm().checkValidity()).toBe(true);
  });

  it("neither submits nor validates a disabled field", () => {
    render(
      <form aria-label="Mail">
        <TagsInput
          aria-label="To"
          defaultValue={["anna"]}
          disabled
          name="to"
          required
        />
      </form>,
    );

    expect(input()).toBeDisabled();
    expect(shownTags()).toEqual([]);
    expect(screen.getByText("anna")).toBeInTheDocument();
    expect(getForm().checkValidity()).toBe(true);
    expect(new FormData(getForm()).has("to")).toBe(false);
  });

  it("names the remove buttons in the language of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <TagsInput aria-label="Štítky" defaultValue={["faktura"]} />
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Odebrat faktura" }),
    ).toHaveAttribute("tabindex", "-1");
  });

  describe("suggestions", () => {
    const skills = ["React", "TypeScript", "GraphQL", "Čeština"];

    it("offers the matching suggestions as the user types", async () => {
      const user = userEvent.setup();
      render(<TagsInput label="Skills" suggestions={skills} />);

      const combobox = screen.getByRole("combobox", { name: "Skills:" });
      expect(combobox).toHaveAttribute("aria-expanded", "false");

      // Ignoring case and diacritics
      await user.type(combobox, "cest");
      expect(combobox).toHaveAttribute("aria-expanded", "true");
      const listbox = screen.getByRole("listbox", { name: "Suggestions" });
      expect(combobox).toHaveAttribute("aria-controls", listbox.id);
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Čeština"]);
    });

    it("picks a suggestion with the arrow keys and Enter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <TagsInput
          aria-label="Skills"
          defaultValue={["React"]}
          onChange={onChange}
          suggestions={skills}
        />,
      );

      await user.click(screen.getByRole("combobox"));
      await user.keyboard("{ArrowDown}");
      // The values in the list are not offered
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["TypeScript", "GraphQL", "Čeština"]);
      expect(
        screen.getByRole("option", { name: "TypeScript" }),
      ).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "GraphQL" }).id,
      );
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(["React", "GraphQL"]);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("adds a clicked suggestion, and the typed text as a suggestion spells it", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <TagsInput
          aria-label="Skills"
          onChange={onChange}
          suggestions={skills}
        />,
      );

      await user.type(screen.getByRole("combobox"), "type");
      await user.click(screen.getByRole("option", { name: "TypeScript" }));
      expect(onChange).toHaveBeenLastCalledWith(["TypeScript"]);
      expect(screen.getByRole("combobox")).toHaveFocus();

      await user.type(screen.getByRole("combobox"), "graphql{Enter}");
      expect(onChange).toHaveBeenLastCalledWith(["TypeScript", "GraphQL"]);

      // Any other text too
      await user.type(screen.getByRole("combobox"), "Rust{Enter}");
      expect(onChange).toHaveBeenLastCalledWith([
        "TypeScript",
        "GraphQL",
        "Rust",
      ]);
    });

    it("closes the list on Escape and nothing around it", async () => {
      const user = userEvent.setup();
      const onDocumentKeyDown = vi.fn();
      document.addEventListener("keydown", onDocumentKeyDown);
      render(<TagsInput aria-label="Skills" suggestions={skills} />);

      await user.type(screen.getByRole("combobox"), "r");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
      document.removeEventListener("keydown", onDocumentKeyDown);
    });

    it("keeps the focus and the validity of the input when they arrive while typing", async () => {
      const user = userEvent.setup();
      function Skills() {
        // Loaded for the typed text - none until the first answer
        const [loaded, setLoaded] = useState<string[]>();
        return (
          <form aria-label="Profile">
            <TagsInput
              label="Skills"
              onChange={() => {}}
              onKeyDown={() => setLoaded(skills)}
              required
              suggestions={loaded}
            />
          </form>
        );
      }
      render(<Skills />);

      const field = input();
      await user.click(field);
      await user.keyboard("re");

      // The same input - a new one would have lost the focus and the message
      expect(screen.getByRole("combobox", { name: /Skills/ })).toBe(field);
      expect(field).toHaveFocus();
      expect(field).toHaveValue("re");
      expect(getForm().checkValidity()).toBe(false);
      expect(field.validationMessage).toBe("Add at least one item.");
    });
  });

  it("is described by its errors first, then its description", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p id="hint">Hint</p>
        <TagsInput
          aria-describedby="hint"
          defaultValue={["a"]}
          description="Separate them by commas."
          error="Too many keywords"
          id="keywords"
          label="Keywords"
        />
      </>,
    );

    expect(input()).toHaveAccessibleDescription(
      "Too many keywords Separate them by commas. Hint",
    );
    await user.type(input(), "a{Enter}");
    expect(input()).toHaveAttribute(
      "aria-describedby",
      "keywords-input-error keywords-error keywords-description hint",
    );
  });

  it("passes its ref and native attributes to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <TagsInput
        aria-label="Recipients"
        data-testid="recipients"
        inputMode="email"
        placeholder="Add a recipient"
        ref={ref}
      />,
    );

    expect(ref.current).toBe(input());
    expect(input()).toHaveAttribute("data-testid", "recipients");
    expect(input()).toHaveAttribute("inputmode", "email");
    expect(input()).toHaveAttribute("placeholder", "Add a recipient");
  });

  it("calls the consumer's key handler first - a prevented key is left alone", () => {
    const onChange = vi.fn();
    render(
      <TagsInput
        aria-label="Keywords"
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />,
    );

    fireEvent.change(input(), { target: { value: "a" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const field = (
      <TagsInput
        defaultValue={["anna"]}
        label="To"
        name="to"
        required
        suggestions={["petr"]}
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(field);
    document.body.append(container);

    expect(container.querySelector("[role='combobox']")).not.toBeNull();
    expect(
      container.querySelector<HTMLInputElement>("input[name='to']")?.value,
    ).toBe("anna");

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(removeButton("anna")).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });
});

describe("TagsInput read-only", () => {
  it("shows and submits its values but takes no changes", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TagsInput
          defaultValue={["alpha", "beta"]}
          label="Tags"
          name="tags"
          readOnly
          suggestions={["gamma"]}
        />
      </form>,
    );
    const input = screen.getByRole("combobox", { name: /Tags/ });

    expect(
      screen.queryByRole("button", { name: /alpha/ }),
    ).not.toBeInTheDocument();

    await user.click(input);
    await user.keyboard("{Backspace}{Backspace}{ArrowDown}{Enter}");
    await user.paste("one, two");

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).getAll("tags")).toEqual(["alpha", "beta"]);
    expect(input).toHaveAttribute("readonly");
  });

  it("submits its form on Enter, as a read-only text field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TagsInput
          defaultValue={["alpha"]}
          label="Tags"
          readOnly
          suggestions={["gamma"]}
        />
        <button type="submit">Save</button>
      </form>,
    );

    act(() => screen.getByRole("combobox", { name: /Tags/ }).focus());
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
