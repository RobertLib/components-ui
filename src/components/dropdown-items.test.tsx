import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dropdown from "./dropdown";
import Navbar from "./navbar";
// The public entry point - the item types are exported there
import type { DropdownEntry } from "../index";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The item the focused menu announces. */
const activeItem = (menu = screen.getByRole("menu")) =>
  document.getElementById(menu.getAttribute("aria-activedescendant") ?? "");

/** Opens the menu from the keyboard - with its first item highlighted. */
async function openWithKeyboard(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: "Actions" }).focus();
  await user.keyboard("{Enter}");
  return screen.getByRole("menu");
}

function renderMenu(items: DropdownEntry[]) {
  return render(
    <Dropdown aria-label="Actions" items={items} trigger={<span>…</span>} />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Dropdown items", () => {
  it("names an item by its label - described by its description", async () => {
    const user = userEvent.setup();
    renderMenu([
      {
        description: "Change the name of the file",
        icon: <svg data-testid="rename-icon" />,
        label: "Rename",
        shortcut: "f2",
      },
      { danger: true, label: "Delete" },
    ]);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const rename = screen.getByRole("menuitem", { name: "Rename" });
    expect(rename).toHaveAccessibleDescription("Change the name of the file");
    expect(rename).toHaveAttribute("aria-keyshortcuts", "F2");
    // The icon and the shortcut are for the eye
    expect(screen.getByTestId("rename-icon").closest("[aria-hidden]")).toBe(
      rename.firstElementChild,
    );
    expect(rename.querySelector("kbd")).toHaveAttribute("aria-hidden", "true");
    expect(rename.querySelector("kbd")).toHaveTextContent("F2");

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass(
      "text-danger-700",
    );
  });

  it("announces a shortcut as the platform names its keys", async () => {
    vi.stubGlobal("navigator", { ...navigator, platform: "MacIntel" });
    renderMenu([{ label: "Duplicate", shortcut: "mod+d" }]);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const item = await screen.findByRole("menuitem", { name: "Duplicate" });
    expect(item).toHaveAttribute("aria-keyshortcuts", "Meta+D");
    expect(item.querySelector("kbd")).toHaveTextContent("⌘D");
  });

  it("keeps a disabled item reachable, but it cannot be picked", async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    const edit = vi.fn();
    renderMenu([
      { label: "Edit", onClick: edit },
      { disabled: true, label: "Archive", onClick: archive },
      { label: "Delete" },
    ]);

    const menu = await openWithKeyboard(user);
    await user.keyboard("{ArrowDown}");
    const item = screen.getByRole("menuitem", { name: "Archive" });
    expect(activeItem()).toBe(item);
    expect(item).toHaveAttribute("aria-disabled", "true");

    await user.keyboard("{Enter}");
    await user.click(item);
    expect(archive).not.toHaveBeenCalled();
    expect(menu).toBeInTheDocument();

    // The arrow keys go on past it
    await user.keyboard("{ArrowDown}");
    expect(activeItem()).toHaveTextContent("Delete");
    expect(edit).not.toHaveBeenCalled();
  });

  it("renders a disabled link without a URL to open", async () => {
    const user = userEvent.setup();
    renderMenu([{ disabled: true, href: "/reports", label: "Reports" }]);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const link = screen.getByRole("menuitem", { name: "Reports" });
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("href");
  });

  it("separates entries and groups them under a heading", async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: "Edit" },
      { type: "separator" },
      {
        items: [{ label: "Copy link" }, { label: "Send by e-mail" }],
        label: "Share",
        type: "group",
      },
    ]);

    const menu = await openWithKeyboard(user);
    expect(screen.getByRole("separator")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Share" });
    expect(group).toContainElement(
      screen.getByRole("menuitem", { name: "Copy link" }),
    );
    // The heading names the group - it is no line of its own
    expect(screen.queryByRole("menuitem", { name: "Share" })).toBeNull();

    // The arrow keys move past the separator into the group
    await user.keyboard("{ArrowDown}");
    expect(activeItem(menu)).toHaveTextContent("Copy link");
    await user.keyboard("{End}");
    expect(activeItem(menu)).toHaveTextContent("Send by e-mail");
  });

  it("skips empty entries - `cond && item` in any form", async () => {
    const user = userEvent.setup();
    const isAdmin = false as boolean;
    const note = "";
    renderMenu([
      { label: "Edit" },
      isAdmin && { label: "Administration" },
      note,
      null,
      undefined,
    ]);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu").children).toHaveLength(1);
  });
});

