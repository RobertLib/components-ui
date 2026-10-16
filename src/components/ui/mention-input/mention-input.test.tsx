import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MentionInput, { type MentionSuggestion } from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import Dialog from "../dialog";

const people: MentionSuggestion[] = [
  { description: "Účetní", id: "user:42", label: "Jana Nováková" },
  { description: "Obchod", id: "user:7", label: "Petr Svoboda" },
  { id: "user:9", keywords: ["IT"], label: "Lukáš Dvořák" },
  { disabled: true, id: "user:5", label: "Jan Bez Přístupu" },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as { execCommand?: unknown }).execCommand;
});

const field = () => screen.getByRole("textbox") as HTMLTextAreaElement;
const options = () => screen.queryAllByRole("option");
/** What the live region of the list says. */
const status = () => screen.queryAllByRole("status").at(-1)?.textContent ?? "";

describe("MentionInput suggestions", () => {
  it("offers the suggestions after the trigger, ignoring case and diacritics", async () => {
    const user = userEvent.setup();
    render(<MentionInput label="Comment" suggestions={people} />);

    await user.type(field(), "Hi @");
    expect(screen.getByRole("listbox", { name: "Suggestions" })).toBeVisible();
    expect(options()).toHaveLength(4);

    await user.type(field(), "nova");
    expect(options().map((option) => option.textContent)).toEqual([
      "Jana NovákováÚčetní",
    ]);
    // The match in bold, the first option highlighted for Enter
    expect(options()[0].querySelector("b")).toHaveTextContent("Nová");
    expect(field()).toHaveAttribute("aria-activedescendant", options()[0].id);
    expect(field()).toHaveAttribute("aria-autocomplete", "list");
    expect(field()).toHaveAttribute(
      "aria-controls",
      screen.getByRole("listbox").id,
    );
  });

  it("finds by the description and the keywords too, and caps the list", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput
        aria-label="Comment"
        maxSuggestions={2}
        suggestions={people}
      />,
    );

    await user.type(field(), "@");
    expect(options()).toHaveLength(2);
    await user.type(field(), "it");
    expect(options().map((option) => option.textContent)).toEqual([
      "Lukáš Dvořák",
    ]);
  });

  it("inserts the highlighted suggestion with Enter as a token", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        name="comment"
        onChange={onChange}
        suggestions={people}
      />,
    );

    await user.type(field(), "Ahoj @pe");
    await user.keyboard("{Enter}");

    expect(field()).toHaveValue("Ahoj @Petr Svoboda ");
    expect(onChange).toHaveBeenLastCalledWith("Ahoj @[Petr Svoboda](user:7) ");
    expect(
      document.querySelector<HTMLInputElement>("input[name=comment]"),
    ).toHaveValue("Ahoj @[Petr Svoboda](user:7) ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // The caret after the space, typing goes on
    expect(field().selectionStart).toBe(19);
    expect(status()).toBe("Mentioned “Petr Svoboda”.");
    // Highlighted under the text
    expect(
      document.querySelector("[data-mention-overlay] [data-mention]"),
    ).toHaveTextContent("@Petr Svoboda");

    await user.type(field(), "díky");
    expect(onChange).toHaveBeenLastCalledWith(
      "Ahoj @[Petr Svoboda](user:7) díky",
    );
  });

  it("moves with the arrows past disabled suggestions and inserts with Tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        onChange={onChange}
        suggestions={people}
      />,
    );

    await user.type(field(), "@j");
    // Jana, Jan Bez Přístupu (disabled)
    expect(options()).toHaveLength(2);
    await user.keyboard("{ArrowDown}");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    expect(options()[1]).toHaveAttribute("aria-disabled", "true");

    await user.keyboard("{Tab}");
    expect(onChange).toHaveBeenLastCalledWith("@[Jana Nováková](user:42) ");
    expect(field()).toHaveFocus();
  });

  it("inserts a clicked suggestion and keeps the focus in the field", async () => {
    const user = userEvent.setup();
    render(<MentionInput aria-label="Comment" suggestions={people} />);

    await user.type(field(), "Díky @");
    await user.click(screen.getByRole("option", { name: /Lukáš/ }));

    expect(field()).toHaveValue("Díky @Lukáš Dvořák ");
    expect(field()).toHaveFocus();
  });

  it("closes with Escape - not the dialog around - until the caret leaves the mention", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Note">
        <MentionInput aria-label="Comment" suggestions={people} />
      </Dialog>,
    );

    await user.type(field(), "@ja");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Typing on in the same mention leaves it closed
    await user.type(field(), "n");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // A new one opens it
    await user.type(field(), " @");
    expect(screen.getByRole("listbox")).toBeVisible();

    // Escape with the list closed is the dialog's
    await user.keyboard("{Escape}{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the list again when the focus comes back", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MentionInput aria-label="Comment" suggestions={people} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.type(field(), "@ja");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(field());
    field().setSelectionRange(3, 3);
    fireEvent.select(field());
    expect(screen.getByRole("listbox")).toBeVisible();
  });

  it("opens no list in an e-mail address, after a space, or while read-only", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MentionInput aria-label="Comment" suggestions={people} />,
    );

    await user.type(field(), "jana@firma.cz @ ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    rerender(
      <MentionInput aria-label="Comment" readOnly suggestions={people} />,
    );
    field().setSelectionRange(14, 14);
    fireEvent.select(field());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes a query with a space that matches nothing", async () => {
    const user = userEvent.setup();
    render(<MentionInput aria-label="Comment" suggestions={people} />);

    await user.type(field(), "@xy");
    expect(screen.getByText("No matches")).toBeVisible();
    await user.type(field(), " z");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // A name with a space is found
    await user.clear(field());
    await user.type(field(), "@jana nov");
    expect(options()).toHaveLength(1);
  });

  it("does not insert a mention that would not fit maxLength", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput aria-label="Comment" maxLength={10} suggestions={people} />,
    );

    await user.type(field(), "@pe{Enter}");
    expect(field()).toHaveValue("@pe");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("inserts a mention before a line break with a space, the caret on its line", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue={"x @ja\nahoj"}
        onChange={onChange}
        suggestions={people}
      />,
    );

    await user.click(field());
    field().setSelectionRange(5, 5);
    fireEvent.select(field());
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(
      "x @[Jana Nováková](user:42) \nahoj",
    );
    expect(field().selectionStart).toBe(17);
  });

  it("tells screen readers how many suggestions there are, in Czech too", () => {
    vi.useFakeTimers();
    render(
      <UIProvider locale={cs}>
        <MentionInput label="Komentář" suggestions={people} />
      </UIProvider>,
    );

    act(() => field().focus());
    fireEvent.change(field(), { target: { value: "@" } });
    field().setSelectionRange(1, 1);
    fireEvent.select(field());
    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByRole("listbox", { name: "Návrhy" })).toBeVisible();
    expect(status()).toBe("4 návrhy");
  });
});

