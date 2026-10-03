import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dropdown from "./dropdown";

// The trigger in the middle of the 1024 x 768 viewport of jsdom - room on
// every side, so the menu opens where it is asked to
function triggerInTheMiddle() {
  const getRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (!this.classList.contains("popover")) return getRect.call(this);
      return {
        bottom: 390,
        height: 30,
        left: 480,
        right: 540,
        top: 360,
        width: 60,
      } as DOMRect;
    },
  );
}

// The panel around the menu - it carries the placement
const panel = () => screen.getByRole("menu").parentElement!;

const items = [{ label: "Edit" }, { label: "Delete" }];

afterEach(() => {
  document.documentElement.removeAttribute("dir");
});

describe("Dropdown placement", () => {
  it("opens below the trigger from its end edge, 10px away, by default", async () => {
    const user = userEvent.setup();
    triggerInTheMiddle();
    render(
      <Dropdown aria-label="Actions" items={items} trigger={<span>…</span>} />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(panel()).toHaveClass("top-full", "inset-e-0");
    expect(panel().style.marginTop).toBe("10px");
  });

  it("opens above, aligned to the start or centered", async () => {
    const user = userEvent.setup();
    triggerInTheMiddle();
    const { rerender } = render(
      <Dropdown
        align="start"
        aria-label="Actions"
        items={items}
        position="top"
        trigger={<span>…</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(panel()).toHaveClass("bottom-full", "inset-s-0");

    rerender(
      <Dropdown
        align="center"
        aria-label="Actions"
        items={items}
        offset={4}
        position="top"
        trigger={<span>…</span>}
      />,
    );
    expect(panel()).toHaveClass("left-1/2");
    expect(panel().style.marginBottom).toBe("4px");
  });

  it("opens beside the trigger from its top - the end side right to left too", async () => {
    const user = userEvent.setup();
    triggerInTheMiddle();
    document.documentElement.dir = "rtl";
    render(
      <Dropdown
        aria-label="Actions"
        items={items}
        position="end"
        trigger={<span>…</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    // On the left of the trigger, right to left
    expect(panel()).toHaveClass("right-full", "top-0");
  });
});

describe("A controlled Dropdown", () => {
  it("opens when the parent says so and takes the focus", () => {
    const { rerender } = render(
      <Dropdown
        aria-label="Actions"
        items={items}
        open={false}
        trigger={<span>…</span>}
      />,
    );
    expect(screen.queryByRole("menu")).toBeNull();

    rerender(
      <Dropdown
        aria-label="Actions"
        items={items}
        open
        trigger={<span>…</span>}
      />,
    );
    const menu = screen.getByRole("menu");
    // As when it is clicked open - no item highlighted yet
    expect(menu).toHaveFocus();
    expect(menu).not.toHaveAttribute("aria-activedescendant");
  });

  it("asks to close on a pick, Escape and a click outside", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <>
        <Dropdown
          aria-label="Actions"
          items={items}
          onOpenChange={onOpenChange}
          open
          trigger={<span>…</span>}
        />
        <p>Outside</p>
      </>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    // Still open - the parent keeps it so
    expect(screen.getByRole("menu")).toBeInTheDocument();

    onOpenChange.mockClear();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    await user.click(screen.getByText("Outside"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("follows a parent that passes the state back - also a keyboard opening", async () => {
    const user = userEvent.setup();

    function Menu() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Dropdown
            aria-label="Actions"
            items={items}
            onOpenChange={setOpen}
            open={open}
            trigger={<span>…</span>}
          />
          <button onClick={() => setOpen(true)} type="button">
            Open the menu
          </button>
        </>
      );
    }
    render(<Menu />);

    const trigger = screen.getByRole("button", { name: "Actions" });
    act(() => trigger.focus());
    await user.keyboard("{ArrowDown}");
    const menu = screen.getByRole("menu");
    // Opened from the keyboard - its first item highlighted
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Edit" }).id,
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Open the menu" }));
    expect(screen.getByRole("menu")).toHaveFocus();
  });
});