describe("Dropdown checkbox items", () => {
  function ViewMenu({ onChange }: { onChange: (checked: boolean) => void }) {
    const [showArchived, setShowArchived] = useState(false);
    return (
      <Dropdown
        aria-label="Actions"
        items={[
          {
            checked: showArchived,
            label: "Show archived",
            onCheckedChange: (checked) => {
              onChange(checked);
              setShowArchived(checked);
            },
          },
          { label: "Refresh" },
        ]}
        trigger={<span>…</span>}
      />
    );
  }

  it("toggles on Space and stays open - Enter toggles and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewMenu onChange={onChange} />);

    await openWithKeyboard(user);
    const item = screen.getByRole("menuitemcheckbox", {
      name: "Show archived",
    });
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("menu")).toBeNull();
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("closes after a click - unless the item keeps the menu open", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { checked: false, label: "Name", onCheckedChange },
          { checked: true, keepOpen: true, label: "Size", onCheckedChange },
        ]}
        trigger={<span>…</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Size" }));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Name" }));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Dropdown radio options", () => {
  function SortMenu({ onChange }: { onChange: (value: string) => void }) {
    const [sort, setSort] = useState("name");
    return (
      <Dropdown
        aria-label="Actions"
        items={[
          {
            label: "Sort by",
            onChange: (value) => {
              onChange(value);
              setSort(value);
            },
            options: [
              { label: "Name", value: "name" },
              { label: "Date modified", value: "modified" },
              { disabled: true, label: "Size", value: "size" },
            ],
            type: "radio",
            value: sort,
          },
        ]}
        trigger={<span>…</span>}
      />
    );
  }

  it("checks one option of the group", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortMenu onChange={onChange} />);

    await openWithKeyboard(user);
    const group = screen.getByRole("group", { name: "Sort by" });
    const name = screen.getByRole("menuitemradio", { name: "Name" });
    const modified = screen.getByRole("menuitemradio", {
      name: "Date modified",
    });
    expect(group).toContainElement(name);
    expect(name).toHaveAttribute("aria-checked", "true");
    expect(modified).toHaveAttribute("aria-checked", "false");

    // Space checks an option and keeps the menu open
    await user.keyboard("{ArrowDown} ");
    expect(onChange).toHaveBeenLastCalledWith("modified");
    expect(modified).toHaveAttribute("aria-checked", "true");
    expect(name).toHaveAttribute("aria-checked", "false");

    // A disabled option cannot be checked
    await user.keyboard("{ArrowDown} ");
    expect(onChange).toHaveBeenCalledTimes(1);

    // A click checks one and closes the menu
    await user.click(name);
    expect(onChange).toHaveBeenLastCalledWith("name");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not report the checked option again, but closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortMenu onChange={onChange} />);

    await openWithKeyboard(user);
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Dropdown typeahead", () => {
  const items: DropdownEntry[] = [
    { label: "Copy" },
    { label: "Cut" },
    { label: "Paste" },
    { label: "Štítky" },
    { label: "Save as…" },
  ];

  it("moves to the next item starting with the typed letters", async () => {
    const user = userEvent.setup();
    renderMenu(items);

    const menu = await openWithKeyboard(user);
    await user.keyboard("p");
    expect(activeItem(menu)).toHaveTextContent("Paste");

    // Accents do not count
    await act(() => sleep(550));
    await user.keyboard("s");
    expect(activeItem(menu)).toHaveTextContent("Štítky");

    // The same letter again moves on to the next item starting with it
    await act(() => sleep(550));
    await user.keyboard("c");
    expect(activeItem(menu)).toHaveTextContent("Copy");
    await user.keyboard("c");
    expect(activeItem(menu)).toHaveTextContent("Cut");
  });

  it("reads quickly typed letters as one word, spaces included", async () => {
    const user = userEvent.setup();
    const saveAs = vi.fn();
    renderMenu([
      { label: "Save" },
      { label: "Save as…", onClick: saveAs },
      { label: "Share" },
    ]);

    const menu = await openWithKeyboard(user);
    await user.keyboard("sh");
    expect(activeItem(menu)).toHaveTextContent("Share");

    await act(() => sleep(550));
    // The space belongs to the search - it picks nothing
    await user.keyboard("save a");
    expect(activeItem(menu)).toHaveTextContent("Save as…");
    expect(saveAs).not.toHaveBeenCalled();
  });

  it("keeps the item a longer search still matches", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const saveAs = vi.fn();
    renderMenu([
      { label: "Open" },
      { label: "Save", onClick: save },
      { label: "Save as…", onClick: saveAs },
    ]);

    const menu = await openWithKeyboard(user);
    // Every letter of "save" stays on "Save" - it did not flip between the
    // two items starting so
    for (const letter of "save") {
      await user.keyboard(letter);
      expect(activeItem(menu)).toHaveTextContent(/^Save$/);
    }

    await user.keyboard("{Enter}");
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveAs).not.toHaveBeenCalled();
  });

  it("works from the trigger of a menu opened with the mouse", async () => {
    const user = userEvent.setup();
    renderMenu(items);

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    expect(trigger).toHaveFocus();
    await user.keyboard("p");
    expect(screen.getByRole("menu")).toHaveFocus();
    expect(activeItem()).toHaveTextContent("Paste");
  });
});

describe("Dropdown in StrictMode", () => {
  it("highlights the first item once, although refs attach twice", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Dropdown
          aria-label="Actions"
          items={[
            { label: "Edit" },
            { items: [{ label: "Inbox" }], label: "Move to" },
          ]}
          trigger={<span>…</span>}
        />
      </StrictMode>,
    );

    const menu = await openWithKeyboard(user);
    expect(menu).toHaveFocus();
    expect(activeItem(menu)).toHaveTextContent("Edit");

    await user.keyboard("{ArrowDown}{ArrowRight}");
    const submenu = screen.getByRole("menu", { name: "Move to" });
    expect(submenu).toHaveFocus();
    expect(activeItem(submenu)).toHaveTextContent("Inbox");
  });
});

describe("Dropdown names and state", () => {
  it("is named by its trigger and reports opening and closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[{ label: "Edit" }]}
        onOpenChange={onOpenChange}
        trigger={<span>…</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu", { name: "Actions" })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("is named by a button trigger with an id of its own", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        buttonTrigger
        items={[{ label: "Edit" }]}
        trigger={
          <button id="more" type="button">
            More
          </button>
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menu")).toHaveAttribute("aria-labelledby", "more");
  });
});

describe("Navbar user menu", () => {
  it("takes the entries of Dropdown", async () => {
    const user = userEvent.setup();
    const logOut = vi.fn();
    render(
      <Navbar
        noDrawerToggle
        user={{
          menuItems: [
            { href: "/profile", label: "Profile" },
            { type: "separator" },
            { danger: true, label: "Log out", onClick: logOut },
          ],
          name: "Jana Nováková",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Jana Nováková" }));
    expect(screen.getByRole("separator")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(logOut).toHaveBeenCalledTimes(1);
  });
});
