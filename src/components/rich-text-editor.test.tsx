import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
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
    expect(editor().innerHTML).toBe("<p>Ada</p>");
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

  it("sends no unsanitized HTML and hydrates without a mismatch", async () => {
    // Rendered where there is no DOM to sanitize with
    vi.stubGlobal("document", undefined);
    let serverHtml: string;
    try {
      serverHtml = renderToString(<Form />);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(serverHtml).not.toContain("steal");
    expect(serverHtml).toContain('<input type="hidden" name="note" value=""/>');

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
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
    ["example.com:8080/page", "https://example.com:8080/page"],
    ["localhost:3000", "https://localhost:3000"],
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
      `${typed}{Enter}`,
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
    expect(
      container.querySelector("[role=toolbar][aria-labelledby]"),
    ).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
