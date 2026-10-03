import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tooltip from "./tooltip";

const tooltipNamed = (text: string) =>
  screen
    .queryAllByRole("tooltip", { hidden: true })
    .find((tooltip) => tooltip.textContent === text) ?? null;

describe("A controlled Tooltip", () => {
  it("shows while open is true - without hover or focus", () => {
    render(
      <Tooltip open title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Saves the draft");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-describedby",
      tooltip.id,
    );
  });

  it("asks to show and to hide, and leaves it to the parent", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Tooltip onOpenChange={onOpenChange} open={false} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );

    await user.tab();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("tooltip")).toBeNull();

    rerender(
      <Tooltip onOpenChange={onOpenChange} open title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    // Still shown - the parent keeps it open
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("follows a parent that passes the state back", async () => {
    const user = userEvent.setup();

    function Hint() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Tooltip onOpenChange={setOpen} open={open} title="Saves the draft">
            <button type="button">Save</button>
          </Tooltip>
          <output>{open ? "shown" : "hidden"}</output>
        </>
      );
    }
    render(<Hint />);

    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("shown");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("hidden");
  });
});

describe("Tooltips shown one after another", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Past the window in which the next one shows at once
    act(() => vi.advanceTimersByTime(1000));
    vi.useRealTimers();
  });

  const toolbar = () =>
    render(
      <>
        <Tooltip delay={500} title="Bold">
          <button type="button">B</button>
        </Tooltip>
        <Tooltip delay={500} title="Italic">
          <button type="button">I</button>
        </Tooltip>
      </>,
    );
  const button = (name: string) => screen.getByRole("button", { name });

  it("shows the next one at once while one is shown - and only that one", () => {
    toolbar();

    fireEvent.mouseEnter(button("B"));
    act(() => vi.advanceTimersByTime(499));
    expect(tooltipNamed("Bold")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(tooltipNamed("Bold")).not.toBeNull();

    // Straight on to the next button - no waiting, and one tooltip at a time
    fireEvent.mouseLeave(button("B"));
    fireEvent.mouseEnter(button("I"));
    expect(tooltipNamed("Italic")).not.toBeNull();
    expect(tooltipNamed("Bold")).toBeNull();
  });

  it("shows the next one at once a moment after the pointer left one", () => {
    toolbar();

    fireEvent.mouseEnter(button("B"));
    act(() => vi.advanceTimersByTime(500));
    fireEvent.mouseLeave(button("B"));
    act(() => vi.advanceTimersByTime(200));
    expect(tooltipNamed("Bold")).toBeNull();

    // Within the window - at once
    act(() => vi.advanceTimersByTime(100));
    fireEvent.mouseEnter(button("I"));
    expect(tooltipNamed("Italic")).not.toBeNull();

    // Past it - the delay again
    fireEvent.mouseLeave(button("I"));
    act(() => vi.advanceTimersByTime(800));
    fireEvent.mouseEnter(button("B"));
    expect(tooltipNamed("Bold")).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(tooltipNamed("Bold")).not.toBeNull();
  });

  it("waits again after one was hidden by Escape", () => {
    toolbar();

    fireEvent.mouseEnter(button("B"));
    act(() => vi.advanceTimersByTime(500));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(tooltipNamed("Bold")).toBeNull();

    fireEvent.mouseLeave(button("B"));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.mouseEnter(button("I"));
    expect(tooltipNamed("Italic")).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(tooltipNamed("Italic")).not.toBeNull();
  });

  it("leaves a controlled tooltip alone", () => {
    render(
      <>
        <Tooltip open title="Pinned">
          <button type="button">P</button>
        </Tooltip>
        <Tooltip delay={500} title="Italic">
          <button type="button">I</button>
        </Tooltip>
      </>,
    );

    // A shown controlled tooltip does not make the others show at once
    fireEvent.mouseEnter(button("I"));
    expect(tooltipNamed("Italic")).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(tooltipNamed("Italic")).not.toBeNull();
    expect(tooltipNamed("Pinned")).not.toBeNull();
  });
});

describe("A tooltip shown on keyboard focus", () => {
  it("hides once another one shows on hover - after its delay", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip delay={50} title="Bold">
          <button type="button">B</button>
        </Tooltip>
        <Tooltip delay={50} title="Italic">
          <button type="button">I</button>
        </Tooltip>
      </>,
    );

    await user.tab();
    expect(tooltipNamed("Bold")).not.toBeNull();

    // Shown by the keyboard - the one on hover waits for its delay
    fireEvent.mouseEnter(screen.getByRole("button", { name: "I" }));
    expect(tooltipNamed("Italic")).toBeNull();
    expect(await screen.findByText("Italic")).toBeInTheDocument();
    expect(tooltipNamed("Bold")).toBeNull();
  });
});

describe("Tooltip start / end and scrolling", () => {
  let rect = { bottom: 320, height: 20, left: 500, right: 540, top: 300 };

  const mockLayout = () => {
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (
          this.getAttribute("role") !== "tooltip" &&
          this.querySelector("button")
        ) {
          return { ...rect, width: rect.right - rect.left } as DOMRect;
        }
        return getRect.call(this);
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(24);
  };

  afterEach(() => {
    document.documentElement.removeAttribute("dir");
    rect = { bottom: 320, height: 20, left: 500, right: 540, top: 300 };
  });

  const showTooltip = async (position?: "start" | "end") => {
    const user = userEvent.setup();
    render(
      <Tooltip position={position} title="Saves the draft">
        <button type="button">Save</button>
      </Tooltip>,
    );
    await user.tab();
    return screen.getByRole("tooltip", { hidden: true });
  };

  it("shows at the end of the trigger by default - its right side", async () => {
    mockLayout();
    const tooltip = await showTooltip();
    expect(tooltip.style.left).toBe(`${540 + 8}px`);
  });

  it("turns start and end round right to left", async () => {
    mockLayout();
    document.documentElement.dir = "rtl";
    const tooltip = await showTooltip("end");
    // On the left of the trigger
    expect(tooltip.style.left).toBe(`${500 - 8 - 120}px`);
  });

  it("shows at the start of the trigger - its left side", async () => {
    mockLayout();
    const tooltip = await showTooltip("start");
    expect(tooltip.style.left).toBe(`${500 - 8 - 120}px`);
  });

  it("hides while its trigger is scrolled out of view", async () => {
    mockLayout();
    const tooltip = await showTooltip();
    expect(tooltip.style.visibility).toBe("");

    rect = { bottom: -20, height: 20, left: 500, right: 540, top: -40 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(tooltip.style.visibility).toBe("hidden");
  });
});
