import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./confirm-dialog";
import DateTimePicker from "./datetime-picker";
import Dialog from "./dialog";
import FileUpload from "./file-upload";
import Popover from "./popover";
import Tooltip from "./tooltip";
import SnackbarProvider from "../providers/snackbar-provider";
import { useSnackbar } from "../providers/snackbar-context";

const noop = () => {};

/**
 * An edit dialog whose delete button asks in a ConfirmDialog. The stable
 * `onEditClose` keeps the edit dialog's key listener from being registered
 * anew on each render.
 */
function EditWithConfirm({
  nested = false,
  onEditClose = noop,
}: {
  nested?: boolean;
  onEditClose?: () => void;
}) {
  const [edit, setEdit] = useState(true);
  const [confirm, setConfirm] = useState(false);

  const confirmDialog = (
    <ConfirmDialog
      onClose={() => setConfirm(false)}
      onConfirm={() => {
        setConfirm(false);
        setEdit(false);
      }}
      open={confirm}
      title="Delete?"
    />
  );

  return (
    <>
      <Dialog onClose={onEditClose} open={edit} title="Edit">
        <button onClick={() => setConfirm(true)}>Delete</button>
        {nested && confirmDialog}
      </Dialog>
      {!nested && confirmDialog}
    </>
  );
}

describe("Dialog", () => {
  it.each([false, true])(
    "unlocks the page scroll when two dialogs close at once (nested: %s)",
    async (nested) => {
      const user = userEvent.setup();
      render(<EditWithConfirm nested={nested} />);

      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(document.body.style.overflow).toBe("hidden");

      await user.click(screen.getByRole("button", { name: "Confirm" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");
    },
  );

  it.each([false, true])(
    "closes only the topmost dialog on Escape (nested: %s)",
    async (nested) => {
      const user = userEvent.setup();
      const onEditClose = vi.fn();
      render(<EditWithConfirm nested={nested} onEditClose={onEditClose} />);

      await user.click(screen.getByRole("button", { name: "Delete" }));
      await user.keyboard("{Escape}");

      expect(onEditClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
      expect(
        screen.queryByRole("dialog", { name: "Delete?" }),
      ).not.toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(onEditClose).toHaveBeenCalledTimes(1);
    },
  );

  it("leaves Escape to a popover inside that handled it first", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const handledByPopover = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", handledByPopover, true);

    render(
      <Dialog onClose={onClose} open title="Filters">
        <input aria-label="Name" />
      </Dialog>,
    );
    await user.keyboard("{Escape}");

    document.removeEventListener("keydown", handledByPopover, true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves the focus to the first visible field, past hidden inputs", () => {
    render(
      <Dialog open title="Filters">
        <DateTimePicker label="From" name="from" required type="date" />
        <input aria-label="Note" />
      </Dialog>,
    );

    expect(screen.getByRole("combobox", { name: /From/ })).toHaveFocus();
  });

  it("wraps Tab around the last visible control", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open title="Attach">
        <input aria-label="Note" />
        <FileUpload upload={async () => ({})} />
      </Dialog>,
    );

    act(() => screen.getByRole("button", { name: "Upload" }).focus());
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Upload" })).toHaveFocus();
  });

  it("reports closing an uncontrolled dialog once", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} title="Order">
        <p>Details</p>
      </Dialog>,
    );
    act(() => vi.advanceTimersByTime(20));

    const close = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(close);
    fireEvent.click(close);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(500));

    vi.useRealTimers();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives the focus back to the trigger after an autoFocus field", async () => {
    const user = userEvent.setup();

    function Rename() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Rename</button>
          <Dialog onClose={() => setOpen(false)} open={open} title="Rename">
            <input aria-label="First" />
            <input aria-label="Name" autoFocus />
          </Dialog>
        </>
      );
    }

    render(<Rename />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Rename" })).toHaveFocus();
  });
});

