import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Button from "./button";
import Dropdown from "./dropdown";
import Popover from "./popover";
import Tooltip from "./tooltip";

describe("Tooltip", () => {
  it("shows on keyboard focus and hides on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip delay={10} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );

    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Saves the draft",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("Tooltip for screen readers", () => {
  it("describes the focused element while it is shown", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip delay={1000} title="Deletes the record">
        <button aria-describedby="hint" type="button">
          Delete
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete" });

    // Keyboard focus shows it without the delay
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Deletes the record");
    expect(button.getAttribute("aria-describedby")).toBe(
      `hint ${screen.getByRole("tooltip").id}`,
    );

    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-describedby", "hint");
  });
});

describe("Tooltip and Escape", () => {
  it("leaves Escape alone while it is hidden", () => {
    render(
      <Tooltip title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );

    // Not dispatched on a shown tooltip - nothing prevents it
    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(true);
  });

  it("uses up the Escape that hides it", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );

    await user.tab();
    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays shown on the Escape that cancels an IME composition", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip title="Type a name">
        <input aria-label="Name" />
      </Tooltip>,
    );

    await user.tab();
    fireEvent.keyDown(screen.getByRole("textbox"), {
      isComposing: true,
      key: "Escape",
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Type a name");
  });

  it("stays shown when a field uses up the Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip title="Type a name">
        <input
          aria-label="Name"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </Tooltip>,
    );

    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Type a name");
  });
});

describe("Tooltip hover", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const hoverTrigger = (delay: number) => {
    fireEvent.mouseEnter(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(delay));
    return screen.getByRole("tooltip");
  };

  it("stays shown while the pointer moves from the trigger onto it", () => {
    vi.useFakeTimers();
    render(
      <Tooltip delay={500} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );
    const tooltip = hoverTrigger(500);
    // The pointer can get onto it (WCAG 1.4.13)
    expect(tooltip).not.toHaveClass("pointer-events-none");

    // Across the gap, then on the tooltip
    fireEvent.mouseLeave(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(100));
    fireEvent.mouseEnter(tooltip);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("tooltip")).toBe(tooltip);

    // Left - hidden after the grace period
    fireEvent.mouseLeave(tooltip);
    act(() => vi.advanceTimersByTime(149));
    expect(screen.getByRole("tooltip")).toBe(tooltip);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays shown on the way back from it to the trigger", () => {
    vi.useFakeTimers();
    render(
      <Tooltip delay={1000} interactive title="Participants">
        <button type="button">12 participants</button>
      </Tooltip>,
    );
    const tooltip = hoverTrigger(1000);

    fireEvent.mouseEnter(tooltip);
    fireEvent.mouseLeave(tooltip);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole("tooltip")).toBe(tooltip);

    // Back on the trigger - no second `delay`, no flicker
    fireEvent.mouseEnter(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("tooltip")).toBe(tooltip);
  });

  it("stays shown when the pointer jumps from it straight onto the trigger", () => {
    vi.useFakeTimers();
    render(
      <Tooltip delay={200} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );
    const tooltip = hoverTrigger(200);

    fireEvent.mouseEnter(tooltip);
    // No gap crossed - React fires no mouseenter on the trigger around it
    fireEvent.mouseOut(tooltip, { relatedTarget: screen.getByRole("button") });
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("tooltip")).toBe(tooltip);
  });

  it("stays open on a click in an interactive tooltip", () => {
    vi.useFakeTimers();
    render(
      <Tooltip delay={0} interactive title="Participants">
        <button type="button">12 participants</button>
      </Tooltip>,
    );
    const tooltip = hoverTrigger(0);

    fireEvent.mouseEnter(tooltip);
    fireEvent.click(tooltip);
    expect(screen.getByRole("tooltip")).toBe(tooltip);
  });

  it("stays open when the focus moves from the trigger into it", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip interactive title={<ul tabIndex={-1}>Participants</ul>}>
        <button type="button">12 participants</button>
      </Tooltip>,
    );

    await user.tab();
    // A click on the scrollable list focuses it
    act(() => screen.getByRole("list").focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent("Participants");
  });

  it("hides on a click in a plain tooltip", () => {
    vi.useFakeTimers();
    render(
      <Tooltip delay={0} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );
    const tooltip = hoverTrigger(0);

    fireEvent.mouseEnter(tooltip);
    fireEvent.click(tooltip);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps a click on a plain tooltip from the trigger and its ancestors", () => {
    vi.useFakeTimers();
    const onRowClick = vi.fn();
    const onTooltipClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <Tooltip delay={0} onClick={onTooltipClick} title="Saves the draft">
          <button type="button">Save</button>
        </Tooltip>
      </div>,
    );
    const tooltip = hoverTrigger(0);

    fireEvent.click(tooltip);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onTooltipClick).not.toHaveBeenCalled();
  });
});

