import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import ContextMenu from "./context-menu";
import Dialog from "./dialog";
import Dropdown from "./dropdown";
import type { DropdownEntry } from "./menu/types";

function EditorItem() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Edit
      </button>
      <Dialog onClose={() => setOpen(false)} open={open} title="Edit record">
        <input aria-label="Name" />
        <button type="button">Save</button>
      </Dialog>
    </>
  );
}

describe.each(["Dropdown", "ContextMenu"] as const)(
  "%s with a dialog in custom content",
  (kind) => {
    it.each([false, true])(
      "keeps the dialog and its form through Tab and Shift+Tab (submenu: %s)",
      async (inSubmenu) => {
        const user = userEvent.setup();
        const editor = <EditorItem key="editor" />;
        const items: DropdownEntry[] = inSubmenu
          ? [{ items: [editor], label: "More" }]
          : [editor];

        render(
          kind === "Dropdown" ? (
            <Dropdown items={items} trigger={<span>Actions</span>} />
          ) : (
            <ContextMenu items={items}>
              <button type="button">Actions</button>
            </ContextMenu>
          ),
        );

        const trigger = screen.getByRole("button", { name: "Actions" });
        trigger.focus();
        await user.keyboard(
          kind === "Dropdown" ? "{Enter}" : "{Shift>}{F10}{/Shift}",
        );
        if (inSubmenu) await user.keyboard("{ArrowRight}");
        await user.click(screen.getByRole("button", { name: "Edit" }));

        const dialog = screen.getByRole("dialog", { name: "Edit record" });
        const field = within(dialog).getByRole("textbox", { name: "Name" });
        const save = within(dialog).getByRole("button", { name: "Save" });
        const close = within(dialog).getByRole("button", {
          name: "Close dialog",
        });
        await user.type(field, "Draft name");

        await user.tab();
        expect(dialog).toBeInTheDocument();
        expect(save).toHaveFocus();
        await user.tab({ shift: true });
        expect(field).toHaveFocus();
        await user.tab({ shift: true });
        expect(close).toHaveFocus();
        await user.tab({ shift: true });
        expect(save).toHaveFocus();
        await user.tab();
        expect(close).toHaveFocus();
        expect(field).toHaveValue("Draft name");

        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.getAllByRole("menu")).toHaveLength(inSubmenu ? 2 : 1);
        expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
      },
    );
  },
);