describe("MentionInput loading suggestions", () => {
  it("loads after a pause, aborting the query left behind", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const loadSuggestions = vi.fn(
      (query: string, { signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return Promise.resolve(
          people.filter((person) =>
            person.label.toLowerCase().includes(query.toLowerCase()),
          ),
        );
      },
    );
    render(
      <MentionInput aria-label="Comment" loadSuggestions={loadSuggestions} />,
    );

    const type = (text: string) => {
      fireEvent.change(field(), { target: { value: text } });
      field().setSelectionRange(text.length, text.length);
      fireEvent.select(field());
    };

    act(() => field().focus());
    type("@");
    // Loading at once for the trigger alone
    expect(screen.getAllByText("Loading…")[0]).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(loadSuggestions).toHaveBeenLastCalledWith("", {
      signal: expect.any(AbortSignal),
      trigger: "@",
    });
    expect(options()).toHaveLength(4);

    type("@p");
    type("@pe");
    await act(() => vi.advanceTimersByTimeAsync(100));
    // The suggestions of before that still match stay while the next load
    expect(options().map((option) => option.textContent)).toEqual([
      "Petr SvobodaObchod",
    ]);
    // None match - Enter waits for them, it makes no new line
    type("@pex");
    expect(options()).toHaveLength(0);
    expect(fireEvent.keyDown(field(), { key: "Enter" })).toBe(false);
    type("@pe");
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(loadSuggestions).toHaveBeenCalledTimes(2);
    expect(loadSuggestions).toHaveBeenLastCalledWith("pe", expect.anything());
    expect(options().map((option) => option.textContent)).toEqual([
      "Petr SvobodaObchod",
    ]);

    type("@pet");
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(signals[1].aborted).toBe(true);
  });

  it("shows a failure and reports it", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onLoadError = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        loadSuggestions={() => Promise.reject(new Error("offline"))}
        onLoadError={onLoadError}
      />,
    );

    act(() => field().focus());
    fireEvent.change(field(), { target: { value: "@" } });
    field().setSelectionRange(1, 1);
    fireEvent.select(field());
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Suggestions could not be loaded.",
    );
    expect(onLoadError).toHaveBeenCalledWith(new Error("offline"));
  });

  it("stops loading a query with a space once it finds nothing", async () => {
    vi.useFakeTimers();
    const loadSuggestions = vi.fn(() => Promise.resolve([]));
    render(
      <MentionInput aria-label="Comment" loadSuggestions={loadSuggestions} />,
    );
    const type = async (text: string) => {
      fireEvent.change(field(), { target: { value: text } });
      field().setSelectionRange(text.length, text.length);
      fireEvent.select(field());
      await act(() => vi.advanceTimersByTimeAsync(300));
    };

    act(() => field().focus());
    await type("@ahoj ");
    expect(loadSuggestions).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await type("@ahoj j");
    await type("@ahoj ja");
    expect(loadSuggestions).toHaveBeenCalledTimes(1);
  });

  it("offers none of the suggestions loaded before once the list opens again", async () => {
    vi.useFakeTimers();
    const loadA = vi.fn(() => Promise.resolve(people.slice(0, 1)));
    const loadB = vi.fn(() => new Promise<MentionSuggestion[]>(() => {}));
    const { rerender } = render(
      <MentionInput aria-label="Comment" loadSuggestions={loadA} />,
    );
    const type = (text: string) => {
      fireEvent.change(field(), { target: { value: text } });
      field().setSelectionRange(text.length, text.length);
      fireEvent.select(field());
    };

    act(() => field().focus());
    type("@");
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(options()).toHaveLength(1);

    // Closed, and opened again - with the people of another project
    type("");
    rerender(<MentionInput aria-label="Comment" loadSuggestions={loadB} />);
    type("@");
    expect(options()).toHaveLength(0);
    expect(screen.getAllByText("Loading…")[0]).toBeVisible();
    // Enter waits for them - it inserts no one of before
    expect(fireEvent.keyDown(field(), { key: "Enter" })).toBe(false);
    expect(field()).toHaveValue("@");
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(loadB).toHaveBeenCalledWith("", expect.anything());
  });

  it("takes the suggestions and the name of a trigger of its own", async () => {
    const user = userEvent.setup();
    const loadTickets = vi.fn(() => [
      { description: "Otevřený", id: "ticket:12", label: "T-12 Faktura" },
    ]);
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        onChange={onChange}
        suggestions={people}
        triggers={[
          "@",
          {
            allowSpaces: false,
            char: "#",
            label: "Tickets",
            loadSuggestions: loadTickets,
          },
        ]}
      />,
    );

    await user.type(field(), "#t");
    expect(
      await screen.findByRole("option", { name: /T-12 Faktura/ }),
    ).toBeVisible();
    expect(screen.getByRole("listbox", { name: "Tickets" })).toBeVisible();
    await waitFor(() =>
      expect(loadTickets).toHaveBeenCalledWith("t", {
        signal: expect.any(AbortSignal),
        trigger: "#",
      }),
    );
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith("#[T-12 Faktura](ticket:12) ");
  });
});

