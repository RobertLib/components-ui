import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode, useRef, useState } from "react";
import { expect, it } from "vitest";
import UIProvider from "../../providers/ui-provider";
import Dialog from "./dialog";
import {
  getActiveElement,
  hasModalOverlay,
  OverlayScope,
  useOverlay,
} from "./overlay-stack";

function RetainedPanel({
  autoFocus,
  close,
}: {
  autoFocus: boolean;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scope } = useOverlay({
    modal: true,
    onEscape: close,
    open: true,
    ref,
  });
  return (
    <div
      aria-label="Custom filters"
      aria-modal="true"
      ref={ref}
      role="dialog"
      tabIndex={-1}
    >
      <OverlayScope value={scope}>
        <input aria-label="Search" autoFocus={autoFocus} />
      </OverlayScope>
    </div>
  );
}

function RetainedPage({ autoFocus = false }: { autoFocus?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <StrictMode>
      <button onClick={() => setVisible(true)}>Show filters</button>
      <button onClick={() => setVisible(true)}>Show other filters</button>
      <Activity mode={visible ? "visible" : "hidden"}>
        <RetainedPanel autoFocus={autoFocus} close={() => setVisible(false)} />
      </Activity>
    </StrictMode>
  );
}

it.each([false, true])(
  "captures each reveal opener for an initially hidden custom modal (autoFocus: %s)",
  async (autoFocus) => {
    const user = userEvent.setup();
    await act(async () => {
      render(<RetainedPage autoFocus={autoFocus} />);
    });
    expect(hasModalOverlay()).toBe(false);
    for (const name of ["Show filters", "Show other filters"]) {
      const trigger = screen.getByRole("button", { name });
      await user.click(trigger);
      const field = screen.getByRole("textbox", { name: "Search" });
      expect(field).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(trigger).toHaveFocus();
      expect(hasModalOverlay()).toBe(false);
    }
  },
);

it("captures a reveal click that leaves focus on the body", async () => {
  await act(async () => {
    render(<RetainedPage autoFocus />);
  });
  const trigger = screen.getByRole("button", {
    name: "Show filters",
  });
  // Safari does not focus a button clicked with the pointer.
  fireEvent.click(trigger);
  const field = screen.getByRole("textbox", { name: "Search" });
  expect(field).toHaveFocus();
  fireEvent.keyDown(field, { key: "Escape" });
  expect(trigger).toHaveFocus();
});

it("captures retained autofocus in the configured shadow root", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const app = document.createElement("div");
  const portal = document.createElement("div");
  shadow.append(app, portal);
  const { unmount } = await act(async () =>
    render(
      <UIProvider portalContainer={portal}>
        <RetainedPage autoFocus />
      </UIProvider>,
      { container: app },
    ),
  );
  try {
    const trigger = within(app).getByRole("button", {
      name: "Show filters",
    });
    act(() => trigger.focus());
    fireEvent.click(trigger, { composed: true });
    const field = within(app).getByRole("textbox", { name: "Search" });
    expect(getActiveElement()).toBe(field);
    fireEvent.keyDown(field, { composed: true, key: "Escape" });
    expect(getActiveElement()).toBe(trigger);
  } finally {
    unmount();
    host.remove();
  }
});

it("passes focus return targets to a child dialog that outlives its custom modal", async () => {
  function Page() {
    const [open, setOpen] = useState(false);
    const [childOpen, setChildOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { scope } = useOverlay({ modal: true, open, ref });
    return (
      <>
        <button onClick={() => setOpen(true)}>Open filters</button>
        <OverlayScope value={scope}>
          {open && (
            <div
              aria-label="Filters"
              aria-modal="true"
              ref={ref}
              role="dialog"
              tabIndex={-1}
            >
              <button onClick={() => setChildOpen(true)}>Confirm action</button>
            </div>
          )}
          <Dialog
            open={childOpen}
            onClose={() => setChildOpen(false)}
            title="Confirm"
          >
            <input aria-label="Child field" autoFocus />
            <button onClick={() => setOpen(false)}>Close parent</button>
          </Dialog>
        </OverlayScope>
      </>
    );
  }
  const user = userEvent.setup();
  render(<Page />);
  const opener = screen.getByRole("button", { name: "Open filters" });
  await user.click(opener);
  await user.click(screen.getByRole("button", { name: "Confirm action" }));
  expect(screen.getByRole("textbox", { name: "Child field" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Close parent" }));
  expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull();
  expect(screen.getByRole("button", { name: "Close parent" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(opener).toHaveFocus();
});
