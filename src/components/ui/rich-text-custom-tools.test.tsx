import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RichTextEditor from "./rich-text-editor";

describe("RichTextEditor custom tools", () => {
  it("restores selection, sanitizes inserted HTML and exposes the current HTML", () => {
    const click = vi.fn((context) =>
      context.insertHtml(
        '<strong>Yes</strong><script>alert(1)</script><img src="bad" onerror="bad()"/>',
      ),
    );
    document.execCommand = vi.fn(() => true);
    render(
      <RichTextEditor
        additionalFormats={["bold"]}
        customTools={[{ id: "insert", label: "Insert", onClick: click }]}
        defaultValue="<p>Text</p>"
        label="Note"
        toolbar={[]}
      />,
    );
    const editor = screen.getByRole("textbox", { name: /^Note/ });
    const range = document.createRange();
    range.selectNodeContents(editor);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.mouseUp(editor);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Insert" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(click.mock.calls[0][0]).toMatchObject({
      html: "<p>Text</p>",
      selectedText: "Text",
    });
    expect(document.execCommand).toHaveBeenCalledWith(
      "insertHTML",
      false,
      "<strong>Yes</strong>",
    );
  });
  it("supports shortcuts and limits inserted text to maxLength", () => {
    document.execCommand = vi.fn(() => true);
    render(
      <RichTextEditor
        customTools={[
          {
            id: "signature",
            label: "Signature",
            shortcut: "Ctrl+Shift+S",
            onClick: (context) => context.insertText("Hello there"),
          },
        ]}
        defaultValue="<p>Hi</p>"
        label="Note"
        maxLength={5}
        toolbar={[]}
      />,
    );
    const editor = screen.getByRole("textbox", { name: /^Note/ });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.keyDown(editor, { key: "S", ctrlKey: true, shiftKey: true });
    expect(document.execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "Hel",
    );
  });
  it("inserts no HTML where nothing more fits", () => {
    document.execCommand = vi.fn(() => true);
    const onChange = vi.fn();
    render(
      <RichTextEditor
        customTools={[
          {
            id: "insert",
            label: "Insert",
            onClick: (context) =>
              context.insertHtml("<p>Signed</p><ul><li>Team</li></ul>"),
          },
        ]}
        defaultValue="<p>Hello</p>"
        label="Note"
        maxLength={5}
        onChange={onChange}
        toolbar={[]}
      />,
    );
    const editor = screen.getByRole("textbox", { name: /^Note/ });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    // Not even the empty paragraph and list item of a cut at 0 characters
    expect(document.execCommand).not.toHaveBeenCalledWith(
      "insertHTML",
      false,
      expect.anything(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
  it("includes custom tools in roving toolbar navigation and respects disabled/readOnly", () => {
    const click = vi.fn();
    const tools = [
      { id: "first", label: "First", onClick: click },
      { id: "second", label: "Second", onClick: click },
      { id: "disabled", label: "Disabled", disabled: true, onClick: click },
    ];
    const { rerender } = render(
      <RichTextEditor customTools={tools} label="Note" toolbar={[]} />,
    );
    const first = screen.getByRole("button", { name: "First" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Disabled" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    rerender(
      <RichTextEditor customTools={tools} label="Note" readOnly toolbar={[]} />,
    );
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(click).not.toHaveBeenCalled();
  });
});
