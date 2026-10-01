import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode, createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RichTextEditor, { type RichTextToolbarItem } from "./rich-text-editor";
import UIProvider from "../providers/ui-provider";

const editor = () => screen.getByRole("textbox", { name: /Note/ });

describe("RichTextEditor", () => {
  it("follows the label with the label suffix of the locale", () => {
    render(
      <UIProvider messages={{ form: { labelSuffix: " :" } }}>
        <RichTextEditor label="Note" />
      </UIProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Note :" })).toBeVisible();
  });

  it("is described by its error, its description and its own ids", () => {
    render(
      <>
        <p id="hint">Hint</p>
        <RichTextEditor
          aria-describedby="hint"
          description="Markdown is not supported."
          error="Too short"
          label="Note"
        />
      </>,
    );

    expect(editor()).toHaveAccessibleDescription(
      "Too short Markdown is not supported. Hint",
    );
  });

  it("loads a value without scripts, styles or unsafe links", () => {
    render(
      <RichTextEditor
        label="Note"
        value={
          '<p onclick="steal()" style="color:red">Hi <img src=x onerror="steal()">' +
          '<a href="java\tscript:steal()">bad</a> <a href="https://example.com">ok</a>' +
          "<script>steal()</script><span>!</span></p>"
        }
      />,
    );

    expect(editor().innerHTML).toBe(
      '<p>Hi bad <a href="https://example.com">ok</a>!</p>',
    );
  });

  it("keeps only its own formatting of pasted content", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? '<meta charset="utf-8"><span style="font-size:20px">Big</span> <b class="x">bold</b>'
            : "Big bold",
      },
    });

    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "Big <b>bold</b>",
    );
  });

  it("reports an editor without text as empty", () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor label="Note" onChange={onChange} value="<p>a</p>" />,
    );

    editor().innerHTML = "<p><br></p>";
    fireEvent.input(editor());

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("enforces required and submits nothing when disabled", () => {
    const { rerender } = render(
      <form data-testid="form">
        <RichTextEditor label="Note" name="note" required />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);

    rerender(
      <form data-testid="form">
        <RichTextEditor label="Note" name="note" required value="<p>Hi</p>" />
      </form>,
    );
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("note")).toBe("<p>Hi</p>");

    rerender(
      <form data-testid="form">
        <RichTextEditor disabled label="Note" name="note" required />
      </form>,
    );
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).has("note")).toBe(false);
  });
});

describe("RichTextEditor disabled fieldsets", () => {
  it("disables editing, shortcuts and pastes inside a disabled fieldset", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    const onChange = vi.fn();
    render(
      <form data-testid="form">
        <fieldset disabled>
          <RichTextEditor
            defaultValue="<p>Saved</p>"
            label="Note"
            name="note"
            onChange={onChange}
          />
        </fieldset>
      </form>,
    );

    expect(editor()).toHaveAttribute("contenteditable", "false");
    expect(editor()).toHaveAttribute("aria-disabled", "true");
    expect(editor()).toHaveAttribute("data-disabled");
    expect(editor()).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" });
    fireEvent.paste(editor(), {
      clipboardData: { getData: () => "Pasted" },
    });
    expect(execCommand).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(editor()).toHaveTextContent("Saved");
    expect(
      new FormData(screen.getByTestId("form") as HTMLFormElement).has("note"),
    ).toBe(false);
  });

  it("follows changes to the fieldset and keeps the value when enabled again", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <fieldset>
        <RichTextEditor
          defaultValue="<p>Saved</p>"
          label="Note"
          onChange={onChange}
        />
      </fieldset>,
    );
    const fieldset = container.querySelector("fieldset")!;
    expect(editor()).toHaveAttribute("contenteditable", "true");

    await act(async () => {
      fieldset.disabled = true;
    });
    expect(editor()).toHaveAttribute("contenteditable", "false");
    expect(editor()).toHaveAttribute("aria-disabled", "true");

    await act(async () => {
      fieldset.disabled = false;
    });
    expect(editor()).toHaveAttribute("contenteditable", "true");
    expect(editor()).not.toHaveAttribute("aria-disabled");
    expect(editor()).toHaveAttribute("tabindex", "0");
    expect(editor()).toHaveTextContent("Saved");
    expect(onChange).not.toHaveBeenCalled();

    editor().innerHTML = "<p>Edited</p>";
    fireEvent.input(editor());
    expect(onChange).toHaveBeenCalledExactlyOnceWith("<p>Edited</p>");
  });

  it("leaves only the first legend's editor enabled", () => {
    const onChange = vi.fn();
    render(
      <fieldset disabled>
        <legend>
          <RichTextEditor label="Note" onChange={onChange} />
        </legend>
        <legend>
          <RichTextEditor label="Blocked" />
        </legend>
      </fieldset>,
    );

    expect(editor()).toHaveAttribute("contenteditable", "true");
    expect(editor()).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("textbox", { name: "Blocked:" })).toHaveAttribute(
      "contenteditable",
      "false",
    );
    editor().innerHTML = "<p>Edited</p>";
    fireEvent.input(editor());
    expect(onChange).toHaveBeenCalledExactlyOnceWith("<p>Edited</p>");
  });
});

describe("RichTextEditor values", () => {
  it("submits and validates the content the editor shows", () => {
    const { unmount } = render(
      <form data-testid="form">
        <RichTextEditor
          label="Note"
          name="note"
          placeholder="Write"
          required
          value="<p><br></p>"
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).get("note")).toBe("");
    expect(editor()).toHaveAttribute("data-empty");

    unmount();

    render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue={'<p style="color:red">Hi<script>steal()</script></p>'}
          label="Note"
          name="note"
        />
      </form>,
    );
    const next = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(next).get("note")).toBe("<p>Hi</p>");
  });

  it("reports the typed content without the browser's styles", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor label="Note" name="note" onChange={onChange} />,
    );

    editor().innerHTML =
      '<p><span style="font-size: 20px">Hi</span><font color="red">!</font></p>';
    fireEvent.input(editor());

    expect(onChange).toHaveBeenCalledWith("<p>Hi!</p>");
    expect(container.querySelector("input[name=note]")).toHaveValue(
      "<p>Hi!</p>",
    );
  });

  it("inserts pasted plain text as text and no pasted images", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "<b>Hi</b>" : ""),
      },
    });
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "<b>Hi</b>");

    execCommand.mockClear();
    const imagePasted = fireEvent.paste(editor(), {
      clipboardData: { getData: () => "" },
    });
    expect(imagePasted).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("takes its defaultValue back when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <RichTextEditor defaultValue="<p>Ada</p>" label="Note" name="note" />
        <button type="reset">Reset</button>
      </form>,
    );

    editor().innerHTML = "<p>Grace</p>";
    fireEvent.input(editor());
    await user.click(screen.getByRole("button", { name: "Reset" }));

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("note")).toBe("<p>Ada</p>");
    await waitFor(() => expect(editor().innerHTML).toBe("<p>Ada</p>"));
  });

  it("clears a list or table without text when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <RichTextEditor
          label="Note"
          name="note"
          toolbar={["bulletList", "table"]}
        />
        <RichTextEditor label="Summary" toolbar={["table"]} value="" />
        <button type="reset">Reset</button>
      </form>,
    );
    const other = screen.getByRole("textbox", { name: /Summary/ });

    // Started, but nothing typed yet - the value is empty before and after
    editor().innerHTML = "<ul><li><br></li></ul>";
    fireEvent.input(editor());
    other.innerHTML = "<table><tbody><tr><td><br></td></tr></tbody></table>";
    fireEvent.input(other);
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(editor().innerHTML).toBe("");
    // A controlled editor shows its value again
    expect(other.innerHTML).toBe("");
  });

  it("is reset after a form action", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <form action={action}>
        <RichTextEditor defaultValue="<p>Ada</p>" label="Note" name="note" />
        <button type="submit">Save</button>
      </form>,
    );

    editor().innerHTML = "<p>Grace</p>";
    fireEvent.input(editor());
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(editor().innerHTML).toBe("<p>Ada</p>"));
    expect(action.mock.calls[0][0].get("note")).toBe("<p>Grace</p>");
  });

  it("follows a defaultValue arriving later until the user edits", () => {
    const { rerender } = render(
      <form data-testid="form">
        <RichTextEditor label="Note" name="note" />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;

    rerender(
      <form data-testid="form">
        <RichTextEditor
          defaultValue="<p>Loaded note</p>"
          label="Note"
          name="note"
        />
      </form>,
    );
    expect(editor().innerHTML).toBe("<p>Loaded note</p>");
    expect(new FormData(form).get("note")).toBe("<p>Loaded note</p>");

    editor().innerHTML = "<p>Mine</p>";
    fireEvent.input(editor());
    rerender(
      <form data-testid="form">
        <RichTextEditor defaultValue="<p>Other</p>" label="Note" name="note" />
      </form>,
    );
    expect(editor().innerHTML).toBe("<p>Mine</p>");
    expect(new FormData(form).get("note")).toBe("<p>Mine</p>");
  });

  it("shows its value again after an input the parent did not take", () => {
    render(
      <RichTextEditor
        label="Note"
        name="note"
        onChange={() => {}}
        value="<p>X</p>"
      />,
    );

    editor().innerHTML = "<p>XY</p>";
    fireEvent.input(editor());

    // Like a controlled native field - it shows what it submits
    expect(editor().innerHTML).toBe("<p>X</p>");
  });

  it("keeps the typed content in place when the parent takes it", () => {
    function Controlled() {
      const [note, setNote] = useState("<p>X</p>");
      return <RichTextEditor label="Note" onChange={setNote} value={note} />;
    }
    render(<Controlled />);

    const paragraph = editor().querySelector("p") as HTMLElement;
    paragraph.textContent = "XY";
    fireEvent.input(editor());

    // Not written anew - the caret stays where the user typed
    expect(editor().innerHTML).toBe("<p>XY</p>");
    expect(editor().querySelector("p")).toBe(paragraph);
  });

  it("sanitizes the content once for a change", () => {
    const parse = vi.spyOn(DOMParser.prototype, "parseFromString");
    function Controlled() {
      const [note, setNote] = useState("<p>X</p>");
      return <RichTextEditor label="Note" onChange={setNote} value={note} />;
    }
    const { unmount } = render(<Controlled />);

    parse.mockClear();
    (editor().querySelector("p") as HTMLElement).textContent = "XY";
    fireEvent.input(editor());
    expect(editor().innerHTML).toBe("<p>XY</p>");
    expect(parse).toHaveBeenCalledTimes(1);
    unmount();

    const { unmount: unmountUncontrolled } = render(
      <RichTextEditor defaultValue="<p>X</p>" label="Note" />,
    );
    parse.mockClear();
    (editor().querySelector("p") as HTMLElement).textContent = "XY";
    fireEvent.input(editor());
    expect(parse).toHaveBeenCalledTimes(1);
    unmountUncontrolled();

    // A value from outside - not again when the caret renders the toolbar
    render(
      <RichTextEditor
        label="Note"
        onChange={() => {}}
        value="<h2>Plan</h2><p>Text</p>"
      />,
    );
    parse.mockClear();
    selectText("Plan");
    expect(tool("Heading 2")).toHaveAttribute("aria-pressed", "true");
    selectText("Text");
    expect(tool("Heading 2")).toHaveAttribute("aria-pressed", "false");
    expect(parse).not.toHaveBeenCalled();
  });

  it("normalizes a change without parsing its content again", () => {
    render(<RichTextEditor defaultValue="<p>X</p>" label="Note" />);
    const createElement = vi.spyOn(document, "createElement");

    (editor().querySelector("p") as HTMLElement).textContent = "XY";
    fireEvent.input(editor());

    expect(editor().innerHTML).toBe("<p>XY</p>");
    expect(createElement).not.toHaveBeenCalledWith("template");
  });

  it("keeps the headings and lists of pasted content", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? "<h1>Plan</h1><ul><li>One</li><li>Two</li></ul>"
            : "Plan\nOne\nTwo",
      },
    });

    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "<h2>Plan</h2><ul><li>One</li><li>Two</li></ul>",
    );
  });

  it("inserts pasted lists and headings as paragraphs without their tools", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor label="Note" toolbar={["bold", "italic", "link"]} />,
    );

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? "<h2>Plan</h2><ul><li>One</li><li>Two</li></ul><u>under</u>"
            : "Plan\nOne\nTwo",
      },
    });

    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "<p>Plan</p><p>One</p><p>Two</p>under",
    );
  });
});

describe("RichTextEditor pastes over a selection", () => {
  const paste = (html: string) =>
    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? html : ""),
      },
    });

  it("keeps the blocks of content replacing a heading as a whole", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<h2>Plan</h2><p>Text</p>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    // Select all - the heading goes with the selection
    selectText("Plan", "Text");
    paste("<p>One</p><ul><li>Two</li></ul>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<p>One</p><ul><li>Two</li></ul>",
    );
    // Its line is a paragraph for the content to go into
    expect(editor().innerHTML).toBe("<p>Plan</p><p>Text</p>");
    expect(document.getSelection()?.toString()).toBe("PlanText");
  });

  it("fills an empty heading with the blocks of pasted content", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<h2>Plan</h2>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    // What the browser leaves of content starting with a heading, all of
    // it deleted - the editor shows its placeholder
    editor().innerHTML = "<h2><br></h2>";
    fireEvent.input(editor());
    caretIn(editor().querySelector("h2") as HTMLElement);

    paste("<p>One</p><ul><li>Two</li></ul>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<p>One</p><ul><li>Two</li></ul>",
    );
    expect(editor().innerHTML).toBe("<p><br></p>");
  });

  it("pastes lines into a heading or cell it stays in", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<h2>Plan</h2><p>Text</p>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    // From the middle of the heading - it stays
    selectText("an", "Text");
    paste("<p>One</p><ul><li>Two</li></ul>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "One<br>Two",
    );
    expect(editor().innerHTML).toBe("<h2>Plan</h2><p>Text</p>");
  });

  it("keeps the blocks of content replacing a table as a whole", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p>After</p>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("a", "After");
    paste("<h2>One</h2><p>Two</p>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<h2>One</h2><p>Two</p>",
    );

    // Within the table - lines of its cell
    selectText("a", "b");
    paste("<h2>One</h2><p>Two</p>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "One<br>Two",
    );
  });

  it.each([
    ["a list", "<ul><li>Plan</li></ul><p>Text</p>"],
    ["a quote", "<blockquote><p>Plan</p></blockquote><p>Text</p>"],
  ])("keeps the blocks of content replacing %s as a whole", (_, html) => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue={html} label="Note" toolbar={ALL_TOOLS} />,
    );

    // Select all - the browser would put the pasted blocks into the item
    // or the quote, which hold no headings or tables
    selectText("Plan", "Text");
    const table = "<table><tbody><tr><td>a</td></tr></tbody></table>";
    paste(`<h2>One</h2>${table}`);
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      `<h2>One</h2>${table}`,
    );
    expect(editor().innerHTML).toBe("<p>Plan</p><p>Text</p>");
    expect(document.getSelection()?.toString()).toBe("PlanText");
  });

  it("pastes what a list item or a quote holds into it", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<ul><li>Plan</li></ul><blockquote><p>Quote</p></blockquote>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    // An item holds lines - the value would make them so anyway
    selectText("Plan", undefined, 2);
    paste("<h2>One</h2><p>Two</p>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "One<br>Two",
    );
    // A list gives it items next to it - the browser inserts them so
    paste("<ol><li>One</li><li>Two</li></ol>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<ol><li>One</li><li>Two</li></ol>",
    );

    // A quote holds paragraphs
    selectText("Quote", undefined, 2);
    paste("<h2>One</h2><ul><li>Two</li></ul>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<p>One</p><p>Two</p>",
    );
    expect(editor().innerHTML).toBe(
      "<ul><li>Plan</li></ul><blockquote><p>Quote</p></blockquote>",
    );
  });

  it("fills an empty list item with the blocks of pasted content", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<ul><li>Plan</li></ul>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    editor().innerHTML = "<ul><li>Plan</li><li><br></li></ul>";
    fireEvent.input(editor());
    caretIn(editor().querySelectorAll("li")[1]);

    paste("<h2>One</h2><p>Two</p>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<h2>One</h2><p>Two</p>",
    );
    expect(editor().innerHTML).toBe("<ul><li>Plan</li></ul><p><br></p>");
  });

  it("keeps an empty heading for pasted text of one line", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<p>Intro</p><h2>Plan</h2>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    editor().innerHTML = "<p>Intro</p><h2><br></h2>";
    fireEvent.input(editor());
    caretIn(editor().querySelector("h2") as HTMLElement);

    // A phrase copied from a page - and a paragraph of it
    paste('<meta charset="utf-8"><span style="font-size: 16px">Chapter</span>');
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "Chapter",
    );
    paste("<p>Chapter <b>one</b></p>");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "Chapter <b>one</b>",
    );
    expect(editor().innerHTML).toBe("<p>Intro</p><h2><br></h2>");
  });

  it("makes lines of plain text replacing a heading as a whole paragraphs", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<h2>Plan</h2><p>Text</p>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );
    const pasteText = (text: string) =>
      fireEvent.paste(editor(), {
        clipboardData: {
          getData: (type: string) => (type === "text/plain" ? text : ""),
        },
      });

    // One line stays in the heading, like typed text
    selectText("Plan", "Text");
    pasteText("One");
    expect(execCommand).toHaveBeenLastCalledWith("insertText", false, "One");
    expect(editor().innerHTML).toBe("<h2>Plan</h2><p>Text</p>");

    // Lines are paragraphs - the first one of the heading's kind no more
    pasteText("One\nTwo");
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertText",
      false,
      "One\nTwo",
    );
    expect(editor().innerHTML).toBe("<p>Plan</p><p>Text</p>");
    expect(document.getSelection()?.toString()).toBe("PlanText");
  });
});

