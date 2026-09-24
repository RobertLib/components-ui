import { act, fireEvent, render, screen } from "@testing-library/react";
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

    // Opened from the keyboard, with the first item highlighted - the
    // header is skipped, the arrow keys move between the items
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

  it("starts every opening afresh - at the first item from the keyboard", async () => {
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
    // A click opens the menu without a highlighted item
    await user.click(trigger);
    expect(await screen.findByRole("menu")).not.toHaveAttribute(
      "aria-activedescendant",
    );
    await user.hover(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.keyboard("{Escape}");

    // Enter opens it at the first item, not at the one hovered before
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(remove).not.toHaveBeenCalled();
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["{ArrowDown}", "Edit"],
    ["{ }", "Edit"],
    ["{ArrowUp}", "Delete"],
  ])("opens on %s with %s highlighted", async (key, label) => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { label: "Edit" },
          { label: "Delete" },
          <p key="note">Deleted items stay in the trash</p>,
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard(key);
    const menu = screen.getByRole("menu");
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: label }).id,
    );
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

  it("picks the active item with Space and jumps with Home and End", async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { label: "Edit" },
          <hr key="divider" />,
          { label: "Archive", onClick: archive },
          { label: "Delete" },
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}");
    const menu = screen.getByRole("menu");
    const active = () =>
      document.getElementById(menu.getAttribute("aria-activedescendant")!);

    await user.keyboard("{End}");
    expect(active()).toHaveTextContent("Delete");
    await user.keyboard("{Home}");
    expect(active()).toHaveTextContent("Edit");
    await user.keyboard("{ArrowDown}");
    expect(active()).toHaveTextContent("Archive");

    // Space picks it instead of scrolling the page
    expect(fireEvent.keyDown(menu, { key: " " })).toBe(false);
    expect(archive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    // Back on the trigger once the menu has gone
    await act(async () => {});
    expect(trigger).toHaveFocus();
  });

  it("makes a button trigger the menu button itself", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        buttonTrigger
        items={[{ label: "Edit" }]}
        trigger={
          <button aria-label="Actions" type="button">
            …
          </button>
        }
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    // No button wrapped around it
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    const menu = screen.getByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);

    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
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

  it("wraps every entry in a presentational item - also custom content", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          <div key="header">Signed in</div>,
          { label: "Edit" },
          <hr key="divider" />,
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(menu.children).toHaveLength(3);
    for (const entry of menu.children) {
      expect(entry).toHaveAttribute("role", "none");
    }
    expect(screen.getByRole("separator")).toBeInTheDocument();
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

  it.each([false, true])(
    "moves Shift+Tab from the menu back to the trigger (button trigger: %s)",
    async (buttonTrigger) => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Dropdown
            aria-label={buttonTrigger ? undefined : "Actions"}
            buttonTrigger={buttonTrigger}
            items={[{ label: "Edit" }]}
            trigger={
              buttonTrigger ? (
                <button aria-label="Actions" type="button">
                  …
                </button>
              ) : (
                <span>Menu</span>
              )
            }
          />
          <button type="button">After</button>
        </>,
      );

      const trigger = screen.getByRole("button", { name: "Actions" });
      trigger.focus();
      await user.keyboard("{Enter}{ArrowDown}");
      expect(screen.getByRole("menu")).toHaveFocus();

      // Not backwards from the menu at the end of the page to "After"
      await user.tab({ shift: true });
      expect(screen.queryByRole("menu")).toBeNull();
      expect(trigger).toHaveFocus();

      // From the trigger, Shift+Tab goes on backwards as usual
      await user.click(trigger);
      expect(trigger).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    },
  );

  it("moves Tab from the menu on past the trigger", async () => {
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
    await user.keyboard("{Enter}{ArrowDown}");
    await user.tab();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });
});

describe("Dropdown picking from the keyboard", () => {
  it("follows a link item as a click does - its onClick once", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    // Stands in for the browser following the link (to another site, a
    // mailto: address), which the router's navigate() cannot
    const followed: string[] = [];
    const follow = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a");
      if (!link) return;
      event.preventDefault();
      followed.push(link.getAttribute("href") ?? "");
    };
    document.addEventListener("click", follow, true);

    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { href: "mailto:support@example.com", label: "Write us", onClick },
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    document.removeEventListener("click", follow, true);

    expect(followed).toEqual(["mailto:support@example.com"]);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("calls the onClick of a plain item once", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[{ label: "Edit", onClick }]}
        trigger={<span>Menu</span>}
      />,
    );

    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Dropdown and Escape", () => {
  it("gives the focus in custom content back to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Settings"
        items={[
          <label key="dark">
            <input type="checkbox" /> Dark mode
          </label>,
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Settings" });
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}");
    expect(screen.getByRole("checkbox", { name: "Dark mode" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("leaves an Escape used up in custom content to it", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        aria-label="Filter"
        items={[
          <input
            aria-label="Search"
            key="search"
            onKeyDown={(event) => {
              if (event.key === "Escape") event.preventDefault();
            }}
          />,
        ]}
        trigger={<span>Menu</span>}
      />,
    );

    screen.getByRole("button", { name: "Filter" }).focus();
    await user.keyboard("{Enter}{ArrowDown}");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
