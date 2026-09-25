import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import CopyButton from "./copy-button";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

afterEach(() => {
  vi.useRealTimers();
});

/** Clicks with fake timers - `user-event` waits on real ones. */
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("CopyButton", () => {
  it("copies its value and says so for a moment", async () => {
    // Installs the clipboard of the tests
    userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    vi.useFakeTimers();
    const onCopied = vi.fn();
    render(<CopyButton onCopied={onCopied} value="CZ65 0800 0000 1920" />);

    await click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("CZ65 0800 0000 1920");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(onCopied).toHaveBeenCalledWith("CZ65 0800 0000 1920");

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("keeps its tooltip open and switches it to Copied", async () => {
    userEvent.setup();
    vi.useFakeTimers();
    render(<CopyButton label="Copy the API key" timeout={1000} value="sk-1" />);

    const button = screen.getByRole("button", { name: "Copy the API key" });
    fireEvent.mouseEnter(button);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copy the API key");

    await click(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copied");

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copy the API key");
  });

  it("does not click what it is in", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <CopyButton value="ORD-1042" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(onRowClick).not.toHaveBeenCalled();
    expect(await navigator.clipboard.readText()).toBe("ORD-1042");
  });

  it("copies nothing when its onClick prevents the default", async () => {
    const user = userEvent.setup();
    await navigator.clipboard.writeText("before");
    render(
      <CopyButton onClick={(event) => event.preventDefault()} value="after" />,
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("before");
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("says when copying failed, then offers it again", async () => {
    userEvent.setup();
    vi.useFakeTimers();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Write permission denied.", "NotAllowedError"),
    );
    render(<CopyButton value="secret" />);

    await click(screen.getByRole("button", { name: "Copy" }));
    expect(
      screen.getByRole("button", { name: "Copying failed" }),
    ).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("renders on the server", () => {
    const html = renderToString(
      <CopyButton label="Copy the IBAN" value="CZ65" />,
    );
    expect(html).toContain('aria-label="Copy the IBAN"');
  });

  it("is operated from the keyboard and speaks the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <CopyButton value="42" />
      </UIProvider>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Kopírovat" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: "Zkopírováno" }),
    ).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe("42");
  });
});

describe("CopyButton for screen readers", () => {
  it("tells the outcome in a status that is there before it", async () => {
    userEvent.setup();
    vi.useFakeTimers();
    render(<CopyButton value="CZ65" />);

    // Empty at first - a status that appears filled is often not read
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await click(screen.getByRole("button", { name: "Copy" }));
    expect(status).toHaveTextContent("Copied");

    act(() => vi.advanceTimersByTime(2000));
    expect(status).toBeEmptyDOMElement();

    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Write permission denied.", "NotAllowedError"),
    );
    await click(screen.getByRole("button", { name: "Copy" }));
    expect(status).toHaveTextContent("Copying failed");
  });
});
