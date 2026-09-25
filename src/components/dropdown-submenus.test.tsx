import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./confirm-dialog";
import Dropdown from "./dropdown";
import type { DropdownEntry } from "../index";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const activeItem = (menu: HTMLElement) =>
  document.getElementById(menu.getAttribute("aria-activedescendant") ?? "");

const menuItems = (inbox = vi.fn()): DropdownEntry[] => [
  { label: "Edit" },
  {
    items: [
      { label: "Inbox", onClick: inbox },
      { label: "Archive" },
      {
        items: [{ label: "2025" }, { label: "2026" }],
        label: "Older",
      },
    ],
    label: "Move to",
  },
  { label: "Delete" },
];

function renderMenu(items: DropdownEntry[]) {
  render(
    <>
      <Dropdown aria-label="Actions" items={items} trigger={<span>…</span>} />
      <button type="button">Next</button>
    </>,
  );
  return screen.getByRole("button", { name: "Actions" });
}

describe("Dropdown submenus from the keyboard", () => {
  it("opens with ArrowRight at the first item and closes with ArrowLeft", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}");
    const menu = screen.getByRole("menu", { name: "Actions" });
    const parent = screen.getByRole("menuitem", { name: "Move to" });
    expect(parent).toHaveAttribute("aria-haspopup", "menu");
    expect(parent).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowRight}");
    // Named by its item, with the focus and its first item highlighted
    const submenu = screen.getByRole("menu", { name: "Move to" });
    expect(submenu).toHaveFocus();
    expect(activeItem(submenu)).toHaveTextContent("Inbox");
    expect(parent).toHaveAttribute("aria-expanded", "true");
    expect(parent).toHaveAttribute("aria-controls", submenu.id);

    await user.keyboard("{ArrowDown}");
    expect(activeItem(submenu)).toHaveTextContent("Archive");

    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByRole("menu", { name: "Move to" })).toBeNull();
    // Back on its item
    expect(menu).toHaveFocus();
    expect(activeItem(menu)).toBe(parent);
  });

  it("opens with Enter and Space too, and nests", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    const submenu = screen.getByRole("menu", { name: "Move to" });
    await user.keyboard("{End} ");
    const nested = screen.getByRole("menu", { name: "Older" });
    expect(nested).toHaveFocus();
    expect(activeItem(nested)).toHaveTextContent("2025");

    await user.keyboard("{ArrowLeft}");
    expect(submenu).toHaveFocus();
    expect(screen.queryByRole("menu", { name: "Older" })).toBeNull();
  });

  it("closes one level per Escape - the menu last, to its trigger", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{ArrowRight}");
    expect(screen.getAllByRole("menu")).toHaveLength(2);

    await user.keyboard("{Escape}");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes the whole menu after a pick in a submenu", async () => {
    const user = userEvent.setup();
    const inbox = vi.fn();
    const trigger = renderMenu(menuItems(inbox));

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{ArrowRight}{Enter}");
    expect(inbox).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    // The focus goes back to the trigger, not to the page
    await act(async () => {});
    expect(trigger).toHaveFocus();
  });

  it("moves Tab from a submenu on past the trigger", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{ArrowRight}");
    await user.tab();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("closes the submenu when the highlight moves on", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{ArrowRight}{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("menu")).toHaveLength(2);

    // Typed letters of the submenu stay in it
    await user.keyboard("a");
    expect(
      activeItem(screen.getByRole("menu", { name: "Move to" })),
    ).toHaveTextContent("Archive");

    await user.keyboard("{ArrowLeft}{ArrowDown}");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("gives the focus back to the trigger after a Dialog opened from a submenu", async () => {
    const user = userEvent.setup();

    function Page() {
      const [confirm, setConfirm] = useState(false);
      return (
        <>
          <Dropdown
            aria-label="Actions"
            items={[
              {
                items: [
                  { label: "Everything", onClick: () => setConfirm(true) },
                ],
                label: "Delete",
              },
            ]}
            trigger={<span>…</span>}
          />
          <ConfirmDialog
            onClose={() => setConfirm(false)}
            onConfirm={() => setConfirm(false)}
            open={confirm}
            title="Delete everything?"
          />
        </>
      );
    }

    render(<Page />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}{ArrowRight}{Enter}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("Dropdown submenus right to left", () => {
  afterEach(() => {
    document.documentElement.dir = "";
  });

  it("open with ArrowLeft, close with ArrowRight and point to the left", async () => {
    const user = userEvent.setup();
    document.documentElement.dir = "rtl";
    const trigger = renderMenu(menuItems());

    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}");
    const menu = screen.getByRole("menu", { name: "Actions" });
    const parent = screen.getByRole("menuitem", { name: "Move to" });
    expect(parent.querySelector("svg")).toHaveClass("rtl:rotate-180");

    // ArrowRight goes back - there is nothing to go back to in the menu
    await user.keyboard("{ArrowRight}");
    expect(screen.queryByRole("menu", { name: "Move to" })).toBeNull();

    await user.keyboard("{ArrowLeft}");
    const submenu = screen.getByRole("menu", { name: "Move to" });
    expect(submenu).toHaveFocus();
    expect(submenu.closest("[dir]")).toHaveAttribute("dir", "rtl");

    await user.keyboard("{ArrowRight}");
    expect(screen.queryByRole("menu", { name: "Move to" })).toBeNull();
    expect(menu).toHaveFocus();
  });
});

describe("Dropdown submenus with the pointer", () => {
  it("opens on hover after a moment, and closes on another item", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    await user.click(trigger);
    await user.hover(screen.getByRole("menuitem", { name: "Move to" }));
    expect(screen.getAllByRole("menu")).toHaveLength(1);

    await act(() => sleep(200));
    const submenu = screen.getByRole("menu", { name: "Move to" });
    // Opened by the pointer: the focus stays in the menu, nothing is
    // highlighted in the submenu
    expect(screen.getByRole("menu", { name: "Actions" })).toHaveFocus();
    expect(submenu).not.toHaveAttribute("aria-activedescendant");

    await user.hover(screen.getByRole("menuitem", { name: "Inbox" }));
    expect(activeItem(submenu)).toHaveTextContent("Inbox");
    // Its item stays highlighted
    expect(activeItem(screen.getByRole("menu", { name: "Actions" }))).toBe(
      screen.getByRole("menuitem", { name: "Move to" }),
    );

    await user.hover(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.queryByRole("menu", { name: "Move to" })).toBeNull();
  });

  it("does not open when the pointer passes over the item", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu(menuItems());

    await user.click(trigger);
    await user.hover(screen.getByRole("menuitem", { name: "Move to" }));
    await user.hover(screen.getByRole("menuitem", { name: "Delete" }));
    await act(() => sleep(200));
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("opens on a click or tap at once, and a pick in it closes all", async () => {
    const user = userEvent.setup();
    const inbox = vi.fn();
    const trigger = renderMenu(menuItems(inbox));

    await user.click(trigger);
    // A touch moves no highlight and opens nothing by moving
    fireEvent.pointerMove(screen.getByRole("menuitem", { name: "Move to" }), {
      pointerType: "touch",
    });
    await act(() => sleep(200));
    expect(screen.getAllByRole("menu")).toHaveLength(1);

    await user.click(screen.getByRole("menuitem", { name: "Move to" }));
    expect(screen.getByRole("menu", { name: "Move to" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Inbox" }));
    expect(inbox).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    await act(async () => {});
    expect(trigger).toHaveFocus();
  });

  it("does not open the submenu of a disabled item", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu([
      { disabled: true, items: [{ label: "Inbox" }], label: "Move to" },
    ]);

    await user.click(trigger);
    const parent = screen.getByRole("menuitem", { name: "Move to" });
    await user.click(parent);
    await user.keyboard("{ArrowDown}{ArrowRight}{Enter}");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(parent).toHaveAttribute("aria-disabled", "true");
  });
});
