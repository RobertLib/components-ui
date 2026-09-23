import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
