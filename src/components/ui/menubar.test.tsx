import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Menubar from "./menubar";
const menus = [
  { id: "file", label: "File", items: [{ label: "New", onClick: vi.fn() }] },
  { id: "locked", label: "Locked", disabled: true, items: [] },
  { id: "edit", label: "Edit", items: [{ label: "Copy", onClick: vi.fn() }] },
  { id: "view", label: "View", items: [{ label: "Zoom", onClick: vi.fn() }] },
];

describe("Menubar", () => {
  it("has one Tab stop and wraps arrows around enabled menus", () => {
    render(<Menubar aria-label="Application" menus={menus} />);
    const root = screen.getByRole("menubar");
    const file = within(root).getByRole("menuitem", { name: "File" });
    const edit = within(root).getByRole("menuitem", { name: "Edit" });
    const view = within(root).getByRole("menuitem", { name: "View" });
    expect(file).toHaveAttribute("tabindex", "0");
    expect(edit).toHaveAttribute("tabindex", "-1");
    file.focus();
    fireEvent.keyDown(file, { key: "ArrowRight" });
    expect(edit).toHaveFocus();
    fireEvent.keyDown(edit, { key: "End" });
    expect(view).toHaveFocus();
    fireEvent.keyDown(view, { key: "ArrowRight" });
    expect(file).toHaveFocus();
    fireEvent.keyDown(file, { key: "v", timeStamp: 100 });
    expect(view).toHaveFocus();
  });
  it("opens commands and switches an open menu from the trigger", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Menubar menus={menus} onOpenMenuChange={changed} />);
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    expect(screen.getByRole("menuitem", { name: "New" })).toBeInTheDocument();
    const file = screen.getByRole("menuitem", { name: "File" });
    file.focus();
    fireEvent.keyDown(file, { key: "ArrowRight" });
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(menus[2].items[0].onClick).toHaveBeenCalled();
    expect(changed).toHaveBeenLastCalledWith(null);
  });
  it("leaves the arrow keys to a field in a menu - the menu itself switches", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Menubar
        menus={[
          {
            id: "file",
            label: "File",
            items: [
              <input aria-label="Find" key="find" />,
              { label: "New", onClick: vi.fn() },
            ],
          },
          { id: "edit", label: "Edit", items: [{ label: "Copy" }] },
        ]}
        onOpenMenuChange={changed}
      />,
    );
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    const field = screen.getByRole("textbox", { name: "Find" });
    field.focus();

    // The caret of the field moves - the menu stays
    expect(fireEvent.keyDown(field, { key: "ArrowLeft" })).toBe(true);
    expect(fireEvent.keyDown(field, { key: "ArrowRight" })).toBe(true);
    expect(changed).toHaveBeenLastCalledWith("file");

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowRight" });
    expect(changed).toHaveBeenLastCalledWith("edit");
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
  });
  it("respects controlled open state, RTL and forwarded refs", () => {
    const changed = vi.fn();
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Menubar
        dir="rtl"
        menus={menus}
        onOpenMenuChange={changed}
        openMenu="file"
        ref={ref}
      />,
    );
    expect(ref.current).toBe(screen.getByRole("menubar"));
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "File" }), {
      key: "ArrowLeft",
    });
    expect(changed).toHaveBeenLastCalledWith("edit");
    expect(screen.getByRole("menuitem", { name: "New" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
  });
});
