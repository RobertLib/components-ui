import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Dialog from "./dialog";
import Dropdown from "./dropdown";

describe("Dropdown", () => {
  it("moves the focus into the menu and announces the active item", async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          <div key="header">Signed in</div>,
          { label: "Edit", onClick: edit },
          { label: "Delete" },
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");

    // The header is skipped - the arrow keys move between the items
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Edit" }).id,
    );

    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // Back on the trigger, not lost with the menu
    expect(trigger).toHaveFocus();
  });

  it("gives the focus back to the trigger when Escape closes the menu", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Actions"
        items={[{ label: "Edit" }]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("starts every opening without a highlighted item", async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    const remove = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { label: "Edit", onClick: edit },
          { label: "Delete", onClick: remove },
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    await user.hover(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.keyboard("{Escape}");

    // Enter opens the menu; the next Enter has no item to pick yet
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(remove).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("keeps the focus on the trigger when an item is clicked", async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[{ label: "Edit", onClick: edit }]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));

    expect(edit).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("leaves Escape to a Dialog around it once the menu is closed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Order">
        <Dropdown
          aria-label="Actions"
          items={[{ label: "Edit" }]}
          trigger={<span>Menu</span>}
        />
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // The focus is still on the trigger - this Escape is the Dialog's
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Dropdown with custom content", () => {
  it("moves the focus to a control in it and leaves it its keys", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <Dropdown
        aria-label="Settings"
        items={[
          { label: "Profile" },
          <div key="heading">Display</div>,
          <label key="dark">
            <input onChange={onToggle} type="checkbox" /> Dark mode
          </label>,
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    screen.getByRole("button", { name: "Settings" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");

    // Past the heading, which has no control
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const checkbox = screen.getByRole("checkbox", { name: "Dark mode" });
    expect(checkbox).toHaveFocus();

    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menu")).toHaveFocus();
  });
});

describe("Dropdown semantics", () => {
  it("is a menu button without a dialog around the menu", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Actions"
        items={[{ label: "Edit" }]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    await user.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("calls the consumer's onKeyDown along with its own", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[{ label: "Edit" }]}
        onKeyDown={onKeyDown}
        trigger={<span>Menu</span>}
      />,
    );

    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("moves Tab on from the trigger past the closing menu", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Dropdown
          aria-label="Actions"
          items={[{ label: "Edit" }]}
          trigger={<span>Menu</span>}
        />
        <button type="button">Next</button>
      </>,
    );

    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.tab();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });
});
