import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sheet from "./sheet";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A finger on the header of the sheet, dragged down to `y`. */
const finger = (pointerType = "touch") => {
  const at = (clientY: number) => ({
    clientX: 100,
    clientY,
    isPrimary: true,
    pointerId: 3,
    pointerType,
  });
  return {
    down: (element: Element, y: number) =>
      fireEvent.pointerDown(element, at(y)),
    move: (element: Element, y: number) =>
      fireEvent.pointerMove(element, at(y)),
    up: (element: Element, y: number) => fireEvent.pointerUp(element, at(y)),
  };
};

const sheet = () => screen.getByRole("dialog");
const header = () => sheet().querySelector("header")!;

describe("Sheet start / end", () => {
  it.each([
    ["start", "start-0", "-translate-x-full", "rtl:translate-x-full"],
    ["end", "end-0", "translate-x-full", "rtl:-translate-x-full"],
  ] as const)(
    "slides in from the %s edge of the writing direction",
    (side, edgeClass, closedClass, rtlClass) => {
      render(<Sheet open side={side} title="Filters" />);

      // Out over its edge while closed - the other edge right to left
      expect(sheet()).toHaveClass(edgeClass, closedClass, rtlClass);
      expect(sheet()).toHaveClass("inset-y-0", "w-full");
    },
  );

  it("has its border on the inner edge", () => {
    const { rerender } = render(<Sheet open side="start" title="Filters" />);
    expect(sheet()).toHaveClass("sm:border-e");

    rerender(<Sheet open side="end" title="Filters" />);
    expect(sheet()).toHaveClass("sm:border-s");
  });
});

describe("A bottom Sheet swiped down", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows the finger and goes back when let go early", () => {
    // Slowly - the time of the events is the one of the clock
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose} open side="bottom" title="Share">
        Content
      </Sheet>,
    );
    act(() => vi.advanceTimersByTime(20));
    const touch = finger();

    touch.down(header(), 500);
    act(() => vi.advanceTimersByTime(200));
    touch.move(header(), 540);
    expect(sheet().style.translate).toBe("0 40px");
    // Without a transition while the finger holds it
    expect(sheet().style.transition).toBe("none");
    // Never up, out of its place
    act(() => vi.advanceTimersByTime(200));
    touch.move(header(), 450);
    expect(sheet().style.translate).toBe("0 0px");

    act(() => vi.advanceTimersByTime(400));
    touch.move(header(), 540);
    act(() => vi.advanceTimersByTime(200));
    touch.up(header(), 540);
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet().style.translate).toBe("");
  });

  it("closes on a quick flick of a few pixels", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose} open side="bottom" title="Share">
        Content
      </Sheet>,
    );
    act(() => vi.advanceTimersByTime(20));
    const touch = finger();

    touch.down(header(), 500);
    act(() => vi.advanceTimersByTime(16));
    // 30 px in a frame
    touch.move(header(), 530);
    touch.up(header(), 530);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes once let go far enough down", async () => {
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose} open side="bottom" title="Share">
        Content
      </Sheet>,
    );
    await act(() => sleep(20));
    const touch = finger();

    touch.down(header(), 500);
    touch.move(header(), 560);
    touch.move(header(), 600);
    touch.up(header(), 600);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Out from where the finger left it
    expect(sheet().style.translate).toBe("");
  });

  it("slides out and tells the parent when uncontrolled", async () => {
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose} side="bottom" title="Share">
        Content
      </Sheet>,
    );
    await act(() => sleep(20));
    const touch = finger();

    touch.down(header(), 500);
    touch.move(header(), 620);
    touch.up(header(), 620);
    expect(sheet()).toHaveClass("translate-y-full");
    await act(() => sleep(350));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a handle on touch screens", async () => {
    const { rerender } = render(<Sheet open side="bottom" title="Share" />);
    const handle = header().querySelector("span[aria-hidden='true']");
    expect(handle).toHaveClass("pointer-fine:hidden");
    expect(header()).toHaveClass("touch-none");

    rerender(<Sheet open side="right" title="Share" />);
    expect(header().querySelector("span[aria-hidden='true']")).toBeNull();
    expect(header()).not.toHaveClass("touch-none");
  });

  it("leaves the mouse, the close button and a disabled sheet alone", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet onClose={onClose} open side="bottom" title="Share" />,
    );
    await act(() => sleep(20));

    const mouse = finger("mouse");
    mouse.down(header(), 500);
    mouse.move(header(), 650);
    mouse.up(header(), 650);
    expect(sheet().style.translate).toBe("");

    const touch = finger();
    const close = screen.getByRole("button", { name: "Close dialog" });
    touch.down(close, 500);
    touch.move(close, 650);
    touch.up(close, 650);
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Sheet closeDisabled onClose={onClose} open side="bottom" />);
    const bar = sheet().firstElementChild!;
    touch.down(bar, 500);
    touch.move(bar, 650);
    touch.up(bar, 650);
    expect(sheet().style.translate).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays put with swipeToClose off", async () => {
    const onClose = vi.fn();
    render(
      <Sheet
        onClose={onClose}
        open
        side="bottom"
        swipeToClose={false}
        title="Share"
      />,
    );
    await act(() => sleep(20));
    expect(header().querySelector("span[aria-hidden='true']")).toBeNull();

    const touch = finger();
    touch.down(header(), 500);
    touch.move(header(), 650);
    touch.up(header(), 650);
    expect(onClose).not.toHaveBeenCalled();
  });
});
