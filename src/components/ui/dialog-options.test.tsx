import { fireEvent, render, screen } from "@testing-library/react";
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