describe("Dialog focus trap", () => {
  const renderWithPage = () =>
    render(
      <>
        <button type="button">Behind</button>
        <Dialog open title="Edit">
          <input aria-label="Name" />
          <button type="button">Save</button>
        </Dialog>
      </>,
    );

  it("brings Tab back into the dialog after the focus got out of it", async () => {
    const user = userEvent.setup();
    renderWithPage();

    // A click on the backdrop or the page leaves the focus on the body
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.body).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    act(() => (document.activeElement as HTMLElement).blur());
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  });

  it("moves focus that lands on the page back into the dialog", () => {
    renderWithPage();
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toHaveFocus();

    act(() => screen.getByRole("button", { name: "Behind" }).focus());
    expect(name).toHaveFocus();
  });

  it("keeps the focus on the dialog when its backdrop is pressed", () => {
    renderWithPage();
    const backdrop = screen.getByRole("dialog").previousElementSibling!;

    expect(fireEvent.mouseDown(backdrop)).toBe(false);
  });

  it("lets the focus into a popover opened in it", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open title="Edit">
        <Popover
          aria-label="More"
          trigger={<span>More</span>}
          triggerType="click"
        >
          <button type="button">Inside</button>
        </Popover>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "More" }));
    act(() => screen.getByRole("button", { name: "Inside" }).focus());
    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
  });
});

describe("Dialog in the overlay stack", () => {
  it("closes the inner dialog first when both open in one commit", async () => {
    const user = userEvent.setup();
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(
      <Dialog onClose={onOuterClose} open title="Outer">
        <Dialog onClose={onInnerClose} open title="Inner">
          <input aria-label="Name" />
        </Dialog>
      </Dialog>,
    );

    await user.keyboard("{Escape}");
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("gets Escape before a popover it was opened from, and paints above it", async () => {
    const user = userEvent.setup();
    const onDialogClose = vi.fn();

    function FromPopover() {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          aria-label="Actions"
          trigger={<span>Actions</span>}
          triggerType="click"
        >
          <button onClick={() => setOpen(true)} type="button">
            Rename
          </button>
          <Dialog
            onClose={() => {
              onDialogClose();
              setOpen(false);
            }}
            open={open}
            title="Rename"
          >
            <input aria-label="Name" />
          </Dialog>
        </Popover>
      );
    }

    render(<FromPopover />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));

    const dialog = screen.getByRole("dialog", { name: "Rename" });
    const panel = screen.getByRole("dialog", { name: "Actions" });
    // The focus moved into the dialog - the popover it belongs to stays
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    // Same z-index, later in the page
    expect(panel.parentElement).toHaveStyle({ zIndex: "50" });
    expect(dialog).toHaveClass("z-50");
    expect(
      panel.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(onDialogClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Rename" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
  });

  it("stays open when Escape hides a tooltip in it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Edit">
        <input aria-label="Name" />
        <Tooltip title="Saves the draft">
          <button type="button">Save</button>
        </Tooltip>
      </Dialog>,
    );

    // From the field that took the focus on to the button
    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // Nothing shown any more - this Escape is the dialog's
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows toasts above it and lets the focus into them", async () => {
    const user = userEvent.setup();

    function Notify() {
      const { enqueueSnackbar } = useSnackbar();
      return (
        <Dialog open title="Edit">
          <button
            onClick={() =>
              enqueueSnackbar("Saved", "success", { persist: true })
            }
            type="button"
          >
            Save
          </button>
        </Dialog>
      );
    }

    render(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    const close = screen.getByRole("button", { name: "Close notification" });
    const region = close.closest("[data-focus-trap-exempt]")!;
    expect(region).toHaveClass("z-60");
    expect(region.parentElement).toBe(document.body);

    act(() => close.focus());
    expect(close).toHaveFocus();
    await user.click(close);
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("cannot be cancelled while loading", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        loading
        onClose={onClose}
        onConfirm={() => {}}
        open
        title="Delete?"
      />,
    );

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
