import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ContextMenu from "./context-menu";
import Dialog from "./dialog";
import Dropdown from "./dropdown";
import Overlay from "./overlay";
import Popover from "./popover";
import Tooltip from "./tooltip";
import { getActiveElement } from "./overlay-stack";
import SnackbarProvider from "../providers/snackbar-provider";
import { useSnackbar } from "../providers/snackbar-context";
import UIProvider from "../providers/ui-provider";

/**
 * A dialog opened by a button - it gives the focus back there. With `more`,
 * a popover in it.
 */
function DialogButton({ more = false }: { more?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Open
      </button>
      <button type="button">Elsewhere</button>
      <Dialog onClose={() => setOpen(false)} open={open} title="Edit">
        <input aria-label="Name" />
        {more && (
          <Popover trigger="More" triggerType="click">
            More options
          </Popover>
        )}
      </Dialog>
    </>
  );
}

function Toaster() {
  const { enqueueSnackbar } = useSnackbar();
  return (
    <button onClick={() => enqueueSnackbar("Saved")} type="button">
      Save
    </button>
  );
}

describe("A portalContainer in the page", () => {
  let portalRoot: HTMLDivElement;

  beforeEach(() => {
    portalRoot = document.createElement("div");
    portalRoot.id = "portal-root";
    document.body.append(portalRoot);
  });

  afterEach(() => {
    portalRoot.remove();
  });

  it("gets the dialogs - the page behind is hidden, the focus goes in and back", async () => {
    const user = userEvent.setup();
    // Rendered there before the dialog, e.g. by another library
    const before = document.createElement("div");
    portalRoot.append(before);
    const { container } = render(
      <UIProvider portalContainer={portalRoot}>
        <DialogButton more />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Edit" });
    expect(portalRoot).toContainElement(dialog);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    // Added after the dialog - opened from it - and the stack changing
    const after = document.createElement("div");
    portalRoot.append(after);
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(portalRoot).toContainElement(screen.getByText("More options"));

    // The page is hidden, and what was there before the dialog - not the
    // container of the dialog, nor what it opened
    expect(container).toHaveAttribute("aria-hidden", "true");
    expect(before).toHaveAttribute("aria-hidden", "true");
    expect(portalRoot).not.toHaveAttribute("aria-hidden");
    expect(after).not.toHaveAttribute("aria-hidden");

    await user.keyboard("{Escape}{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
    expect(container).not.toHaveAttribute("aria-hidden");
    expect(before).not.toHaveAttribute("aria-hidden");
    expect(document.body.style.overflow).toBe("");
  });

  it("gets the popovers, tooltips, menus, submenus, context menus, toasts and backdrops", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider portalContainer={() => portalRoot}>
        <SnackbarProvider>
          <Popover trigger="Filters" triggerType="click">
            Panel
          </Popover>
          <Tooltip open title="Help">
            <button type="button">?</button>
          </Tooltip>
          <Dropdown
            aria-label="Actions"
            items={[{ items: [{ label: "PDF" }], label: "Export" }]}
            trigger="…"
          />
          <ContextMenu items={[{ label: "Rename" }]}>
            <div tabIndex={0}>report.pdf</div>
          </ContextMenu>
          <Toaster />
          <Overlay data-testid="backdrop" />
        </SnackbarProvider>
      </UIProvider>,
    );

    expect(portalRoot).toContainElement(screen.getByRole("tooltip"));
    expect(portalRoot).toContainElement(screen.getByTestId("backdrop"));

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(portalRoot).toContainElement(screen.getByRole("dialog"));

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(portalRoot).toContainElement(screen.getByRole("menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export" }));
    expect(portalRoot).toContainElement(
      screen.getByRole("menu", { name: "Export" }),
    );
    await user.keyboard("{Escape}{Escape}");

    fireEvent.keyDown(screen.getByText("report.pdf"), {
      key: "F10",
      shiftKey: true,
    });
    expect(portalRoot).toContainElement(screen.getByRole("menu"));
    // A press in the menu keeps it open
    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(portalRoot).toHaveTextContent("Saved"));
  });

  it("gives a popover the direction of its trigger where it differs from the container's", async () => {
    const user = userEvent.setup();
    portalRoot.dir = "rtl";
    render(
      <UIProvider portalContainer={portalRoot}>
        <div dir="rtl">
          <Popover trigger="Right to left" triggerType="click">
            Panel
          </Popover>
        </div>
        <Popover trigger="Left to right" triggerType="click">
          Panel
        </Popover>
      </UIProvider>,
    );

    // Like the container - nothing to change
    await user.click(screen.getByRole("button", { name: "Right to left" }));
    expect(screen.getByRole("dialog").parentElement).not.toHaveAttribute("dir");
    await user.keyboard("{Escape}");

    // The container is right to left, the trigger is not
    await user.click(screen.getByRole("button", { name: "Left to right" }));
    expect(screen.getByRole("dialog").parentElement).toHaveAttribute(
      "dir",
      "ltr",
    );
  });

  it("goes back to the body with null in a nested UIProvider", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider portalContainer={portalRoot}>
        <UIProvider portalContainer={null}>
          <DialogButton />
        </UIProvider>
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(portalRoot).toBeEmptyDOMElement();
  });
});