describe("RichTextEditor on the server", () => {
  const unsafe = '<p onclick="steal()">Hi<img src=x onerror="steal()"></p>';

  function Form() {
    return (
      <form>
        <RichTextEditor defaultValue={unsafe} label="Note" name="note" />
      </form>
    );
  }

  it("shows no unsanitized HTML, submits the value until it hydrates, and hydrates without a mismatch", async () => {
    // Rendered where there is no DOM to sanitize with
    vi.stubGlobal("document", undefined);
    let serverHtml: string;
    try {
      serverHtml = renderToString(<Form />);
    } finally {
      vi.unstubAllGlobals();
    }

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    // The value is only in the attribute of the hidden input - no element
    // or handler of it is in the page, and the editor shows nothing
    expect(container.querySelector("img, [onclick]")).toBeNull();
    expect(container.querySelector("[role=textbox]")?.innerHTML).toBe("");
    // A submit before the page is hydrated keeps the value
    expect(
      new FormData(container.querySelector("form") as HTMLFormElement).get(
        "note",
      ),
    ).toBe(unsafe);
    const consoleError = vi.spyOn(console, "error");
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, <Form />, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    // Filled in right after hydration
    expect(
      container.querySelector<HTMLInputElement>("input[name=note]")?.value,
    ).toBe("<p>Hi</p>");
    expect(container.querySelector("[role=textbox]")?.innerHTML).toBe(
      "<p>Hi</p>",
    );

    act(() => root.unmount());
    container.remove();
  });
});

describe("RichTextEditor props", () => {
  it("is named, identified and focused without a label", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onBlur = vi.fn();
    render(
      <>
        <span id="note-heading">Note</span>
        <RichTextEditor
          aria-labelledby="note-heading"
          id="note-editor"
          onBlur={onBlur}
          ref={ref}
        />
        <RichTextEditor aria-label="Summary" />
        <button type="button">After</button>
      </>,
    );

    const note = editor();
    expect(note).toHaveAttribute("id", "note-editor");
    expect(
      screen.getByRole("textbox", { name: "Summary" }),
    ).toBeInTheDocument();

    act(() => ref.current?.focus());
    expect(note).toHaveFocus();

    // Its own toolbar is part of it - leaving it is the blur
    await user.click(screen.getAllByRole("button", { name: "Link" })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onBlur).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "After" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("gives screen readers its placeholder while it is empty", () => {
    const { unmount } = render(
      <RichTextEditor label="Note" placeholder="Write a note" />,
    );
    expect(editor()).toHaveAttribute("aria-placeholder", "Write a note");
    expect(editor()).toHaveAttribute("data-placeholder", "Write a note");
    unmount();

    render(
      <RichTextEditor
        defaultValue="<p>Hi</p>"
        label="Note"
        placeholder="Write a note"
      />,
    );
    expect(editor()).not.toHaveAttribute("aria-placeholder");
  });

  it("shows its placeholder only over an empty line", () => {
    render(<RichTextEditor label="Note" placeholder="Write a note" />);
    const showsPlaceholder = (html: string) => {
      editor().innerHTML = html;
      fireEvent.input(editor());
      const shows = editor().hasAttribute("data-empty");
      expect(editor().hasAttribute("aria-placeholder")).toBe(shows);
      return shows;
    };

    expect(showsPlaceholder("<p><br></p>")).toBe(true);
    expect(showsPlaceholder("<h2><br></h2>")).toBe(true);
    // Without text, but the placeholder would cover a bullet, a table or
    // another line
    expect(showsPlaceholder("<ul><li><br></li></ul>")).toBe(false);
    expect(
      showsPlaceholder("<table><tbody><tr><td><br></td></tr></tbody></table>"),
    ).toBe(false);
    expect(showsPlaceholder("<hr><p><br></p>")).toBe(false);
    expect(showsPlaceholder("<p><br></p><p><br></p>")).toBe(false);
    expect(showsPlaceholder("<blockquote><p><br></p></blockquote>")).toBe(
      false,
    );
    expect(showsPlaceholder("")).toBe(true);
  });

  it("hides the required mark from screen readers", () => {
    render(<RichTextEditor label="Note" required />);

    expect(editor()).toHaveAccessibleName("Note:");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("RichTextEditor formatting", () => {
  it("does not underline or apply formatting its value cannot keep", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor label="Note" toolbar={["bold", "italic", "link"]} />,
    );

    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "u" })).toBe(
      false,
    );
    expect(fireEvent.keyDown(editor(), { key: "u", metaKey: true })).toBe(true);
    expect(execCommand).not.toHaveBeenCalledWith("underline", false, undefined);

    const input = (inputType: string) =>
      editor().dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType,
        }),
      );

    expect(input("formatUnderline")).toBe(false);
    expect(input("formatStrikeThrough")).toBe(false);
    expect(input("insertUnorderedList")).toBe(false);
    expect(input("formatJustifyCenter")).toBe(false);
    expect(input("formatFontColor")).toBe(false);
    expect(input("formatBold")).toBe(true);
    expect(input("insertText")).toBe(true);
    expect(editor().querySelector("ul")).toBeNull();
  });

  it("underlines by the keyboard and the menus when it has the tool", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "u" })).toBe(
      false,
    );
    expect(execCommand).toHaveBeenCalledWith("underline", false, undefined);

    const input = (inputType: string) =>
      editor().dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType,
        }),
      );
    expect(input("formatUnderline")).toBe(true);
    expect(input("formatStrikeThrough")).toBe(true);
    expect(input("formatSuperscript")).toBe(false);
  });

  it("formats the selection the editor had before the focus left it", async () => {
    const user = userEvent.setup();
    let formatted = "";
    document.execCommand = vi.fn(() => {
      formatted = document.getSelection()?.toString() ?? "";
      return true;
    });
    render(<RichTextEditor label="Note" value="<p>Hello world</p>" />);

    act(() => editor().focus());
    const text = editor().querySelector("p")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 11);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    // To the toolbar by the keyboard - and the selection is lost, as when
    // Firefox focuses the editor again
    act(() => screen.getByRole("button", { name: "Bold" }).focus());
    document.getSelection()?.removeAllRanges();
    await user.keyboard("{Enter}");

    expect(document.execCommand).toHaveBeenCalledWith("bold", false, undefined);
    expect(formatted).toBe("world");
    expect(editor()).toHaveFocus();
  });

  it("makes no marks of the styles the browser's editing leaves", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <RichTextEditor
          defaultValue="<p>para</p><h2>Head</h2>"
          label="Note"
          onChange={onChange}
        />
        <button type="button">After</button>
      </>,
    );

    await user.click(editor());
    // What Chrome makes of Backspace at the start of the heading - the text
    // keeps its size and weight, it is no bold text of the user
    editor().innerHTML =
      '<p>para<span style="font-size: 1.3em; font-weight: 600;">Head</span></p>';
    fireEvent.input(editor());
    expect(onChange).toHaveBeenLastCalledWith("<p>paraHead</p>");

    await user.click(screen.getByRole("button", { name: "After" }));
    expect(editor().innerHTML).toBe("<p>paraHead</p>");
  });

  it("reads the styles of a loaded value like those of pasted content", () => {
    render(
      <RichTextEditor
        defaultValue={'<p><span style="font-weight:700">Bold</span> text</p>'}
        label="Note"
      />,
    );

    expect(editor().innerHTML).toBe("<p><b>Bold</b> text</p>");
  });

  it("shows what its value keeps once the focus leaves it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <RichTextEditor label="Note" onChange={onChange} />
        <button type="button">After</button>
      </>,
    );

    await user.click(editor());
    editor().innerHTML =
      '<p><sup>up</sup> <b>bold</b> <span style="color: red">red</span></p>';
    fireEvent.input(editor());
    expect(onChange).toHaveBeenLastCalledWith("<p>up <b>bold</b> red</p>");

    await user.click(screen.getByRole("button", { name: "After" }));
    expect(editor().innerHTML).toBe("<p>up <b>bold</b> red</p>");
  });
});

describe.each([
  { tool: "link", title: "Link", role: "textbox", name: "Enter the link URL:" },
  { tool: "image", title: "Image", role: "textbox", name: "Alternative text" },
  { tool: "table", title: "Table", role: "spinbutton", name: "Rows" },
] as const)("RichTextEditor $tool form composition", (form) => {
  it.each([
    { key: "Enter", isComposing: true, keyCode: 13 },
    { key: "Escape", isComposing: true, keyCode: 27 },
    { key: "Enter", isComposing: false, keyCode: 229 },
    { key: "Escape", isComposing: false, keyCode: 229 },
  ])(
    "leaves $key to the IME (composing: $isComposing, code: $keyCode)",
    (key) => {
      const onChange = vi.fn();
      render(
        <RichTextEditor
          defaultValue="<p>Draft</p>"
          label="Note"
          onChange={onChange}
          toolbar={[form.tool]}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: form.title }));
      const input = screen.getByRole(form.role, { name: form.name });
      if (form.tool === "image") {
        fireEvent.change(screen.getByRole("textbox", { name: "Image URL" }), {
          target: { value: "/a.png" },
        });
        fireEvent.change(input, { target: { value: "漢" } });
      } else if (form.tool === "link") {
        fireEvent.change(input, {
          target: { value: "https://example.com/漢" },
        });
      }

      act(() => input.focus());
      fireEvent.compositionStart(input);
      // Safari delivers the candidate-confirming key after compositionend.
      if (!key.isComposing) fireEvent.compositionEnd(input);
      expect(fireEvent.keyDown(input, key)).toBe(true);

      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
      expect(editor().innerHTML).toBe("<p>Draft</p>");
      expect(onChange).not.toHaveBeenCalled();
    },
  );
});

describe("RichTextEditor links", () => {
  /** Selects the text of the editor, like the user would before a link. */
  function selectText() {
    const range = document.createRange();
    range.selectNodeContents(editor().querySelector("p") as HTMLElement);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  }

  it("makes the selected text a link to the typed URL", async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" value="<p>Docs</p>" />);

    selectText();
    await user.click(screen.getByRole("button", { name: "Link" }));
    const url = screen.getByRole("textbox", { name: "Enter the link URL:" });
    expect(url).toHaveFocus();

    await user.type(url, "example.com{Enter}");

    expect(execCommand).toHaveBeenCalledWith(
      "createLink",
      false,
      "https://example.com",
    );
    expect(url).not.toBeInTheDocument();
  });

  it("inserts the URL as the text of a link without a selection", async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.type(
      screen.getByRole("textbox", { name: "Enter the link URL:" }),
      "https://example.com/?a=1&b=2{Enter}",
    );

    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      '<a href="https://example.com/?a=1&amp;b=2">https://example.com/?a=1&amp;b=2</a>',
    );
  });

  it("refuses a URL that could run a script", async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" value="<p>Docs</p>" />);

    selectText();
    await user.click(screen.getByRole("button", { name: "Link" }));
    const url = screen.getByRole("textbox", { name: "Enter the link URL:" });
    await user.type(url, "javascript:alert(1){Enter}");

    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(execCommand).not.toHaveBeenCalled();

    // Escape cancels - without closing a dialog around
    await user.keyboard("{Escape}");
    expect(url).not.toBeInTheDocument();
  });

  it.each([
    ["/docs/page", "/docs/page"],
    ["./docs/page", "./docs/page"],
    ["../docs/page", "../docs/page"],
    ["docs/page", "docs/page"],
    ["?page=2", "?page=2"],
    ["#details", "#details"],
    ["//example.com/docs", "//example.com/docs"],
    ["example.com/docs", "https://example.com/docs"],
    ["example.com?next=/docs", "https://example.com?next=/docs"],
    ["example.com#docs/page", "https://example.com#docs/page"],
    ["example.com:8080/page", "https://example.com:8080/page"],
    ["localhost:3000", "https://localhost:3000"],
    ["localhost:3000/docs", "https://localhost:3000/docs"],
    ["http://localhost:3000/a", "http://localhost:3000/a"],
    ["jana@example.com", "mailto:jana@example.com"],
    ["mailto:jana@example.com", "mailto:jana@example.com"],
    ["+420 123 456 789", "tel:+420123456789"],
    ["(555) 123-4567", "tel:5551234567"],
    // Their digits are no port of a host
    ["tel:602123456", "tel:602123456"],
    ["tel:+420 602 123 456", "tel:+420602123456"],
    ["tel:12345", "tel:12345"],
    // The dots of an IP address make no phone number
    ["192.168.1.1", "https://192.168.1.1"],
    ["10.0.0.138:8080", "https://10.0.0.138:8080"],
    ["[::1]:3000/docs", "https://[::1]:3000/docs"],
    ["555.123.4567", "tel:5551234567"],
  ])("links %s to %s", async (typed, href) => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" value="<p>Docs</p>" />);

    selectText();
    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.type(
      screen.getByRole("textbox", { name: "Enter the link URL:" }),
      `${typed.replaceAll("[", "[[")}{Enter}`,
    );

    expect(execCommand).toHaveBeenCalledWith("createLink", false, href);
  });
});

