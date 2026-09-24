import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cs } from "../i18n/cs";
import Textarea from "./textarea";
import UIProvider from "../providers/ui-provider";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Textarea counter", () => {
  it("counts the characters against maxLength", async () => {
    const user = userEvent.setup();
    render(
      <Textarea
        description="Shown on the invoice."
        label="Note"
        maxLength={500}
        showCount
      />,
    );

    expect(screen.getByText("0 / 500")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: /Note/ }), "Hello");
    expect(screen.getByText("5 / 500")).toBeVisible();
    // The counter does not replace the description
    expect(
      screen.getByRole("textbox", { name: /Note/ }),
    ).toHaveAccessibleDescription("Shown on the invoice.");
  });

  it("counts without a limit, and writes numbers as the locale does", () => {
    render(
      <UIProvider locale={cs}>
        <Textarea defaultValue={"x".repeat(1234)} label="Text" showCount />
        <Textarea
          defaultValue="abc"
          label="Poznámka"
          maxLength={5000}
          showCount
        />
      </UIProvider>,
    );

    // The text matcher sees non-breaking spaces as spaces
    expect(screen.getByText("1 234")).toBeVisible();
    expect(screen.getByText("3 / 5 000")).toBeVisible();
  });

  it("tells screen readers what is left near the limit, once the typing pauses", () => {
    vi.useFakeTimers();
    render(
      <UIProvider locale={cs}>
        <Textarea label="Poznámka" maxLength={20} showCount />
      </UIProvider>,
    );

    const status = screen.getByRole("status");
    const textarea = screen.getByRole("textbox", { name: /Poznámka/ });
    const type = (value: string) =>
      fireEvent.change(textarea, { target: { value } });
    fireEvent.focus(textarea);

    // Far from the limit - nothing to say
    type("12345");
    act(() => vi.advanceTimersByTime(1000));
    expect(status).toBeEmptyDOMElement();

    type("12345678901234567");
    expect(status).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(1000));
    expect(status).toHaveTextContent("Zbývají 3 znaky");

    type("12345678901234567890");
    act(() => vi.advanceTimersByTime(1000));
    expect(status).toHaveTextContent("Zbývá 0 znaků");

    // Leaving the field ends the announcements
    fireEvent.blur(textarea);
    expect(status).toBeEmptyDOMElement();
  });

  it("marks a value longer than maxLength", () => {
    vi.useFakeTimers();
    render(
      <Textarea
        label="Note"
        maxLength={3}
        onChange={() => {}}
        showCount
        value="Hello"
      />,
    );

    const counter = screen.getByText("5 / 3");
    expect(counter).toHaveClass("text-danger-700");
    expect(counter.className).not.toMatch(/text-neutral/);

    fireEvent.focus(screen.getByRole("textbox", { name: /Note/ }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 characters over the limit",
    );
  });
});

describe("Textarea autosize", () => {
  it("sizes the field by CSS, between its rows", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    render(
      <>
        <Textarea autosize label="Note" maxRows={8} minRows={2} />
        <Textarea autosize dim="lg" floating label="Floating" minRows={1} />
      </>,
    );

    const note = screen.getByRole("textbox", { name: /Note/ });
    expect(note).toHaveClass("field-sizing-content", "resize-none");
    expect(note).not.toHaveClass("resize-y");
    // Lines, the padding and the border
    const parts = (height: string) =>
      height
        .replace(/^calc\((.*)\)$/, "$1")
        .split(" + ")
        .sort();
    expect(parts(note.style.minHeight)).toEqual(["0.5rem", "2lh", "2px"]);
    expect(parts(note.style.maxHeight)).toEqual(["0.5rem", "2px", "8lh"]);
    expect(
      parts(screen.getByRole("textbox", { name: /Floating/ }).style.minHeight),
    ).toEqual(["1lh", "2px", "2rem"]);
    // No measuring copy where CSS sizes the field
    expect(document.querySelectorAll("textarea")).toHaveLength(2);
  });

  it("measures the content where the browser cannot size it", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const user = userEvent.setup();
    const { rerender } = render(<Textarea autosize label="Note" />);

    const textarea = screen.getByRole("textbox", { name: /Note/ });
    const shadow = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-hidden=true]",
    )!;
    expect(shadow).toHaveAttribute("tabindex", "-1");
    expect(shadow).not.toHaveAttribute("name");

    // jsdom lays nothing out - the copy tells the height of its text
    Object.defineProperty(shadow, "scrollHeight", {
      configurable: true,
      get: () => shadow.value.split("\n").length * 24 + 8,
    });

    await user.type(textarea, "a{Enter}b{Enter}c");
    expect(shadow).toHaveValue("a\nb\nc");
    // jsdom has no borders to add
    expect(textarea.style.height).toBe("80px");

    // Without autosize the script leaves the height alone again
    rerender(<Textarea label="Note" />);
    expect(textarea.style.height).toBe("");
    expect(document.querySelectorAll("textarea")).toHaveLength(1);
  });

  it("measures the content where ResizeObserver is missing too", async () => {
    // Like the jsdom of the tests of an app
    vi.stubGlobal("CSS", { supports: () => false });
    vi.stubGlobal("ResizeObserver", undefined);
    const user = userEvent.setup();
    render(<Textarea autosize label="Note" />);

    const textarea = screen.getByRole("textbox", { name: /Note/ });
    await user.type(textarea, "a{Enter}b");
    expect(textarea).toHaveValue("a\nb");
  });

  it("leaves the resize handle without autosize", () => {
    render(<Textarea label="Note" maxRows={3} minRows={2} />);

    const textarea = screen.getByRole("textbox", { name: /Note/ });
    expect(textarea).toHaveClass("resize-y");
    expect(textarea.style.minHeight).toBe("");
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const field = (
      <Textarea
        autosize
        defaultValue="Hello"
        label="Note"
        maxLength={100}
        showCount
      />
    );

    const html = renderToString(field);
    expect(html).toContain("5 / 100");
    // The server leaves the sizing to CSS
    expect(html).not.toContain('aria-hidden="true"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    // After hydration a browser without `field-sizing` measures
    expect(
      container.querySelector("textarea[aria-hidden=true]"),
    ).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
