import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog from "../components/dialog";
import { useOverlay } from "../components/overlay-stack";
import useHotkeys, { type Hotkey, type UseHotkeysOptions } from "./use-hotkeys";

function Shortcuts({
  children,
  hotkeys,
  options,
}: {
  children?: React.ReactNode;
  hotkeys: Hotkey[];
  options?: UseHotkeysOptions;
}) {
  useHotkeys(hotkeys, options);
  return <>{children}</>;
}

/** Presses Ctrl + K on the focused element - `mod+k` outside Apple platforms. */
const pressModK = (target: Element = document.activeElement ?? document.body) =>
  fireEvent.keyDown(target, { code: "KeyK", ctrlKey: true, key: "k" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHotkeys", () => {
  it("calls the handler of the matching shortcut and prevents the default", () => {
    const search = vi.fn();
    const help = vi.fn();
    render(
      <Shortcuts
        hotkeys={[
          ["mod+k", search],
          ["?", help],
        ]}
      />,
    );

    // `fireEvent` returns false when the default was prevented
    expect(pressModK()).toBe(false);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0]).toBeInstanceOf(KeyboardEvent);
    expect(help).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    expect(help).toHaveBeenCalledTimes(1);

    // Other modifiers are another shortcut
    fireEvent.keyDown(document.body, {
      ctrlKey: true,
      key: "k",
      shiftKey: true,
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("uses ⌘ for mod on a Mac", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    const search = vi.fn();
    render(<Shortcuts hotkeys={[["mod+k", search]]} />);

    fireEvent.keyDown(document.body, { ctrlKey: true, key: "k" });
    expect(search).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("leaves the default alone when asked to", () => {
    render(
      <Shortcuts
        hotkeys={[
          ["mod+k", () => {}],
          ["mod+p", () => {}, { preventDefault: true }],
        ]}
        options={{ preventDefault: false }}
      />,
    );

    expect(pressModK()).toBe(true);
    expect(fireEvent.keyDown(document.body, { ctrlKey: true, key: "p" })).toBe(
      false,
    );
  });

  it("ignores keys typed into fields - unless the shortcut allows it", () => {
    const help = vi.fn();
    const save = vi.fn();
    render(
      <Shortcuts
        hotkeys={[
          ["?", help],
          ["mod+s", save, { allowInFields: true }],
        ]}
      >
        <input aria-label="Name" />
        <textarea aria-label="Note" />
        <select aria-label="Status">
          <option>Open</option>
        </select>
        <div aria-label="Editor" contentEditable role="textbox" />
        <div contentEditable suppressContentEditableWarning>
          <p>Nested text</p>
        </div>
        <input aria-label="Done" type="checkbox" />
        <button type="button">Save</button>
      </Shortcuts>,
    );

    for (const field of [
      screen.getByRole("textbox", { name: "Name" }),
      screen.getByRole("textbox", { name: "Note" }),
      screen.getByRole("combobox", { name: "Status" }),
      screen.getByRole("textbox", { name: "Editor" }),
      screen.getByText("Nested text"),
    ]) {
      fireEvent.keyDown(field, { key: "?" });
      fireEvent.keyDown(field, { ctrlKey: true, key: "s" });
    }
    expect(help).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(5);

    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "?" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "?" });
    expect(help).toHaveBeenCalledTimes(2);
  });

  it("leaves the numpad arrows of NumLock off and AltGr text alone", () => {
    const week = vi.fn();
    const save = vi.fn();
    render(
      <Shortcuts
        hotkeys={[
          ["2", week],
          ["ctrl+alt+s", save, { allowInFields: true }],
        ]}
      >
        <input aria-label="Name" />
      </Shortcuts>,
    );

    // The numpad 2 with NumLock off scrolls the page down
    expect(
      fireEvent.keyDown(document.body, { code: "Numpad2", key: "ArrowDown" }),
    ).toBe(true);
    expect(week).not.toHaveBeenCalled();

    // AltGr + S types "ś" on a Polish keyboard - Ctrl + Alt on Windows
    expect(
      fireEvent.keyDown(screen.getByRole("textbox"), {
        altKey: true,
        code: "KeyS",
        ctrlKey: true,
        key: "ś",
      }),
    ).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("ignores a key press the page has handled, and one composing text", () => {
    const search = vi.fn();
    render(
      <Shortcuts hotkeys={[["mod+k", search]]}>
        <button onKeyDown={(event) => event.preventDefault()} type="button">
          Own shortcut
        </button>
      </Shortcuts>,
    );

    pressModK(screen.getByRole("button"));
    fireEvent.keyDown(document.body, {
      ctrlKey: true,
      isComposing: true,
      key: "k",
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("calls only the first matching shortcut", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <Shortcuts
        hotkeys={[
          ["mod+k", first],
          ["ctrl+k", second],
        ]}
      />,
    );

    pressModK();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("calls the handler of the latest render and turns off with enabled", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = render(
      <Shortcuts hotkeys={[["mod+k", first]]} />,
    );

    rerender(<Shortcuts hotkeys={[["mod+k", latest]]} />);
    pressModK();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);

    rerender(
      <Shortcuts hotkeys={[["mod+k", latest]]} options={{ enabled: false }} />,
    );
    pressModK();
    expect(latest).toHaveBeenCalledTimes(1);

    rerender(<Shortcuts hotkeys={[["mod+k", latest]]} />);
    pressModK();
    expect(latest).toHaveBeenCalledTimes(2);

    unmount();
    pressModK();
    expect(latest).toHaveBeenCalledTimes(2);
  });

  it("does not work under a modal dialog - but in it", async () => {
    const user = userEvent.setup();
    const pageShortcut = vi.fn();
    const dialogShortcut = vi.fn();

    function Page() {
      const [open, setOpen] = useState(false);
      useHotkeys([["n", pageShortcut]]);

      return (
        <>
          <button onClick={() => setOpen(true)}>Edit</button>
          <Dialog onClose={() => setOpen(false)} open={open} title="Edit">
            <Shortcuts hotkeys={[["mod+enter", dialogShortcut]]}>
              <button type="button">Save</button>
            </Shortcuts>
          </Dialog>
        </>
      );
    }

    render(<Page />);
    await user.keyboard("n");
    expect(pageShortcut).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("n");
    expect(pageShortcut).toHaveBeenCalledTimes(1);

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(dialogShortcut).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    await user.keyboard("n");
    expect(pageShortcut).toHaveBeenCalledTimes(2);
  });
});

describe("useHotkeys under modal overlays", () => {
  it("is out of reach under any modal overlay of the stack - also one without aria-modal", () => {
    const handler = vi.fn();

    function Page() {
      useHotkeys([["n", handler]]);
      return null;
    }

    // Like the full-screen DataTable: modal in the stack, no aria-modal
    function FullScreen({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      useOverlay({ modal: true, open, ref });
      return <div ref={ref} />;
    }

    const { rerender } = render(
      <>
        <Page />
        <FullScreen open />
      </>,
    );

    fireEvent.keyDown(document, { key: "n" });
    expect(handler).not.toHaveBeenCalled();

    rerender(
      <>
        <Page />
        <FullScreen open={false} />
      </>,
    );
    fireEvent.keyDown(document, { key: "n" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
