import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnackbarProvider from "../../providers/snackbar-provider";
import Toast, { LIVE_REGION_DELAY } from "./toast";
import { useSnackbar } from "../../providers/snackbar-context";

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

  it("shows its text a moment after its live region is in the page", () => {
    vi.useFakeTimers();
    render(<Toast message="Saved" />);

    // Screen readers announce a change in a region they know - not a region
    // that appears with its text
    const toast = screen.getByRole("status");
    const content = screen.getByText("Saved").parentElement!.parentElement!;
    expect(toast).toHaveClass("opacity-0");
    expect(content).toHaveClass("invisible");

    act(() => vi.advanceTimersByTime(LIVE_REGION_DELAY));
    expect(toast).toHaveClass("animate-slide-down");
    expect(toast).not.toHaveClass("opacity-0");
    expect(content).not.toHaveClass("invisible");
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

  it("closes only once when dismissed during its automatic slide-out", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast duration={1000} message="Saved" onClose={onClose} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "closed");
    fireEvent.click(screen.getByRole("button", { name: "Close notification" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Saved")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cancels its timers when dismissed before its duration ends", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onHide = vi.fn();
    render(
      <Toast
        duration={1000}
        message="Saved"
        onClose={onClose}
        onHide={onHide}
      />,
    );

    act(() => vi.advanceTimersByTime(LIVE_REGION_DELAY));
    fireEvent.click(screen.getByRole("button", { name: "Close notification" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Saved")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(200));
    expect(onHide).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cancels the swipe animation timer when dismissed while sliding away", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Saved" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(LIVE_REGION_DELAY));
    const toast = screen.getByRole("status");
    const pointer = {
      clientY: 20,
      isPrimary: true,
      pointerId: 5,
      pointerType: "touch",
    };

    fireEvent.pointerDown(toast, { ...pointer, clientX: 100 });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerMove(toast, { ...pointer, clientX: 190 });
    fireEvent.pointerUp(toast, { ...pointer, clientX: 190 });
    expect(toast).toHaveAttribute("data-state", "closed");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close notification" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledTimes(1);
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

describe("Toast icon and colors", () => {
  it("shows no icon of its own for an icon of null", () => {
    render(
      <>
        <Toast icon={null} message="Saved" variant="success" />
        <Toast icon={null} message="Note" />
      </>,
    );

    // The icon of the variant only in forced colors, as without `icon` -
    // no empty place for an icon taking a gap
    const icons = document.querySelectorAll("[data-toast-icon]");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass("hidden", "forced-colors:block");
    expect(icons[0].tagName).toBe("svg");
  });

  it("takes colors in place of those of its variant, also in dark mode", () => {
    render(
      <Toast
        className="shadow-lg"
        colorClassName="border-neutral-900 bg-neutral-900 text-white"
        message="Saved"
        variant="success"
      />,
    );

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass(
      "border-neutral-900",
      "bg-neutral-900",
      "text-white",
      "shadow-lg",
    );
    expect(toast.className).not.toMatch(/success/);
    expect(toast).toHaveAttribute("data-variant", "success");
  });

  it("takes colors of variables in place of those of its variant", () => {
    render(
      <Toast
        colorClassName="bg-(--brand) text-[var(--on-brand)]"
        message="Saved"
        variant="success"
      />,
    );

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-(--brand)", "text-[var(--on-brand)]");
    expect(toast.className).not.toMatch(
      /(?:^|\s)(?:dark:)?(?:bg|text)-success/,
    );
  });

  it("keeps the colors of its variant with classes that set none", () => {
    render(
      <Toast
        colorClassName="font-semibold shadow-lg"
        message="Saved"
        variant="success"
      />,
    );

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass(
      "font-semibold",
      "shadow-lg",
      "border-success-200",
      "bg-success-50",
      "text-success-800",
      "dark:bg-success-900",
      "dark:text-success-200",
      "dark:border-success-800",
    );
  });

  it("replaces only the colors given - in the light and the dark mode", () => {
    render(
      <Toast colorClassName="border-info-500" message="Saved" variant="info" />,
    );

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("border-info-500");
    expect(toast).not.toHaveClass("border-info-200");
    expect(toast).not.toHaveClass("dark:border-info-800");
    // The background and the text keep the colors of the variant
    expect(toast).toHaveClass(
      "bg-info-50",
      "text-info-800",
      "dark:bg-info-900",
      "dark:text-info-200",
    );
  });

  it("shows the light background and text in the dark mode for one given alone", () => {
    render(<Toast colorClassName="bg-white" message="Saved" variant="info" />);

    // Not the light text of the dark mode on a white toast
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-white", "text-info-800");
    expect(toast).not.toHaveClass("bg-info-50");
    expect(toast).not.toHaveClass("dark:bg-info-900");
    expect(toast).not.toHaveClass("dark:text-info-200");
    // The border is no part of it
    expect(toast).toHaveClass("border-info-200", "dark:border-info-800");

    render(
      <Toast colorClassName="text-danger-700" message="Note" variant="info" />,
    );
    const note = screen.getByText("Note").closest<HTMLElement>("[data-toast]")!;
    expect(note).toHaveClass("bg-info-50", "text-danger-700");
    expect(note).not.toHaveClass("dark:bg-info-900");
    expect(note).not.toHaveClass("dark:text-info-200");
  });

  it("takes a color given for the dark mode there", () => {
    render(
      <Toast
        colorClassName="bg-white dark:bg-neutral-900"
        message="Saved"
        variant="info"
      />,
    );

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-white", "dark:bg-neutral-900");
    expect(toast).not.toHaveClass("bg-info-50");
    expect(toast).not.toHaveClass("dark:bg-info-900");
    // The light text of the variant goes with the dark background given
    expect(toast).toHaveClass("dark:text-info-200");

    // Given for the dark mode alone, it leaves the light one as it is
    render(
      <Toast
        colorClassName="dark:text-white"
        message="Note"
        variant="warning"
      />,
    );
    const note = screen.getByText("Note").closest<HTMLElement>("[data-toast]")!;
    expect(note).toHaveClass("text-warning-800", "dark:text-white");
    expect(note).not.toHaveClass("dark:text-warning-200");
  });

  it("takes an important color in place of the variant's one too", () => {
    const toastOf = (text: string) =>
      screen.getByText(text).closest<HTMLElement>("[data-toast]")!;
    render(
      <>
        <Toast colorClassName="!bg-white" message="Saved" variant="success" />
        <Toast colorClassName="bg-white!" message="Sent" variant="info" />
        <Toast
          colorClassName="!text-neutral-900 border-neutral-900!"
          message="Note"
          variant="warning"
        />
        <Toast
          colorClassName="bg-white dark:bg-neutral-900!"
          message="Done"
          variant="danger"
        />
      </>,
    );

    // The important white wins in the dark mode too - with the light text,
    // not the dark mode's light one
    for (const [text, tone] of [
      ["Saved", "success"],
      ["Sent", "info"],
    ]) {
      const toast = toastOf(text);
      expect(toast).toHaveClass(`text-${tone}-800`, `border-${tone}-200`);
      expect(toast).not.toHaveClass(`bg-${tone}-50`);
      expect(toast).not.toHaveClass(`dark:bg-${tone}-900`);
      expect(toast).not.toHaveClass(`dark:text-${tone}-200`);
    }
    expect(toastOf("Saved")).toHaveClass("!bg-white");
    expect(toastOf("Sent")).toHaveClass("bg-white!");

    const note = toastOf("Note");
    expect(note).toHaveClass("!text-neutral-900", "border-neutral-900!");
    expect(note).toHaveClass("bg-warning-50");
    expect(note).not.toHaveClass("text-warning-800");
    expect(note).not.toHaveClass("dark:text-warning-200");
    expect(note).not.toHaveClass("dark:bg-warning-900");
    expect(note).not.toHaveClass("border-warning-200");
    expect(note).not.toHaveClass("dark:border-warning-800");

    // Given for the dark mode, important there
    const done = toastOf("Done");
    expect(done).toHaveClass("dark:bg-neutral-900!", "dark:text-danger-200");
    expect(done).not.toHaveClass("dark:bg-danger-900");
  });

  it("keeps the colors of its variant with classes that only look like colors", () => {
    render(
      <>
        {/* The angle of a gradient, and an opacity of Tailwind 3 */}
        <Toast
          colorClassName="bg-linear-50"
          message="Saved"
          variant="success"
        />
        <Toast colorClassName="bg-opacity-50" message="Note" variant="info" />
      </>,
    );

    expect(
      screen.getByText("Saved").closest<HTMLElement>("[data-toast]"),
    ).toHaveClass(
      "bg-linear-50",
      "bg-success-50",
      "dark:bg-success-900",
      "dark:text-success-200",
    );
    expect(
      screen.getByText("Note").closest<HTMLElement>("[data-toast]"),
    ).toHaveClass("bg-info-50", "dark:bg-info-900", "dark:text-info-200");
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
