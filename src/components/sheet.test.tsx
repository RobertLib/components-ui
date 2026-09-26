import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./confirm-dialog";
import Dialog, { DialogFooter } from "./dialog";
import Popover from "./popover";
import Sheet, { type SheetProps } from "./sheet";
import Tooltip from "./tooltip";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A customer list whose button opens the customer in a sheet. */
function CustomerPage({
  onSheetClose,
  ...props
}: Partial<SheetProps> & { onSheetClose?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Edit customer
      </button>
      <Sheet
        {...props}
        onClose={() => {
          onSheetClose?.();
          setOpen(false);
        }}
        open={open}
        title="Customer"
      >
        <input aria-label="Name" />
        <button type="button">Save</button>
      </Sheet>
    </>
  );
}

/** Opens the sheet of `CustomerPage` and waits until it has slid in. */
async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Edit customer" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus(),
  );
}

describe("Sheet", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a modal dialog named by its title", () => {
    render(
      <Sheet open title="Customer">
        <p>Details</p>
      </Sheet>,
    );

    const sheet = screen.getByRole("dialog", { name: "Customer" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    // Rendered into the body, like a Dialog
    expect(sheet.parentElement).toBe(document.body);
  });

  it("is named by aria-label without a title", () => {
    render(<Sheet aria-label="Filters" open />);

    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it("slides in and, closed, out before it goes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Sheet open={false} title="Customer" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<Sheet open title="Customer" />);
    const sheet = screen.getByRole("dialog", { name: "Customer" });
    // Rendered off the screen first, so it slides in
    expect(sheet).toHaveClass("translate-x-full");
    act(() => vi.advanceTimersByTime(10));
    expect(sheet).not.toHaveClass("translate-x-full");
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Sheet open={false} title="Customer" />);
    expect(sheet).toHaveClass("translate-x-full", "pointer-events-none");
    act(() => vi.advanceTimersByTime(299));
    expect(screen.getByRole("dialog")).toBe(sheet);
    // The page stays locked until the sheet is gone
    expect(document.body.style.overflow).toBe("hidden");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("fades instead of sliding for users who prefer reduced motion", () => {
    render(<Sheet open side="left" title="Filters" />);

    // Before it opens: the closed position, which reduced motion keeps
    // in place and hides by its opacity
    expect(screen.getByRole("dialog")).toHaveClass(
      "-translate-x-full",
      "motion-reduce:translate-x-0",
      "motion-reduce:opacity-0",
      "motion-reduce:transition-opacity",
    );
  });

  it("slides back in when opened again while it slides out", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Sheet open title="Customer" />);
    act(() => vi.advanceTimersByTime(10));

    rerender(<Sheet open={false} title="Customer" />);
    act(() => vi.advanceTimersByTime(100));
    rerender(<Sheet open title="Customer" />);
    act(() => vi.advanceTimersByTime(400));

    const sheet = screen.getByRole("dialog", { name: "Customer" });
    expect(sheet).not.toHaveClass("translate-x-full");
    expect(sheet).not.toHaveClass("pointer-events-none");
  });

  it("gives the focus back to the button it was opened again from while sliding out", async () => {
    const user = userEvent.setup();

    function Customers() {
      const [open, setOpen] = useState<string | null>(null);
      return (
        <>
          {["Jana", "Petr"].map((name) => (
            <button key={name} onClick={() => setOpen(name)} type="button">
              {name}
            </button>
          ))}
          <Sheet
            onClose={() => setOpen(null)}
            open={open !== null}
            title="Customer"
          >
            <input aria-label="Note" />
          </Sheet>
        </>
      );
    }

    render(<Customers />);
    await user.click(screen.getByRole("button", { name: "Jana" }));
    await act(() => sleep(20));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Jana" })).toHaveFocus();

    // Still sliding out - the next customer opens it again
    await user.click(screen.getByRole("button", { name: "Petr" }));
    await act(() => sleep(20));
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Petr" })).toHaveFocus();
  });

  it.each([
    ["right", "right-0", "translate-x-full"],
    ["left", "left-0", "-translate-x-full"],
    ["top", "top-0", "-translate-y-full"],
    ["bottom", "bottom-0", "translate-y-full"],
  ] as const)("slides in from the %s edge", (side, edgeClass, closedClass) => {
    render(<Sheet open side={side} title="Customer" />);

    const sheet = screen.getByRole("dialog");
    expect(sheet).toHaveClass(edgeClass, closedClass);
  });

  it("takes the width of its size on the side, the height at the top", () => {
    const { rerender } = render(<Sheet open size="lg" title="Customer" />);
    // Full width on phones, the size from the sm breakpoint up
    expect(screen.getByRole("dialog")).toHaveClass("w-full", "sm:max-w-lg");

    rerender(<Sheet open side="bottom" size="lg" title="Customer" />);
    expect(screen.getByRole("dialog")).toHaveClass("max-h-[min(32rem,100dvh)]");
    expect(screen.getByRole("dialog")).not.toHaveClass("sm:max-w-lg");
  });

  it("takes the focus, keeps it and gives it back as it closes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CustomerPage />
        <button type="button">Behind</button>
      </>,
    );
    const edit = screen.getByRole("button", { name: "Edit customer" });

    await openSheet(user);
    const name = screen.getByRole("textbox", { name: "Name" });

    // Tab cycles inside, focus that lands on the page comes back
    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await user.tab();
    expect(name).toHaveFocus();
    act(() =>
      screen.getByRole("button", { hidden: true, name: "Behind" }).focus(),
    );
    expect(name).toHaveFocus();

    // Back on the trigger as soon as it starts sliding out
    await user.keyboard("{Escape}");
    expect(edit).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(edit).toHaveFocus();
  });

  it("closes with its close button", async () => {
    const user = userEvent.setup();
    const onSheetClose = vi.fn();
    render(<CustomerPage onSheetClose={onSheetClose} />);

    await openSheet(user);
    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(onSheetClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Edit customer" })).toHaveFocus();
  });

  it("stays open with closeDisabled", async () => {
    const user = userEvent.setup();
    const onSheetClose = vi.fn();
    render(
      <CustomerPage
        closeDisabled
        closeOnBackdropClick
        onSheetClose={onSheetClose}
      />,
    );

    await openSheet(user);
    await user.keyboard("{Escape}");
    fireEvent.click(screen.getByRole("dialog").previousElementSibling!);

    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
    expect(onSheetClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the backdrop only with closeOnBackdropClick", async () => {
    const user = userEvent.setup();
    const onSheetClose = vi.fn();
    const { rerender } = render(<CustomerPage onSheetClose={onSheetClose} />);

    await openSheet(user);
    const backdrop = screen.getByRole("dialog").previousElementSibling!;
    // The press keeps the focus in the sheet
    expect(fireEvent.mouseDown(backdrop)).toBe(false);
    fireEvent.click(backdrop);
    expect(onSheetClose).not.toHaveBeenCalled();

    rerender(<CustomerPage closeOnBackdropClick onSheetClose={onSheetClose} />);
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onSheetClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when the press on the backdrop closes a menu in it", () => {
    const onClose = vi.fn();
    render(
      <Sheet closeOnBackdropClick onClose={onClose} open title="Filters">
        <Popover open trigger={<button type="button">More</button>}>
          Options
        </Popover>
      </Sheet>,
    );

    const backdrop = screen.getByRole("dialog", {
      name: "Filters",
    }).previousElementSibling!;
    fireEvent.pointerDown(backdrop);
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the backdrop while a tooltip in it is shown", async () => {
    // As in the browsers, the focus moved after a key press is visible - so
    // is the focus the sheet opened from the keyboard gives its first control
    const { matches } = Element.prototype;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible"
        ? this === document.activeElement
        : matches.call(this, selector);
    });
    const onClose = vi.fn();
    render(
      <Sheet closeOnBackdropClick onClose={onClose} open title="Filters">
        <Tooltip title="Reload the list">
          <button type="button">Reload</button>
        </Tooltip>
      </Sheet>,
    );

    // Shown for the focus, which the press on the backdrop keeps
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reload" })).toHaveFocus(),
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Reload the list");

    const backdrop = screen.getByRole("dialog", {
      name: "Filters",
    }).previousElementSibling!;
    fireEvent.pointerDown(backdrop);
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores the Escape that ends an IME composition", async () => {
    const user = userEvent.setup();
    const onSheetClose = vi.fn();
    render(<CustomerPage onSheetClose={onSheetClose} />);

    await openSheet(user);
    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.keyDown(name, { isComposing: true, key: "Escape" });
    expect(onSheetClose).not.toHaveBeenCalled();

    fireEvent.keyDown(name, { key: "Escape" });
    expect(onSheetClose).toHaveBeenCalledTimes(1);
  });

  it("opens by itself when uncontrolled and reports closing after sliding out", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Route() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button onClick={() => setShown(true)} type="button">
            Order 1042
          </button>
          {shown && (
            <Sheet
              onClose={() => {
                onClose();
                setShown(false);
              }}
              title="Order 1042"
            >
              <input aria-label="Note" />
            </Sheet>
          )}
        </>
      );
    }

    render(<Route />);
    const trigger = screen.getByRole("button", { name: "Order 1042" });
    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    // Called once it has slid out
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("Sheet switching its content", () => {
  function DetailOrForm() {
    const [editing, setEditing] = useState(false);
    return (
      <Sheet open title="Customer">
        {editing ? (
          <input aria-label="Name" />
        ) : (
          <button onClick={() => setEditing(true)} type="button">
            Edit
          </button>
        )}
      </Sheet>
    );
  }

  it("keeps the focus in it when the focused element goes", async () => {
    const user = userEvent.setup();
    render(<DetailOrForm />);

    const edit = screen.getByRole("button", { name: "Edit" });
    await waitFor(() => expect(edit).toHaveFocus());
    await user.click(edit);

    // On the sheet, not the page - the next Tab goes on inside
    const sheet = screen.getByRole("dialog", { name: "Customer" });
    await waitFor(() => expect(sheet).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  });

  it("leaves the focus to an autoFocus field of the new content", async () => {
    const user = userEvent.setup();

    function WithAutoFocus() {
      const [editing, setEditing] = useState(false);
      return (
        <Sheet open title="Customer">
          {editing ? (
            <>
              <input aria-label="Email" />
              <input aria-label="Name" autoFocus />
            </>
          ) : (
            <button onClick={() => setEditing(true)} type="button">
              Edit
            </button>
          )}
        </Sheet>
      );
    }

    render(<WithAutoFocus />);
    const edit = screen.getByRole("button", { name: "Edit" });
    await waitFor(() => expect(edit).toHaveFocus());
    await user.click(edit);
    await act(() => sleep(20));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });
});

describe("Sheet in the overlay stack", () => {
  it.each([
    // Chrome focuses the clicked button
    ["Chrome", (button: HTMLElement) => button],
    // WebKit focuses no clicked button, but its nearest focusable ancestor:
    // the panel of the sheet (`tabIndex={-1}`)
    [
      "Safari",
      (button: HTMLElement) => button.closest<HTMLElement>("[tabindex]")!,
    ],
  ])(
    "gives the focus back to the button a ConfirmDialog in it was opened from - %s",
    async (_, focusedOnPress) => {
      function SheetWithConfirm() {
        const [confirming, setConfirming] = useState(false);
        return (
          <Sheet onClose={() => {}} open title="Jana Nováková">
            <button onClick={() => setConfirming(true)} type="button">
              Delete
            </button>
            <ConfirmDialog
              confirmLabel="Delete"
              onClose={() => setConfirming(false)}
              onConfirm={() => setConfirming(false)}
              open={confirming}
              title="Delete the customer?"
            />
          </Sheet>
        );
      }
      render(<SheetWithConfirm />);
      await act(() => sleep(350));

      const del = screen.getByRole("button", { name: "Delete" });
      fireEvent.pointerDown(del);
      fireEvent.mouseDown(del);
      act(() => focusedOnPress(del).focus());
      fireEvent.mouseUp(del);
      fireEvent.click(del);
      await waitFor(() =>
        expect(screen.getByRole("alertdialog")).toContainElement(
          document.activeElement as HTMLElement,
        ),
      );

      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await act(() => sleep(250));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(del).toHaveFocus();
    },
  );

  it("closes a ConfirmDialog opened in it first", async () => {
    const user = userEvent.setup();
    const onSheetClose = vi.fn();

    function DeleteFromSheet() {
      const [confirm, setConfirm] = useState(false);
      return (
        <Sheet onClose={onSheetClose} open title="Customer">
          <button onClick={() => setConfirm(true)} type="button">
            Delete
          </button>
          <ConfirmDialog
            onClose={() => setConfirm(false)}
            onConfirm={() => setConfirm(false)}
            open={confirm}
            title="Delete the customer?"
          />
        </Sheet>
      );
    }

    render(<DeleteFromSheet />);
    const remove = screen.getByRole("button", { name: "Delete" });
    await waitFor(() => expect(remove).toHaveFocus());
    await user.click(remove);
    expect(
      screen.getByRole("alertdialog", { name: "Delete the customer?" }),
    ).toBeInTheDocument();
    // The focus is in the confirm dialog, which traps it
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onSheetClose).not.toHaveBeenCalled();
    expect(remove).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onSheetClose).toHaveBeenCalledTimes(1);
  });

  it("closes a popover opened in it first", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose} open title="Filters">
        <Popover
          aria-label="Sort"
          trigger={<span>Sort</span>}
          triggerType="click"
        >
          <button type="button">By name</button>
        </Popover>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Sort" }));
    const byName = screen.getByRole("button", { name: "By name" });
    // A Sheet under the popover lets the focus into its panel
    act(() => byName.focus());
    expect(byName).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "By name" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes before a Dialog it was opened from, and leaves the next Escape to it", async () => {
    const user = userEvent.setup();
    const onDialogClose = vi.fn();

    function OrderDialog() {
      const [sheet, setSheet] = useState(false);
      return (
        <Dialog onClose={onDialogClose} open title="Order">
          <button onClick={() => setSheet(true)} type="button">
            Customer
          </button>
          <Sheet
            onClose={() => setSheet(false)}
            open={sheet}
            title="Customer detail"
          >
            <input aria-label="Name" />
          </Sheet>
        </Dialog>
      );
    }

    render(<OrderDialog />);
    const customer = screen.getByRole("button", { name: "Customer" });
    await user.click(customer);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(customer).toHaveFocus();

    // Still sliding out - but no longer in the way of the Dialog
    expect(
      screen.getByRole("dialog", { name: "Customer detail" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onDialogClose).toHaveBeenCalledTimes(1);
  });
});