describe("RichTextEditor drops", () => {
  it("keeps only its own formatting of dropped content", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    fireEvent.drop(editor(), {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/html"
            ? '<span style="color:red" onclick="steal()">Red</span> <b>bold</b>'
            : "Red bold",
      },
    });

    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "Red <b>bold</b>",
    );
  });

  it("reduces foreign content after a drag of its own ended elsewhere", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    // A drag of a whole `<b>` moves the element - its `dragend` never
    // reaches the editor
    const dragged = new Map<string, string>();
    fireEvent.dragStart(editor(), {
      dataTransfer: {
        setData: (type: string, data: string) => dragged.set(type, data),
      },
    });
    expect(dragged.size).toBe(1);

    fireEvent.drop(editor(), {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/html" ? '<span style="color:red">Red</span>' : "",
      },
    });
    expect(execCommand).toHaveBeenCalledWith("insertHTML", false, "Red");
  });

  it("leaves the move of its own content to the browser", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" value="<p>Hi <b>bold</b></p>" />);

    const dragged = new Map<string, string>([["text/html", "<b>bold</b>"]]);
    const dataTransfer = {
      files: [],
      getData: (type: string) => dragged.get(type) ?? "",
      setData: (type: string, data: string) => dragged.set(type, data),
    };
    fireEvent.dragStart(editor(), { dataTransfer });

    expect(fireEvent.drop(editor(), { dataTransfer })).toBe(true);
    expect(execCommand).not.toHaveBeenCalled();

    // The drop ended the drag - the next drop of the same data is foreign
    expect(fireEvent.drop(editor(), { dataTransfer })).toBe(false);
    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "<b>bold</b>",
    );
  });

  it("does not drop files into the text", () => {
    render(<RichTextEditor label="Note" />);

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.assign(drop, {
      dataTransfer: { files: [new File(["x"], "x.png")], getData: () => "" },
    });
    editor().dispatchEvent(drop);

    expect(drop.defaultPrevented).toBe(true);
  });
});

const ALL_TOOLS: RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "paragraph",
  "heading2",
  "heading3",
  "|",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "|",
  "bulletList",
  "numberedList",
  "outdent",
  "indent",
  "|",
  "blockquote",
  "link",
  "table",
  "horizontalRule",
  "|",
  "clearFormatting",
];

/** The text node of the editor that holds `text`. */
function textNode(text: string) {
  const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes(text)) return node as Text;
  }
  throw new Error(`No text "${text}"`);
}

/**
 * Selects from `from` to the end of `to` - puts the caret at the start of
 * `from` without it (or at `offset` in it) - and tells the editor.
 */
function selectText(from: string, to?: string, offset = 0) {
  const start = textNode(from);
  const range = document.createRange();
  range.setStart(start, start.data.indexOf(from) + offset);

  if (to === undefined) {
    range.collapse(true);
  } else {
    const end = textNode(to);
    range.setEnd(end, end.data.indexOf(to) + to.length);
  }

  act(() => {
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

/** Puts the caret into an element - an empty cell or line. */
function caretIn(element: Node, offset = 0) {
  const range = document.createRange();
  range.setStart(element, offset);

  act(() => {
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

const tool = (name: string) => screen.getByRole("button", { name });

/** Fires `beforeinput` - returns whether its default action is left be. */
function beforeInput(inputType: string, data?: string) {
  let notPrevented = true;
  act(() => {
    notPrevented = editor().dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data,
        inputType,
      }),
    );
  });
  return notPrevented;
}

describe("RichTextEditor toolbar", () => {
  it.each([false, true])(
    "moves through its tools with the keyboard, shadow root=%s",
    (inShadowRoot) => {
      const host = document.createElement("div");
      document.body.append(host);
      const root = inShadowRoot
        ? host.attachShadow({ mode: "open" })
        : document;
      const container = inShadowRoot
        ? root.appendChild(document.createElement("div"))
        : host;
      const { unmount } = render(<RichTextEditor label="Note" />, {
        container,
      });
      const tools = within(container);
      const undo = tools.getByRole("button", { name: "Undo" });
      const redo = tools.getByRole("button", { name: "Redo" });
      const last = tools.getByRole("button", { name: "Clear formatting" });

      try {
        act(() => undo.focus());
        fireEvent.keyDown(undo, { key: "ArrowRight" });
        expect(root.activeElement).toBe(redo);
        fireEvent.keyDown(redo, { key: "End" });
        expect(root.activeElement).toBe(last);
        fireEvent.keyDown(last, { key: "ArrowRight" });
        expect(root.activeElement).toBe(undo);
        fireEvent.keyDown(undo, { key: "ArrowLeft" });
        expect(root.activeElement).toBe(last);
        fireEvent.keyDown(last, { key: "Home" });
        expect(root.activeElement).toBe(undo);
      } finally {
        unmount();
        host.remove();
      }
    },
  );

  it("shows the default tools as one stop of Tab", async () => {
    const user = userEvent.setup();
    render(<RichTextEditor label="Note" />);

    const toolbar = screen.getByRole("toolbar", { name: "Note" });
    const buttons = Array.from(toolbar.querySelectorAll("button"));
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Undo",
      "Redo",
      "Paragraph",
      "Heading 2",
      "Heading 3",
      "Bold",
      "Italic",
      "Underline",
      "Strikethrough",
      "Bulleted list",
      "Numbered list",
      "Decrease indent",
      "Increase indent",
      "Quote",
      "Link",
      "Clear formatting",
    ]);
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);

    await user.tab();
    expect(tool("Undo")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tool("Redo")).toHaveFocus();
    await user.keyboard("{End}");
    expect(tool("Clear formatting")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tool("Undo")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tool("Clear formatting")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tool("Undo")).toHaveFocus();

    // Past the toolbar to the text - and back to the tool used last
    await user.keyboard("{ArrowRight}");
    await user.tab();
    expect(editor()).toHaveFocus();
    await user.tab({ shift: true });
    expect(tool("Redo")).toHaveFocus();
  });

  it("takes the tools and their order from toolbar", () => {
    const { rerender } = render(
      <RichTextEditor
        label="Note"
        toolbar={["|", "link", "|", "|", "bold", "bold", "|"]}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Note" });
    expect(
      Array.from(toolbar.querySelectorAll("button"), (button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["Link", "Bold"]);
    // In two groups - a button starts each
    expect(
      Array.from(
        toolbar.querySelectorAll("button"),
        (button) => button.previousElementSibling === null,
      ),
    ).toEqual([true, true]);

    rerender(<RichTextEditor label="Note" toolbar={[]} />);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("names the keyboard shortcuts of the tools", () => {
    const { unmount } = render(<RichTextEditor label="Note" />);

    expect(tool("Bold")).toHaveAttribute("title", "Bold (Ctrl+B)");
    expect(tool("Bold")).toHaveAttribute("aria-keyshortcuts", "Control+B");
    expect(tool("Bold")).toHaveAccessibleDescription("Bold (Ctrl+B)");
    expect(tool("Numbered list")).toHaveAttribute(
      "title",
      "Numbered list (Ctrl+Shift+7)",
    );
    expect(tool("Heading 2")).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+Alt+2",
    );
    unmount();

    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    render(
      <UIProvider messages={{ richTextEditor: { keys: { ctrl: "Strg" } } }}>
        <RichTextEditor label="Note" />
      </UIProvider>,
    );
    expect(tool("Bold")).toHaveAttribute("title", "Bold (⌘B)");
    expect(tool("Bold")).toHaveAttribute("aria-keyshortcuts", "Meta+B");
    expect(tool("Numbered list")).toHaveAttribute(
      "title",
      "Numbered list (⇧⌘7)",
    );
  });

  it("names the modifier keys in the language of the locale", () => {
    render(
      <UIProvider
        messages={{
          richTextEditor: { keys: { ctrl: "Strg", shift: "Umschalt" } },
        }}
      >
        <RichTextEditor label="Note" />
      </UIProvider>,
    );

    expect(tool("Numbered list")).toHaveAttribute(
      "title",
      "Numbered list (Strg+Umschalt+7)",
    );
  });

  it("takes no commands in a disabled editor", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor defaultValue="<p>Docs</p>" disabled label="Note" />);

    // A click focuses it
    act(() => editor().focus());
    selectText("Docs", "Docs");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "k" });
    expect(
      screen.queryByRole("textbox", { name: "Enter the link URL:" }),
    ).toBeNull();

    fireEvent.paste(editor(), {
      clipboardData: { getData: () => "<b>Pasted</b>" },
    });
    expect(execCommand).not.toHaveBeenCalled();
    expect(editor().innerHTML).toBe("<p>Docs</p>");
  });

  it("disables all tools of a disabled editor", () => {
    render(<RichTextEditor disabled label="Note" />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});

describe("RichTextEditor blocks", () => {
  it("makes headings, lists and quotes of the selected lines", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>Plan</p><p>Steps</p>"
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("Plan");
    await user.click(tool("Heading 2"));
    expect(onChange).toHaveBeenLastCalledWith("<h2>Plan</h2><p>Steps</p>");
    expect(editor()).toHaveFocus();

    selectText("Plan", "Steps");
    await user.click(tool("Bulleted list"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<ul><li>Plan</li><li>Steps</li></ul>",
    );

    selectText("Steps");
    await user.click(tool("Quote"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<ul><li>Plan</li></ul><blockquote><p>Steps</p></blockquote>",
    );

    await user.click(tool("Paragraph"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<ul><li>Plan</li></ul><p>Steps</p>",
    );
  });

  it("shows the formatting of the selection", () => {
    render(
      <RichTextEditor
        defaultValue="<h2>Title</h2><ul><li>One</li><li>Two</li></ul><p><b>bold</b> text</p>"
        label="Note"
      />,
    );

    selectText("Two");
    expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "true");
    expect(tool("Heading 2")).toHaveAttribute("aria-pressed", "false");
    expect(tool("Increase indent")).not.toHaveAttribute("aria-disabled");
    expect(tool("Decrease indent")).not.toHaveAttribute("aria-disabled");

    selectText("One");
    expect(tool("Increase indent")).toHaveAttribute("aria-disabled", "true");

    selectText("Title");
    expect(tool("Heading 2")).toHaveAttribute("aria-pressed", "true");
    // A heading is bold anyway
    expect(tool("Bold")).toHaveAttribute("aria-disabled", "true");
    expect(tool("Decrease indent")).toHaveAttribute("aria-disabled", "true");

    selectText("bold");
    expect(tool("Paragraph")).toHaveAttribute("aria-pressed", "true");
    expect(tool("Bold")).toHaveAttribute("aria-pressed", "true");
    expect(tool("Clear formatting")).toHaveAttribute("aria-disabled", "true");

    selectText("bold", "text");
    expect(tool("Bold")).toHaveAttribute("aria-pressed", "false");
    expect(tool("Clear formatting")).not.toHaveAttribute("aria-disabled");
  });

  it("has no bold to add to several headings or header cells", () => {
    render(
      <RichTextEditor
        defaultValue={
          "<h2>Plan</h2><h3>Steps</h3><p>Text</p>" +
          "<table><thead><tr><th>Name</th><th>Age</th></tr></thead></table>"
        }
        label="Note"
        toolbar={["bold", "heading2", "heading3", "table"]}
      />,
    );

    // The browser would "unbold" them with a style the value does not keep
    selectText("Plan", "Steps");
    expect(tool("Bold")).toHaveAttribute("aria-disabled", "true");
    selectText("Name", "Age");
    expect(tool("Bold")).toHaveAttribute("aria-disabled", "true");

    selectText("Steps", "Text");
    expect(tool("Bold")).not.toHaveAttribute("aria-disabled");

    // Chrome "unbolds" the heading of a selection reaching past it - the
    // heading stays bold
    document.execCommand = vi.fn(() => {
      const heading = editor().querySelector("h3") as HTMLElement;
      heading.innerHTML = `<span style="font-weight: normal">${heading.innerHTML}</span>`;
      return true;
    });
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" });
    expect(document.execCommand).toHaveBeenCalledWith("bold", false, undefined);
    expect(editor().querySelector("h3 span")?.getAttribute("style")).toBe("");
  });

  it("indents and outdents list items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<ol><li>One</li><li>Two</li></ol>"
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("Two");
    await user.click(tool("Increase indent"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<ol><li>One<ol><li>Two</li></ol></li></ol>",
    );

    await user.click(tool("Decrease indent"));
    await user.click(tool("Decrease indent"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<ol><li>One</li></ol><p>Two</p>",
    );
  });

  it("indents by Tab and outdents a nested item by Shift+Tab", () => {
    render(
      <RichTextEditor
        defaultValue="<ul><li>One</li><li>Two</li></ul>"
        label="Note"
      />,
    );

    // The first item has nothing to be nested in - Tab leaves the editor
    selectText("One");
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);

    selectText("Two");
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
    expect(editor().innerHTML).toBe(
      "<ul><li>One<ul><li>Two</li></ul></li></ul>",
    );

    expect(fireEvent.keyDown(editor(), { key: "Tab", shiftKey: true })).toBe(
      false,
    );
    expect(editor().innerHTML).toBe("<ul><li>One</li><li>Two</li></ul>");

    // On the top level Shift+Tab leaves the editor
    expect(fireEvent.keyDown(editor(), { key: "Tab", shiftKey: true })).toBe(
      true,
    );
  });

  it("leaves a list or a quote by Enter in an empty line", () => {
    render(
      <RichTextEditor
        defaultValue="<ul><li>One</li><li><br></li></ul><blockquote><p>Q</p><p><br></p></blockquote>"
        label="Note"
      />,
    );

    caretIn(editor().querySelectorAll("li")[1]);
    expect(beforeInput("insertParagraph")).toBe(false);
    expect(editor().innerHTML).toBe(
      "<ul><li>One</li></ul><p><br></p><blockquote><p>Q</p><p><br></p></blockquote>",
    );

    caretIn(editor().querySelectorAll("blockquote p")[1]);
    expect(beforeInput("insertParagraph")).toBe(false);
    expect(editor().innerHTML).toBe(
      "<ul><li>One</li></ul><p><br></p><blockquote><p>Q</p></blockquote><p><br></p>",
    );

    // Enter in a line with text is left to the browser
    selectText("Q");
    expect(beforeInput("insertParagraph")).toBe(true);
  });

  it("makes lists of the list commands of the browser", () => {
    render(<RichTextEditor defaultValue="<p>Item</p>" label="Note" />);

    selectText("Item");
    expect(beforeInput("insertOrderedList")).toBe(false);
    expect(editor().innerHTML).toBe("<ol><li>Item</li></ol>");
  });

  it("inserts a horizontal line after the text of the caret", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>Intro</p>"
        label="Note"
        onChange={onChange}
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("Intro", undefined, 5);
    await user.click(tool("Horizontal line"));
    expect(onChange).toHaveBeenLastCalledWith("<p>Intro</p><hr><p><br></p>");
    expect(document.getSelection()?.anchorNode).toBe(editor().lastChild);
  });
});

describe("RichTextEditor marks", () => {
  it("formats by the keyboard shortcuts of its tools", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<p>Plan</p>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("Plan", "Plan");
    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" })).toBe(
      false,
    );
    expect(execCommand).toHaveBeenCalledWith("bold", false, undefined);

    // Shift changes the character of a digit - its place on the keyboard counts
    fireEvent.keyDown(editor(), {
      code: "Digit8",
      ctrlKey: true,
      key: "*",
      shiftKey: true,
    });
    expect(editor().innerHTML).toBe("<ul><li>Plan</li></ul>");

    fireEvent.keyDown(editor(), {
      altKey: true,
      code: "Digit2",
      ctrlKey: true,
      key: "2",
    });
    expect(editor().innerHTML).toBe("<h2>Plan</h2>");

    // AltGr types a character - `²` on a German keyboard
    expect(
      fireEvent.keyDown(editor(), {
        altKey: true,
        code: "Digit3",
        ctrlKey: true,
        key: "³",
        modifierAltGraph: true,
      }),
    ).toBe(true);
    expect(editor().innerHTML).toBe("<h2>Plan</h2>");

    fireEvent.keyDown(editor(), { code: "KeyE", ctrlKey: true, key: "e" });
    expect(editor().innerHTML).toBe("<h2><code>Plan</code></h2>");
  });

  it("acts on the selection of a key press before its selectionchange", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue="<h2>Title</h2><p>Text</p>" label="Note" />,
    );

    // In a heading bold has nothing to add
    selectText("Title");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" });
    expect(execCommand).not.toHaveBeenCalledWith("bold", false, undefined);

    // Selected, and the key pressed before the browser tells the change
    const range = document.createRange();
    range.selectNodeContents(textNode("Text"));
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" });
    expect(execCommand).toHaveBeenCalledWith("bold", false, undefined);
  });

  it("makes the selected text code, or switches code for the text typed next", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>Run npm test</p>"
        label="Note"
        onChange={onChange}
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("npm", "test");
    await user.click(tool("Code"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<p>Run <code>npm test</code></p>",
    );

    // At a caret the code is for the text typed next
    selectText("Run", undefined, 3);
    await user.click(tool("Code"));
    expect(tool("Code")).toHaveAttribute("aria-pressed", "true");

    expect(beforeInput("insertText", "!")).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(
      "<p>Run<code>!</code> <code>npm test</code></p>",
    );
  });

  it("clears the formatting of the selected text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue='<p><b>bold</b> <i>it</i> <a href="/x"><u>link</u></a></p>'
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("bold", "link");
    await user.click(tool("Clear formatting"));
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>bold it <a href="/x">link</a></p>',
    );
  });

  it("underlines links, which the browser takes for underlined", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue='<p>Go <a href="https://example.com">there</a> now</p>'
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("there", "there");
    expect(tool("Underline")).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "u" });
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>Go <u><a href="https://example.com">there</a></u> now</p>',
    );
    expect(tool("Underline")).toHaveAttribute("aria-pressed", "true");

    // And back - also for a selection with text around the link
    selectText("Go", "now");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "u" });
    expect(onChange).toHaveBeenLastCalledWith(
      '<p><u>Go <a href="https://example.com">there</a> now</u></p>',
    );
    selectText("Go", "now");
    fireEvent.click(tool("Underline"));
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>Go <a href="https://example.com">there</a> now</p>',
    );
    expect(execCommand).not.toHaveBeenCalledWith("underline", false, undefined);
  });

  it("shows struck text as it keeps it", async () => {
    const user = userEvent.setup();
    document.execCommand = vi.fn((command: string) => {
      // What Chrome does
      if (command === "strikeThrough") {
        editor().innerHTML = "<p><strike>old</strike> price</p>";
      }
      return true;
    });
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>old price</p>"
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("old", "old");
    await user.click(tool("Strikethrough"));
    expect(editor().innerHTML).toBe("<p><s>old</s> price</p>");
    expect(onChange).toHaveBeenLastCalledWith("<p><s>old</s> price</p>");
  });
});