describe("A portalContainer in a shadow root", () => {
  let host: HTMLDivElement;
  let shadow: ShadowRoot;
  let appRoot: HTMLDivElement;
  let portalRoot: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    shadow = host.attachShadow({ mode: "open" });
    appRoot = document.createElement("div");
    portalRoot = document.createElement("div");
    shadow.append(appRoot, portalRoot);
  });

  afterEach(() => {
    host.remove();
  });

  const renderInShadow = (ui: React.ReactNode) =>
    render(<UIProvider portalContainer={portalRoot}>{ui}</UIProvider>, {
      container: appRoot,
    });

  it("traps the focus in a dialog there, hides the page and gives the focus back", async () => {
    const page = document.createElement("button");
    page.textContent = "Page";
    document.body.prepend(page);
    renderInShadow(<DialogButton />);

    const app = within(appRoot);
    const open = app.getByRole("button", { name: "Open" });
    act(() => open.focus());
    fireEvent.click(open);

    const dialog = within(portalRoot).getByRole("dialog", { name: "Edit" });
    const field = within(dialog).getByRole("textbox", { name: "Name" });
    expect(getActiveElement()).toBe(field);

    // The page around the host and the app next to the container
    expect(page).toHaveAttribute("aria-hidden", "true");
    expect(appRoot).toHaveAttribute("aria-hidden", "true");
    expect(host).not.toHaveAttribute("aria-hidden");
    expect(portalRoot).not.toHaveAttribute("aria-hidden");

    // Focus that lands outside comes back
    act(() =>
      app.getByRole("button", { hidden: true, name: "Elsewhere" }).focus(),
    );
    expect(getActiveElement()).toBe(field);

    // Tab goes round - from the last field to the close button
    fireEvent.keyDown(field, { composed: true, key: "Tab" });
    expect(getActiveElement()).toBe(
      within(dialog).getByRole("button", { name: "Close dialog" }),
    );
    act(() => field.focus());

    fireEvent.keyDown(field, { composed: true, key: "Escape" });
    expect(within(portalRoot).queryByRole("dialog")).toBeNull();
    expect(getActiveElement()).toBe(open);
    expect(page).not.toHaveAttribute("aria-hidden");
    expect(appRoot).not.toHaveAttribute("aria-hidden");
    page.remove();
  });

  it("keeps a popover open on a press in its panel there, and closes it on one outside", () => {
    renderInShadow(
      <Popover trigger="Filters" triggerType="click">
        <button type="button">Apply</button>
      </Popover>,
    );

    fireEvent.click(within(appRoot).getByRole("button", { name: "Filters" }));
    const apply = within(portalRoot).getByRole("button", { name: "Apply" });

    fireEvent.mouseDown(apply, { composed: true });
    fireEvent.mouseUp(apply, { composed: true });
    expect(within(portalRoot).getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(within(portalRoot).queryByRole("dialog")).toBeNull();
  });

  it("keeps a context menu open on a press in it there", () => {
    renderInShadow(
      <ContextMenu items={[{ label: "Rename" }, { label: "Delete" }]}>
        <div tabIndex={0}>report.pdf</div>
      </ContextMenu>,
    );

    fireEvent.keyDown(within(appRoot).getByText("report.pdf"), {
      key: "F10",
      shiftKey: true,
    });
    const menu = within(portalRoot).getByRole("menu");
    expect(getActiveElement()).toBe(menu);

    fireEvent.pointerDown(
      within(menu).getByRole("menuitem", { name: "Delete" }),
      {
        composed: true,
      },
    );
    expect(within(portalRoot).getByRole("menu")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(within(portalRoot).queryByRole("menu")).toBeNull();
  });
});