describe("Sheet with a DialogFooter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves the height of the footer free under the content", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === "footer" ? 90 : 0;
      },
    );

    render(
      <Sheet open title="Customer">
        <form>
          <input aria-label="Name" />
          <DialogFooter data-testid="footer">
            <button type="submit">Save</button>
          </DialogFooter>
        </form>
      </Sheet>,
    );

    const footer = screen.getByTestId("footer");
    const body = footer.closest<HTMLElement>(".overflow-y-auto")!;
    expect(body.style.paddingBottom).toBe("calc(90px + 1.5rem)");
    // Square, at the edge of the screen
    expect(footer).not.toHaveClass("rounded-b-lg");
    expect(footer).toHaveClass("absolute", "bottom-0");
  });

  it("keeps the room of the footer of a Dialog opened in it to that Dialog", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(60);

    render(
      <Sheet open title="Customer">
        <p>Details</p>
        <ConfirmDialog
          onClose={() => {}}
          onConfirm={() => {}}
          open
          title="Delete?"
        />
      </Sheet>,
    );

    const sheetBody = screen
      .getByText("Details")
      .closest<HTMLElement>(".overflow-y-auto")!;
    expect(sheetBody.style.paddingBottom).toBe("");

    const confirmFooter = screen
      .getByRole("button", { name: "Confirm" })
      .closest(".absolute")!;
    expect(confirmFooter).toHaveClass("rounded-b-lg");
  });

  it("passes its ref on", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Sheet open title="Customer">
        <DialogFooter ref={ref}>Buttons</DialogFooter>
      </Sheet>,
    );

    expect(ref.current).toHaveTextContent("Buttons");
  });
});

describe("Sheet on the server", () => {
  it("renders nothing, then opens once hydrated", async () => {
    const page = (
      <div>
        <Sheet open title="Customer">
          <p>Details</p>
        </Sheet>
      </div>
    );

    // Next.js renders "use client" components on the server too
    const html = renderToString(page);
    expect(html).toBe("<div></div>");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    await act(() => sleep(20));
    expect(
      screen.getByRole("dialog", { name: "Customer" }),
    ).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });
});
