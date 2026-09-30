import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Popover from "./popover";
// The public entry point - the new types of Popover are exported there
import type { PopoverAlign, PopoverAnchor, PopoverPosition } from "../index";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Box {
  height: number;
  left: number;
  top: number;
  width: number;
}

const toRect = ({ height, left, top, width }: Box) =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
  }) as DOMRect;

/**
 * Lays the page out: the trigger (the wrapper of the popover) where `trigger`
 * says, the panel where `panel` says, the box around the panel over the
 * trigger. Returns what changes it.
 */
function layout(initial: { list?: Box; panel?: Box; trigger: Box }) {
  const boxes = { ...initial };
  const getRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("popover")) return toRect(boxes.trigger);
      // A scrolling container around the trigger
      if (this.dataset.testid === "list" && boxes.list) {
        return toRect(boxes.list);
      }
      if (this.getAttribute("role") === "dialog" && boxes.panel) {
        return toRect(boxes.panel);
      }
      // The fixed box around the panel - over the trigger
      if (this.querySelector(":scope > [role=dialog]")) {
        return toRect(boxes.trigger);
      }
      return getRect.call(this);
    },
  );
  return boxes;
}

// Also while it is hidden - out of the accessibility tree
const panel = () => screen.getByRole("dialog", { hidden: true });
const positioningBox = () => panel().parentElement!;
const arrowOf = () =>
  positioningBox().querySelector<HTMLElement>(".popover-arrow");

// In the middle of the 1024 x 768 viewport of jsdom - room on every side
const middle = () =>
  layout({ trigger: { height: 30, left: 480, top: 360, width: 60 } });

afterEach(() => {
  document.documentElement.removeAttribute("dir");
  vi.restoreAllMocks();
});

