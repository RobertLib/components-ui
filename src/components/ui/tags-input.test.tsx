import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TagsInput from "./tags-input";
import { cs } from "../../i18n/ui/cs";
import UIProvider from "../../providers/ui-provider";

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

  it.each([
    { finalInput: "before", allowDuplicates: false },
    { finalInput: "after", allowDuplicates: false },
    { finalInput: "before", allowDuplicates: true },
    { finalInput: "after", allowDuplicates: true },
  ])(
    "waits for IME composition with final input $finalInput compositionend (duplicates: $allowDuplicates)",
    async ({ finalInput, allowDuplicates }) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onCompositionStart = vi.fn();
      const onCompositionEnd = vi.fn();
      render(
        <TagsInput
          allowDuplicates={allowDuplicates}
          onChange={onChange}
          onCompositionEnd={onCompositionEnd}
          onCompositionStart={onCompositionStart}
          separators={[" "]}
        />,
      );
      const field = input();
      await user.click(field);
      fireEvent.compositionStart(field);
      fireEvent.input(field, {
        inputType: "insertCompositionText",
        isComposing: true,
        target: { value: "ni hao" },
      });
      expect(field).toHaveValue("ni hao");
      expect(onChange).not.toHaveBeenCalled();
      expect(shownTags()).toEqual([]);

      // Some browsers clear isComposing before dispatching compositionend;
      // others dispatch the final input only after that event.
      const finalInputEvent = () =>
        fireEvent.input(field, {
          inputType: "insertText",
          isComposing: false,
          target: { value: "你 好" },
        });
      if (finalInput === "before") {
        finalInputEvent();
        expect(onChange).not.toHaveBeenCalled();
      }
      fireEvent.compositionEnd(field, {
        data: "你 好",
        target: { value: "你 好" },
      });
      if (finalInput === "after") finalInputEvent();

      expect(onCompositionStart).toHaveBeenCalledTimes(1);
      expect(onCompositionEnd).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(["你"]);
      expect(shownTags()).toEqual(["你"]);
      expect(field).toHaveValue("好");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      await user.keyboard(" ");
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(["你", "好"]);
      expect(field).toHaveValue("");
    },
  );

  it("can paste the same text again after a composition", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput allowDuplicates onChange={onChange} />);
    const field = input();
    await user.click(field);
    fireEvent.compositionStart(field);
    fireEvent.input(field, {
      isComposing: true,
      target: { value: "one," },
    });
    fireEvent.compositionEnd(field, { data: "one," });

    await user.paste("one,");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(["one", "one"]);
    expect(field).toHaveValue("");
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

  it.each([false, true])(
    "keeps focus while removing values with the keyboard, shadow root=%s",
    (inShadowRoot) => {
      const host = document.createElement("div");
      document.body.append(host);
      const root = inShadowRoot
        ? host.attachShadow({ mode: "open" })
        : document;
      const container = inShadowRoot
        ? root.appendChild(document.createElement("div"))
        : host;
      const { unmount } = render(
        <TagsInput aria-label="Keywords" defaultValue={["a", "b", "c"]} />,
        { container },
      );
      const field = within(container);
      const input = field.getByRole("textbox", { name: "Keywords" });
      const remove = (tag: string) =>
        field.getByRole("button", { name: `Remove ${tag}` });

      try {
        act(() => input.focus());
        fireEvent.keyDown(input, { key: "Backspace" });
        expect(root.activeElement).toBe(remove("c"));
        fireEvent.keyDown(remove("c"), { key: "Backspace" });
        expect(field.queryByRole("button", { name: "Remove c" })).toBeNull();
        expect(root.activeElement).toBe(remove("b"));
        fireEvent.keyDown(remove("b"), { key: "ArrowLeft" });
        fireEvent.keyDown(remove("a"), { key: "Delete" });
        expect(root.activeElement).toBe(remove("b"));
        fireEvent.keyDown(remove("b"), { key: "Backspace" });
        expect(root.activeElement).toBe(input);
      } finally {
        unmount();
        host.remove();
      }
    },
  );

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

  it("keeps the form from submitting while it holds refused text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form aria-label="Mail" onSubmit={onSubmit}>
        <TagsInput
          addOnBlur
          defaultValue={["anna@example.com"]}
          label="To"
          name="to"
          validate={(tag) =>
            tag.includes("@") ? undefined : `${tag} is not an e-mail address.`
          }
        />
        <button type="submit">Send</button>
      </form>,
    );

    // The blur of the click on the button refuses the text
    await user.type(input(), "bob");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(input()).toHaveValue("bob");
    expect(input()).toBeInvalid();
    expect(input().validationMessage).toBe("bob is not an e-mail address.");
    expect(onSubmit).not.toHaveBeenCalled();

    // Fixed, the text is added on the next blur
    await user.type(input(), "@example.com");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(new FormData(getForm()).getAll("to")).toEqual([
      "anna@example.com",
      "bob@example.com",
    ]);
  });

  it.each([false, true])(
    "submits the pending text after leaving a remove button (controlled: %s)",
    async (controlled) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onBlur = vi.fn((event: React.FocusEvent<HTMLInputElement>) => ({
        currentTarget: event.currentTarget,
        relatedTarget: event.relatedTarget,
      }));
      const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        return new FormData(event.currentTarget).getAll("tags");
      });
      function Form() {
        const [tags, setTags] = useState(["first", "second"]);
        return (
          <form aria-label="Tags" onSubmit={onSubmit}>
            <TagsInput
              addOnBlur
              defaultValue={controlled ? undefined : tags}
              name="tags"
              onBlur={onBlur}
              onChange={(next) => {
                onChange(next);
                if (controlled) setTags(next);
              }}
              value={controlled ? tags : undefined}
            />
            <button type="submit">Save</button>
          </form>
        );
      }
      render(<Form />);

      await user.type(input(), "draft");
      await user.keyboard("{Home}{ArrowLeft}");
      expect(removeButton("second")).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onBlur.mock.results[0].value).toEqual({
        currentTarget: input(),
        relatedTarget: removeButton("second"),
      });

      await user.keyboard("{ArrowLeft}{ArrowRight}{ArrowRight}");
      expect(input()).toHaveFocus();
      expect(input()).toHaveValue("draft");
      expect(onChange).not.toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalledTimes(1);

      await user.keyboard("{ArrowLeft}");
      expect(removeButton("second")).toHaveFocus();
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith([
        "first",
        "second",
        "draft",
      ]);
      expect(input()).toHaveValue("");
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.results[0].value).toEqual([
        "first",
        "second",
        "draft",
      ]);
      // The consumer's handler still describes input blur, not button blur.
      expect(onBlur).toHaveBeenCalledTimes(2);
    },
  );

  it("refuses an invalid draft before submitting from a remove button", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return new FormData(event.currentTarget).getAll("to");
    });
    render(
      <form aria-label="Mail" onSubmit={onSubmit}>
        <TagsInput
          addOnBlur
          defaultValue={["anna@example.com"]}
          name="to"
          validate={(tag) =>
            tag.includes("@") ? undefined : `${tag} is not an e-mail address.`
          }
        />
        <button type="submit">Send</button>
      </form>,
    );

    await user.type(input(), "bob");
    await user.keyboard("{Home}{ArrowLeft}");
    expect(removeButton("anna@example.com")).toHaveFocus();
    expect(input()).toBeValid();
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(input()).toHaveValue("bob");
    expect(input()).toBeInvalid();
    expect(input().validationMessage).toBe("bob is not an e-mail address.");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(input());
    await user.keyboard("{End}@example.com{Home}{ArrowLeft}");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(input()).toHaveValue("");
    expect(input()).toBeValid();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.results[0].value).toEqual([
      "anna@example.com",
      "bob@example.com",
    ]);
  });

  it("preserves an application validation error on an unrelated render", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <form aria-label="Mail">
        <TagsInput defaultValue={["anna"]} label="To" ref={ref} />
      </form>,
    );

    ref.current!.setCustomValidity("Rejected by the server");
    expect(getForm().checkValidity()).toBe(false);

    rerender(
      <form aria-label="Mail">
        <TagsInput
          defaultValue={["anna"]}
          description="Recipients of this message"
          label="To"
          ref={ref}
        />
      </form>,
    );

    expect(ref.current!.validationMessage).toBe("Rejected by the server");
    expect(getForm().checkValidity()).toBe(false);
  });

  it("preserves an application error while required and draft errors change", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Mail">
        <TagsInput label="To" required />
      </form>,
    );

    expect(input()).toBeInvalid();
    input().setCustomValidity("Rejected by the server");

    // Satisfying required must not clear the error the app set over it.
    await user.type(input(), "anna{Enter}");
    expect(input().validationMessage).toBe("Rejected by the server");
    expect(getForm().checkValidity()).toBe(false);

    // A duplicate creates a temporary error, and fixing it clears only
    // that error, leaving the app's message in charge of form validity.
    await user.type(input(), "anna{Enter}");
    expect(input().validationMessage).toBe("Rejected by the server");
    await user.clear(input());
    await user.type(input(), "bob{Enter}");
    expect(shownTags()).toEqual(["anna", "bob"]);
    expect(input().validationMessage).toBe("Rejected by the server");
    expect(getForm().checkValidity()).toBe(false);

    input().setCustomValidity("");
    expect(getForm().checkValidity()).toBe(true);
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
    await waitFor(() => expect(shownTags()).toEqual(["anna"]));
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

  it.each(["prop", "fieldset"])(
    "neither submits nor validates a field disabled by %s",
    (mode) => {
      render(
        <form aria-label="Mail">
          <fieldset disabled={mode === "fieldset"}>
            <TagsInput
              aria-label="To"
              defaultValue={["anna"]}
              disabled={mode === "prop"}
              name="to"
              required
            />
          </fieldset>
        </form>,
      );

      expect(input()).toBeDisabled();
      expect(shownTags()).toEqual([]);
      expect(screen.getByText("anna")).toBeInTheDocument();
      expect(getForm().checkValidity()).toBe(true);
      expect(new FormData(getForm()).has("to")).toBe(false);
    },
  );

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

    it.each(["fieldset", "disabled", "readOnly"] as const)(
      "closes its suggestions on %s and keeps them closed when enabled again",
      async (mode) => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const content = (blocked: boolean) => (
          <fieldset>
            <TagsInput
              addOnBlur
              defaultValue={["React"]}
              disabled={mode === "disabled" && blocked}
              label="Skills"
              onChange={onChange}
              readOnly={mode === "readOnly" && blocked}
              suggestions={skills}
            />
          </fieldset>
        );
        const { container, rerender } = render(content(false));
        const combobox = screen.getByRole("combobox");
        await user.type(combobox, "Type");
        await user.keyboard("{ArrowDown}");
        expect(
          screen.getByRole("option", { name: "TypeScript" }),
        ).toBeVisible();

        const setBlocked = async (blocked: boolean) => {
          if (mode === "fieldset") {
            await act(async () => {
              container.querySelector("fieldset")!.disabled = blocked;
            });
          } else {
            rerender(content(blocked));
          }
        };
        await setBlocked(true);
        expect(screen.queryByRole("listbox")).toBeNull();
        expect(combobox).toHaveAttribute("aria-expanded", "false");
        expect(combobox).not.toHaveAttribute("aria-activedescendant");
        if (mode !== "readOnly") expect(combobox).toBeDisabled();
        fireEvent.blur(combobox);
        expect(onChange).not.toHaveBeenCalled();

        await setBlocked(false);
        expect(screen.queryByRole("listbox")).toBeNull();
        expect(combobox).toHaveValue("Type");
        expect(shownTags()).toEqual(["React"]);
        await user.click(combobox);
        await user.keyboard("{ArrowDown}{Enter}");
        expect(onChange).toHaveBeenCalledExactlyOnceWith([
          "React",
          "TypeScript",
        ]);
      },
    );

    it("leaves only the first legend's field enabled", () => {
      const onChange = vi.fn();
      render(
        <fieldset disabled>
          <legend>
            <TagsInput
              label="Allowed"
              onChange={onChange}
              suggestions={skills}
            />
          </legend>
          <legend>
            <TagsInput
              defaultValue={["GraphQL"]}
              label="Blocked"
              suggestions={skills}
            />
          </legend>
        </fieldset>,
      );

      const allowed = screen.getByRole("combobox", { name: "Allowed:" });
      expect(allowed).toBeEnabled();
      expect(screen.getByRole("combobox", { name: "Blocked:" })).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Remove GraphQL" }),
      ).toBeNull();
      fireEvent.keyDown(allowed, { key: "ArrowDown" });
      fireEvent.click(screen.getByRole("option", { name: "React" }));
      expect(onChange).toHaveBeenCalledExactlyOnceWith(["React"]);
    });

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

    it("keeps the highlight of the arrow keys under a pointer that does not move", async () => {
      const user = userEvent.setup();
      render(<TagsInput label="Skills" suggestions={skills} />);
      const combobox = screen.getByRole("combobox", { name: "Skills:" });
      const highlighted = () =>
        document.getElementById(
          combobox.getAttribute("aria-activedescendant") ?? "",
        )?.textContent;

      await user.click(combobox);
      await user.keyboard("{ArrowDown}");
      fireEvent.mouseMove(screen.getByRole("option", { name: "GraphQL" }), {
        clientX: 10,
        clientY: 30,
      });
      expect(highlighted()).toBe("GraphQL");

      await user.keyboard("{ArrowDown}");
      expect(highlighted()).toBe("Čeština");

      // Chrome after the list scrolled: another suggestion under the
      // pointer, which has not moved
      fireEvent.mouseMove(screen.getByRole("option", { name: "React" }), {
        clientX: 10,
        clientY: 30,
      });
      expect(highlighted()).toBe("Čeština");

      // A real move of the pointer
      fireEvent.mouseMove(screen.getByRole("option", { name: "React" }), {
        clientX: 10,
        clientY: 12,
      });
      expect(highlighted()).toBe("React");
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

  it("marks its input read-only for assistive technology and styling", () => {
    render(<TagsInput defaultValue={["alpha"]} label="Tags" readOnly />);
    const field = input();

    expect(field).toHaveAttribute("aria-readonly", "true");
    expect(field).toHaveAttribute("data-readonly");
    // Still a tab stop - it can be read and its form submitted
    expect(field).not.toHaveAttribute("tabindex", "-1");
  });
});