describe("RichTextEditor history", () => {
  it("undoes and redoes its changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>Plan</p>"
        label="Note"
        onChange={onChange}
      />,
    );
    expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");
    expect(tool("Redo")).toHaveAttribute("aria-disabled", "true");

    selectText("Plan");
    await user.click(tool("Heading 2"));
    await user.click(tool("Bulleted list"));
    expect(editor().innerHTML).toBe("<ul><li>Plan</li></ul>");

    await user.click(tool("Undo"));
    expect(editor().innerHTML).toBe("<h2>Plan</h2>");
    expect(onChange).toHaveBeenLastCalledWith("<h2>Plan</h2>");
    expect(tool("Redo")).not.toHaveAttribute("aria-disabled");

    // By the keyboard and by the menus of the browser
    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "z" })).toBe(
      false,
    );
    expect(editor().innerHTML).toBe("<p>Plan</p>");
    expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");

    expect(beforeInput("historyRedo")).toBe(false);
    expect(editor().innerHTML).toBe("<h2>Plan</h2>");
    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "y" })).toBe(
      false,
    );
    expect(editor().innerHTML).toBe("<ul><li>Plan</li></ul>");
    expect(onChange).toHaveBeenLastCalledWith("<ul><li>Plan</li></ul>");
  });

  it("puts the caret back in text its own commands split", () => {
    render(
      <RichTextEditor
        defaultValue="<p>hello world</p>"
        label="Note"
        toolbar={["code"]}
      />,
    );

    // Code on and off again - the text stays in two text nodes
    selectText("world", "world");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "e" });
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "e" });
    expect(editor().innerHTML).toBe("<p>hello world</p>");

    selectText("world", undefined, 3);
    typeText("X");
    undoKey();
    expect(editor().innerHTML).toBe("<p>hello world</p>");
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(textNode("hello world"));
    expect(range?.startOffset).toBe(9);
  });

  it("undoes a run of typing in one step", () => {
    render(<RichTextEditor defaultValue="<p>a</p>" label="Note" />);
    const text = textNode("a");

    for (const typed of ["ab", "abc"]) {
      beforeInput("insertText");
      text.data = typed;
      fireEvent.input(editor(), { inputType: "insertText" });
    }
    expect(tool("Undo")).not.toHaveAttribute("aria-disabled");

    fireEvent.keyDown(editor(), { ctrlKey: true, key: "z" });
    expect(editor().innerHTML).toBe("<p>a</p>");
  });

  it("undoes an IME composition in one step", () => {
    render(<RichTextEditor defaultValue="<p>a</p>" label="Note" />);
    const text = textNode("a");
    selectText("a", undefined, 1);

    fireEvent.compositionStart(editor());
    for (const composed of ["k", "か", "かn", "かん", "漢字"]) {
      // The browser selects the composed text for each of its changes
      const range = document.createRange();
      range.setStart(text, 1);
      range.setEnd(text, text.length);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);

      act(() => {
        editor().dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            data: composed,
            inputType: "insertCompositionText",
            isComposing: true,
          }),
        );
      });
      text.data = `a${composed}`;
      fireEvent.input(editor(), {
        data: composed,
        inputType: "insertCompositionText",
        isComposing: true,
      });
    }
    fireEvent.compositionEnd(editor(), { data: "漢字" });
    expect(editor().innerHTML).toBe("<p>a漢字</p>");

    // Not back to "かん" - out with the whole word
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "z" });
    expect(editor().innerHTML).toBe("<p>a</p>");
    expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");
  });

  it("starts anew with a value from outside", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [note, setNote] = useState("<p>Draft</p>");
      return (
        <>
          <RichTextEditor label="Note" onChange={setNote} value={note} />
          <button onClick={() => setNote("<p>Template</p>")} type="button">
            Load
          </button>
        </>
      );
    }
    render(<Controlled />);

    selectText("Draft");
    await user.click(tool("Heading 2"));
    expect(tool("Undo")).not.toHaveAttribute("aria-disabled");
    // The controlled value took the change - the history stays
    expect(editor().innerHTML).toBe("<h2>Draft</h2>");

    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(editor().innerHTML).toBe("<p>Template</p>");
    expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("RichTextEditor tables", () => {
  const TABLE =
    "<table><thead><tr><th>Name</th><th>Role</th></tr></thead>" +
    "<tbody><tr><td>Jana</td><td>Lead</td></tr></tbody></table><p>After</p>";

  it("inserts a table of the size of the form", async () => {
    const user = userEvent.setup();
    render(
      <RichTextEditor
        defaultValue="<p>Team</p>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("Team", undefined, 4);
    await user.click(tool("Table"));
    expect(tool("Table")).toHaveAttribute("aria-expanded", "true");

    const form = screen.getByRole("group", { name: "Insert table" });
    const rows = screen.getByRole("spinbutton", { name: "Rows" });
    expect(rows).toHaveFocus();
    await user.clear(rows);
    await user.type(rows, "2");
    await user.clear(screen.getByRole("spinbutton", { name: "Columns" }));
    await user.type(screen.getByRole("spinbutton", { name: "Columns" }), "3");
    expect(screen.getByRole("checkbox", { name: "Header row" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Insert table" }));
    expect(form).not.toBeInTheDocument();
    expect(editor().innerHTML).toBe(
      "<p>Team</p><table><thead><tr><th><br></th><th><br></th><th><br></th></tr></thead>" +
        "<tbody><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><p><br></p>",
    );
    // The caret is in the first cell, the table tools act on it
    expect(document.getSelection()?.anchorNode).toBe(
      editor().querySelector("th"),
    );
    expect(screen.getByRole("toolbar", { name: "Table" })).toBeVisible();
    expect(tool("Insert row below")).not.toHaveAttribute("aria-disabled");
    expect(tool("Table")).toHaveAttribute("aria-disabled", "true");
  });

  it("closes the table form by Escape and keeps a form around unsubmitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <RichTextEditor
          defaultValue="<p>Team</p>"
          label="Note"
          toolbar={["table"]}
        />
      </form>,
    );

    selectText("Team");
    await user.click(tool("Table"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(editor()).toHaveFocus();

    // Enter in a field of the form inserts the table
    await user.click(tool("Table"));
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(editor().querySelectorAll("tr")).toHaveLength(3);
  });

  it("moves between the cells by Tab, adding a row after the last one", () => {
    render(
      <RichTextEditor defaultValue={TABLE} label="Note" toolbar={ALL_TOOLS} />,
    );

    selectText("Name");
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
    expect(document.getSelection()?.toString()).toBe("Role");

    selectText("Lead");
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
    expect(editor().querySelectorAll("tbody tr")).toHaveLength(2);
    expect(document.getSelection()?.anchorNode).toBe(
      editor().querySelector("tbody tr:last-child td"),
    );

    expect(fireEvent.keyDown(editor(), { key: "Tab", shiftKey: true })).toBe(
      false,
    );
    expect(document.getSelection()?.toString()).toBe("Lead");

    // From the first cell Shift+Tab leaves the editor
    selectText("Name");
    expect(fireEvent.keyDown(editor(), { key: "Tab", shiftKey: true })).toBe(
      true,
    );
  });

  it("edits the rows and columns of the table at the caret", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue={TABLE}
        label="Note"
        onChange={onChange}
        toolbar={ALL_TOOLS}
      />,
    );

    // Shown with the table, acting once the caret is in it
    expect(tool("Insert row below")).toHaveAttribute("aria-disabled", "true");
    selectText("Jana");
    expect(tool("Header row")).toHaveAttribute("aria-pressed", "true");

    await user.click(tool("Insert row below"));
    await user.click(tool("Insert column right"));
    expect(
      Array.from(editor().querySelectorAll("tr"), (row) => row.cells.length),
    ).toEqual([3, 3, 3]);

    await user.click(tool("Delete column"));
    await user.click(tool("Delete row"));
    expect(onChange).toHaveBeenLastCalledWith(TABLE);

    selectText("Name");
    await user.click(tool("Header row"));
    expect(editor().querySelector("thead")).toBeNull();

    await user.click(tool("Delete table"));
    expect(onChange).toHaveBeenLastCalledWith("<p>After</p>");
    expect(
      screen.queryByRole("toolbar", { name: "Table" }),
    ).not.toBeInTheDocument();
  });

  it("inserts a column on the side it says in a right-to-left table", async () => {
    mockRightToLeft();
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue={TABLE}
        label="Note"
        onChange={onChange}
        toolbar={ALL_TOOLS}
      />,
    );

    // The first cell is on the right - the column on the right of "Jana"
    // comes before it
    selectText("Jana");
    await user.click(tool("Insert column right"));
    expect(
      Array.from(editor().querySelectorAll("tbody td"), (cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(["", "Jana", "Lead"]);

    selectText("Lead");
    await user.click(tool("Insert column left"));
    expect(
      Array.from(editor().querySelectorAll("tbody td"), (cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(["", "Jana", "Lead", ""]);
  });

  it("breaks lines in a cell and pastes lines into it", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue={TABLE} label="Note" toolbar={ALL_TOOLS} />,
    );

    selectText("Jana");
    expect(beforeInput("insertParagraph")).toBe(false);
    expect(execCommand).toHaveBeenCalledWith(
      "insertLineBreak",
      false,
      undefined,
    );

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html" ? "<h2>One</h2><ul><li>Two</li></ul>" : "",
      },
    });
    expect(execCommand).toHaveBeenCalledWith("insertHTML", false, "One<br>Two");
  });

  it("leaves a table at the end of the content by the arrow keys", () => {
    render(
      <RichTextEditor
        // Source formatting after the table is nowhere to go either
        defaultValue={"<table><tbody><tr><td>x</td></tr></tbody></table>\n"}
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("x", undefined, 1);
    expect(fireEvent.keyDown(editor(), { key: "ArrowDown" })).toBe(false);
    expect(editor().querySelector("table + p")?.innerHTML).toBe("<br>");
    expect(document.getSelection()?.anchorNode).toBe(
      editor().querySelector("table + p"),
    );

    // Not in the middle of the text of a cell
    selectText("x");
    expect(fireEvent.keyDown(editor(), { key: "ArrowRight" })).toBe(true);
  });

  it("keeps the line after a table out of it by Backspace", () => {
    const table = "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";
    render(
      <RichTextEditor
        defaultValue={`${table}<p>After</p>`}
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );
    const lastCell = () => editor().querySelectorAll("td")[1];

    // The browser would pull the line into the last cell - also by a word
    for (const modifiers of [{}, { altKey: true }, { ctrlKey: true }]) {
      selectText("After");
      expect(
        fireEvent.keyDown(editor(), { key: "Backspace", ...modifiers }),
      ).toBe(false);
      expect(editor().innerHTML).toBe(`${table}<p>After</p>`);
      // The caret goes to the end of the table
      const selection = document.getSelection() as Selection;
      expect(lastCell().contains(selection.anchorNode)).toBe(true);
      expect(selection.isCollapsed).toBe(true);
    }

    // Within the text it deletes as usual
    selectText("After", undefined, 2);
    expect(fireEvent.keyDown(editor(), { key: "Backspace" })).toBe(true);

    // A line without text goes - the last one stays, to write after the
    // table
    editor().innerHTML = `${table}<p><br></p><p>End</p>`;
    fireEvent.input(editor());
    caretIn(editor().querySelector("p") as HTMLElement);
    expect(fireEvent.keyDown(editor(), { key: "Backspace" })).toBe(false);
    expect(editor().innerHTML).toBe(`${table}<p>End</p>`);

    editor().innerHTML = `${table}<p><br></p>`;
    fireEvent.input(editor());
    caretIn(editor().querySelector("p") as HTMLElement);
    expect(fireEvent.keyDown(editor(), { key: "Backspace" })).toBe(false);
    expect(editor().innerHTML).toBe(`${table}<p><br></p>`);
    expect(
      lastCell().contains(document.getSelection()?.anchorNode ?? null),
    ).toBe(true);

    // A list or a quote lifts its first line out by its own Backspace
    for (const block of [
      "<ul><li>Item</li></ul>",
      "<blockquote>Quote</blockquote>",
    ]) {
      editor().innerHTML = `${table}${block}`;
      fireEvent.input(editor());
      selectText(block.includes("Item") ? "Item" : "Quote");
      expect(fireEvent.keyDown(editor(), { key: "Backspace" })).toBe(true);
    }
  });

  it("reduces pasted tables to lines without the table tool", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(<RichTextEditor label="Note" />);

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? "<table><tr><td>a</td><td>b</td></tr></table>"
            : "",
      },
    });
    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "<p>a\tb</p>",
    );
  });
});

