import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContextMenu from "./context-menu";
import Dialog from "./dialog";
import type { DropdownEntry } from "../index";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const activeItem = (menu: HTMLElement) =>
  document.getElementById(menu.getAttribute("aria-activedescendant") ?? "");

/** jsdom lays nothing out - the row is 500 x 40 px at the top left. */
const layOut = (element: HTMLElement) =>
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    bottom: 40,
    height: 40,
    left: 0,
    right: 500,
    top: 0,
    width: 500,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

function FileRow({
  items,
  onOpenChange,
}: {
  items?: DropdownEntry[];
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ul>
      <ContextMenu
        aria-label="Actions for report.pdf"
        items={
          items ?? [
            { label: "Rename", shortcut: "f2" },
            { label: "Duplicate" },
            { danger: true, label: "Delete" },
          ]
        }
        onOpenChange={onOpenChange}
      >
        <li tabIndex={0}>report.pdf</li>
      </ContextMenu>
      <li>
        <button type="button">Next</button>
      </li>
    </ul>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ContextMenu with the pointer", () => {
  it("opens at the pointer on a right click, instead of the browser's menu", () => {
    const onOpenChange = vi.fn();
    render(<FileRow onOpenChange={onOpenChange} />);
    const row = screen.getByText("report.pdf");
    layOut(row);

    // Not prevented by the browser's own menu
    expect(fireEvent.contextMenu(row, { clientX: 120, clientY: 30 })).toBe(
      false,
    );

    const menu = screen.getByRole("menu", { name: "Actions for report.pdf" });
    expect(menu.parentElement).toHaveStyle({ left: "120px", top: "32px" });
    // The menu takes the keys - opened with the mouse, nothing is
    // highlighted
    expect(menu).toHaveFocus();
    expect(menu).not.toHaveAttribute("aria-activedescendant");
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveAttribute(
      "aria-keyshortcuts",
      "F2",
    );
  });

  it("runs a picked item, closes and gives the focus back", async () => {
    const user = userEvent.setup();
    const rename = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <FileRow
        items={[{ label: "Rename", onClick: rename }]}
        onOpenChange={onOpenChange}
      />,
    );
    const row = screen.getByText("report.pdf");
    layOut(row);
    row.focus();

    fireEvent.contextMenu(row, { clientX: 120, clientY: 30 });
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(rename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await act(async () => {});
    expect(row).toHaveFocus();
  });

  it("closes on a press outside, on scrolling and resizing", async () => {
    const user = userEvent.setup();
    render(<FileRow />);
    const row = screen.getByText("report.pdf");
    layOut(row);

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    // Scrolling the menu itself keeps it
    fireEvent.scroll(screen.getByRole("menu").parentElement!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.scroll(document);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    fireEvent(window, new Event("resize"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("stays open on a press inside, also in a submenu", async () => {
    const user = userEvent.setup();
    render(
      <FileRow
        items={[
          {
            items: [{ label: "Inbox" }, { label: "Archive" }],
            label: "Move to",
          },
        ]}
      />,
    );
    const row = screen.getByText("report.pdf");
    layOut(row);

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: "Move to" }));
    const submenu = screen.getByRole("menu", { name: "Move to" });
    await user.pointer({ keys: "[MouseLeft>]", target: submenu });
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });

  it("opens on a long press of a finger that does not move", async () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(<FileRow onOpenChange={onOpenChange} />);
    const row = screen.getByText("report.pdf");
    layOut(row);
    const touch = {
      clientX: 60,
      clientY: 20,
      pointerId: 7,
      pointerType: "touch",
    };

    // Lifted too early
    fireEvent.pointerDown(row, touch);
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerUp(row, touch);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("menu")).toBeNull();

    // A scroll moves the finger
    fireEvent.pointerDown(row, touch);
    fireEvent.pointerMove(row, { ...touch, clientY: 40 });
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.pointerDown(row, touch);
    act(() => vi.advanceTimersByTime(500));
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toHaveStyle({ left: "60px", top: "22px" });
    expect(onOpenChange).toHaveBeenCalledTimes(1);

    // The click that may follow the long press picks nothing
    const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
    fireEvent.click(duplicate, { detail: 1 });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("leaves a mouse press alone", () => {
    vi.useFakeTimers();
    render(<FileRow />);
    const row = screen.getByText("report.pdf");

    fireEvent.pointerDown(row, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("ContextMenu right to left", () => {
  it("takes the direction of its target, and opens its submenus with ArrowLeft", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <ContextMenu
          aria-label="Actions"
          items={[
            { items: [{ label: "Archive" }], label: "Move to" },
            { label: "Delete" },
          ]}
        >
          <div tabIndex={0}>report.pdf</div>
        </ContextMenu>
      </div>,
    );
    const row = screen.getByText("report.pdf");
    layOut(row);

    act(() => row.focus());
    await user.keyboard("{Shift>}{F10}{/Shift}");
    const menu = screen.getByRole("menu", { name: "Actions" });
    // A portal in the body, which is left to right
    expect(menu.closest("[dir]")).toHaveAttribute("dir", "rtl");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("menu", { name: "Move to" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.queryByRole("menu", { name: "Move to" })).toBeNull();
    expect(menu).toHaveFocus();
  });
});

describe("ContextMenu from the keyboard", () => {
  it.each([
    ["Shift+F10", "{Shift>}{F10}{/Shift}"],
    ["the context menu key", "{ContextMenu}"],
  ])("opens with %s next to the focused element", async (_, keys) => {
    const user = userEvent.setup();
    render(<FileRow />);
    const row = screen.getByText("report.pdf");
    layOut(row);
    row.focus();

    await user.keyboard(keys);
    const menu = screen.getByRole("menu");
    // Below the row, with its first item highlighted
    expect(menu.parentElement).toHaveStyle({ left: "8px", top: "44px" });
    expect(menu).toHaveFocus();
    expect(activeItem(menu)).toHaveTextContent("Rename");

    await user.keyboard("{ArrowDown}");
    expect(activeItem(menu)).toHaveTextContent("Duplicate");
  });

  it("goes next to the element for a contextmenu event of the keyboard", () => {
    render(<FileRow />);
    const row = screen.getByText("report.pdf");
    layOut(row);

    // The context menu key of Windows fires it at 0, 0
    fireEvent.contextMenu(row, { clientX: 0, clientY: 0 });
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toHaveStyle({ top: "44px" });
    expect(activeItem(menu)).toHaveTextContent("Rename");
  });

  it("closes on Escape and gives the focus back", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FileRow onOpenChange={onOpenChange} />);
    const row = screen.getByText("report.pdf");
    row.focus();

    await user.keyboard("{Shift>}{F10}{/Shift}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(row).toHaveFocus();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("closes a submenu first on Escape", async () => {
    const user = userEvent.setup();
    render(
      <FileRow items={[{ items: [{ label: "Inbox" }], label: "Move to" }]} />,
    );
    const row = screen.getByText("report.pdf");
    row.focus();

    await user.keyboard("{Shift>}{F10}{/Shift}{ArrowRight}");
    expect(screen.getByRole("menu", { name: "Move to" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("menu", { name: "Actions for report.pdf" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(row).toHaveFocus();
  });

  it("gives the focus back after a pick", async () => {
    const user = userEvent.setup();
    const duplicate = vi.fn();
    render(<FileRow items={[{ label: "Duplicate", onClick: duplicate }]} />);
    const row = screen.getByText("report.pdf");
    row.focus();

    await user.keyboard("{Shift>}{F10}{/Shift}{Enter}");
    expect(duplicate).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(row).toHaveFocus();
  });

  it("leaves the menu with Tab as if it were not there", async () => {
    const user = userEvent.setup();
    render(<FileRow />);
    const row = screen.getByText("report.pdf");
    row.focus();

    await user.keyboard("{Shift>}{F10}{/Shift}");
    await user.tab({ shift: true });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(row).toHaveFocus();

    await user.keyboard("{Shift>}{F10}{/Shift}");
    await user.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("keeps the keys it uses from the list around it", async () => {
    const user = userEvent.setup();
    const onListKeyDown = vi.fn();
    render(
      <div onKeyDown={(event) => onListKeyDown(event.key)}>
        <ContextMenu items={[{ label: "Rename" }, { label: "Delete" }]}>
          <div tabIndex={0}>Row</div>
        </ContextMenu>
      </div>,
    );
    screen.getByText("Row").focus();

    await user.keyboard("{Shift>}{F10}{/Shift}");
    onListKeyDown.mockClear();
    await user.keyboard("{ArrowDown}d");
    expect(onListKeyDown).not.toHaveBeenCalled();
  });
});

describe("ContextMenu options", () => {
  it("leaves the browser's menu while disabled or without items", () => {
    const { rerender } = render(
      <ContextMenu disabled items={[{ label: "Rename" }]}>
        <div>Row</div>
      </ContextMenu>,
    );
    expect(fireEvent.contextMenu(screen.getByText("Row"))).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();

    rerender(
      <ContextMenu items={[false, null]}>
        <div>Row</div>
      </ContextMenu>,
    );
    expect(fireEvent.contextMenu(screen.getByText("Row"))).toBe(true);
  });

  it("closes when it is disabled while open", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ContextMenu items={[{ label: "Rename" }]} onOpenChange={onOpenChange}>
        <div>Row</div>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Row"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    rerender(
      <ContextMenu
        disabled
        items={[{ label: "Rename" }]}
        onOpenChange={onOpenChange}
      >
        <div>Row</div>
      </ContextMenu>,
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("calls the handlers of its element - one that prevents keeps it closed", () => {
    const onContextMenu = vi.fn((event: React.MouseEvent) => {
      if (event.shiftKey) event.preventDefault();
    });
    render(
      <ContextMenu items={[{ label: "Rename" }]}>
        <div className="row" onContextMenu={onContextMenu}>
          Row
        </div>
      </ContextMenu>,
    );
    const row = screen.getByText("Row");
    expect(row).toHaveClass("row");

    fireEvent.contextMenu(row, { shiftKey: true });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(row);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("wraps anything but a single element in a <div>", () => {
    const { container } = render(
      <ContextMenu items={[{ label: "Rename" }]}>
        Plain <b>text</b>
      </ContextMenu>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");

    fireEvent.contextMenu(screen.getByText("text"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("opens the innermost of nested menus", () => {
    render(
      <ContextMenu aria-label="Row" items={[{ label: "Delete row" }]}>
        <div>
          <ContextMenu aria-label="Cell" items={[{ label: "Copy cell" }]}>
            <span>Cell</span>
          </ContextMenu>
        </div>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Cell"));
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu", { name: "Cell" })).toBeInTheDocument();
  });

  it("keeps clicks in the menu from the row around", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <ContextMenu items={[{ disabled: true, label: "Rename" }]}>
          <span>Row</span>
        </ContextMenu>
      </div>,
    );

    fireEvent.contextMenu(screen.getByText("Row"));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("works in a Dialog - the menu takes the focus, Escape closes it first", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Page() {
      const [name, setName] = useState("report.pdf");
      return (
        <Dialog onClose={onClose} open title="Files">
          <ContextMenu
            items={[{ label: "Rename", onClick: () => setName("renamed.pdf") }]}
          >
            <button type="button">{name}</button>
          </ContextMenu>
        </Dialog>
      );
    }

    render(<Page />);
    const file = screen.getByRole("button", { name: "report.pdf" });
    file.focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");
    expect(screen.getByRole("menu")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(file).toHaveFocus();

    await user.keyboard("{Shift>}{F10}{/Shift}{Enter}");
    expect(
      screen.getByRole("button", { name: "renamed.pdf" }),
    ).toBeInTheDocument();
    await act(() => sleep(0));
    expect(screen.getByRole("button", { name: "renamed.pdf" })).toHaveFocus();
  });

  it("renders on the server", () => {
    const html = renderToString(
      <ContextMenu items={[{ label: "Rename", shortcut: "mod+r" }]}>
        <li>report.pdf</li>
      </ContextMenu>,
    );
    expect(html).toContain("report.pdf");
    expect(html).not.toContain("Rename");
  });
});