describe("MentionInput editing", () => {
  it("shows a stored value as text, and deletes a mention whole with Backspace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="Ahoj @[Jana Nováková](user:42)!"
        onChange={onChange}
      />,
    );

    expect(field()).toHaveValue("Ahoj @Jana Nováková!");
    await user.click(field());
    field().setSelectionRange(19, 19);
    await user.keyboard("{Backspace}");

    expect(field()).toHaveValue("Ahoj !");
    expect(onChange).toHaveBeenLastCalledWith("Ahoj !");
  });

  it("deletes a mention whole for a phone keyboard, which sends no key", () => {
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="Ahoj @[Jana Nováková](user:42)"
        onChange={onChange}
      />,
    );

    act(() => field().focus());
    field().setSelectionRange(19, 19);
    const event = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward",
    });
    act(() => {
      field().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith("Ahoj ");
    expect(field()).toHaveValue("Ahoj ");
    expect(field().selectionStart).toBe(5);
  });

  it("deletes a mention whole with a word deleted after it", () => {
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="Ahoj @[Jana Nováková](user:42)  x"
        onChange={onChange}
      />,
    );

    act(() => field().focus());
    // ⌥ / Ctrl + Backspace after the spaces - the browser would delete
    // "Nováková  " alone
    field().setSelectionRange(21, 21);
    const event = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteWordBackward",
    });
    act(() => {
      field().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith("Ahoj x");
    expect(field().selectionStart).toBe(5);
  });

  it("leaves a deletion it cannot cancel to the browser", () => {
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="Ahoj @[Jana Nováková](user:42)"
      />,
    );

    act(() => field().focus());
    field().setSelectionRange(19, 19);
    // Of a composition on Android - the selection is not widened under it
    act(() => {
      field().dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "deleteContentBackward",
        }),
      );
    });

    expect(field().selectionStart).toBe(19);
    expect(field().selectionEnd).toBe(19);
  });

  it("deletes a mention whole with Delete before it", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="@[Jana Nováková](user:42) ahoj"
      />,
    );

    await user.click(field());
    field().setSelectionRange(0, 0);
    await user.keyboard("{Delete}");
    expect(field()).toHaveValue(" ahoj");
  });

  it("makes a mention text once a change reaches into it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="@[Jana Nováková](user:42)"
        onChange={onChange}
      />,
    );

    await user.click(field());
    field().setSelectionRange(5, 14);
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith("@Jana");
    expect(document.querySelector("[data-mention]")).toBeNull();
  });

  it("moves the caret out of a mention, in the direction it went", () => {
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="a @[Jana Nováková](user:42) b"
      />,
    );
    const textarea = field();
    act(() => textarea.focus());

    // Coming from its start, the caret goes on to its end
    textarea.setSelectionRange(2, 2);
    fireEvent.select(textarea);
    textarea.setSelectionRange(3, 3);
    fireEvent.select(textarea);
    expect(textarea.selectionStart).toBe(16);

    // Back from its end to its start
    textarea.setSelectionRange(15, 15);
    fireEvent.select(textarea);
    expect(textarea.selectionStart).toBe(2);

    // A click in it - to the nearer edge
    textarea.setSelectionRange(14, 14);
    fireEvent.select(textarea);
    expect(textarea.selectionStart).toBe(16);
  });

  it("brings the mentions of a text back on undo", () => {
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="@[Jana Nováková](user:42) x"
        onChange={onChange}
      />,
    );
    const textarea = field();
    const input = (value: string, inputType: string, caret: number) => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(textarea, value);
      textarea.setSelectionRange(caret, caret);
      fireEvent(
        textarea,
        new InputEvent("input", { bubbles: true, inputType }),
      );
    };

    // Typed into the mention, it is text
    input("@Jana! Nováková x", "insertText", 6);
    expect(onChange).toHaveBeenLastCalledWith("@Jana! Nováková x");
    // Undo brings back the text before - with its mention
    input("@Jana Nováková x", "historyUndo", 5);
    expect(onChange).toHaveBeenLastCalledWith("@[Jana Nováková](user:42) x");
  });

  it("inserts by the editing of the browser, which undo takes back", async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn((command: string, _ui: boolean, text: string) => {
      const textarea = field();
      const { selectionEnd, selectionStart, value } = textarea;
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(
        textarea,
        value.slice(0, selectionStart) + text + value.slice(selectionEnd),
      );
      textarea.setSelectionRange(
        selectionStart + text.length,
        selectionStart + text.length,
      );
      fireEvent(
        textarea,
        new InputEvent("input", { bubbles: true, inputType: "insertText" }),
      );
      return command === "insertText";
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        onChange={onChange}
        suggestions={people}
      />,
    );

    await user.type(field(), "x @ja z");
    field().setSelectionRange(5, 5);
    fireEvent.select(field());
    await user.keyboard("{Enter}");

    expect(execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "@Jana Nováková",
    );
    // The space after it was there - the caret goes past it
    expect(onChange).toHaveBeenLastCalledWith("x @[Jana Nováková](user:42) z");
    expect(field().selectionStart).toBe(17);
  });

  it("copies and pastes mentions as mentions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <MentionInput
          aria-label="Source"
          defaultValue="Díky @[Jana Nováková](user:42)!"
        />
        <MentionInput aria-label="Target" onChange={onChange} />
      </>,
    );
    const data = new Map<string, string>();
    const clipboardData = {
      getData: (type: string) => data.get(type) ?? "",
      setData: (type: string, value: string) => data.set(type, value),
    };

    const source = screen.getByRole("textbox", { name: "Source" });
    await user.click(source);
    (source as HTMLTextAreaElement).setSelectionRange(0, 19);
    fireEvent.copy(source, { clipboardData });
    expect(data.get("text/plain")).toBe("Díky @Jana Nováková");

    const target = screen.getByRole("textbox", { name: "Target" });
    await user.click(target);
    fireEvent.paste(target, { clipboardData });
    expect(onChange).toHaveBeenLastCalledWith("Díky @[Jana Nováková](user:42)");
    expect(target).toHaveValue("Díky @Jana Nováková");
  });

  it("pastes the mentions of a field with other triggers as text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <MentionInput
          aria-label="Tickets"
          defaultValue="@[Jana](1) #[T-12](ticket:12)"
          triggers={["@", "#"]}
        />
        <MentionInput
          aria-label="People"
          defaultValue="@[Jana](1) #[T-12](x)"
        />
        <MentionInput aria-label="Target" onChange={onChange} />
        <MentionInput
          aria-label="Target with tickets"
          onChange={onChange}
          triggers={["@", "#"]}
        />
      </>,
    );
    const copyAndPaste = async (from: string, to: string) => {
      const data = new Map<string, string>();
      const clipboardData = {
        getData: (type: string) => data.get(type) ?? "",
        setData: (type: string, value: string) => data.set(type, value),
      };
      const source = screen.getByRole("textbox", {
        name: from,
      }) as HTMLTextAreaElement;
      await user.click(source);
      source.setSelectionRange(0, source.value.length);
      fireEvent.copy(source, { clipboardData });
      const target = screen.getByRole("textbox", { name: to });
      await user.click(target);
      fireEvent.paste(target, { clipboardData });
    };

    // A ticket is text in a field without "#"
    await copyAndPaste("Tickets", "Target");
    expect(onChange).toHaveBeenLastCalledWith("@[Jana](1) #T-12");
    // Text of a field without "#" stays text in one with it
    await copyAndPaste("People", "Target with tickets");
    expect(onChange).toHaveBeenLastCalledWith("@[Jana](1) #\\[T-12](x)");
    expect(
      screen.getByRole("textbox", { name: "Target with tickets" }),
    ).toHaveValue("@Jana #[T-12](x)");
  });

  it("cuts mentions out", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        aria-label="Comment"
        defaultValue="a @[Jana](1) b"
        onChange={onChange}
      />,
    );
    const data = new Map<string, string>();

    await user.click(field());
    field().setSelectionRange(2, 7);
    fireEvent.cut(field(), {
      clipboardData: {
        getData: (type: string) => data.get(type) ?? "",
        setData: (type: string, value: string) => data.set(type, value),
      },
    });

    expect(onChange).toHaveBeenLastCalledWith("a  b");
    expect(data.get("application/x-mention-value")).toBe("@[Jana](1)");
  });
});