describe("RichTextEditor link editing", () => {
  it.each([
    "/docs/page",
    "./docs/page",
    "../docs/page",
    "docs/page",
    "guide.html",
    "?page=2",
    "#details",
    "//example.com/docs",
  ])(
    "keeps an existing link %s when its URL is confirmed unchanged",
    async (href) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <RichTextEditor
          defaultValue={`<p>See <a href="${href}">the docs</a></p>`}
          label="Note"
          onChange={onChange}
        />,
      );

      selectText("docs", undefined, 2);
      await user.click(tool("Link"));
      const url = screen.getByRole("textbox", { name: "Enter the link URL:" });
      expect(url).toHaveValue(href);
      await user.keyboard("{Enter}");

      expect(url).not.toBeInTheDocument();
      expect(editor().querySelector("a")).toHaveAttribute("href", href);
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("edits and removes the link at the selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue='<p>See <a href="https://old.example">the docs</a></p>'
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("docs", undefined, 2);
    expect(tool("Link")).toHaveClass("bg-primary-100");
    await user.click(tool("Link"));

    const url = screen.getByRole("textbox", { name: "Enter the link URL:" });
    expect(url).toHaveValue("https://old.example");
    await user.clear(url);
    await user.type(url, "new.example{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>See <a href="https://new.example">the docs</a></p>',
    );

    selectText("docs");
    await user.click(tool("Link"));
    await user.click(screen.getByRole("button", { name: "Remove link" }));
    expect(onChange).toHaveBeenLastCalledWith("<p>See the docs</p>");
    expect(
      screen.queryByRole("textbox", { name: "Enter the link URL:" }),
    ).not.toBeInTheDocument();
  });

  it("opens the link form by the keyboard shortcut", async () => {
    render(<RichTextEditor defaultValue="<p>Docs</p>" label="Note" />);

    selectText("Docs", "Docs");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "k" });
    expect(
      await screen.findByRole("textbox", { name: "Enter the link URL:" }),
    ).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Remove link" })).toBeNull();
  });
});

describe("RichTextEditor content", () => {
  it("starts the text of an empty editor in a paragraph", () => {
    const onChange = vi.fn();
    render(<RichTextEditor label="Note" name="note" onChange={onChange} />);

    act(() => editor().focus());
    expect(editor().innerHTML).toBe("<p><br></p>");
    expect(editor()).toHaveAttribute("data-empty");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("submits the new formatting with its form", () => {
    const html =
      "<h2>Plan</h2><ol><li>One<ul><li>Sub</li></ul></li></ol>" +
      "<blockquote><p>Quote</p></blockquote><p><u>u</u> <s>s</s> <code>c</code></p><hr>" +
      "<table><tbody><tr><td>Cell</td></tr></tbody></table>";
    render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue={html}
          label="Note"
          name="note"
          toolbar={ALL_TOOLS}
        />
      </form>,
    );

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("note")).toBe(html);
    expect(editor().innerHTML).toBe(html);
  });

  it("keeps only the formatting of its tools in a loaded value", () => {
    render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue="<h2>Plan</h2><ul><li>One</li></ul><p><b>bold</b> <u>u</u></p>"
          label="Note"
          name="note"
          toolbar={["bold", "italic"]}
        />
      </form>,
    );

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("note")).toBe(
      "<p>Plan</p><p>One</p><p><b>bold</b> u</p>",
    );
  });
});

describe("RichTextEditor with changing tools", () => {
  it("shows only the formatting of its tools", () => {
    const html = "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";
    const { rerender } = render(
      <RichTextEditor defaultValue={html} label="Note" toolbar={["table"]} />,
    );
    expect(editor().innerHTML).toBe(html);

    rerender(
      <RichTextEditor defaultValue={html} label="Note" toolbar={["bold"]} />,
    );
    expect(editor().innerHTML).toBe("<p>a\tb</p>");
  });
});

describe("RichTextEditor with all tools on the server", () => {
  it("hydrates without a mismatch", async () => {
    const element = (
      <RichTextEditor
        defaultValue="<table><tbody><tr><td>Cell</td></tr></tbody></table>"
        label="Note"
        toolbar={ALL_TOOLS}
      />
    );

    vi.stubGlobal("document", undefined);
    let serverHtml: string;
    try {
      serverHtml = renderToString(element);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(serverHtml).toContain('aria-keyshortcuts="Control+B"');

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error");
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, element, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector("td")?.textContent).toBe("Cell");
    // The table tools of the loaded table
    expect(screen.getByRole("toolbar", { name: "Table" })).toBeVisible();

    act(() => root.unmount());
    container.remove();
  });
});

// Every tool - also those of code blocks and images
const EVERY_TOOL: RichTextToolbarItem[] = [...ALL_TOOLS, "codeBlock", "image"];
const IMAGE_TOOLS: RichTextToolbarItem[] = ["bold", "link", "image"];

/**
 * Types text at the selection as the browser does - each character a
 * `beforeinput` the editor may cancel, the text and an `input`.
 */
function typeText(typed: string) {
  for (const character of typed) {
    if (!beforeInput("insertText", character)) continue;

    const selection = document.getSelection() as Selection;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    let text = range.startContainer;
    let offset = range.startOffset;
    if (text.nodeType !== Node.TEXT_NODE) {
      const node = document.createTextNode("");
      range.insertNode(node);
      text = node;
      offset = 0;
    }
    (text as Text).insertData(offset, character);

    const caret = document.createRange();
    caret.setStart(text, offset + 1);
    act(() => {
      selection.removeAllRanges();
      selection.addRange(caret);
    });
    fireEvent.input(editor(), { data: character, inputType: "insertText" });
  }
}

/** Lays the page out right to left - jsdom knows no `dir`. */
function mockRightToLeft() {
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return new Proxy(style, {
      get: (target, property) => {
        if (property === "direction") return "rtl";
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

const undoKey = () => fireEvent.keyDown(editor(), { ctrlKey: true, key: "z" });

describe("RichTextEditor read-only", () => {
  it("shows its content focusable and submitted, but not editable", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue="<p>Signed <b>off</b></p>"
          label="Note"
          name="note"
          readOnly
        />
      </form>,
    );

    expect(editor()).toHaveAttribute("aria-readonly", "true");
    expect(editor()).toHaveAttribute("data-readonly");
    expect(editor()).toHaveAttribute("contenteditable", "false");
    expect(editor()).not.toHaveAttribute("aria-disabled");
    expect(editor().tabIndex).toBe(0);
    // No tools to change it
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(
      new FormData(screen.getByTestId("form") as HTMLFormElement).get("note"),
    ).toBe("<p>Signed <b>off</b></p>");

    act(() => editor().focus());
    selectText("Signed", "off");
    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" })).toBe(true);
    undoKey();
    fireEvent.paste(editor(), {
      clipboardData: { getData: () => "<b>Pasted</b>" },
    });
    expect(execCommand).not.toHaveBeenCalled();
    expect(editor().innerHTML).toBe("<p>Signed <b>off</b></p>");
  });

  it("is not validated, like a read-only native field", () => {
    render(
      <form data-testid="form">
        <RichTextEditor
          label="Note"
          maxLength={2}
          name="note"
          readOnly
          required
        />
      </form>,
    );

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("note")).toBe("");
  });
});

describe("RichTextEditor height", () => {
  // The terms of a `calc()` - jsdom writes them in an order of its own
  const parts = (height: string) =>
    height
      .replace(/^calc\((.*)\)$/, "$1")
      .split(" + ")
      .sort();

  it("has room for minRows lines and scrolls past maxRows", () => {
    const { rerender } = render(<RichTextEditor label="Note" />);
    expect(parts(editor().style.minHeight)).toEqual(["1.5rem", "8lh"]);
    expect(editor().style.maxHeight).toBe("");
    expect(editor()).toHaveClass("overflow-y-auto");
    expect(editor()).not.toHaveClass("resize-y");

    rerender(<RichTextEditor label="Note" maxRows={12} minRows={3} resize />);
    expect(parts(editor().style.minHeight)).toEqual(["1.5rem", "3lh"]);
    expect(parts(editor().style.maxHeight)).toEqual(["1.5rem", "12lh"]);
    expect(editor()).toHaveClass("resize-y");

    // Never less room than `minRows`
    rerender(<RichTextEditor label="Note" maxRows={2} minRows={4} />);
    expect(parts(editor().style.maxHeight)).toEqual(["1.5rem", "4lh"]);
  });
});

describe("RichTextEditor character count", () => {
  it("counts the characters of the text as it shows", () => {
    const { rerender } = render(
      <RichTextEditor
        defaultValue={
          '<p>Hello</p>\n  <ul><li>big <b>world</b></li></ul><p><img src="/a.png">!</p>'
        }
        label="Note"
        showCount
        toolbar={[...IMAGE_TOOLS, "bulletList"]}
      />,
    );
    // Line breaks, whitespace between blocks and images count none
    expect(screen.getByText("15")).toBeVisible();

    rerender(
      <RichTextEditor
        defaultValue="<p>Hello</p>"
        label="Note"
        maxLength={1200}
        showCount
      />,
    );
    expect(screen.getByText("5 / 1,200")).toHaveClass("text-neutral-500");
  });

  it("tells screen readers how many are left once the typing pauses", () => {
    vi.useFakeTimers();
    try {
      render(
        <RichTextEditor
          defaultValue="<p>abc</p>"
          label="Note"
          maxLength={5}
          showCount
        />,
      );

      act(() => editor().focus());
      expect(screen.queryByText("2 characters left")).toBeNull();
      act(() => vi.advanceTimersByTime(750));
      expect(screen.getByText("2 characters left")).toHaveAttribute(
        "role",
        "status",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops typed text at maxLength, like a native field", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue="<p>abc</p>" label="Note" maxLength={5} />,
    );

    selectText("abc", undefined, 3);
    expect(beforeInput("insertText", "d")).toBe(true);
    // Text that does not fit is cut
    expect(beforeInput("insertText", "xyz")).toBe(false);
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "xy");

    textNode("abc").data = "abcde";
    fireEvent.input(editor(), { inputType: "insertText" });
    selectText("abcde", undefined, 5);
    expect(beforeInput("insertText", "f")).toBe(false);
    // In place of a selection
    selectText("abcde", "abcde");
    expect(beforeInput("insertText", "f")).toBe(true);
    // Deleting and new paragraphs add no text
    selectText("abcde", undefined, 5);
    expect(beforeInput("deleteContentBackward")).toBe(true);
    expect(beforeInput("insertParagraph")).toBe(true);
  });

  it("cuts pasted content that does not fit", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue="<p>ab</p>" label="Note" maxLength={5} />,
    );
    selectText("ab", undefined, 2);

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html" ? "<b>1234</b><p>567</p>" : "1234567",
      },
    });
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "<b>123</b>",
    );

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "12\n345" : ""),
      },
    });
    expect(execCommand).toHaveBeenLastCalledWith("insertText", false, "12\n3");
  });

  it.each([
    { html: "<p>a b</p>", selection: " ", replacement: "X", max: 3 },
    {
      html: "<p>a   b</p>",
      selection: "   ",
      replacement: "X",
      max: 3,
    },
    {
      html: "<pre><code>a  b</code></pre>",
      selection: "  ",
      replacement: "XY",
      max: 4,
    },
  ])(
    "allows replacing selected whitespace at maxLength in $html",
    ({ html, selection, replacement, max }) => {
      const execCommand = vi.fn(() => true);
      document.execCommand = execCommand;
      render(
        <RichTextEditor
          defaultValue={html}
          label="Note"
          maxLength={max}
          toolbar={EVERY_TOOL}
        />,
      );
      selectText(selection, selection);

      expect(beforeInput("insertText", replacement)).toBe(true);
      expect(execCommand).not.toHaveBeenCalled();
      expect(beforeInput("insertText", `${replacement}Z`)).toBe(false);
      expect(execCommand).toHaveBeenLastCalledWith(
        "insertText",
        false,
        replacement,
      );
    },
  );

  it.each([
    {
      html: "<p>a b</p>",
      selection: " ",
      max: 3,
      clipboardHtml: "",
      command: "insertText",
      inserted: "X",
    },
    {
      html: "<p>a b</p>",
      selection: " ",
      max: 3,
      clipboardHtml: "<b>XYZ</b>",
      command: "insertHTML",
      inserted: "<b>X</b>",
    },
    {
      html: "<pre><code>a  b</code></pre>",
      selection: "  ",
      max: 4,
      clipboardHtml: "",
      command: "insertHTML",
      inserted: "XY",
    },
  ])(
    "fits pasted content into selected whitespace in $html ($command)",
    ({ html, selection, max, clipboardHtml, command, inserted }) => {
      const execCommand = vi.fn(() => true);
      document.execCommand = execCommand;
      render(
        <RichTextEditor
          defaultValue={html}
          label="Note"
          maxLength={max}
          toolbar={EVERY_TOOL}
        />,
      );
      selectText(selection, selection);

      fireEvent.paste(editor(), {
        clipboardData: {
          getData: (type: string) =>
            type === "text/html" ? clipboardHtml : "XYZ",
        },
      });

      expect(execCommand).toHaveBeenLastCalledWith(command, false, inserted);
    },
  );

  it("cuts the text of a new link that does not fit", async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue="<p>abc</p>" label="Note" maxLength={5} />,
    );

    selectText("abc", undefined, 3);
    await user.click(tool("Link"));
    await user.type(
      screen.getByRole("textbox", { name: "Enter the link URL:" }),
      "example.com{Enter}",
    );
    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      '<a href="https://example.com">ex</a>',
    );
  });

  it("pastes nothing once the text is at its limit", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor defaultValue="<p>abc</p>" label="Note" maxLength={3} />,
    );
    selectText("abc", undefined, 3);

    fireEvent.paste(editor(), {
      clipboardData: { getData: () => "more" },
    });
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("cuts a composition back to the limit when it ends", () => {
    render(
      <RichTextEditor defaultValue="<p>abc</p>" label="Note" maxLength={4} />,
    );
    const text = textNode("abc");

    selectText("abc", undefined, 3);
    fireEvent.compositionStart(editor());
    text.data = "abc漢字";
    const caret = document.createRange();
    caret.setStart(text, 5);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(caret);
    fireEvent.compositionEnd(editor(), { data: "漢字" });

    expect(editor().innerHTML).toBe("<p>abc漢</p>");
  });

  it.each([
    { composed: "😀", expected: "abc" },
    { composed: "𠮷字", expected: "abc" },
    { composed: "字😀", expected: "abc字" },
  ])(
    "keeps complete characters when cutting a composition: $composed",
    ({ composed, expected }) => {
      const onChange = vi.fn();
      render(
        <RichTextEditor
          defaultValue="<p>abc</p>"
          label="Note"
          maxLength={4}
          onChange={onChange}
        />,
      );
      const text = textNode("abc");
      selectText("abc", undefined, 3);
      fireEvent.compositionStart(editor());
      text.data = `abc${composed}`;
      const caret = document.createRange();
      caret.setStart(text, text.length);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(caret);
      fireEvent.compositionEnd(editor(), { data: composed });

      expect(editor().innerHTML).toBe(`<p>${expected}</p>`);
      expect(document.getSelection()?.anchorOffset).toBe(expected.length);
      if (expected === "abc") expect(onChange).not.toHaveBeenCalled();
      else expect(onChange).toHaveBeenLastCalledWith(`<p>${expected}</p>`);
    },
  );

  it("is invalid once the user edits a text too long", () => {
    const { container } = render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue="<p>abcdef</p>"
          label="Note"
          maxLength={5}
          name="note"
          showCount
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;

    // A value from outside is only counted over the limit
    expect(form.checkValidity()).toBe(true);
    expect(screen.getByText("6 / 5")).toHaveClass("text-danger-700");

    textNode("abcdef").data = "abcdeg";
    fireEvent.input(editor());
    expect(form.checkValidity()).toBe(false);
    expect(
      container.querySelector<HTMLInputElement>("input[aria-hidden]")
        ?.validationMessage,
    ).toBe("1 character over the limit");

    textNode("abcdeg").data = "abcde";
    fireEvent.input(editor());
    expect(form.checkValidity()).toBe(true);
  });
});

