import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Kbd from "./kbd";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Kbd", () => {
  it("renders a key", () => {
    render(<Kbd title="Escape">Esc</Kbd>);

    const key = screen.getByText("Esc");
    expect(key.tagName).toBe("KBD");
    expect(key).toHaveAttribute("title", "Escape");
  });

  it("renders a shortcut as nested keys the Windows way", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    const { container } = render(<Kbd shortcut="mod+shift+k" />);

    const outer = container.firstElementChild!;
    expect(outer.tagName).toBe("KBD");
    expect(
      Array.from(outer.querySelectorAll("kbd"), (key) => key.textContent),
    ).toEqual(["Ctrl", "Shift", "K"]);
    expect(outer).toHaveTextContent("Ctrl+Shift+K");
  });

  it("renders a shortcut with the symbols of a Mac", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    const { container } = render(<Kbd shortcut="mod+shift+k" />);

    expect(container.firstElementChild).toHaveTextContent("⇧⌘K");
  });

  it("writes shortcuts the Windows way on the server", () => {
    vi.stubGlobal("navigator", undefined);

    expect(renderToString(<Kbd shortcut="mod+k" />)).toContain(">Ctrl</kbd>");
  });
});
