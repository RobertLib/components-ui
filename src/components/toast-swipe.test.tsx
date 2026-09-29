import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toast, { LIVE_REGION_DELAY } from "./toast";

/** A finger on the toast, moved to `x` / `y` - slowly, a frame apart. */
const finger = (pointerType = "touch") => {
  const at = (clientX: number, clientY = 20) => ({
    clientX,
    clientY,
    isPrimary: true,
    pointerId: 5,
    pointerType,
  });
  return {
    down: (element: Element, x: number) =>
      fireEvent.pointerDown(element, at(x)),
    move: (element: Element, x: number, y?: number) => {
      act(() => vi.advanceTimersByTime(100));
      fireEvent.pointerMove(element, at(x, y));
    },
    up: (element: Element, x: number) => {
      act(() => vi.advanceTimersByTime(100));
      fireEvent.pointerUp(element, at(x));
    },
  };
};

const setReducedMotion = (reduce: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: () => {},
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      removeEventListener: () => {},
    })),
  );

describe("Toast variants", () => {
  it.each(["danger", "error"] as const)(
    "shows %s in the danger colors and announces it at once",
    (variant) => {
      render(<Toast message="The file is too large" variant={variant} />);

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-danger-50", "text-danger-800");
      expect(toast).toHaveAttribute("aria-live", "assertive");
    },
  );

  it("shows any React node as its message and title", () => {
    render(
      <Toast
        message={
          <>
            Saved - <a href="#files">open the files</a>
          </>
        }
        title={<em>Done</em>}
      />,
    );

    expect(
      screen.getByRole("link", { name: "open the files" }),
    ).toHaveAttribute("href", "#files");
    expect(screen.getByText("Done").tagName).toBe("EM");
  });
});

describe("Toast swiped away", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderToast = () => {
    const onClose = vi.fn();
    render(<Toast message="Saved" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(LIVE_REGION_DELAY));
    return { onClose, toast: screen.getByRole("status") };
  };

  it("follows the finger sideways and leaves the screen once let go far enough", () => {
    const { onClose, toast } = renderToast();
    // Sideways only - up and down the page scrolls
    expect(toast).toHaveClass("touch-pan-y");
    const touch = finger();

    touch.down(toast, 100);
    touch.move(toast, 140);
    expect(toast.style.translate).toBe("40px");
    touch.move(toast, 190);
    touch.up(toast, 190);

    // Out to the right, then gone
    expect(toast.style.translate).not.toBe("90px");
    expect(toast).toHaveAttribute("data-toast", "hiding");
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("goes back when let go early, and waits meanwhile", () => {
    const { onClose, toast } = renderToast();
    const touch = finger();

    touch.down(toast, 100);
    touch.move(toast, 130);
    // Held for longer than its duration - it stays
    act(() => vi.advanceTimersByTime(5000));
    touch.up(toast, 130);
    expect(toast.style.translate).toBe("");
    expect(onClose).not.toHaveBeenCalled();

    // The time goes on once it is let go - then it slides out
    act(() => vi.advanceTimersByTime(3000));
    expect(toast).toHaveAttribute("data-toast", "hiding");
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays when the finger moves up or down - a scroll", () => {
    const { onClose, toast } = renderToast();
    const touch = finger();

    touch.down(toast, 100);
    touch.move(toast, 104, 60);
    touch.move(toast, 200, 60);
    touch.up(toast, 200);
    expect(toast.style.translate).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves the mouse and a toast that cannot be dismissed alone", () => {
    const { toast } = renderToast();
    const mouse = finger("mouse");
    mouse.down(toast, 100);
    mouse.move(toast, 200);
    expect(toast.style.translate).toBe("");

    render(<Toast message="Uploading" />);
    const plain = screen
      .getByText("Uploading")
      .closest<HTMLElement>("[data-toast]")!;
    expect(plain).not.toHaveClass("touch-pan-y");
    const touch = finger();
    touch.down(plain, 100);
    touch.move(plain, 200);
    expect(plain.style.translate).toBe("");
  });

  it("is dismissed at once for users who prefer reduced motion", () => {
    setReducedMotion(true);
    const { onClose, toast } = renderToast();
    const touch = finger();

    touch.down(toast, 100);
    touch.move(toast, 20);
    touch.up(toast, 20);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
