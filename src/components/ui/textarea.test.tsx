import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cs } from "../../i18n/ui/cs";
import Textarea from "./textarea";
import UIProvider from "../../providers/ui-provider";

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

  it.each([
    ["200px", "200px", "200px"],
    ["200px", "12rem", "12rem"],
    [200, 200, "200px"],
    [200, 320, "320px"],
  ])(
    "restores the inline height from %s to %s when autosize ends",
    (initialHeight, height, expected) => {
      vi.stubGlobal("CSS", { supports: () => false });
      const { rerender } = render(
        <Textarea autosize label="Note" style={{ height: initialHeight }} />,
      );

      rerender(<Textarea label="Note" style={{ height }} />);

      const textarea = screen.getByRole("textbox", { name: /Note/ });
      expect(textarea.style.height).toBe(expected);
      expect(document.querySelectorAll("textarea")).toHaveLength(1);
    },
  );

  it("measures inline typography and spacing, also when the styles change", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const view = (lineHeight: number) => (
      <Textarea
        autosize
        defaultValue={"First line\nSecond line\nThird line"}
        label="Note"
        style={{
          fontSize: 32,
          lineHeight: `${lineHeight}px`,
          padding: "4px 12px",
          width: 300,
          minHeight: 60,
          maxHeight: 200,
        }}
      />
    );
    const { rerender } = render(view(40));
    const textarea = screen.getByRole("textbox", { name: /Note/ });
    const shadow = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-hidden=true]",
    )!;

    // jsdom cannot lay out text. Measure using the measuring element's
    // styles, so a copy using the default font would give the wrong height.
    Object.defineProperty(shadow, "scrollHeight", {
      configurable: true,
      get: () => {
        const style = getComputedStyle(shadow);
        return (
          shadow.value.split("\n").length *
            (parseFloat(style.lineHeight) || 24) +
          (parseFloat(style.paddingTop) || 0) +
          (parseFloat(style.paddingBottom) || 0)
        );
      },
    });

    rerender(view(40));
    expect(textarea.style.height).toBe("128px");
    expect(shadow).toHaveStyle({ fontSize: "32px", width: "300px" });
    // The copy measures freely and stays hidden despite the public styles.
    expect(shadow).toHaveStyle({
      minHeight: "0",
      maxHeight: "none",
      visibility: "hidden",
    });

    rerender(view(48));
    expect(textarea.style.height).toBe("152px");
    expect(textarea).toHaveStyle({ minHeight: "60px", maxHeight: "200px" });
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

describe("Textarea label and states", () => {
  it("takes content as its label, also a floating one", () => {
    render(
      <>
        <Textarea
          label={
            <>
              Note <small>(internal)</small>
            </>
          }
          required
        />
        <Textarea
          floating
          label={
            <>
              Address <em>(delivery)</em>
            </>
          }
        />
      </>,
    );

    expect(
      screen.getByRole("textbox", { name: "Note (internal):" }),
    ).toBeRequired();
    expect(
      screen.getByRole("textbox", { name: "Address (delivery)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("*")).toHaveClass("cui-required-mark");
  });

  it("moves a floating label in by a margin, so that it stays at the start", () => {
    render(<Textarea floating label="Note" />);

    const label = screen.getByText("Note");
    expect(label).toHaveClass("ms-2");
    expect(label.className).not.toMatch(/translate-x/);
  });

  it("marks a read-only field for styles", () => {
    render(
      <>
        <Textarea defaultValue="Sent" label="Note" readOnly />
        <Textarea label="Other" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: /Note/ })).toHaveAttribute(
      "data-readonly",
    );
    expect(screen.getByRole("textbox", { name: /Other/ })).not.toHaveAttribute(
      "data-readonly",
    );
  });
});