describe("Tooltip placement", () => {
  let rect = {
    bottom: 30,
    height: 20,
    left: 100,
    right: 140,
    top: 10,
    width: 40,
  };

  const mockLayout = () => {
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (
          this.getAttribute("role") !== "tooltip" &&
          this.querySelector("button")
        ) {
          return rect as DOMRect;
        }
        return getRect.call(this);
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(24);
  };

  afterEach(() => {
    vi.restoreAllMocks();
    rect = {
      bottom: 30,
      height: 20,
      left: 100,
      right: 140,
      top: 10,
      width: 40,
    };
  });

  const showTooltip = async (position: "top" | "bottom" | "left" | "right") => {
    const user = userEvent.setup();
    render(
      <Tooltip position={position} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );
    await user.tab();
    return screen.getByRole("tooltip");
  };

  it("flips below a trigger at the top of the viewport", async () => {
    mockLayout();
    const tooltip = await showTooltip("top");

    // Below: bottom of the trigger + the gap
    expect(tooltip.style.top).toBe("38px");
    // Centered on the trigger: 120 - 120 / 2
    expect(tooltip.style.left).toBe("60px");
  });

  it("stays inside the viewport at its left edge", async () => {
    mockLayout();
    rect = { bottom: 230, height: 20, left: 0, right: 20, top: 210, width: 20 };
    const tooltip = await showTooltip("top");

    expect(tooltip.style.left).toBe("4px");
    expect(tooltip.style.top).toBe(`${210 - 8 - 24}px`);
  });

  it("follows its trigger while the page scrolls", async () => {
    mockLayout();
    rect = {
      bottom: 230,
      height: 20,
      left: 100,
      right: 140,
      top: 210,
      width: 40,
    };
    const tooltip = await showTooltip("bottom");
    expect(tooltip.style.top).toBe("238px");

    rect = {
      bottom: 130,
      height: 20,
      left: 100,
      right: 140,
      top: 110,
      width: 40,
    };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(tooltip.style.top).toBe("138px");
  });
});

describe("Tooltip around the trigger of a popover or menu", () => {
  // As in the browsers, the focus a key press moves is visible - jsdom does
  // not always tell so for the focus a popover or menu moves into its panel
  const mockFocusVisible = () => {
    const { matches } = Element.prototype;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible"
        ? this === document.activeElement
        : matches.call(this, selector);
    });
  };

  it("stays hidden while the focus is in the panel, which gets the Escape", async () => {
    const user = userEvent.setup();
    mockFocusVisible();
    render(
      <Tooltip title="Filter the list">
        <Popover
          buttonTrigger
          trigger={<Button>Filters</Button>}
          triggerType="click"
        >
          <button type="button">Apply</button>
        </Popover>
      </Tooltip>,
    );

    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Filter the list");
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();
    // The focus in the panel is not on the trigger the tooltip explains
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
  });

  it("hides once a menu opened from the keyboard takes the focus", async () => {
    const user = userEvent.setup();
    mockFocusVisible();
    render(
      <Tooltip title="More actions">
        <Dropdown
          buttonTrigger
          items={[{ label: "Edit" }, { label: "Delete" }]}
          trigger={<Button aria-label="More">…</Button>}
        />
      </Tooltip>,
    );

    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();

    // Pointing at the menu does not show it either
    vi.useFakeTimers();
    fireEvent.mouseOver(screen.getByRole("menuitem", { name: "Edit" }));
    act(() => vi.advanceTimersByTime(1500));
    vi.useRealTimers();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
