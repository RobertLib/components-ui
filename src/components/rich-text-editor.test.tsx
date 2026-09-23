import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RichTextEditor from "./rich-text-editor";

const editor = () => screen.getByRole("textbox", { name: /Note/ });

describe("RichTextEditor", () => {
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
      '<p>Hi <a>bad</a> <a href="https://example.com">ok</a>!</p>',
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