describe("MentionInput as a form field", () => {
  it("submits the value with tokens and resets to the default", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <MentionInput
          aria-label="Comment"
          defaultValue="@[Jana](1) ahoj"
          name="comment"
          required
          suggestions={people}
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;

    expect(new FormData(form).get("comment")).toBe("@[Jana](1) ahoj");
    expect(field()).toBeRequired();
    // Only the hidden input has the name
    expect(field()).not.toHaveAttribute("name");

    await user.clear(field());
    expect(new FormData(form).get("comment")).toBe("");
    expect(field()).toBeInvalid();

    vi.useFakeTimers();
    act(() => form.reset());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(field()).toHaveValue("@Jana ahoj");
    expect(new FormData(form).get("comment")).toBe("@[Jana](1) ahoj");
  });

  it("is disabled by a disabled fieldset - nothing submitted, no suggestions", () => {
    render(
      <form data-testid="form">
        <fieldset disabled>
          <MentionInput
            aria-label="Comment"
            defaultValue="@x"
            name="comment"
            suggestions={people}
          />
        </fieldset>
      </form>,
    );

    act(() => field().focus());
    field().setSelectionRange(2, 2);
    fireEvent.select(field());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(
      new FormData(screen.getByTestId("form") as HTMLFormElement).has(
        "comment",
      ),
    ).toBe(false);
  });

  it("works controlled", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("@[Petr](7) ");
      return (
        <>
          <MentionInput
            aria-label="Comment"
            onChange={setValue}
            suggestions={people}
            value={value}
          />
          <output>{value}</output>
          <button onClick={() => setValue("")} type="button">
            Clear
          </button>
        </>
      );
    }
    render(<Controlled />);

    await user.type(field(), "a @jan{Enter}");
    expect(document.querySelector("output")).toHaveTextContent(
      "@[Petr](7) a @[Jana Nováková](user:42)",
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(field()).toHaveValue("");
  });

  it("has a label, a description, an error and a counter like Textarea", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput
        description="Visible to the team."
        error="Too short"
        label="Comment"
        maxLength={100}
        required
        showCount
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /Comment/ });
    expect(textarea).toHaveAccessibleDescription(
      "Too short Visible to the team.",
    );
    expect(textarea).toBeInvalid();
    expect(screen.getByText("0 / 100")).toBeVisible();
    await user.type(textarea, "Hi");
    expect(screen.getByText("2 / 100")).toBeVisible();
  });
});
