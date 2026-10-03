import { act, fireEvent, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Button from "./button";
import ButtonGroup from "./button-group";
import ContextMenu from "./context-menu";
import Dropdown from "./dropdown";
import SplitButton from "./split-button";

const page = (
  <main>
    <ButtonGroup aria-label="Invoice actions" variant="outline">
      <Button startIcon={<Plus size={16} />}>New</Button>
      <Dropdown
        buttonTrigger
        items={[
          { label: "Duplicate", shortcut: "mod+d" },
          { type: "separator" },
          { items: [{ label: "Inbox" }], label: "Move to" },
        ]}
        trigger={<Button aria-label="More actions">…</Button>}
      />
    </ButtonGroup>
    <SplitButton items={[{ label: "Save as draft" }]} loading>
      Save
    </SplitButton>
    <ContextMenu items={[{ label: "Rename", shortcut: "f2" }]}>
      <p tabIndex={0}>report.pdf</p>
    </ContextMenu>
  </main>
);

describe("Menus and buttons on the server", () => {
  it("render without the browser, then hydrate and work", async () => {
    // Next.js renders "use client" components on the server too
    vi.stubGlobal("navigator", undefined);
    const html = renderToString(page);
    vi.unstubAllGlobals();
    expect(html).toContain("report.pdf");
    expect(html).toContain('aria-label="More options"');
    // Closed menus render nothing
    expect(html).not.toContain("Duplicate");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    // The menus open after hydration
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      await screen.findByRole("menuitem", { name: "Duplicate" }),
    ).toHaveAttribute("aria-keyshortcuts");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    fireEvent.contextMenu(screen.getByText("report.pdf"));
    expect(
      screen.getByRole("menuitem", { name: "Rename" }),
    ).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });
});
