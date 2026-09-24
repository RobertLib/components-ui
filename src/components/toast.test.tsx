import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("shows a message again while its previous toast slides out", () => {
    vi.useFakeTimers();
    render(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );
    const save = screen.getByRole("button", { name: "Save" });

    fireEvent.click(save);
    // Not stacked twice while shown
    fireEvent.click(save);
    expect(screen.getAllByText("Saved")).toHaveLength(1);

    // The 3 s are up - the toast slides out
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(save);
    expect(screen.getAllByText("Saved")).toHaveLength(2);

    act(() => vi.advanceTimersByTime(200));
    expect(screen.getAllByText("Saved")).toHaveLength(1);
  });

  it("removes a hidden toast on time while new toasts keep coming", () => {
    vi.useFakeTimers();

    function Burst() {
      const { enqueueSnackbar } = useSnackbar();
      return (
        <button
          onClick={() => enqueueSnackbar(`Step ${Date.now()}`, "info")}
          type="button"
        >
          Next
        </button>
      );
    }

    render(
      <SnackbarProvider>
        <Notify />
        <Burst />
      </SnackbarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => vi.advanceTimersByTime(3000));

    // A new toast every 150 ms re-renders the list during the slide-out
    for (let step = 0; step < 3; step++) {
      act(() => vi.advanceTimersByTime(150));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the id it is given", () => {
    render(<Toast id="saved" message="Saved" />);

    expect(screen.getByRole("status")).toHaveAttribute("id", "saved");
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

  it("waits while its page is hidden in a background tab", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const setVisibility = (state: DocumentVisibilityState) => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    };
    render(<Toast duration={1000} message="Exported" onClose={onClose} />);
    const toast = screen.getByRole("status");

    act(() => vi.advanceTimersByTime(600));
    setVisibility("hidden");
    act(() => vi.advanceTimersByTime(60_000));
    expect(onClose).not.toHaveBeenCalled();

    // Seen again - the 400 ms left, then the closing animation
    setVisibility("visible");
    act(() => vi.advanceTimersByTime(399));
    expect(toast).toHaveClass("animate-slide-down");
    act(() => vi.advanceTimersByTime(1));
    expect(toast).toHaveClass("animate-slide-up");
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing once it has hidden itself", () => {
    vi.useFakeTimers();
    render(<Toast duration={1000} message="Saved" />);

    // Hides itself, then slides out
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Saved")).toBeNull();
    // Also after the slide-out animation would have ended
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("closes on time while its parent passes a new onClose on each render", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const toast = () => (
      <Toast duration={1000} message="Saved" onClose={() => onClose()} />
    );

    const { rerender } = render(toast());
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(150));
    rerender(toast());
    act(() => vi.advanceTimersByTime(50));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disappears when dismissed, whatever its parent does", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Toast message="Saved" onClose={onClose} persist />);

    await user.click(
      screen.getByRole("button", { name: "Close notification" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("Toast focus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the focus back to where it was before the toasts", async () => {
    const user = userEvent.setup();
    render(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.tab();
    // From the Fail button into the toast
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Saved");

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.getByRole("button", { name: "Fail" })).toHaveFocus();
  });

  it("moves to the next toast when that element is gone", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SnackbarProvider>
        <Notify />
        <button type="button">Other</button>
      </SnackbarProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Fail" }));
    await user.click(screen.getByRole("button", { name: "Other" }));
    // The error toast first, then its close button
    await user.tab();
    await user.tab();
    rerender(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );

    await user.keyboard("{Enter}");
    expect(screen.queryByText("Failed")).toBeNull();
    const saved = screen.getByText("Saved").closest("[data-toast]");
    expect(saved?.querySelector("button")).toHaveFocus();
  });

  it("gives the focus back from a toast rendered on its own", async () => {
    const user = userEvent.setup();

    function Standalone() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button">Before</button>
          {shown && (
            <Toast message="Saved" onClose={() => setShown(false)} persist />
          )}
        </>
      );
    }

    render(<Standalone />);
    await user.tab();
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");

    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("leaves the focus alone when it hides by itself", () => {
    vi.useFakeTimers();
    render(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );
    const fail = screen.getByRole("button", { name: "Fail" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => fail.focus());

    act(() => vi.advanceTimersByTime(3000));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Saved")).toBeNull();
    expect(fail).toHaveFocus();
  });

  it("stays on the Escape that cancels an IME composition", () => {
    const onClose = vi.fn();
    render(<Toast message="Saved" onClose={onClose} persist />);

    fireEvent.keyDown(screen.getByRole("status"), {
      isComposing: true,
      key: "Escape",
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Toast with an action, a title or a spinner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs its action and closes", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <Toast
        action={{ label: "Undo", onClick }}
        message="The invoice was deleted"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("The invoice was deleted")).toBeNull();
  });

  it("stays twice as long with an action", () => {
    vi.useFakeTimers();
    const onHide = vi.fn();
    render(
      <Toast
        action={{ label: "Undo", onClick: () => {} }}
        message="Deleted"
        onHide={onHide}
      />,
    );

    act(() => vi.advanceTimersByTime(5999));
    expect(onHide).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("shows its title above the message and reads both", () => {
    render(<Toast message="3 invoices were sent." title="Done" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Done3 invoices were sent.",
    );
  });

  it("keeps a loading toast on screen with a hidden spinner", () => {
    vi.useFakeTimers();
    const onHide = vi.fn();
    const { rerender } = render(
      <Toast duration={1000} loading message="Saving…" onHide={onHide} />,
    );

    const spinner = screen.getByRole("status").querySelector("svg");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    act(() => vi.advanceTimersByTime(5000));
    expect(onHide).not.toHaveBeenCalled();

    // The whole duration from when it stops loading
    rerender(<Toast duration={1000} message="Saved" onHide={onHide} />);
    act(() => vi.advanceTimersByTime(999));
    expect(onHide).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("slides out when its parent sets open to false", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(
      <Toast message="Uploading…" onClose={onClose} persist />,
    );

    rerender(
      <Toast message="Uploading…" onClose={onClose} open={false} persist />,
    );
    expect(screen.getByRole("status")).toHaveClass("animate-slide-up");
    act(() => vi.advanceTimersByTime(200));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Uploading…")).toBeNull();
  });
});