describe("Popover align", () => {
  it.each([
    ["start", "inset-s-0"],
    ["end", "inset-e-0"],
    // Deprecated - they keep the physical edge
    ["left", "left-0"],
    ["right", "right-0"],
  ] as [PopoverAlign, string][])(
    "lines a panel below the trigger up with its %s",
    (align, className) => {
      render(
        <Popover align={align} open position="bottom" trigger={<span>T</span>}>
          Panel
        </Popover>,
      );
      expect(panel()).toHaveClass("top-full", className);
    },
  );

  it("centers the panel on the trigger by a translate", () => {
    middle();
    render(
      <Popover align="center" open position="top" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(panel()).toHaveClass("bottom-full", "left-1/2");
    expect(panel().style.translate).toBe("calc(0px - 50%) 0px");
  });

  it("lines a side panel up with the top, the middle or the bottom", () => {
    middle();
    const { rerender } = render(
      <Popover align="start" open position="right" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(panel()).toHaveClass("left-full", "top-0");

    rerender(
      <Popover align="end" open position="right" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(panel()).toHaveClass("bottom-0");

    rerender(
      <Popover align="center" open position="right" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(panel()).toHaveClass("top-1/2");
    expect(panel().style.translate).toBe("0px calc(0px - 50%)");
  });
});

describe("Popover start / end positions", () => {
  it.each([
    ["start", "ltr", "right-full"],
    ["end", "ltr", "left-full"],
    ["start", "rtl", "left-full"],
    ["end", "rtl", "right-full"],
  ] as [PopoverPosition, "ltr" | "rtl", string][])(
    "opens %s of the trigger in a %s page",
    (position, dir, className) => {
      middle();
      document.documentElement.dir = dir;
      render(
        <Popover open position={position} trigger={<span>T</span>}>
          Panel
        </Popover>,
      );
      expect(panel()).toHaveClass(className);
    },
  );

  it("opens at the end of the trigger by default - on its left right to left", () => {
    middle();
    render(
      <div dir="rtl">
        <Popover open trigger={<span>T</span>}>
          Panel
        </Popover>
      </div>,
    );
    expect(panel()).toHaveClass("right-full");
  });
});

describe("Popover offset", () => {
  it("keeps the gap of a class, which contentClassName can change", () => {
    render(
      <Popover open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(panel()).toHaveClass("mt-2");
    expect(panel().style.marginTop).toBe("");
  });

  it("puts the panel `offset` pixels away and bridges that gap on hover", async () => {
    const user = userEvent.setup();
    render(
      <Popover offset={16} position="bottom" trigger={<span>Help</span>}>
        Panel
      </Popover>,
    );

    await user.hover(screen.getByText("Help"));
    expect(panel().style.marginTop).toBe("16px");
    expect(panel()).not.toHaveClass("mt-2");
    expect(
      positioningBox().querySelector<HTMLElement>(".popover-bridge")!.style
        .height,
    ).toBe("16px");
  });

  it("flips with its offset", () => {
    layout({ trigger: { height: 30, left: 100, top: 700, width: 40 } });
    render(
      <Popover offset={12} open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(panel()).toHaveClass("bottom-full");
    expect(panel().style.marginBottom).toBe("12px");
  });
});

describe("Popover arrow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("points at the center of the trigger from the edge of the panel", () => {
    layout({
      panel: { height: 100, left: 100, top: 138, width: 200 },
      trigger: { height: 30, left: 100, top: 100, width: 40 },
    });
    render(
      <Popover arrow open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );

    const arrow = arrowOf()!;
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    // Up at the trigger, on the top edge of the panel
    expect(arrow).toHaveClass("border-t", "border-l");
    expect(arrow.style.left).toBe("20px");
    expect(arrow.style.top).toBe("38px");
  });

  it("stays inside the panel when it was moved along the edge", async () => {
    const boxes = layout({
      panel: { height: 100, left: 100, top: 138, width: 200 },
      trigger: { height: 30, left: 100, top: 100, width: 40 },
    });
    render(
      <Popover arrow open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );

    // Moved to the right, into the viewport - the arrow stays off its
    // rounded corner
    boxes.panel = { height: 100, left: 130, top: 138, width: 200 };
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await act(() => sleep(20));
    expect(arrowOf()!.style.left).toBe("42px");
  });

  it("goes along when the panel flips to the other side", () => {
    // No room above a trigger at the top of the viewport
    layout({
      panel: { height: 100, left: 100, top: 48, width: 200 },
      trigger: { height: 30, left: 100, top: 10, width: 40 },
    });
    render(
      <Popover arrow open position="top" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );

    expect(panel()).toHaveClass("top-full");
    expect(arrowOf()).toHaveClass("border-t", "border-l");
    expect(arrowOf()!.style.top).toBe("38px");
  });

  it("points sideways from a side panel", () => {
    layout({
      panel: { height: 120, left: 148, top: 60, width: 200 },
      trigger: { height: 30, left: 100, top: 100, width: 40 },
    });
    render(
      <Popover arrow open position="end" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );

    const arrow = arrowOf()!;
    // Left at the trigger, on the left edge of the panel, level with the
    // middle of the trigger
    expect(arrow).toHaveClass("border-b", "border-l");
    expect(arrow.style.left).toBe("48px");
    expect(arrow.style.top).toBe("15px");
  });

  it("takes the colors of the panel", () => {
    layout({
      panel: { height: 100, left: 100, top: 138, width: 200 },
      trigger: { height: 30, left: 100, top: 100, width: 40 },
    });
    const getStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = getStyle(element);
      if (element.getAttribute("role") !== "dialog") return style;
      return {
        ...style,
        backgroundColor: "rgb(17, 24, 39)",
        borderTopColor: "rgb(55, 65, 81)",
        borderTopWidth: "1px",
        direction: "ltr",
        maxHeight: "none",
      } as CSSStyleDeclaration;
    });
    render(
      <Popover arrow open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );

    expect(arrowOf()!.style.backgroundColor).toBe("rgb(17, 24, 39)");
    expect(arrowOf()!.style.borderColor).toBe("rgb(55, 65, 81)");
  });

  it("has no arrow unless asked", () => {
    render(
      <Popover open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(arrowOf()).toBeNull();
  });
});

describe("Popover at an anchor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens at a point, with nothing of its own in the page", () => {
    render(
      <Popover anchor={{ x: 300, y: 200 }} contentLabel="Actions" open>
        Panel
      </Popover>,
    );

    expect(positioningBox().style.top).toBe("200px");
    expect(positioningBox().style.left).toBe("300px");
    expect(positioningBox().style.height).toBe("0px");
    // No empty button, and no gap in a flex row
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector(".popover")).toHaveClass("contents");
    expect(screen.getByRole("dialog", { name: "Actions" })).toBeInTheDocument();
  });

  it("reads a function again as the page scrolls", () => {
    let rect = toRect({ height: 20, left: 50, top: 300, width: 120 });
    render(
      <Popover anchor={() => rect} open position="top">
        Toolbar
      </Popover>,
    );
    expect(positioningBox().style.top).toBe("300px");

    rect = toRect({ height: 20, left: 50, top: 180, width: 120 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(positioningBox().style.top).toBe("180px");
    expect(positioningBox().style.width).toBe("120px");
  });

  it("measures an element given as the anchor, while the trigger toggles it", async () => {
    const user = userEvent.setup();
    const target = document.createElement("div");
    document.body.append(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(
      toRect({ height: 40, left: 400, top: 250, width: 90 }),
    );

    render(
      <Popover
        anchor={target}
        position="bottom"
        trigger={<span>Details</span>}
        triggerType="click"
      >
        Panel
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(positioningBox().style.left).toBe("400px");
    expect(positioningBox().style.top).toBe("250px");
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    target.remove();
  });

  it("follows a new anchor while open", () => {
    const { rerender } = render(
      <Popover anchor={{ x: 10, y: 20 }} open>
        Panel
      </Popover>,
    );
    rerender(
      <Popover anchor={{ x: 110, y: 120 }} open>
        Panel
      </Popover>,
    );
    expect(positioningBox().style.left).toBe("110px");
    expect(positioningBox().style.top).toBe("120px");
  });

  it("gives the focus back to where it was when it opened on Escape", async () => {
    const user = userEvent.setup();

    function Toolbar() {
      const [open, setOpen] = useState(false);
      const anchor: PopoverAnchor = { x: 100, y: 100 };
      return (
        <>
          <textarea
            aria-label="Text"
            onKeyDown={(event) => {
              if (event.key === "F2") setOpen(true);
            }}
          />
          <Popover
            anchor={anchor}
            onOpenChange={setOpen}
            open={open}
            popupRole="none"
          >
            <button type="button">Bold</button>
          </Popover>
        </>
      );
    }
    render(<Toolbar />);

    const text = screen.getByRole("textbox", { name: "Text" });
    await user.click(text);
    await user.keyboard("{F2}");
    const bold = screen.getByRole("button", { name: "Bold" });
    act(() => bold.focus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(text).toHaveFocus();
  });

  it("stays open when the pointer leaves it - it has no trigger to hover", async () => {
    const onOpenChange = vi.fn();
    render(
      <Popover anchor={{ x: 100, y: 100 }} onOpenChange={onOpenChange} open>
        Panel
      </Popover>,
    );

    fireEvent.mouseEnter(panel());
    fireEvent.mouseLeave(panel());
    await act(() => sleep(80));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("Popover with its trigger scrolled out of view", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides until the trigger is back in the viewport", () => {
    const boxes = layout({
      trigger: { height: 30, left: 100, top: 300, width: 40 },
    });
    render(
      <Popover open position="bottom" trigger={<span>T</span>}>
        Panel
      </Popover>,
    );
    expect(positioningBox().style.visibility).toBe("");

    // Scrolled up out of the viewport
    boxes.trigger = { height: 30, left: 100, top: -60, width: 40 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(positioningBox().style.visibility).toBe("hidden");

    boxes.trigger = { height: 30, left: 100, top: 20, width: 40 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(positioningBox().style.visibility).toBe("");
  });

  it("hides once the trigger is scrolled out of a list around it", () => {
    const boxes = layout({
      list: { height: 200, left: 0, top: 100, width: 300 },
      trigger: { height: 30, left: 20, top: 120, width: 40 },
    });
    render(
      <div data-testid="list" style={{ height: 200, overflowY: "auto" }}>
        <Popover open position="bottom" trigger={<span>T</span>}>
          Panel
        </Popover>
      </div>,
    );
    expect(positioningBox().style.visibility).toBe("");

    // In the viewport, but above the top of the scrolled list
    boxes.trigger = { height: 30, left: 20, top: 40, width: 40 };
    fireEvent.scroll(screen.getByTestId("list"));
    expect(positioningBox().style.visibility).toBe("hidden");
  });
});
