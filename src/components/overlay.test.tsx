import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Dialog from "./dialog";
import Overlay from "./overlay";
import { OverlayScope, useOverlay } from "./overlay-stack";
import Popover from "./popover";
import Tooltip from "./tooltip";

describe("Overlay", () => {
  it("renders the backdrop into the body", () => {
    const { container } = render(<Overlay data-testid="backdrop" />);

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop.parentElement).toBe(document.body);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the backdrop in place with portal={false}", () => {
    const onClick = vi.fn();
    const { container } = render(
      <div>
        <Overlay
          className="z-50"
          data-testid="backdrop"
          onClick={onClick}
          portal={false}
        />
        <aside>Panel</aside>
      </div>,
    );

    const backdrop = screen.getByTestId("backdrop");
    expect(container.firstElementChild).toContainElement(backdrop);
    expect(backdrop).toHaveClass("fixed", "inset-0", "z-50");
    backdrop.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders nothing on the server, then hydrates and shows", async () => {
    const page = (
      <main>
        <Overlay data-testid="backdrop" />
      </main>
    );

    // The server has no body to portal into - and also where it has one (a
    // DOM shim), the page's HTML has no portal
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
    expect(screen.getByTestId("backdrop").parentElement).toBe(document.body);

    act(() => root.unmount());
    container.remove();
  });
});

/** A side panel of its own - the example of the docs, reduced. */
function SidePanel({
  modal = true,
  onEscape,
}: {
  modal?: boolean;
  onEscape?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => {
    onEscape?.();
    setOpen(false);
  };
  const { scope } = useOverlay({ modal, onEscape: close, open, ref: panelRef });

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Filters
      </button>
      {open &&
        createPortal(
          <div
            aria-label="Filters"
            aria-modal={modal}
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
          >
            <OverlayScope value={scope}>
              <input aria-label="Search" />
              <Popover
                aria-label="Sort"
                trigger={<span>Sort</span>}
                triggerType="click"
              >
                <button type="button">By name</button>
              </Popover>
            </OverlayScope>
          </div>,
          document.body,
        )}
    </>
  );
}

describe("useOverlay", () => {
  it("makes a modal overlay take the focus, keep it and give it back", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SidePanel />
        <button type="button">Behind</button>
      </>,
    );

    const opener = screen.getByRole("button", { name: "Filters" });
    await user.click(opener);
    const search = screen.getByRole("textbox", { name: "Search" });
    expect(search).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    // Tab cycles inside, focus on the page comes back
    await user.tab();
    expect(screen.getByRole("button", { name: "Sort" })).toHaveFocus();
    await user.tab();
    expect(search).toHaveFocus();
    act(() =>
      screen.getByRole("button", { hidden: true, name: "Behind" }).focus(),
    );
    expect(search).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(opener).toHaveFocus();
  });

  it("gets Escape only while it is the topmost overlay", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<SidePanel onEscape={onEscape} />);

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Sort" }));
    expect(screen.getByRole("button", { name: "By name" })).toBeInTheDocument();

    // The popover opened in it is above it
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "By name" })).toBeNull();
    expect(onEscape).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("gets no Escape that ends an IME composition", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<SidePanel onEscape={onEscape} />);

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const search = screen.getByRole("textbox", { name: "Search" });
    fireEvent.keyDown(search, { isComposing: true, key: "Escape" });
    fireEvent.keyDown(search, { key: "Escape", keyCode: 229 });
    expect(onEscape).not.toHaveBeenCalled();

    fireEvent.keyDown(search, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("gives the focus to the popover's trigger when the pick that opened it closed the popover", async () => {
    const user = userEvent.setup();

    function Page() {
      const [open, setOpen] = useState(false);
      const [panel, setPanel] = useState(false);
      const panelRef = useRef<HTMLDivElement>(null);
      useOverlay({
        modal: true,
        onEscape: () => setPanel(false),
        open: panel,
        ref: panelRef,
      });
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
                setPanel(true);
              }}
              type="button"
            >
              Filter
            </button>
          </Popover>
          {panel && (
            <div ref={panelRef} role="dialog" tabIndex={-1}>
              <input aria-label="Search" />
            </div>
          )}
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("is the topmost while a tooltip in it is shown - its backdrop closes it", async () => {
    // Built as the docs show: the press on the backdrop reads isTopmost()
    function Panel() {
      const [open, setOpen] = useState(true);
      const ref = useRef<HTMLDivElement>(null);
      const close = () => setOpen(false);
      const { isTopmost, scope } = useOverlay({
        modal: true,
        onEscape: close,
        open,
        ref,
      });
      const pressedOnTopRef = useRef(false);
      if (!open) return null;
      return createPortal(
        <>
          <Overlay
            data-testid="backdrop"
            onClick={() => {
              if (pressedOnTopRef.current) close();
            }}
            onPointerDown={() => {
              pressedOnTopRef.current = isTopmost();
            }}
            portal={false}
          />
          <div aria-label="Share" ref={ref} role="dialog" tabIndex={-1}>
            <OverlayScope value={scope}>
              <Tooltip delay={0} title="Copies the link">
                <button type="button">Copy</button>
              </Tooltip>
            </OverlayScope>
          </div>
        </>,
        document.body,
      );
    }
    render(<Panel />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Copy" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    const backdrop = screen.getByTestId("backdrop");
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog", { name: "Share" })).toBeNull();
  });

  it("lets a Dialog under it hand it the focus and Escape", async () => {
    const user = userEvent.setup();
    const onDialogClose = vi.fn();
    render(
      <Dialog onClose={onDialogClose} open title="Report">
        <SidePanel modal={false} />
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const search = screen.getByRole("textbox", { name: "Search" });
    act(() => search.focus());
    // Not pulled back into the dialog
    expect(search).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull();
    expect(onDialogClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onDialogClose).toHaveBeenCalledTimes(1);
  });
});

describe("Focus trap exemption", () => {
  it("leaves the focus in a region marked data-focus-trap-exempt", () => {
    render(
      <>
        <div data-focus-trap-exempt="">
          <input aria-label="Chat message" />
        </div>
        <Dialog open title="Edit">
          <input aria-label="Name" />
        </Dialog>
      </>,
    );

    const chat = screen.getByRole("textbox", { name: "Chat message" });
    act(() => chat.focus());
    expect(chat).toHaveFocus();
  });
});