describe("RichTextEditor Markdown shortcuts", () => {
  it.each([
    ["# ", "<h2>Title</h2>"],
    ["## ", "<h2>Title</h2>"],
    ["### ", "<h3>Title</h3>"],
    ["- ", "<ul><li>Title</li></ul>"],
    ["* ", "<ul><li>Title</li></ul>"],
    ["1. ", "<ol><li>Title</li></ol>"],
    ["> ", "<blockquote><p>Title</p></blockquote>"],
  ])("formats a paragraph started with %j", (typed, html) => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>Title</p>"
        label="Note"
        onChange={onChange}
      />,
    );

    selectText("Title");
    typeText(typed);
    expect(editor().innerHTML).toBe(html);
    expect(onChange).toHaveBeenLastCalledWith(html);
  });

  it("brings back the typed text by one undo", () => {
    render(<RichTextEditor defaultValue="<p>Title</p>" label="Note" />);

    selectText("Title");
    typeText("# ");
    expect(editor().innerHTML).toBe("<h2>Title</h2>");

    undoKey();
    expect(editor().innerHTML).toBe("<p>#&nbsp;Title</p>");
    // With the caret after the shortcut
    expect(document.getSelection()?.getRangeAt(0).startOffset).toBe(2);

    undoKey();
    expect(editor().innerHTML).toBe("<p>Title</p>");
  });

  it("makes a rule of --- and a code block of ```", () => {
    render(<RichTextEditor label="Note" toolbar={EVERY_TOOL} />);
    act(() => editor().focus());

    typeText("---");
    expect(editor().innerHTML).toBe("<hr><p><br></p>");

    typeText("```");
    expect(editor().innerHTML).toBe("<hr><pre><code><br></code></pre>");
  });

  it("makes inline code of `code`, the text after it no code", () => {
    render(
      <RichTextEditor
        defaultValue="<p>Run x</p>"
        label="Note"
        toolbar={EVERY_TOOL}
      />,
    );

    selectText("Run x", undefined, 5);
    typeText(" `npm test`");
    expect(editor().innerHTML).toBe("<p>Run x <code>npm test</code></p>");
    expect(tool("Code")).toHaveAttribute("aria-pressed", "false");

    typeText(" now");
    expect(editor().innerHTML).toBe("<p>Run x <code>npm test</code> now</p>");

    // Nothing of empty backticks
    typeText(" ``");
    expect(editor().innerHTML).toBe(
      "<p>Run x <code>npm test</code> now ``</p>",
    );
  });

  it("formats only by the tools of the toolbar, and only paragraphs", () => {
    const { unmount } = render(
      <RichTextEditor
        defaultValue="<p>Title</p>"
        label="Note"
        toolbar={["bold", "heading3"]}
      />,
    );
    selectText("Title");
    typeText("# ");
    expect(editor().innerHTML).toBe("<p># Title</p>");
    unmount();

    render(
      <RichTextEditor
        defaultValue="<ul><li>Item</li></ul><h3>Head</h3>"
        label="Note"
      />,
    );
    selectText("Item");
    typeText("# ");
    selectText("Head");
    typeText("- ");
    expect(editor().innerHTML).toBe("<ul><li># Item</li></ul><h3>- Head</h3>");
  });

  it("formats nothing with autoformat off", () => {
    render(
      <RichTextEditor
        autoformat={false}
        defaultValue="<p>Title</p>"
        label="Note"
        toolbar={EVERY_TOOL}
      />,
    );

    selectText("Title");
    typeText("# `a` ");
    expect(editor().innerHTML).toBe("<p># `a` Title</p>");
  });
});

describe("RichTextEditor code blocks", () => {
  it("makes the selected lines a code block of plain text", async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>npm <b>install</b></p><p>npm test</p>"
        label="Note"
        onChange={onChange}
        toolbar={EVERY_TOOL}
      />,
    );

    selectText("npm", "test");
    await user.click(tool("Code block"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<pre><code>npm install<br>npm test</code></pre>",
    );
    expect(tool("Code block")).toHaveAttribute("aria-pressed", "true");
    // Plain text - no marks, links or images in it
    for (const name of ["Bold", "Code", "Link", "Image"]) {
      expect(tool(name)).toHaveAttribute("aria-disabled", "true");
    }
    expect(fireEvent.keyDown(editor(), { ctrlKey: true, key: "b" })).toBe(
      false,
    );
    expect(beforeInput("formatItalic")).toBe(false);
    expect(execCommand).not.toHaveBeenCalledWith("bold", false, undefined);

    await user.click(tool("Code block"));
    expect(onChange).toHaveBeenLastCalledWith(
      "<p>npm install</p><p>npm test</p>",
    );
  });

  it("breaks lines by Enter and leaves by Enter on the empty last line", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<pre><code>a</code></pre>"
        label="Note"
        toolbar={EVERY_TOOL}
      />,
    );

    selectText("a", undefined, 1);
    expect(beforeInput("insertParagraph")).toBe(false);
    expect(execCommand).toHaveBeenCalledWith(
      "insertLineBreak",
      false,
      undefined,
    );

    // The line break the browser made
    const code = editor().querySelector("code") as HTMLElement;
    code.innerHTML = "a<br><br>";
    caretIn(code, 2);
    expect(beforeInput("insertParagraph")).toBe(false);
    expect(editor().innerHTML).toBe("<pre><code>a</code></pre><p><br></p>");
    expect(document.getSelection()?.anchorNode).toBe(editor().lastChild);
  });

  it("leaves the last code block by the arrow keys", () => {
    render(
      <RichTextEditor
        defaultValue="<pre><code>a</code></pre>"
        label="Note"
        toolbar={EVERY_TOOL}
      />,
    );

    selectText("a", undefined, 1);
    expect(fireEvent.keyDown(editor(), { key: "ArrowDown" })).toBe(false);
    expect(editor().innerHTML).toBe("<pre><code>a</code></pre><p><br></p>");
  });

  it("pastes the lines of plain text into a code block", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<pre><code>a</code></pre>"
        label="Note"
        toolbar={EVERY_TOOL}
      />,
    );

    selectText("a", undefined, 1);
    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html" ? "<b>x</b><p>y</p>" : "<x>\ny",
      },
    });
    expect(execCommand).toHaveBeenLastCalledWith(
      "insertHTML",
      false,
      "&lt;x&gt;<br>y",
    );

    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html" ? '<b>x</b><p>y<img src="/a.png"></p>' : "",
      },
    });
    expect(execCommand).toHaveBeenLastCalledWith("insertHTML", false, "x<br>y");
  });
});

