import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnackbarProvider from "../providers/snackbar-provider";
import Toast from "./toast";
import { useSnackbar } from "../providers/snackbar-context";

function Notify() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <>
      <button onClick={() => enqueueSnackbar("Saved", "success")} type="button">
        Save
      </button>
      <button onClick={() => enqueueSnackbar("Failed", "error")} type="button">
        Fail
      </button>
    </>
  );
}

describe("SnackbarProvider", () => {
  it("adds the toasts to live regions that are there before them", async () => {
    const user = userEvent.setup();
    render(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );

    // In a portal - over the dialogs
    const polite = document.querySelector("[aria-live='polite']");
    const assertive = document.querySelector("[aria-live='assertive']");
    expect(polite).toBeEmptyDOMElement();
    expect(assertive).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Fail" }));

    expect(polite).toHaveTextContent("Saved");
    expect(assertive).toHaveTextContent("Failed");
    // No live region inside a live region
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a live region of its own when rendered alone", () => {
    render(<Toast message="Saved" />);

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("waits while it is hovered or focused", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast duration={1000} message="Saved" onClose={onClose} />);
    const toast = screen.getByRole("status");

    act(() => vi.advanceTimersByTime(600));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(5000));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseLeave(toast);
    fireEvent.focus(toast);
    act(() => vi.advanceTimersByTime(5000));
    expect(onClose).not.toHaveBeenCalled();

    // The 400 ms left, then the closing animation
    fireEvent.blur(toast);
    act(() => vi.advanceTimersByTime(399));
    expect(toast).toHaveClass("animate-slide-down");
    act(() => vi.advanceTimersByTime(1));
    expect(toast).toHaveClass("animate-slide-up");
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
