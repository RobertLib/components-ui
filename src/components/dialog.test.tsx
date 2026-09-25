import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./confirm-dialog";
import DateTimePicker from "./datetime-picker";
import Dialog from "./dialog";
import Dropdown from "./dropdown";
import FileUpload from "./file-upload";
import Popover from "./popover";
import Tooltip from "./tooltip";
import SnackbarProvider from "../providers/snackbar-provider";
import { useSnackbar } from "../providers/snackbar-context";

const noop = () => {};

// Longer than the moment a dialog is rendered closed before it opens
const openAnimation = () => new Promise((resolve) => setTimeout(resolve, 20));

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
      expect(
        screen.getByRole("alertdialog", { name: "Delete?" }),
      ).toBeInTheDocument();
      await user.keyboard("{Escape}");

      expect(onEditClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
      expect(
        screen.queryByRole("alertdialog", { name: "Delete?" }),
      ).not.toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(onEditClose).toHaveBeenCalledTimes(1);
    },
  );

  it("leaves alone an Escape that something inside has handled", async () => {
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

  it("takes the focus itself when nothing in it can have it", async () => {
    const user = userEvent.setup();
    const upload = vi.fn();

    function Upload() {
      const [busy, setBusy] = useState(false);
      return (
        <>
          <button
            onClick={() => {
              upload();
              setBusy(true);
            }}
          >
            Upload
          </button>
          <Dialog closeDisabled={busy} open={busy} title="Uploading…">
            <p>Please wait</p>
          </Dialog>
        </>
      );
    }

    render(<Upload />);
    await user.click(screen.getByRole("button", { name: "Upload" }));
    // Not left on the button under the dialog, where Enter presses it again
    expect(screen.getByRole("dialog", { name: "Uploading…" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(upload).toHaveBeenCalledTimes(1);
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

    // Hidden from assistive technology behind the dialog
    act(() =>
      screen.getByRole("button", { hidden: true, name: "Behind" }).focus(),
    );
    expect(name).toHaveFocus();
  });

  it("leaves Tab to the browser on a control amid the others it stops at", () => {
    render(
      <Dialog open title="Help">
        <button type="button">First</button>
        <details>
          <summary>Shipping</summary>
          Within two days.
        </details>
        <iframe title="Map" />
        <button type="button">Last</button>
      </Dialog>,
    );

    for (const name of ["Shipping", "Map"]) {
      const control = screen.queryByText(name) ?? screen.getByTitle(name);
      act(() => control.focus());
      // Neither taken to the first control nor to the last - Tab goes on
      // to the next one by itself
      expect(fireEvent.keyDown(control, { key: "Tab" })).toBe(true);
      expect(fireEvent.keyDown(control, { key: "Tab", shiftKey: true })).toBe(
        true,
      );
      expect(control).toHaveFocus();
    }
  });

  it("goes round from an element focused by a script past the last control", () => {
    render(
      <Dialog open title="Report">
        <button type="button">Export</button>
        <p tabIndex={-1}>3 errors</p>
      </Dialog>,
    );

    const errors = screen.getByText("3 errors");
    act(() => errors.focus());
    // Before it the browser goes back by itself
    expect(fireEvent.keyDown(errors, { key: "Tab", shiftKey: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(errors, { key: "Tab" })).toBe(false);
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
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
    // Behind the dialog, hidden from assistive technology
    const panel = screen.getByRole("dialog", { hidden: true, name: "Actions" });
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

describe("Dialog giving the focus back", () => {
  it("keeps a popover it was opened from open under it, also rendered elsewhere", async () => {
    const user = userEvent.setup();

    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Popover
            aria-label="Actions"
            trigger={<span>Actions</span>}
            triggerType="click"
          >
            <input aria-label="Draft" />
            <button onClick={() => setOpen(true)} type="button">
              Rename
            </button>
          </Popover>
          <Dialog onClose={() => setOpen(false)} open={open} title="Rename">
            <input aria-label="Name" />
          </Dialog>
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.type(screen.getByRole("textbox", { name: "Draft" }), "Q3");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    await waitFor(() => expect(name).toHaveFocus());

    // Neither the focus nor a press in the dialog are outside the popover
    await user.click(name);
    expect(
      screen.getByRole("dialog", { hidden: true, name: "Actions" }),
    ).toBeInTheDocument();

    // Closed, the dialog gives the focus back into the panel, with its draft
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Rename" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rename" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Q3");
  });

  it("gives it to the next Tab stop when what opened it is gone - else to the one before", async () => {
    const user = userEvent.setup();

    function Rows() {
      const [rows, setRows] = useState(["A", "B", "C"]);
      const [asking, setAsking] = useState<string | null>(null);
      return (
        <>
          {rows.map((row) => (
            <button key={row} onClick={() => setAsking(row)} type="button">
              Delete {row}
            </button>
          ))}
          <ConfirmDialog
            onClose={() => setAsking(null)}
            onConfirm={() => {
              setRows((current) => current.filter((row) => row !== asking));
              setAsking(null);
            }}
            open={asking !== null}
            title="Delete?"
          />
        </>
      );
    }

    render(<Rows />);
    await user.click(screen.getByRole("button", { name: "Delete B" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    // Not lost to the page with the deleted row
    expect(screen.getByRole("button", { name: "Delete C" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Delete C" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("button", { name: "Delete A" })).toHaveFocus();
  });

  it("gives it to the popover's trigger when the button that opened it is gone", async () => {
    const user = userEvent.setup();

    function Page() {
      const [menu, setMenu] = useState(false);
      const [open, setOpen] = useState(false);
      return (
        <>
          <Popover
            aria-label="Actions"
            onOpenChange={setMenu}
            open={menu}
            trigger={<span>Actions</span>}
            triggerType="click"
          >
            <button
              onClick={() => {
                setMenu(false);
                setOpen(true);
              }}
              type="button"
            >
              Rename
            </button>
          </Popover>
          <Dialog onClose={() => setOpen(false)} open={open} title="Rename">
            <input aria-label="Name" />
          </Dialog>
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    // The pick closed the popover
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("gives it to the dropdown's trigger when the pick that opened it closed the menu", async () => {
    const user = userEvent.setup();

    function Page() {
      const [confirm, setConfirm] = useState(false);
      return (
        <>
          <Dropdown
            aria-label="Actions"
            items={[{ label: "Delete", onClick: () => setConfirm(true) }]}
            trigger={<span>…</span>}
          />
          {/* After the menu - the menu and the focus in it are gone by the
              time the dialog opens in the same commit */}
          <ConfirmDialog
            onClose={() => setConfirm(false)}
            onConfirm={() => setConfirm(false)}
            open={confirm}
            title="Delete?"
          />
        </>
      );
    }

    render(<Page />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("gives it to the popover's trigger when a click closed the popover and opened it", async () => {
    const user = userEvent.setup();

    function Page() {
      const [open, setOpen] = useState(false);
      const [dialog, setDialog] = useState(false);
      return (
        <>
          <Popover
            aria-label="Actions"
            onOpenChange={setOpen}
            open={open}
            trigger={<span>Actions</span>}
            triggerType="click"
          >
            <button
              onClick={() => {
                setOpen(false);
                setDialog(true);
              }}
              type="button"
            >
              Rename
            </button>
          </Popover>
          <Dialog onClose={() => setDialog(false)} open={dialog} title="Rename">
            <input aria-label="Name" />
          </Dialog>
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });
});

describe("Dialog and Escape", () => {
  it("ignores the Escape that ends an IME composition", () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Rename">
        <input aria-label="Name" />
      </Dialog>,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.keyDown(input, { isComposing: true, key: "Escape" });
    fireEvent.keyDown(input, { key: "Escape", keyCode: 229 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Uncontrolled Dialog unmounted by its parent", () => {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function Page({ closeAfter }: { closeAfter: "open" | "closing" }) {
    const [shown, setShown] = useState(false);
    return (
      <>
        <button onClick={() => setShown(true)} type="button">
          Details
        </button>
        <button onClick={() => setShown(false)} type="button">
          Hide
        </button>
        {shown && (
          <Dialog title="Details">
            <input aria-label="Note" />
            {closeAfter === "closing" && (
              <button onClick={() => setShown(false)} type="button">
                Unmount
              </button>
            )}
          </Dialog>
        )}
      </>
    );
  }

  it.each(["open", "closing"] as const)(
    "gives the focus back when unmounted while %s",
    async (closeAfter) => {
      const user = userEvent.setup();
      render(<Page closeAfter={closeAfter} />);

      const details = screen.getByRole("button", { name: "Details" });
      await user.click(details);
      await act(() => sleep(20));
      expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus();

      if (closeAfter === "closing") {
        // Escape starts the closing animation; the parent unmounts the
        // dialog before it ends
        await user.keyboard("{Escape}");
        fireEvent.click(screen.getByRole("button", { name: "Unmount" }));
      } else {
        fireEvent.click(
          screen.getByRole("button", { hidden: true, name: "Hide" }),
        );
      }

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(details).toHaveFocus();
    },
  );

  it("leaves the focus alone once the closing animation gave it back", async () => {
    const user = userEvent.setup();
    render(<Page closeAfter="open" />);

    const details = screen.getByRole("button", { name: "Details" });
    await user.click(details);
    await act(() => sleep(20));
    await user.keyboard("{Escape}");
    await act(() => sleep(250));
    expect(details).toHaveFocus();

    // The focus has left for the page meanwhile - it stays there
    details.blur();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(document.body).toHaveFocus();
  });
});

describe("Dialog and <Activity>", () => {
  it("closes on Escape after a popover open in a hidden tab", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Settings() {
      const [tab, setTab] = useState<"general" | "advanced">("general");
      return (
        <Dialog onClose={onClose} open title="Settings">
          <button onClick={() => setTab("advanced")} type="button">
            Advanced
          </button>
          <Activity mode={tab === "general" ? "visible" : "hidden"}>
            <Popover open trigger={<span>More</span>}>
              Panel
            </Popover>
          </Activity>
        </Dialog>
      );
    }

    render(<Settings />);
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Dialog and the page behind it", () => {
  it("hides the page from assistive technology - not the toasts or a popover opened in it", async () => {
    const user = userEvent.setup();

    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <SnackbarProvider>
          <main>
            <button onClick={() => setOpen(true)} type="button">
              Edit
            </button>
          </main>
          <Dialog onClose={() => setOpen(false)} open={open} title="Edit">
            <Popover
              aria-label="Tags"
              trigger={<span>Tags</span>}
              triggerType="click"
            >
              <button type="button">Urgent</button>
            </Popover>
          </Dialog>
        </SnackbarProvider>
      );
    }

    const { container } = render(<Page />);
    const toasts = document.querySelector("[data-focus-trap-exempt]")!;
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await act(openAnimation);

    expect(container).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("main")).toBeNull();
    expect(toasts).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Tags" }));
    expect(screen.getByRole("button", { name: "Urgent" })).toBeInTheDocument();

    await user.keyboard("{Escape}{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("hides a dialog under another one, and shows it again", async () => {
    const user = userEvent.setup();
    render(<EditWithConfirm />);
    await act(openAnimation);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await act(openAnimation);
    expect(screen.queryByRole("dialog", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("alertdialog", { name: "Delete?" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
  });

  it("gives the page back the aria-hidden it had", async () => {
    const aside = document.createElement("aside");
    aside.setAttribute("aria-hidden", "false");
    document.body.append(aside);

    const { rerender } = render(<Dialog open title="Edit" />);
    await act(openAnimation);
    expect(aside).toHaveAttribute("aria-hidden", "true");

    rerender(<Dialog open={false} title="Edit" />);
    expect(aside).toHaveAttribute("aria-hidden", "false");
    aside.remove();
  });
});

describe("Dialog page scroll lock", () => {
  afterEach(() => {
    document.body.style.paddingRight = "";
  });

  it("keeps the width of the page while its scrollbar is hidden", () => {
    // A classic 15 px scrollbar beside the 1024 px jsdom window
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      1009,
    );
    document.body.style.paddingRight = "4px";

    const { rerender } = render(<Dialog open title="Edit" />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.paddingRight).toBe("19px");

    rerender(<Dialog open={false} title="Edit" />);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("4px");
  });

  it("locks a page whose root scrolls - a scrollbar always shown", () => {
    const root = document.documentElement;
    root.style.overflowY = "scroll";

    const { rerender } = render(<Dialog open title="Edit" />);
    // The root, not the body, is what scrolls then
    expect(root.style.overflow).toBe("hidden");

    rerender(<Dialog open={false} title="Edit" />);
    expect(root.style.overflowX).toBe("");
    expect(root.style.overflowY).toBe("scroll");
    root.style.overflowY = "";
  });

  it("leaves the root of a page scrolled by the body alone", () => {
    render(<Dialog open title="Edit" />);

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("");
  });
});

describe("Dialog sizes", () => {
  it("is never taller than the visible part of a phone screen", () => {
    render(<Dialog open title="Report" />);

    // The dynamic viewport - without the toolbars of a mobile browser
    expect(screen.getByRole("dialog")).toHaveClass("max-h-[90dvh]");
  });

  it("keeps a full-size dialog inside the viewport", () => {
    render(<Dialog open size="full" title="Report" />);

    const dialog = screen.getByRole("dialog");
    // Centered by the translate - a margin would push it past the right edge
    expect(dialog).toHaveClass("sm:max-w-[calc(100%-2rem)]");
    expect(dialog.className).not.toMatch(/\bsm:mx-/);
  });
});

describe("Dialog and toasts", () => {
  it("lets Tab reach the toasts shown over it", async () => {
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

    const save = screen.getByRole("button", { name: "Save" });
    await user.click(save);
    const toast = screen.getByText("Saved").closest<HTMLElement>("[tabindex]")!;
    const closeToast = screen.getByRole("button", {
      name: "Close notification",
    });
    const closeDialog = screen.getByRole("button", { name: "Close dialog" });

    // From the last control of the dialog through the toast and back
    await user.tab();
    expect(toast).toHaveFocus();
    await user.tab();
    expect(closeToast).toHaveFocus();
    await user.tab();
    expect(closeDialog).toHaveFocus();

    await user.tab({ shift: true });
    expect(closeToast).toHaveFocus();
    await user.tab({ shift: true });
    expect(toast).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
  });
});

describe("ConfirmDialog", () => {
  it("is an alert dialog described by its message", () => {
    render(
      <ConfirmDialog
        className="max-h-[50vh]"
        message="The customer will be deleted."
        onClose={noop}
        onConfirm={noop}
        open
        title="Delete?"
      />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Delete?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("The customer will be deleted.");
    expect(dialog).toHaveClass("max-h-[50vh]");
  });

  it("gives the focus back to the confirm button when loading ends and it stays open", () => {
    const confirm = (loading: boolean) => (
      <ConfirmDialog
        confirmLabel="Delete"
        loading={loading}
        onClose={noop}
        onConfirm={noop}
        open
        title="Delete?"
      />
    );
    const { rerender } = render(confirm(false));

    // A disabled button loses the focus in a browser - the dialog took it
    rerender(confirm(true));
    const dialog = screen.getByRole("alertdialog");
    act(() => dialog.focus());

    rerender(confirm(false));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });

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

describe("Dialog on the server", () => {
  it("renders nothing, then opens with the focus in it once hydrated", async () => {
    const page = (
      <main>
        <Dialog open title="Order 1042">
          <input aria-label="Note" />
        </Dialog>
      </main>
    );

    // A route dialog of a server-rendered page
    const html = renderToString(page);
    expect(html).toBe("<main></main>");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Order 1042" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    act(() => root.unmount());
    container.remove();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("Uncontrolled Dialog closing", () => {
  it("leaves the next Escape to the overlay under it while it animates out", async () => {
    const user = userEvent.setup();
    const onOuterClose = vi.fn();
    render(
      <Dialog onClose={onOuterClose} open title="Order">
        <Dialog title="Note">
          <input aria-label="Text" />
        </Dialog>
      </Dialog>,
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    await user.keyboard("{Escape}");
    // Still animating out - behind the dialog under it now
    expect(screen.getByText("Note").closest("[role='dialog']")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(onOuterClose).toHaveBeenCalledTimes(1);
  });
});
