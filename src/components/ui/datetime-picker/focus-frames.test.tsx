import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DayGrid from "./day-grid";

describe("DayGrid deferred focus", () => {
  it("does not queue another autofocus frame after its day takes focus", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
    render(
      <>
        <input aria-label="Date text" />
        <DayGrid
          autoFocus
          onSelect={() => {}}
          selected={new Date(2026, 8, 24)}
        />
      </>,
    );
    expect(frames.size).toBe(1);
    const runFrames = () => {
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(0)));
    };
    runFrames();
    expect(
      screen.getByRole("button", { name: "September 24, 2026" }),
    ).toHaveFocus();

    const input = screen.getByRole("textbox", { name: "Date text" });
    act(() => input.focus());
    runFrames();
    expect(input).toHaveFocus();
    expect(frames.size).toBe(0);

    // A native focus on a different day also needs no deferred focus of
    // that same button after the focus has already moved elsewhere.
    act(() =>
      screen.getByRole("button", { name: "September 25, 2026" }).focus(),
    );
    act(() => input.focus());
    runFrames();
    expect(input).toHaveFocus();
    expect(frames.size).toBe(0);
  });
});