describe("RichTextEditor images", () => {
  it.each([
    { finishHidden: false, fails: false },
    { finishHidden: true, fails: false },
    { finishHidden: false, fails: true },
    { finishHidden: true, fails: true },
  ])(
    "settles image uploads across Activity hiding: %o",
    async ({ finishHidden, fails }) => {
      let resolve: (url: string) => void = () => {};
      let reject: (error: Error) => void = () => {};
      const signals: AbortSignal[] = [];
      const uploadImage = vi.fn(
        (_: File, { signal }: { signal: AbortSignal }) => {
          signals.push(signal);
          return new Promise<string>((done, fail) => {
            resolve = done;
            reject = fail;
          });
        },
      );
      const onChange = vi.fn();
      const revokeObjectURL = vi.fn();
      class PreviewURL extends URL {
        static createObjectURL = () => "blob:shot.png";
        static revokeObjectURL = revokeObjectURL;
      }
      vi.stubGlobal("URL", PreviewURL);
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <Activity mode={mode}>
            <form aria-label="Order">
              <RichTextEditor
                defaultValue="<p>Shot</p>"
                label="Note"
                name="note"
                onChange={onChange}
                toolbar={[...IMAGE_TOOLS, "undo"]}
                uploadImage={uploadImage}
              />
            </form>
          </Activity>
        </StrictMode>
      );
      const { rerender, unmount } = render(view("visible"));
      try {
        const form = screen.getByRole<HTMLFormElement>("form", {
          name: "Order",
        });
        selectText("Shot", undefined, 4);
        fireEvent.paste(editor(), {
          clipboardData: {
            files: [new File(["png"], "shot.png", { type: "image/png" })],
            getData: () => "",
          },
        });
        expect(form.checkValidity()).toBe(false);
        rerender(view("hidden"));
        expect(signals[0].aborted).toBe(false);
        expect(revokeObjectURL).not.toHaveBeenCalled();
        if (!finishHidden) await act(async () => rerender(view("visible")));
        await act(async () => {
          if (fails) reject(new Error("Upload failed"));
          else resolve("/shot.png");
        });
        if (finishHidden) {
          // The hidden form must not submit before its settled placeholder
          // has been applied to the submitted content on reveal.
          expect(form.checkValidity()).toBe(false);
          await act(async () => rerender(view("visible")));
        }

        expect(form.checkValidity()).toBe(true);
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(editor().querySelector("img[data-upload]")).toBeNull();
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:shot.png",
        );
        if (fails) {
          expect(editor().innerHTML).toBe("<p>Shot</p>");
          expect(new FormData(form).get("note")).toBe("<p>Shot</p>");
          expect(screen.getByRole("alert")).toHaveTextContent(
            "The image could not be uploaded.",
          );
        } else {
          const value = '<p>Shot<img src="/shot.png" alt=""></p>';
          expect(new FormData(form).get("note")).toBe(value);
          expect(onChange).toHaveBeenCalledExactlyOnceWith(value);
          undoKey();
          expect(editor().querySelector("img")).toBeNull();
          fireEvent.keyDown(editor(), { ctrlKey: true, key: "y" });
          expect(editor().querySelector("img")).toHaveAttribute(
            "src",
            "/shot.png",
          );
          expect(editor().querySelector("img[data-upload]")).toBeNull();
        }
        await act(async () => unmount());
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      } finally {
        await act(async () => unmount());
        vi.unstubAllGlobals();
      }
    },
  );

  it.each([
    { emptyDefault: false, rejects: false },
    { emptyDefault: false, rejects: true },
    { emptyDefault: true, rejects: false },
    { emptyDefault: true, rejects: true },
  ])(
    "clears a hidden upload's blocker on reset while preserving required validity: %o",
    async ({ emptyDefault, rejects }) => {
      let resolve: (url: string) => void = () => {};
      let reject: (error: Error) => void = () => {};
      let signal!: AbortSignal;
      const uploadImage = (_: File, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return new Promise<string>((done, fail) => {
          resolve = done;
          reject = fail;
        });
      };
      const onChange = vi.fn();
      const defaultValue = emptyDefault ? "" : "<p>Shot</p>";
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <form aria-label="Order">
            <Activity mode={mode}>
              <RichTextEditor
                defaultValue={defaultValue}
                label="Note"
                name="note"
                onChange={onChange}
                required
                toolbar={IMAGE_TOOLS}
                uploadImage={uploadImage}
              />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      if (emptyDefault) {
        editor().innerHTML = "<p>Shot</p>";
        fireEvent.input(editor());
      }
      selectText("Shot", undefined, 4);
      fireEvent.paste(editor(), {
        clipboardData: {
          files: [new File(["png"], "shot.png", { type: "image/png" })],
          getData: () => "",
        },
      });
      onChange.mockClear();
      expect(form.checkValidity()).toBe(false);
      rerender(view("hidden"));

      await act(async () => {
        form.reset();
        await new Promise((done) => setTimeout(done, 10));
      });

      expect(signal.aborted).toBe(true);
      expect(form.checkValidity()).toBe(!emptyDefault);
      expect(new FormData(form).get("note")).toBe(defaultValue);
      expect(
        form.querySelector<HTMLInputElement>("input[aria-hidden]")?.validity
          .customError,
      ).toBe(false);
      await act(async () => {
        if (rejects) reject(new Error("Late failure"));
        else resolve("/shot.png");
      });
      expect(form.checkValidity()).toBe(!emptyDefault);
      expect(onChange).not.toHaveBeenCalled();
      rerender(view("visible"));
      expect(editor()).not.toHaveAttribute("aria-busy");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(editor().innerHTML).toBe(defaultValue);
    },
  );

  it("aborts uploads and releases previews when a hidden Activity unmounts", async () => {
    const signals: AbortSignal[] = [];
    const uploadImage = vi.fn(
      (_: File, { signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise<string>(() => {});
      },
    );
    const revokeObjectURL = vi.fn();
    class PreviewURL extends URL {
      static createObjectURL = () => "blob:shot.png";
      static revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal("URL", PreviewURL);
    const view = (mode: "hidden" | "visible") => (
      <Activity mode={mode}>
        <RichTextEditor
          label="Note"
          toolbar={IMAGE_TOOLS}
          uploadImage={uploadImage}
        />
      </Activity>
    );
    const { rerender, unmount } = render(view("visible"));
    try {
      fireEvent.paste(editor(), {
        clipboardData: {
          files: [new File(["png"], "shot.png", { type: "image/png" })],
          getData: () => "",
        },
      });
      rerender(view("hidden"));
      expect(signals[0].aborted).toBe(false);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      await act(async () => unmount());
      expect(signals[0].aborted).toBe(true);
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:shot.png");
    } finally {
      await act(async () => unmount());
      vi.unstubAllGlobals();
    }
  });

  it.each([
    { replacement: "<p>New content</p>", rejects: false },
    { replacement: "<p>New content</p>", rejects: true },
    { replacement: "", rejects: false },
  ])(
    "discards a hidden upload when its controlled content is replaced: %o",
    async ({ replacement, rejects }) => {
      let resolve!: (url: string) => void;
      let reject!: (error: Error) => void;
      let signal!: AbortSignal;
      const onChange = vi.fn();
      const revokeObjectURL = vi.fn();
      class PreviewURL extends URL {
        static createObjectURL = () => "blob:shot.png";
        static revokeObjectURL = revokeObjectURL;
      }
      vi.stubGlobal("URL", PreviewURL);
      function Page({
        mode,
        replacement,
      }: {
        mode: "hidden" | "visible";
        replacement?: string;
      }) {
        const [value, setValue] = useState("<p>Shot</p>");
        const [aborted, setAborted] = useState(false);
        return (
          <StrictMode>
            <form aria-label="Order">
              <Activity mode={mode}>
                <RichTextEditor
                  label="Note"
                  name="note"
                  onChange={(next) => {
                    onChange(next);
                    setValue(next);
                  }}
                  required
                  toolbar={[...IMAGE_TOOLS, "undo"]}
                  uploadImage={(_, options) => {
                    signal = options.signal;
                    signal.addEventListener("abort", () => setAborted(true));
                    return new Promise<string>((done, fail) => {
                      resolve = done;
                      reject = fail;
                    });
                  }}
                  value={replacement ?? value}
                />
              </Activity>
              <output aria-label="Upload aborted">{String(aborted)}</output>
            </form>
          </StrictMode>
        );
      }
      const { rerender, unmount } = render(<Page mode="visible" />);
      try {
        const form = screen.getByRole<HTMLFormElement>("form", {
          name: "Order",
        });
        selectText("Shot", undefined, 4);
        fireEvent.paste(editor(), {
          clipboardData: {
            files: [new File(["png"], "shot.png", { type: "image/png" })],
            getData: () => "",
          },
        });
        expect(form.checkValidity()).toBe(false);
        await act(async () => rerender(<Page mode="hidden" />));
        expect(signal.aborted).toBe(false);
        await act(async () =>
          rerender(<Page mode="hidden" replacement={replacement} />),
        );
        expect(signal.aborted).toBe(true);
        expect(screen.getByLabelText("Upload aborted")).toHaveTextContent(
          "true",
        );
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:shot.png",
        );
        expect(new FormData(form).get("note")).toBe(replacement);
        expect(form.checkValidity()).toBe(replacement !== "");
        expect(
          form.querySelector<HTMLInputElement>("input[aria-hidden]")?.validity
            .customError,
        ).toBe(false);
        await act(async () => {
          if (rejects) reject(new Error("Obsolete upload"));
          else resolve("/old.png");
        });
        expect(new FormData(form).get("note")).toBe(replacement);
        expect(onChange).not.toHaveBeenCalled();
        rerender(<Page mode="visible" replacement={replacement} />);
        expect(editor().innerHTML).toBe(replacement);
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");
      } finally {
        await act(async () => unmount());
        vi.unstubAllGlobals();
      }
    },
  );

  it.each(["pending", "resolved", "rejected"] as const)(
    "discards a hidden upload when image formatting is removed (%s)",
    async (completion) => {
      let resolve!: (url: string) => void;
      let reject!: (error: Error) => void;
      let signal!: AbortSignal;
      const onChange = vi.fn();
      const uploadImage = (_: File, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return new Promise<string>((done, fail) => {
          resolve = done;
          reject = fail;
        });
      };
      const view = (mode: "hidden" | "visible", images = true) => (
        <StrictMode>
          <form aria-label="Order">
            <Activity mode={mode}>
              <RichTextEditor
                label="Note"
                name="note"
                onChange={onChange}
                toolbar={images ? IMAGE_TOOLS : ["bold"]}
                uploadImage={uploadImage}
                value="<p>Shot</p>"
              />
            </Activity>
          </form>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      selectText("Shot", undefined, 4);
      fireEvent.paste(editor(), {
        clipboardData: {
          files: [new File(["png"], "shot.png", { type: "image/png" })],
          getData: () => "",
        },
      });
      rerender(view("hidden"));
      if (completion !== "pending") {
        await act(async () => {
          if (completion === "resolved") resolve("/old.png");
          else reject(new Error("Upload failed"));
        });
      }
      await act(async () => rerender(view("hidden", false)));
      expect(signal.aborted).toBe(true);
      expect(form.checkValidity()).toBe(true);
      expect(new FormData(form).get("note")).toBe("<p>Shot</p>");
      await act(async () => resolve("/old.png"));
      rerender(view("visible", false));
      expect(editor().innerHTML).toBe("<p>Shot</p>");
      expect(editor()).not.toHaveAttribute("aria-busy");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "settles a hidden upload with controlled content (replaced: %s)",
    async (replaced) => {
      let resolve: (url: string) => void = () => {};
      const uploadImage = () =>
        new Promise<string>((done) => {
          resolve = done;
        });
      const onChange = vi.fn();
      function Page({
        mode,
        replacement,
      }: {
        mode: "hidden" | "visible";
        replacement?: string;
      }) {
        const [value, setValue] = useState("<p>Shot</p>");
        return (
          <StrictMode>
            <Activity mode={mode}>
              <form aria-label="Order">
                <RichTextEditor
                  label="Note"
                  name="note"
                  onChange={(next) => {
                    onChange(next);
                    setValue(next);
                  }}
                  toolbar={IMAGE_TOOLS}
                  uploadImage={uploadImage}
                  value={replacement ?? value}
                />
              </form>
            </Activity>
          </StrictMode>
        );
      }
      const { rerender } = render(<Page mode="visible" />);
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      selectText("Shot", undefined, 4);
      fireEvent.paste(editor(), {
        clipboardData: {
          files: [new File(["png"], "shot.png", { type: "image/png" })],
          getData: () => "",
        },
      });
      const replacement = replaced ? "<p>New content</p>" : undefined;
      rerender(<Page mode="hidden" replacement={replacement} />);
      await act(async () => resolve("/shot.png"));
      await act(async () =>
        rerender(<Page mode="visible" replacement={replacement} />),
      );
      expect(form.checkValidity()).toBe(true);
      const expected = replacement ?? '<p>Shot<img src="/shot.png" alt=""></p>';
      expect(new FormData(form).get("note")).toBe(expected);
      expect(editor().querySelector("img[data-upload]")).toBeNull();
      if (replaced) {
        expect(editor().innerHTML).toBe(expected);
        expect(onChange).not.toHaveBeenCalled();
      } else {
        expect(editor().querySelector("img")).toHaveAttribute(
          "src",
          "/shot.png",
        );
        expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
      }
    },
  );

  it("lets abort listeners update their owner after the editor unmounts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function Page({ visible }: { visible: boolean }) {
      const [aborted, setAborted] = useState(false);
      return (
        <>
          {visible && (
            <RichTextEditor
              label="Note"
              toolbar={IMAGE_TOOLS}
              uploadImage={(_, { signal }) => {
                signal.addEventListener("abort", () => setAborted(true));
                return new Promise<string>(() => {});
              }}
            />
          )}
          <output>{aborted ? "Cancelled" : "Pending"}</output>
        </>
      );
    }
    const { rerender } = render(<Page visible />);
    fireEvent.paste(editor(), {
      clipboardData: {
        files: [new File(["png"], "shot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    await act(async () => rerender(<Page visible={false} />));
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled");
    expect(error).not.toHaveBeenCalled();
  });

  it("inserts an image by its URL and alternative text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue="<p>Chart: </p>"
        label="Note"
        onChange={onChange}
        toolbar={IMAGE_TOOLS}
      />,
    );

    selectText("Chart", undefined, 7);
    await user.click(tool("Image"));
    expect(tool("Image")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Image" })).toBeVisible();
    // No upload without `uploadImage`
    expect(
      screen.queryByRole("button", { name: "Upload from device" }),
    ).toBeNull();

    const url = screen.getByRole("textbox", { name: "Image URL" });
    expect(url).toHaveFocus();
    await user.type(url, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(url);
    // A host gets `https://`
    await user.type(url, "cdn.example.com/chart.png");
    await user.type(
      screen.getByRole("textbox", { name: "Alternative text" }),
      "Sales in 2026{Enter}",
    );
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>Chart: <img src="https://cdn.example.com/chart.png" alt="Sales in 2026"></p>',
    );
    expect(screen.queryByRole("group", { name: "Image" })).toBeNull();
    expect(editor()).toHaveFocus();
  });

  it("edits the alternative text of the selected image, and removes it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        defaultValue='<p>A <img src="/a.png" alt="Old"> B</p>'
        label="Note"
        onChange={onChange}
        toolbar={IMAGE_TOOLS}
      />,
    );
    const image = () => editor().querySelector("img") as HTMLImageElement;

    await user.click(image());
    await user.click(tool("Image"));
    const alt = screen.getByRole("textbox", { name: "Alternative text" });
    expect(alt).toHaveValue("Old");
    expect(alt).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Image URL" })).toHaveValue(
      "/a.png",
    );

    await user.clear(alt);
    await user.type(alt, "New{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>A <img src="/a.png" alt="New"> B</p>',
    );

    await user.click(image());
    await user.click(tool("Image"));
    await user.click(screen.getByRole("button", { name: "Remove image" }));
    expect(onChange).toHaveBeenLastCalledWith("<p>A  B</p>");
  });

  it("keeps the images of a loaded value only with the image tool", () => {
    const html =
      '<p>A<img src="/a.png" alt="A" onerror="steal()"><img src="data:image/png;base64,AAAA"></p>';
    const { rerender } = render(
      <RichTextEditor defaultValue={html} label="Note" toolbar={IMAGE_TOOLS} />,
    );
    expect(editor().innerHTML).toBe('<p>A<img src="/a.png" alt="A"></p>');

    rerender(
      <RichTextEditor
        allowImageDataUrls
        defaultValue={html}
        label="Note"
        toolbar={IMAGE_TOOLS}
      />,
    );
    expect(editor().innerHTML).toBe(
      '<p>A<img src="/a.png" alt="A"><img src="data:image/png;base64,AAAA"></p>',
    );

    rerender(<RichTextEditor defaultValue={html} label="Note" />);
    expect(editor().innerHTML).toBe("<p>A</p>");
  });

  it("submits a value of an image alone", () => {
    render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue='<p><img src="/a.png" alt=""></p>'
          label="Note"
          name="note"
          required
          toolbar={IMAGE_TOOLS}
        />
      </form>,
    );

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("note")).toBe(
      '<p><img src="/a.png" alt=""></p>',
    );
  });

  it("uploads a pasted image file with a placeholder until its URL comes", async () => {
    let resolve: (url: string) => void = () => {};
    const uploadImage = vi.fn(
      () => new Promise<string>((done) => (resolve = done)),
    );
    const onChange = vi.fn();
    render(
      <form data-testid="form">
        <RichTextEditor
          defaultValue="<p>Shot: </p>"
          label="Note"
          name="note"
          onChange={onChange}
          toolbar={IMAGE_TOOLS}
          uploadImage={uploadImage}
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const file = new File(["png"], "shot.png", { type: "image/png" });

    selectText("Shot", undefined, 6);
    // A copied image - its file and HTML without text
    fireEvent.paste(editor(), {
      clipboardData: {
        files: [file],
        getData: (type: string) =>
          type === "text/html" ? '<img src="https://example.com/x.png">' : "",
      },
    });

    expect(uploadImage).toHaveBeenCalledWith(file, {
      signal: expect.any(AbortSignal),
    });
    expect(editor().querySelector("img[data-upload]")).not.toBeNull();
    expect(editor()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Uploading the image…")).toHaveAttribute(
      "role",
      "status",
    );
    // Not in the value, and the form waits for it
    expect(new FormData(form).get("note")).toBe("<p>Shot: </p>");
    expect(form.checkValidity()).toBe(false);

    await act(async () => resolve("https://cdn.example.com/shot.png"));
    expect(editor().querySelector("img[data-upload]")).toBeNull();
    const value =
      '<p>Shot: <img src="https://cdn.example.com/shot.png" alt=""></p>';
    expect(onChange).toHaveBeenLastCalledWith(value);
    expect(new FormData(form).get("note")).toBe(value);
    expect(form.checkValidity()).toBe(true);
    expect(editor()).not.toHaveAttribute("aria-busy");

    // One undo takes the image out, a redo brings it back uploaded
    undoKey();
    expect(onChange).toHaveBeenLastCalledWith("<p>Shot: </p>");
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "y" });
    expect(onChange).toHaveBeenLastCalledWith(value);
    expect(editor().querySelector("img[data-upload]")).toBeNull();
  });

  it("uploads a pasted picture whose HTML has styles and a title", () => {
    const uploadImage = vi.fn(() => new Promise<string>(() => {}));
    render(
      <RichTextEditor
        label="Note"
        toolbar={IMAGE_TOOLS}
        uploadImage={uploadImage}
      />,
    );
    const file = new File(["png"], "image.png", { type: "image/png" });

    // A picture copied in Word - its text is that of the styles, never kept
    fireEvent.paste(editor(), {
      clipboardData: {
        files: [file],
        getData: (type: string) =>
          type === "text/html"
            ? "<html><head><style>p.MsoNormal{margin:0cm}</style><title>Doc</title></head>" +
              '<body><img src="file:///C:/Temp/clip_image001.png"></body></html>'
            : "",
      },
    });

    expect(uploadImage).toHaveBeenCalledWith(file, {
      signal: expect.any(AbortSignal),
    });
    expect(editor().querySelector("img[data-upload]")).not.toBeNull();
  });

  it("tells a failed upload and takes its placeholder away", async () => {
    let reject: (reason: unknown) => void = () => {};
    let resolve: (url: string) => void = () => {};
    const uploadImage = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<string>((_, fail) => (reject = fail)),
      )
      .mockImplementationOnce(
        () => new Promise<string>((done) => (resolve = done)),
      );
    render(
      <RichTextEditor
        defaultValue="<p>Shot</p>"
        label="Note"
        toolbar={IMAGE_TOOLS}
        uploadImage={uploadImage}
      />,
    );
    const file = new File(["png"], "shot.png", { type: "image/png" });
    const paste = () =>
      fireEvent.paste(editor(), {
        clipboardData: { files: [file], getData: () => "" },
      });

    selectText("Shot", undefined, 4);
    paste();
    await act(async () => reject(new Error("Too big")));
    expect(editor().innerHTML).toBe("<p>Shot</p>");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The image could not be uploaded.",
    );

    // A URL that is no safe image source fails too
    selectText("Shot", undefined, 4);
    paste();
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => resolve("javascript:alert(1)"));
    expect(editor().querySelector("img")).toBeNull();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it.each([false, true])(
    "discards uploads on form reset and ignores their late results, controlled: %s",
    async (controlled) => {
      const pending: {
        resolve: (url: string) => void;
        signal: AbortSignal;
      }[] = [];
      const uploadImage = vi.fn(
        (_: File, { signal }: { signal: AbortSignal }) =>
          new Promise<string>((resolve) => pending.push({ resolve, signal })),
      );
      const onChange = vi.fn();
      const revokeObjectURL = vi.fn();
      class PreviewURL extends URL {
        static createObjectURL = vi.fn<typeof URL.createObjectURL>(
          (file) => `blob:${(file as File).name}`,
        );
        static revokeObjectURL = revokeObjectURL;
      }
      vi.stubGlobal("URL", PreviewURL);
      function Form() {
        const [html, setHtml] = useState("<p>Shot</p>");
        return (
          <form data-testid="form">
            <RichTextEditor
              defaultValue="<p>Shot</p>"
              label="Note"
              name="note"
              onChange={(next) => {
                setHtml(next);
                onChange(next);
              }}
              toolbar={[...IMAGE_TOOLS, "undo"]}
              uploadImage={uploadImage}
              value={controlled ? html : undefined}
            />
          </form>
        );
      }
      const { unmount } = render(<Form />);
      try {
        const form = screen.getByTestId("form") as HTMLFormElement;
        const paste = (name: string) => {
          selectText("Shot", undefined, 4);
          fireEvent.paste(editor(), {
            clipboardData: {
              files: [new File(["png"], name, { type: "image/png" })],
              getData: () => "",
            },
          });
        };
        paste("old.png");
        expect(form.checkValidity()).toBe(false);
        expect(editor().querySelector("img[data-upload]")).not.toBeNull();

        await act(async () => form.reset());
        await waitFor(() => expect(pending[0].signal.aborted).toBe(true));
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:old.png");
        expect(editor().innerHTML).toBe("<p>Shot</p>");
        expect(new FormData(form).get("note")).toBe("<p>Shot</p>");
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(form.checkValidity()).toBe(true);
        expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");

        paste("new.png");
        await act(async () => pending[0].resolve("/old.png"));
        expect(onChange).not.toHaveBeenCalled();
        expect(editor()).toHaveAttribute("aria-busy", "true");
        expect(editor().querySelector("img[data-upload]")).toHaveAttribute(
          "src",
          "blob:new.png",
        );
        expect(form.checkValidity()).toBe(false);
        expect(pending[1].signal.aborted).toBe(false);
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);

        await act(async () => pending[1].resolve("/new.png"));
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(form.checkValidity()).toBe(true);
        expect(new FormData(form).get("note")).toBe(
          '<p>Shot<img src="/new.png" alt=""></p>',
        );
        expect(onChange).toHaveBeenCalledExactlyOnceWith(
          '<p>Shot<img src="/new.png" alt=""></p>',
        );
        expect(revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:new.png");

        unmount();
        expect(revokeObjectURL).toHaveBeenCalledTimes(2);
      } finally {
        unmount();
        vi.unstubAllGlobals();
      }
    },
  );

  it("clears upload failures on reset and ignores a discarded upload rejecting", async () => {
    let reject: (error: Error) => void = () => {};
    const uploadImage = vi.fn(
      () => new Promise<string>((_, fail) => (reject = fail)),
    );
    render(
      <form data-testid="form">
        <RichTextEditor
          label="Note"
          toolbar={IMAGE_TOOLS}
          uploadImage={uploadImage}
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const paste = () =>
      fireEvent.paste(editor(), {
        clipboardData: {
          files: [new File(["png"], "shot.png", { type: "image/png" })],
          getData: () => "",
        },
      });
    paste();
    await act(async () => reject(new Error("Upload failed")));
    expect(screen.getByRole("alert")).toBeVisible();

    await act(async () => form.reset());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    paste();
    await act(async () => form.reset());
    await waitFor(() => expect(editor()).not.toHaveAttribute("aria-busy"));
    await act(async () => reject(new Error("Upload failed after reset")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(editor()).not.toHaveAttribute("aria-busy");
    expect(form.checkValidity()).toBe(true);
  });

  it.each([false, true])(
    "discards uploads when controlled content is replaced and ignores their late results (rejects: %s)",
    async (rejects) => {
      const pending: {
        reject: (error: Error) => void;
        resolve: (url: string) => void;
        signal: AbortSignal;
      }[] = [];
      const uploadImage = vi.fn(
        (_: File, { signal }: { signal: AbortSignal }) =>
          new Promise<string>((resolve, reject) =>
            pending.push({ reject, resolve, signal }),
          ),
      );
      const onChange = vi.fn();
      const revokeObjectURL = vi.fn();
      class PreviewURL extends URL {
        static createObjectURL = vi.fn<typeof URL.createObjectURL>(
          (file) => `blob:${(file as File).name}`,
        );
        static revokeObjectURL = revokeObjectURL;
      }
      vi.stubGlobal("URL", PreviewURL);
      function Form() {
        const [html, setHtml] = useState("<p>Shot</p>");
        return (
          <form data-testid="form">
            <RichTextEditor
              label="Note"
              name="note"
              onChange={(next) => {
                setHtml(next);
                onChange(next);
              }}
              toolbar={[...IMAGE_TOOLS, "undo"]}
              uploadImage={uploadImage}
              value={html}
            />
            <button onClick={() => setHtml("<p>Template</p>")} type="button">
              Load
            </button>
          </form>
        );
      }
      const { unmount } = render(<Form />);
      try {
        const form = screen.getByTestId("form") as HTMLFormElement;
        const paste = (text: string, name: string) => {
          selectText(text, undefined, text.length);
          fireEvent.paste(editor(), {
            clipboardData: {
              files: [new File(["png"], name, { type: "image/png" })],
              getData: () => "",
            },
          });
        };
        paste("Shot", "old.png");
        expect(form.checkValidity()).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Load" }));
        expect(pending[0].signal.aborted).toBe(true);
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:old.png");
        expect(editor().innerHTML).toBe("<p>Template</p>");
        expect(new FormData(form).get("note")).toBe("<p>Template</p>");
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(form.checkValidity()).toBe(true);
        expect(tool("Undo")).toHaveAttribute("aria-disabled", "true");

        paste("Template", "new.png");
        await act(async () => {
          if (rejects) pending[0].reject(new Error("Obsolete failure"));
          else pending[0].resolve("/old.png");
        });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).toBeNull();
        expect(editor()).toHaveAttribute("aria-busy", "true");
        expect(editor().querySelector("img[data-upload]")).toHaveAttribute(
          "src",
          "blob:new.png",
        );
        expect(form.checkValidity()).toBe(false);
        expect(pending[1].signal.aborted).toBe(false);
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);

        await act(async () => pending[1].resolve("/new.png"));
        expect(form.checkValidity()).toBe(true);
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(new FormData(form).get("note")).toBe(
          '<p>Template<img src="/new.png" alt=""></p>',
        );
        expect(onChange).toHaveBeenCalledExactlyOnceWith(
          '<p>Template<img src="/new.png" alt=""></p>',
        );
        expect(revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:new.png");

        unmount();
        expect(revokeObjectURL).toHaveBeenCalledTimes(2);
      } finally {
        unmount();
        vi.unstubAllGlobals();
      }
    },
  );

  it("keeps pending uploads through accepted controlled edits and undo or redo", async () => {
    let resolve: (url: string) => void = () => {};
    let signal: AbortSignal | undefined;
    const uploadImage = vi.fn((_: File, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise<string>((done) => (resolve = done));
    });
    function Controlled() {
      const [html, setHtml] = useState("<p>Shot</p>");
      return (
        <RichTextEditor
          label="Note"
          onChange={setHtml}
          toolbar={[...IMAGE_TOOLS, "undo", "redo"]}
          uploadImage={uploadImage}
          value={html}
        />
      );
    }
    render(<Controlled />);
    selectText("Shot", undefined, 4);
    fireEvent.paste(editor(), {
      clipboardData: {
        files: [new File(["png"], "shot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    textNode("Shot").data = "Changed";
    fireEvent.input(editor(), { inputType: "insertText" });
    expect(editor().querySelector("img[data-upload]")).not.toBeNull();
    expect(signal?.aborted).toBe(false);

    undoKey();
    expect(editor()).toHaveTextContent("Shot");
    expect(editor().querySelector("img[data-upload]")).not.toBeNull();
    undoKey();
    expect(editor().querySelector("img[data-upload]")).toBeNull();
    expect(editor()).toHaveAttribute("aria-busy", "true");
    expect(signal?.aborted).toBe(false);
    fireEvent.keyDown(editor(), { ctrlKey: true, key: "y" });
    expect(editor().querySelector("img[data-upload]")).not.toBeNull();

    await act(async () => resolve("/shot.png"));
    expect(editor().querySelector("img[data-upload]")).toBeNull();
    expect(editor().querySelector("img")).toHaveAttribute("src", "/shot.png");
    expect(editor()).not.toHaveAttribute("aria-busy");
  });

  it("clears a previous upload failure when controlled content is replaced", async () => {
    const field = (value: string) => (
      <RichTextEditor
        label="Note"
        toolbar={IMAGE_TOOLS}
        uploadImage={async () => {
          throw new Error("Upload failed");
        }}
        value={value}
      />
    );
    const { rerender } = render(field("<p>Shot</p>"));
    selectText("Shot", undefined, 4);
    fireEvent.paste(editor(), {
      clipboardData: {
        files: [new File(["png"], "shot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    expect(await screen.findByRole("alert")).toBeVisible();
    rerender(field("<p>Template</p>"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([false, true])(
    "recovers from a synchronous upload failure, with another file: %s",
    async (withAnotherFile) => {
      let resolve: (url: string) => void = () => {};
      const failed = new File(["png"], "bad.png", { type: "image/png" });
      const next = new File(["png"], "good.png", { type: "image/png" });
      const uploadImage = vi.fn((file: File): Promise<string> => {
        if (file === failed) throw new Error("Too big");
        return new Promise<string>((done) => (resolve = done));
      });
      render(
        <form data-testid="form">
          <RichTextEditor
            defaultValue="<p>Shot</p>"
            label="Note"
            name="note"
            toolbar={IMAGE_TOOLS}
            uploadImage={uploadImage}
          />
        </form>,
      );
      const form = screen.getByTestId("form") as HTMLFormElement;
      const paste = (files: File[]) =>
        fireEvent.paste(editor(), {
          clipboardData: { files, getData: () => "" },
        });

      selectText("Shot", undefined, 4);
      await act(async () => paste(withAnotherFile ? [failed, next] : [failed]));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The image could not be uploaded.",
      );
      expect(uploadImage).toHaveBeenCalledTimes(withAnotherFile ? 2 : 1);
      expect(new FormData(form).get("note")).toBe("<p>Shot</p>");

      if (!withAnotherFile) {
        expect(editor()).not.toHaveAttribute("aria-busy");
        expect(editor().querySelector("img")).toBeNull();
        expect(form.checkValidity()).toBe(true);
        // Another attempt still works after the failure.
        selectText("Shot", undefined, 4);
        paste([next]);
      }

      // A failed file leaves the other upload running and validated.
      expect(editor()).toHaveAttribute("aria-busy", "true");
      expect(editor().querySelectorAll("img[data-upload]")).toHaveLength(1);
      expect(form.checkValidity()).toBe(false);
      await act(async () => resolve("/good.png"));
      expect(editor().querySelector("img[data-upload]")).toBeNull();
      expect(editor()).not.toHaveAttribute("aria-busy");
      expect(form.checkValidity()).toBe(true);
      expect(new FormData(form).get("note")).toBe(
        '<p>Shot<img src="/good.png" alt=""></p>',
      );
    },
  );

  it("uploads dropped image files and those picked in the image form", async () => {
    const user = userEvent.setup();
    const uploadImage = vi.fn(async (file: File) => `/uploads/${file.name}`);
    render(
      <RichTextEditor
        defaultValue="<p>Photos</p>"
        label="Note"
        toolbar={IMAGE_TOOLS}
        uploadImage={uploadImage}
      />,
    );

    selectText("Photos", undefined, 6);
    await act(async () => {
      fireEvent.drop(editor(), {
        dataTransfer: {
          files: [
            new File(["a"], "a.png", { type: "image/png" }),
            new File(["x"], "notes.txt", { type: "text/plain" }),
          ],
          getData: () => "",
        },
      });
    });
    expect(editor().innerHTML).toBe(
      '<p>Photos<img alt="" src="/uploads/a.png"></p>',
    );

    await user.click(tool("Image"));
    await user.type(
      screen.getByRole("textbox", { name: "Alternative text" }),
      "Beach",
    );
    await user.click(
      screen.getByRole("button", { name: "Upload from device" }),
    );
    const input = document.querySelector<HTMLInputElement>("input[type=file]");
    expect(input).toHaveAttribute("accept", "image/*");
    await act(async () => {
      await user.upload(
        input as HTMLInputElement,
        new File(["b"], "b.png", { type: "image/png" }),
      );
    });
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(editor().innerHTML).toBe(
      '<p>Photos<img alt="" src="/uploads/a.png"><img alt="Beach" src="/uploads/b.png"></p>',
    );
  });

  it("refuses pasted and dropped image files without uploadImage", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<p>Shot</p>"
        label="Note"
        toolbar={IMAGE_TOOLS}
      />,
    );
    const file = new File(["png"], "shot.png", { type: "image/png" });

    selectText("Shot", undefined, 4);
    expect(
      fireEvent.paste(editor(), {
        clipboardData: { files: [file], getData: () => "" },
      }),
    ).toBe(false);
    expect(
      fireEvent.drop(editor(), {
        dataTransfer: { files: [file], getData: () => "" },
      }),
    ).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
    expect(editor().innerHTML).toBe("<p>Shot</p>");
  });

  it("aborts its uploads when it unmounts", async () => {
    const signals: AbortSignal[] = [];
    const uploadImage = vi.fn(
      (_: File, { signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise<string>(() => {});
      },
    );
    const { unmount } = render(
      <RichTextEditor
        defaultValue="<p>Shot</p>"
        label="Note"
        toolbar={IMAGE_TOOLS}
        uploadImage={uploadImage}
      />,
    );

    selectText("Shot", undefined, 4);
    fireEvent.paste(editor(), {
      clipboardData: {
        files: [new File(["png"], "shot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    expect(signals[0].aborted).toBe(false);

    await act(async () => unmount());
    expect(signals[0].aborted).toBe(true);
  });

  it("keeps the images of pasted content with the image tool", () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <RichTextEditor
        defaultValue="<p>Shot</p>"
        label="Note"
        toolbar={IMAGE_TOOLS}
      />,
    );

    selectText("Shot", undefined, 4);
    fireEvent.paste(editor(), {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? 'x<img src="https://example.com/a.png" onerror="steal()" srcset="javascript:steal()"><img src="javascript:steal()">'
            : "x",
      },
    });
    expect(execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      'x<img src="https://example.com/a.png">',
    );
  });
});

describe("RichTextEditor right to left", () => {
  it("moves in the toolbar by the arrow keys of the direction of the text", async () => {
    mockRightToLeft();
    const user = userEvent.setup();
    render(
      <RichTextEditor label="Note" toolbar={["bold", "italic", "underline"]} />,
    );

    await user.tab();
    expect(tool("Bold")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tool("Italic")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(tool("Underline")).toHaveFocus();
  });

  it("leaves a table forward by the left arrow key", () => {
    mockRightToLeft();
    render(
      <RichTextEditor
        defaultValue="<table><tbody><tr><td>a</td></tr></tbody></table>"
        label="Note"
        toolbar={ALL_TOOLS}
      />,
    );

    selectText("a", undefined, 1);
    expect(fireEvent.keyDown(editor(), { key: "ArrowRight" })).toBe(true);
    expect(fireEvent.keyDown(editor(), { key: "ArrowLeft" })).toBe(false);
    expect(editor().lastElementChild?.outerHTML).toBe("<p><br></p>");
  });
});

describe("RichTextEditor label", () => {
  it("takes content as its label - also the name of its toolbar", () => {
    render(
      <RichTextEditor
        label={
          <>
            Note <em>(public)</em>
          </>
        }
        required
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "Note (public):" }),
    ).toBeVisible();
    expect(
      screen.getByRole("toolbar", { name: "Note (public)" }),
    ).toBeVisible();
  });
});

describe("RichTextEditor with its new props on the server", () => {
  it("hydrates without a mismatch", async () => {
    const element = (
      <RichTextEditor
        defaultValue='<p>Hi <img src="/a.png" alt="A"></p><pre><code>a</code></pre>'
        label="Note"
        maxLength={10}
        maxRows={12}
        minRows={4}
        name="note"
        resize
        showCount
        toolbar={EVERY_TOOL}
        uploadImage={async () => "/a.png"}
      />
    );

    vi.stubGlobal("document", undefined);
    let serverHtml: string;
    try {
      serverHtml = renderToString(element);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(serverHtml).not.toContain("<img");
    expect(serverHtml).toContain("0 / 10");

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error");
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, element, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    // Counted once it is filled in - "Hi " and the code
    expect(screen.getByText("4 / 10")).toBeVisible();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/a.png");

    act(() => root.unmount());
    container.remove();
  });
});
