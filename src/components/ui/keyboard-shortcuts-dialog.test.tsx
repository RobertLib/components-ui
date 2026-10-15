import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog from "./dialog";
import KeyboardShortcutsDialog from "./keyboard-shortcuts-dialog";
import useHotkeys, { type Hotkey } from "../../hooks/use-hotkeys";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/ui/cs";

function Shortcuts({
  enabled,
  hotkeys,
}: {
  enabled?: boolean;
  hotkeys: Hotkey[];
}) {
  useHotkeys(hotkeys, { enabled });
  return null;
}

const noop = () => {};

/** Opens the help with `?` - Shift + the key of a question mark. */
const pressQuestionMark = () =>
  fireEvent.keyDown(document.body, { key: "?", shiftKey: true });

/** The lines of a group of the open help - "action: keys". */
function linesOf(group: string) {
  const section = screen.getByRole("region", { name: group });
  return within(section)
    .getAllByRole("term")
    .map(
      (term) =>
        `${term.textContent}: ${term.nextElementSibling?.textContent ?? ""}`,
    );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KeyboardShortcutsDialog", () => {
  it("opens with ? and lists the described shortcuts in their groups", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Shortcuts
          hotkeys={[
            [
              "mod+s",
              noop,
              { description: "Save the invoice", group: "Invoice" },
            ],
            // Not described - not listed
            ["mod+shift+x", noop],
            ["mod+k", noop, { description: "Search" }],
            ["/", noop, { description: "Search" }],
            ["alt+n", noop, { description: "New line", group: "Invoice" }],
          ]}
        />
        <KeyboardShortcutsDialog />
      </>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pressQuestionMark()).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toBeVisible();

    // The general ones first - with the shortcut of the help itself
    expect(linesOf("General")).toEqual([
      "Search: Ctrl+K or /",
      "Show keyboard shortcuts: ?",
    ]);
    expect(linesOf("Invoice")).toEqual([
      "Save the invoice: Ctrl+S",
      "New line: Alt+N",
    ]);
    expect(within(dialog).queryByText(/Ctrl\+Shift\+X/)).toBeNull();

    // ? closes it again, as Escape does
    await user.keyboard("?");
    expect(screen.queryByRole("dialog")).toBeNull();
    pressQuestionMark();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("writes the shortcuts in the notation of the platform", () => {
    vi.stubGlobal("navigator", { ...navigator, platform: "MacIntel" });
    render(
      <>
        <Shortcuts hotkeys={[["mod+s", noop, { description: "Save" }]]} />
        <KeyboardShortcutsDialog defaultOpen />
      </>,
    );

    expect(linesOf("General")).toContain("Save: ⌘S");
  });

  it("lists only the shortcuts of mounted and enabled hooks", () => {
    function Page() {
      const [mounted, setMounted] = useState(true);
      const [enabled, setEnabled] = useState(true);
      return (
        <>
          <button onClick={() => setMounted(false)} type="button">
            Unmount
          </button>
          <button onClick={() => setEnabled(false)} type="button">
            Disable
          </button>
          {mounted && (
            <Shortcuts hotkeys={[["e", noop, { description: "Edit" }]]} />
          )}
          <Shortcuts
            enabled={enabled}
            hotkeys={[["d", noop, { description: "Duplicate" }]]}
          />
        </>
      );
    }

    render(
      <>
        <Page />
        <KeyboardShortcutsDialog defaultOpen shortcut={null} />
      </>,
    );
    expect(linesOf("General")).toEqual(["Edit: E", "Duplicate: D"]);

    // The page is under the help - clicked as a script would
    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "Unmount" }),
    );
    expect(linesOf("General")).toEqual(["Duplicate: D"]);
    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "Disable" }),
    );
    expect(
      screen.getByText("No keyboard shortcuts are available here."),
    ).toBeInTheDocument();
  });

  it("opens by its state only without a shortcut", () => {
    render(<KeyboardShortcutsDialog shortcut={null} />);

    pressQuestionMark();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("follows the shortcuts registered and unregistered while open", () => {
    function Page() {
      const [extra, setExtra] = useState(false);
      return (
        <>
          <Shortcuts hotkeys={[["e", noop, { description: "Edit" }]]} />
          {extra && (
            <Shortcuts hotkeys={[["d", noop, { description: "Duplicate" }]]} />
          )}
          <KeyboardShortcutsDialog defaultOpen shortcut={null} />
          <button onClick={() => setExtra((value) => !value)} type="button">
            Toggle
          </button>
        </>
      );
    }

    render(<Page />);
    expect(linesOf("General")).toEqual(["Edit: E"]);

    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "Toggle" }),
    );
    expect(linesOf("General")).toEqual(["Edit: E", "Duplicate: D"]);
    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "Toggle" }),
    );
    expect(linesOf("General")).toEqual(["Edit: E"]);
  });

  it("leaves out the shortcuts of a page under a modal dialog", async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Shortcuts
            hotkeys={[["mod+s", noop, { description: "Save the order" }]]}
          />
          <button onClick={() => setOpen(true)} type="button">
            Edit item
          </button>
          <Dialog onClose={() => setOpen(false)} open={open} title="Item">
            <Shortcuts
              hotkeys={[["mod+enter", noop, { description: "Save the item" }]]}
            />
            <HelpButton />
          </Dialog>
        </>
      );
    }

    function HelpButton() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Help
          </button>
          <KeyboardShortcutsDialog
            onOpenChange={setOpen}
            open={open}
            shortcut={null}
          />
        </>
      );
    }

    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole("button", { name: "Edit item" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    // The shortcuts of the dialog work - those of the page under it do not
    expect(linesOf("General")).toEqual(["Save the item: Ctrl+Enter"]);
  });

  it("lists the shortcuts given by the app first in their groups", () => {
    render(
      <>
        <Shortcuts
          hotkeys={[["mod+s", noop, { description: "Save", group: "Table" }]]}
        />
        <KeyboardShortcutsDialog
          defaultOpen
          shortcut={null}
          shortcuts={[
            {
              description: "Move between the cells",
              group: "Table",
              shortcut: ["arrowup", "arrowdown"],
            },
            { description: "Save", group: "Table", shortcut: "Mod+S" },
          ]}
        />
      </>,
    );

    expect(linesOf("Table")).toEqual([
      "Move between the cells: ↑ or ↓",
      // The same shortcut of the same action once
      "Save: Ctrl+S",
    ]);
  });

  it("says so without any shortcut", () => {
    render(<KeyboardShortcutsDialog defaultOpen shortcut={null} />);

    expect(
      screen.getByText("No keyboard shortcuts are available here."),
    ).toBeInTheDocument();
  });

  it("is controlled by open and onOpenChange", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <KeyboardShortcutsDialog onOpenChange={onOpenChange} open={false} />,
    );

    pressQuestionMark();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<KeyboardShortcutsDialog onOpenChange={onOpenChange} open />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens with a shortcut of its own, also in a field when it has a modifier", () => {
    render(
      <>
        <input aria-label="Search" />
        <KeyboardShortcutsDialog shortcut="mod+/" />
      </>,
    );

    screen.getByRole("textbox", { name: "Search" }).focus();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search" }), {
      ctrlKey: true,
      key: "/",
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(linesOf("General")).toEqual(["Show keyboard shortcuts: Ctrl+/"]);
  });

  it("does not open with ? typed into a field", () => {
    render(
      <>
        <input aria-label="Note" />
        <KeyboardShortcutsDialog />
      </>,
    );

    const field = screen.getByRole("textbox", { name: "Note" });
    field.focus();
    fireEvent.keyDown(field, { key: "?", shiftKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("speaks Czech", () => {
    render(
      <UIProvider locale={cs}>
        <Shortcuts
          hotkeys={[
            ["mod+k", noop, { description: "Hledat" }],
            ["/", noop, { description: "Hledat" }],
          ]}
        />
        <KeyboardShortcutsDialog defaultOpen />
      </UIProvider>,
    );

    expect(
      screen.getByRole("dialog", { name: "Klávesové zkratky" }),
    ).toBeInTheDocument();
    expect(linesOf("Obecné")).toEqual([
      "Hledat: Ctrl+K nebo /",
      "Zobrazit klávesové zkratky: ?",
    ]);
  });

  it("renders on the server with nothing registered", () => {
    expect(() =>
      renderToString(
        <>
          <Shortcuts hotkeys={[["e", noop, { description: "Edit" }]]} />
          <KeyboardShortcutsDialog defaultOpen />
        </>,
      ),
    ).not.toThrow();
  });

  it("unregisters on unmount", () => {
    const view = (shown: boolean) => (
      <>
        {shown && (
          <Shortcuts hotkeys={[["e", noop, { description: "Edit" }]]} />
        )}
        <KeyboardShortcutsDialog defaultOpen shortcut={null} />
      </>
    );
    const { rerender } = render(view(true));
    expect(linesOf("General")).toEqual(["Edit: E"]);

    act(() => rerender(view(false)));
    expect(
      screen.getByText("No keyboard shortcuts are available here."),
    ).toBeInTheDocument();
  });
});
