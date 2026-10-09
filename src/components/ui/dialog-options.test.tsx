import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog, { DialogFooter } from "./dialog";

const backdropOf = (dialog: HTMLElement) => dialog.previousElementSibling!;

describe("Dialog closeOnBackdropClick", () => {
  it("stays open on a click on the backdrop by default", () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} open title="Edit" />);

    const backdrop = backdropOf(screen.getByRole("dialog"));
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the backdrop - unless closeDisabled", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog closeDisabled closeOnBackdropClick onClose={onClose} open />,
    );

    const backdrop = backdropOf(screen.getByRole("dialog"));
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Dialog closeOnBackdropClick onClose={onClose} open />);
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Dialog closeOnEscape", () => {
  it("does nothing on Escape - it uses it up - and closes by its button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog closeOnEscape={false} onClose={onClose} open title="Terms">
        <button type="button">Accept</button>
      </Dialog>,
    );

    // Nothing under the dialog takes this Escape
    expect(
      fireEvent.keyDown(screen.getByRole("button", { name: "Accept" }), {
        key: "Escape",
      }),
    ).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape by default", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Terms">
        <button type="button">Accept</button>
      </Dialog>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Dialog fullScreenOnMobile", () => {
  it("fills the screen below md and is a window of its size from md up", () => {
    render(
      <Dialog fullScreenOnMobile onClose={() => {}} open size="lg" title="New">
        <DialogFooter>Buttons</DialogFooter>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "New" });
    expect(dialog).toHaveClass("inset-0", "h-dvh", "w-full");
    expect(dialog).toHaveClass(
      "md:top-1/2",
      "md:left-1/2",
      "md:max-h-[90dvh]",
      "md:rounded-lg",
      "md:max-w-lg",
    );
    expect(dialog).not.toHaveClass("rounded-lg", "sm:max-w-lg");
    // The notch and the home indicator of a phone - none from md up
    expect(dialog).toHaveClass(
      "[--cui-safe-top:env(safe-area-inset-top)]",
      "[--cui-safe-bottom:env(safe-area-inset-bottom)]",
      "md:[--cui-safe-bottom:0px]",
    );
    // The header, the content and the footer keep clear of them
    expect(dialog.querySelector("header")).toHaveClass(
      "pt-[calc(0.8125rem+var(--cui-safe-top,0px))]",
    );
    expect(screen.getByText("Buttons")).toHaveClass(
      "pb-[calc(0.8125rem+var(--cui-safe-bottom,0px))]",
    );
    // Square like the dialog below md - the corners of the window from md up
    expect(screen.getByText("Buttons")).toHaveClass("md:rounded-b-lg");
    expect(screen.getByText("Buttons")).not.toHaveClass("rounded-b-lg");
    expect(screen.getByText("Buttons").parentElement).toHaveClass(
      "pb-[calc(1.5rem+var(--cui-safe-bottom,0px))]",
    );
  });

  it("is a window on every screen by default", () => {
    render(<Dialog onClose={() => {}} open size="lg" title="New" />);

    const dialog = screen.getByRole("dialog", { name: "New" });
    expect(dialog).toHaveClass("top-1/2", "left-1/2", "rounded-lg");
    expect(dialog).toHaveClass("sm:max-w-lg");
    expect(dialog).not.toHaveClass("h-dvh");
  });
});

