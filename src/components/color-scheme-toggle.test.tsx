import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ColorSchemeToggle from "./color-scheme-toggle";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

afterEach(() => {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

describe("ColorSchemeToggle", () => {
  it("is a named radio group with the system scheme chosen at first", () => {
    render(<ColorSchemeToggle />);

    const group = screen.getByRole("radiogroup", { name: "Color scheme" });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "Light",
      "Dark",
      "System",
    ]);
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    // One tab stop - the chosen scheme
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, -1, 0]);
  });

  it("chooses a scheme on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorSchemeToggle onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("color-scheme")).toBe("dark");
    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("moves and chooses with the arrow keys, around the ends", async () => {
    const user = userEvent.setup();
    localStorage.setItem("color-scheme", "light");
    render(<ColorSchemeToggle />);

    await user.tab();
    const light = screen.getByRole("radio", { name: "Light" });
    expect(light).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    const dark = screen.getByRole("radio", { name: "Dark" });
    expect(dark).toHaveFocus();
    expect(dark).toBeChecked();

    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(light).toHaveFocus();
    expect(light).toBeChecked();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("follows the other toggles and the storage key it is given", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ColorSchemeToggle storageKey="crm-theme" />
        <ColorSchemeToggle storageKey="crm-theme" />
      </>,
    );

    const [first, second] = screen.getAllByRole("radiogroup");
    await user.click(
      first.querySelector("[aria-label='Dark']") as HTMLButtonElement,
    );

    expect(second.querySelector("[aria-label='Dark']")).toBeChecked();
    expect(localStorage.getItem("crm-theme")).toBe("dark");
  });

  it("renders the default scheme on the server, then the remembered one", async () => {
    const html = renderToString(<ColorSchemeToggle />);
    expect(html).toContain('aria-label="System"');

    localStorage.setItem("color-scheme", "dark");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, <ColorSchemeToggle />, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();

    act(() => root.unmount());
    container.remove();
  });

  it("speaks the language of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <ColorSchemeToggle />
      </UIProvider>,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Barevný režim" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Podle systému" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Tmavý" })).toBeInTheDocument();
  });
});