describe("TagsInput dim and label", () => {
  it("takes the sizes of Input", () => {
    render(
      <>
        <TagsInput defaultValue={["a"]} dim="xs" label="Extra small" />
        <TagsInput defaultValue={["b"]} dim="sm" label="Small" />
        <TagsInput defaultValue={["c"]} label="Medium" />
        <TagsInput defaultValue={["d"]} dim="lg" label="Large" />
      </>,
    );
    const field = (name: string) =>
      screen.getByRole("textbox", { name }).parentElement!;

    expect(field("Extra small:")).toHaveClass("px-1", "py-0", "text-sm");
    expect(field("Small:")).toHaveClass("px-1", "py-0.5", "text-sm");
    expect(field("Medium:")).toHaveClass("px-2", "py-1", "text-base");
    expect(field("Large:")).toHaveClass("px-3", "py-2", "text-lg");

    // The values fit the line of the small fields
    expect(removeButton("b").parentElement).toHaveClass("text-xs");
    expect(removeButton("c").parentElement).toHaveClass("text-sm");
  });

  it("is named by a label with markup", () => {
    render(
      <TagsInput
        label={
          <>
            Keywords <em>(optional)</em>
          </>
        }
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "Keywords (optional):" }),
    ).toBeInTheDocument();
  });
});