describe("Dialog with a DialogFooter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves the height of the footer free under the padding of the content", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === "footer" ? 65 : 0;
      },
    );

    render(
      <Dialog onClose={() => {}} open title="Rename">
        <form>
          <input aria-label="Name" />
          <DialogFooter data-testid="footer">
            <button type="submit">Save</button>
          </DialogFooter>
        </form>
      </Dialog>,
    );

    const footer = screen.getByTestId("footer");
    const body = footer.closest<HTMLElement>(".overflow-y-auto")!;
    expect(body).toHaveClass("p-6");
    expect(body.style.paddingBottom).toBe("calc(65px + 1.5rem)");
    expect(footer).toHaveClass("rounded-b-lg");
  });

  it("has the same padding at the bottom as at the top without a footer", () => {
    render(
      <Dialog onClose={() => {}} open title="Size sm">
        <p>Text</p>
      </Dialog>,
    );

    const body = screen.getByText("Text").parentElement!;
    expect(body).toHaveClass("p-6");
    expect(body.className).not.toMatch(/\bpb-/);
    expect(body.style.paddingBottom).toBe("");
  });

  it("gives the room back when the footer goes", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === "footer" ? 65 : 0;
      },
    );

    const { rerender } = render(
      <Dialog onClose={() => {}} open title="Steps">
        <p>Step</p>
        <DialogFooter data-testid="footer">Buttons</DialogFooter>
      </Dialog>,
    );

    const body = screen.getByText("Step").parentElement!;
    expect(body.style.paddingBottom).toBe("calc(65px + 1.5rem)");

    rerender(
      <Dialog onClose={() => {}} open title="Steps">
        <p>Step</p>
      </Dialog>,
    );
    expect(body.style.paddingBottom).toBe("");
  });
});

describe("Dialog onBeforeClose", () => {
  it("keeps the dialog open when it answers false", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onBeforeClose = vi.fn(() => false);
    render(
      <Dialog
        closeOnBackdropClick
        onBeforeClose={onBeforeClose}
        onClose={onClose}
        open
        title="Edit"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    await user.keyboard("{Escape}");
    const backdrop = backdropOf(screen.getByRole("dialog"));
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);

    expect(onBeforeClose).toHaveBeenCalledTimes(3);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("waits for a promise - and for one answer at a time", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let answer: (close: boolean) => void = () => {};
    const onBeforeClose = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    render(
      <Dialog
        onBeforeClose={onBeforeClose}
        onClose={onClose}
        open
        title="Edit"
      />,
    );

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onBeforeClose).toHaveBeenCalledOnce();

    await act(async () => answer(false));
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await act(async () => answer(true));
    expect(onBeforeClose).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes once the answer comes only if it still may", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let answer: (close: boolean) => void = () => {};
    const ask = () =>
      new Promise<boolean>((resolve) => {
        answer = resolve;
      });
    const { rerender } = render(
      <Dialog onBeforeClose={ask} onClose={onClose} open title="Edit" />,
    );

    await user.keyboard("{Escape}");
    // Saving started meanwhile
    rerender(
      <Dialog
        closeDisabled
        onBeforeClose={ask}
        onClose={onClose}
        open
        title="Edit"
      />,
    );
    await act(async () => answer(true));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks anew when opened again after its owner closed it", async () => {
    const user = userEvent.setup();
    const onBeforeClose = vi.fn(() => new Promise<boolean>(() => {}));
    const { rerender } = render(
      <Dialog onBeforeClose={onBeforeClose} onClose={() => {}} open />,
    );

    await user.keyboard("{Escape}");
    rerender(
      <Dialog onBeforeClose={onBeforeClose} onClose={() => {}} open={false} />,
    );
    rerender(<Dialog onBeforeClose={onBeforeClose} onClose={() => {}} open />);
    await user.keyboard("{Escape}");

    expect(onBeforeClose).toHaveBeenCalledTimes(2);
  });
});

describe("Dialog bodyClassName", () => {
  it("adds classes to the scrolling body", () => {
    render(
      <Dialog bodyClassName="flex flex-col p-4" onClose={() => {}} open>
        <p>Text</p>
      </Dialog>,
    );

    const body = screen.getByText("Text").parentElement!;
    expect(body).toHaveClass("flex", "flex-col", "p-4");
    expect(body).not.toHaveClass("p-6");
  });

  it("paints its body with the dialog token, its header with the surface", () => {
    render(<Dialog onClose={() => {}} open title="Edit" />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("bg-dialog", "dark:bg-dialog-dark");
    expect(dialog.querySelector("header")).toHaveClass("bg-surface");
  });
});
