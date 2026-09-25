import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler, StrictMode, useLayoutEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Autocomplete from "./autocomplete";
import Dialog from "./dialog";
import Popover from "./popover";
// The public entry point - the prop types of Popover are exported there
import type { PopoverPopupRole } from "../index";

const cities = [
  { label: "Praha", value: "praha" },
  { label: "Plzeň", value: "plzen" },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Popover with nested popovers", () => {
  it("stays open while an Autocomplete inside it is used", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Popover trigger={<span>Filters</span>} triggerType="click">
        <Autocomplete label="City" onChange={onChange} options={cities} />
      </Popover>,
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByRole("combobox", { name: /City/ }));
    // The list is a portal of its own, outside the popover's panel
    await user.click(screen.getByRole("option", { name: "Plzeň" }));

    expect(onChange).toHaveBeenCalledWith("plzen", null);
    expect(screen.getByRole("combobox", { name: /City/ })).toHaveValue("Plzeň");
  });

  it("closes one level per Escape and leaves the Dialog around open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Filters">
        <Popover trigger={<span>More</span>} triggerType="click">
          <Autocomplete label="City" options={cities} />
        </Popover>
      </Dialog>,
    );

    await user.click(screen.getByText("More"));
    await user.click(screen.getByRole("combobox", { name: /City/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /City/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("combobox", { name: /City/ }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Popover in click mode", () => {
  it("leaves Enter and Space of a button in the trigger to the button", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <Popover
        trigger={
          <span>
            24.09.2026
            <button
              onClick={(event) => {
                // Like the clear button of a date picker
                event.stopPropagation();
                onClear();
              }}
              type="button"
            >
              Clear
            </button>
          </span>
        }
        triggerType="click"
      >
        Calendar
      </Popover>,
    );

    screen.getByRole("button", { name: "Clear" }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClear).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();

    // The trigger itself still toggles the popover
    screen.getByRole("button", { name: /24\.09\.2026/ }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Calendar")).toBeInTheDocument();
  });

  it("closes when the focus leaves after a press released outside the panel", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover trigger={<span>Open</span>} triggerType="click">
          Panel
        </Popover>
        <input aria-label="Next" />
      </>,
    );

    await user.click(screen.getByText("Open"));
    const panel = await screen.findByRole("dialog");

    // E.g. dragging the scrollbar of the panel out of it
    fireEvent.mouseDown(panel);
    fireEvent.mouseUp(document.body);

    await user.tab();
    expect(screen.getByRole("textbox", { name: "Next" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds no button semantics around a trigger with its own control", () => {
    render(
      <Popover
        interactiveTrigger
        trigger={<input aria-label="Field" role="combobox" />}
        triggerType="click"
      >
        Panel
      </Popover>,
    );

    const wrapper = screen.getByRole("combobox").parentElement!;
    expect(wrapper).not.toHaveAttribute("role");
    expect(wrapper).not.toHaveAttribute("tabindex");
    expect(wrapper).not.toHaveAttribute("aria-haspopup");
  });
});

describe("Popover on a phone", () => {
  let triggerTop = 100;

  const mobile = () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: () => {},
        matches: true,
        media: query,
        removeEventListener: () => {},
      })),
    );
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (!this.classList.contains("popover")) return getRect.call(this);
        return {
          bottom: triggerTop + 30,
          height: 30,
          left: 10,
          right: 310,
          top: triggerTop,
          width: 300,
          x: 10,
          y: triggerTop,
        } as DOMRect;
      },
    );
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    triggerTop = 100;
  });

  it("measures the trigger again after a controlled close", async () => {
    mobile();

    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Popover
            onOpenChange={setOpen}
            open={open}
            position="bottom"
            trigger={<span>Trigger</span>}
            triggerType="click"
          >
            Panel
          </Popover>
          <button onClick={() => setOpen((prev) => !prev)} type="button">
            toggle
          </button>
        </>
      );
    }

    render(<Controlled />);
    const panelTop = () => screen.getByRole("dialog").parentElement!.style.top;

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(panelTop()).toBe("100px");

    // Closed by the parent, not by the popover - then the page moves
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    triggerTop = 400;

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await act(() => sleep(0));
    expect(panelTop()).toBe("400px");
  });

  it("follows the trigger while the page scrolls", async () => {
    mobile();
    render(
      <Popover open position="bottom" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );
    const panelTop = () => screen.getByRole("dialog").parentElement!.style.top;
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(panelTop()).toBe("100px");

    triggerTop = 40;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(panelTop()).toBe("40px");
  });
});

describe("Popover in hover mode", () => {
  it("opens on keyboard focus and closes when the focus leaves", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover tabIndex={0} trigger={<span>Long text…</span>}>
          The whole text
        </Popover>
        <button type="button">Next</button>
      </>,
    );

    await user.tab();
    expect(screen.getByText("The whole text")).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(screen.queryByText("The whole text")).toBeNull();
  });

  it("moves Tab from its trigger into the panel and on past it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover trigger={<button type="button">Plan</button>}>
          <a href="/pricing">Compare plans</a>
        </Popover>
        <button type="button">Next</button>
      </>,
    );

    await user.tab();
    // Opened on keyboard focus - its link is reached right after the trigger
    await user.tab();
    expect(screen.getByRole("link", { name: "Compare plans" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Compare plans" })).toBeNull();
  });

  it("goes into the panel only from the last control of its trigger", async () => {
    const user = userEvent.setup();
    render(
      <Popover
        trigger={
          <span>
            <button type="button">Plan</button>
            <button type="button">Details</button>
          </span>
        }
      >
        <a href="/pricing">Compare plans</a>
      </Popover>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Plan" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Details" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Compare plans" })).toHaveFocus();
  });

  it("stays open while the pointer moves from the panel back to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<span>Trigger</span>}>
        <p>Panel text</p>
      </Popover>,
    );

    await user.hover(screen.getByText("Trigger"));
    await user.hover(await screen.findByText("Panel text"));
    await user.hover(screen.getByText("Trigger"));
    await act(() => sleep(80));
    expect(screen.getByText("Panel text")).toBeInTheDocument();

    await user.unhover(screen.getByText("Trigger"));
    await act(() => sleep(80));
    expect(screen.queryByText("Panel text")).not.toBeInTheDocument();
  });

  it("cancels the pending close when the pointer comes back or it unmounts", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <>
        <Popover onOpenChange={onOpenChange} trigger={<span>Trigger</span>}>
          <p>Panel text</p>
        </Popover>
        <span>Elsewhere</span>
      </>,
    );

    const trigger = screen.getByText("Trigger");
    await user.hover(trigger);
    await user.hover(screen.getByText("Elsewhere"));
    await user.hover(trigger);
    await act(() => sleep(80));
    expect(screen.getByText("Panel text")).toBeInTheDocument();

    await user.hover(screen.getByText("Elsewhere"));
    unmount();
    await act(() => sleep(80));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("Popover from the keyboard", () => {
  const panel = (
    <>
      <Popover
        aria-label="Filters"
        trigger={<span>Filters</span>}
        triggerType="click"
      >
        <button type="button">Apply</button>
        <button type="button">Reset</button>
      </Popover>
      <button type="button">Next</button>
    </>
  );

  it("moves Tab through the panel as if it followed the trigger", async () => {
    const user = userEvent.setup();
    render(panel);

    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    await user.keyboard("{Enter}");

    await user.tab();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(trigger).toHaveFocus();

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();

    // Past the end of the panel - on to what follows the trigger
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("goes round to the first control of a Dialog it is the last one of", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open title="Report">
        <input aria-label="Name" />
        <Popover
          aria-label="Filters"
          trigger={<span>Filters</span>}
          triggerType="click"
        >
          <button type="button">Apply</button>
        </Popover>
      </Dialog>,
    );

    await act(() => sleep(20));
    const trigger = screen.getByRole("button", { name: "Filters" });
    act(() => trigger.focus());
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();

    // Past the end of the panel - as Tab past the last control of the dialog
    await user.tab();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  });

  it("gives the focus back to the trigger when Escape closes it", async () => {
    const user = userEvent.setup();
    render(panel);

    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("keeps a surrounding Dialog from moving the focus it has moved", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open title="Filters">
        <button type="button">First</button>
        <Popover
          aria-label="More"
          trigger={<span>More</span>}
          triggerType="click"
        >
          <button type="button">Inside</button>
        </Popover>
      </Dialog>,
    );

    screen.getByRole("button", { name: "More" }).focus();
    await user.keyboard("{Enter}");
    await user.tab();

    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
  });
});

describe("Popover focus", () => {
  it("closes when the focus leaves the panel for the page", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover
          aria-label="Filters"
          trigger={<span>Filters</span>}
          triggerType="click"
        >
          <button type="button">Apply</button>
        </Popover>
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    act(() => screen.getByRole("button", { name: "Apply" }).focus());
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("closes on a click on a button trigger while the focus is in the panel - also in Safari", async () => {
    render(
      <Popover
        buttonTrigger
        trigger={<button type="button">Filters</button>}
        triggerType="click"
      >
        <input aria-label="Search" />
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(trigger);
    await act(async () => {});
    const search = screen.getByRole("textbox", { name: "Search" });
    act(() => search.focus());

    // Safari does not focus a button on a click - the focus goes to the
    // page, and the click that follows toggles the popover
    fireEvent.mouseDown(trigger);
    act(() => search.blur());
    fireEvent.mouseUp(trigger);
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Search" })).toBeNull();
  });

  it("closes when a Dialog opened from the page takes the focus", async () => {
    const user = userEvent.setup();

    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Popover
            aria-label="Actions"
            trigger={<span>Actions</span>}
            triggerType="click"
          >
            <button onClick={() => setOpen(true)} type="button">
              Rename
            </button>
          </Popover>
          <Dialog onClose={() => setOpen(false)} open={open} title="Rename">
            <input aria-label="Name" />
          </Dialog>
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
  });
});

describe("Popover in the overlay stack", () => {
  it("closes the inner popover first when both open in one commit", async () => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <Popover
        onOpenChange={onOuterChange}
        open
        trigger={<span>Outer</span>}
        triggerType="click"
      >
        <Popover
          onOpenChange={onInnerChange}
          open
          trigger={<span>Inner</span>}
          triggerType="click"
        >
          Inner panel
        </Popover>
      </Popover>,
    );

    expect(await screen.findByText("Inner panel")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onInnerChange).toHaveBeenCalledWith(false);
    expect(onOuterChange).not.toHaveBeenCalled();
  });
});

describe("Popover props", () => {
  it("calls the consumer's handlers along with its own", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      // The consumer can keep Space from toggling
      if (event.key === " ") event.preventDefault();
    });
    render(
      <Popover
        aria-label="Filters"
        onClick={onClick}
        onKeyDown={onKeyDown}
        trigger={<span>Filters</span>}
        triggerType="click"
      >
        Panel
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Panel")).toBeInTheDocument();

    trigger.focus();
    await user.keyboard(" ");
    expect(screen.getByText("Panel")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Panel")).toBeNull();
  });

  it("calls the consumer's mouse handlers in hover mode", async () => {
    const user = userEvent.setup();
    const onMouseEnter = vi.fn();
    render(
      <Popover onMouseEnter={onMouseEnter} trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );

    await user.hover(screen.getByText("Trigger"));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Panel")).toBeInTheDocument();
  });

  it("is a dialog named by its trigger by default", async () => {
    const user = userEvent.setup();
    render(
      <Popover
        aria-label="Filters"
        trigger={<span>Filters</span>}
        triggerType="click"
      >
        Panel
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Filters" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it.each(["menu", "listbox"] as const)(
    "wraps a %s without a dialog role around it",
    async (popupRole) => {
      const user = userEvent.setup();
      render(
        <Popover
          aria-controls="list"
          aria-label="Pick"
          popupRole={popupRole}
          trigger={<span>Pick</span>}
          triggerType="click"
        >
          <ul id="list" role={popupRole}>
            <li>One</li>
          </ul>
        </Popover>,
      );

      const trigger = screen.getByRole("button", { name: "Pick" });
      expect(trigger).toHaveAttribute("aria-haspopup", popupRole);
      await user.click(trigger);
      expect(screen.getByRole(popupRole)).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trigger).toHaveAttribute("aria-controls", "list");
    },
  );
});

describe("Popover placement", () => {
  const triggerAt = (rect: Partial<DOMRect>) => {
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("popover")) return rect as DOMRect;
        if (this.getAttribute("role") === "dialog") {
          // A tall panel beside a trigger near the bottom of the viewport
          return { bottom: 900, left: 100, right: 300, top: 700 } as DOMRect;
        }
        return getRect.call(this);
      },
    );
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on the other side when there is no room to the right", () => {
    triggerAt({ bottom: 130, height: 30, left: 900, right: 1000, top: 100 });
    render(
      <Popover open position="right" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );

    expect(screen.getByRole("dialog")).toHaveClass("right-full");
  });

  it("moves a side panel up into the viewport", async () => {
    triggerAt({ bottom: 730, height: 30, left: 10, right: 90, top: 700 });
    render(
      <Popover open position="right" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );

    await act(() => sleep(50));
    // 900 - (768 - 8) px over the bottom edge of the jsdom viewport
    expect(screen.getByRole("dialog").style.translate).toBe("0px -140px");
  });
});

describe("Popover over its trigger", () => {
  it("lets the pointer through its positioning box to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Popover
        aria-label="Filters"
        trigger={<span>Filters</span>}
        triggerType="click"
      >
        <button type="button">Apply</button>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = screen.getByRole("dialog");
    // The box is as big as the trigger and fixed over it - only the panel
    // and the hover bridge in it take the pointer
    const box = panel.parentElement!;
    expect(box).toHaveClass("pointer-events-none");
    expect(panel).toHaveClass("pointer-events-auto");
    expect(box.querySelector(".popover-bridge")).toHaveClass(
      "pointer-events-auto",
    );
  });

  it("adds nothing to the page but the box with its panel", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<span>Filters</span>} triggerType="click">
        <p>Panel content</p>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const box = screen.getByRole("dialog").parentElement!;
    // No stray text in the body next to the portal - it showed under the
    // page and screen readers read it
    expect(
      Array.from(document.body.childNodes).filter(
        (node) => node.nodeType === Node.TEXT_NODE,
      ),
    ).toEqual([]);
    expect(box.parentElement).toBe(document.body);
    expect(document.body).toHaveTextContent(/^FiltersPanel content$/);
  });
});

describe("Popover with a button as its trigger", () => {
  it("makes the button the trigger - one tab stop with the ARIA state", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover
          buttonTrigger
          trigger={<button type="button">Filters</button>}
          triggerType="click"
        >
          <button type="button">Apply</button>
        </Popover>
        <button type="button">Next</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Filters" });
    // No button wrapped around it
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    const panel = screen.getByRole("dialog", { name: "Filters" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);

    await user.tab();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(trigger).toHaveFocus();
    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("attaches the panel to the button, not to the wider wrapper", async () => {
    const user = userEvent.setup();
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("popover")) {
          return { height: 30, left: 0, top: 10, width: 800 } as DOMRect;
        }
        if (this.tagName === "BUTTON") {
          return { height: 30, left: 700, top: 10, width: 100 } as DOMRect;
        }
        return getRect.call(this);
      },
    );
    render(
      <Popover
        align="right"
        buttonTrigger
        position="bottom"
        trigger={<button type="button">Filters</button>}
        triggerType="click"
      >
        Panel
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const box = screen.getByRole("dialog").parentElement!;
    expect(box.style.left).toBe("700px");
    expect(box.style.width).toBe("100px");
  });

  it("keeps the button's own props and passes it the popover's aria props", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Popover
        aria-label="Sort the table"
        buttonTrigger
        trigger={
          <button id="sort" onClick={onClick} type="button">
            Sort
          </button>
        }
        triggerType="click"
      >
        Panel
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Sort the table" });
    expect(trigger).toHaveAttribute("id", "sort");
    await user.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: "Sort the table" }),
    ).toBeInTheDocument();
  });
});

describe("Popover closing with the focus in its panel", () => {
  it("gives the focus to the trigger when the parent closes it", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          aria-label="Label"
          onOpenChange={setOpen}
          open={open}
          trigger={<span>Label</span>}
          triggerType="click"
        >
          <button onClick={() => setOpen(false)} type="button">
            Apply
          </button>
        </Popover>
      );
    }

    render(<Controlled />);
    const trigger = screen.getByRole("button", { name: "Label" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("gives the focus back to a hover trigger on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Popover tabIndex={0} trigger={<span>Info</span>}>
        <a href="#details">Details</a>
      </Popover>,
    );

    // A hover popover opens on keyboard focus
    await user.tab();
    const trigger = document.activeElement as HTMLElement;
    act(() => screen.getByRole("link", { name: "Details" }).focus());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: "Details" })).toBeNull();
    expect(trigger).toHaveFocus();
    // Not opened again by the focus it got back
    await act(() => sleep(80));
    expect(screen.queryByRole("link", { name: "Details" })).toBeNull();
  });
});

describe("Popover with a field that takes the focus", () => {
  it("stays open when an autoFocus field in the panel takes the focus", async () => {
    const user = userEvent.setup();
    render(
      <Popover
        aria-label="Rename"
        trigger={<span>Rename</span>}
        triggerType="click"
      >
        <input aria-label="Name" autoFocus />
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Rename" })).toBeInTheDocument();
  });

  it("keeps that focus in StrictMode, which runs the effects twice", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Popover
          aria-label="Rename"
          trigger={<span>Rename</span>}
          triggerType="click"
        >
          <input aria-label="Name" autoFocus />
        </Popover>
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "Rename" }));
    await act(() => sleep(0));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });
});

describe("Popover panel clicks", () => {
  it("stay in the panel and leave the popover open", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onPopoverClick = vi.fn();
    const onDocumentClick = vi.fn();
    render(
      // A clickable row around a menu - a pick must not open the row too
      <div onClick={onRowClick}>
        <Popover
          aria-label="Filters"
          onClick={onPopoverClick}
          trigger={<span>Filters</span>}
          triggerType="click"
        >
          <button type="button">Apply</button>
        </Popover>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    onRowClick.mockClear();
    onPopoverClick.mockClear();
    document.addEventListener("click", onDocumentClick, true);
    await user.click(screen.getByRole("button", { name: "Apply" }));
    document.removeEventListener("click", onDocumentClick, true);

    expect(onRowClick).not.toHaveBeenCalled();
    expect(onPopoverClick).not.toHaveBeenCalled();
    // A capture listener of the page still sees it
    expect(onDocumentClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("leave a popover open that the panel is nested in", async () => {
    const user = userEvent.setup();
    render(
      <Popover
        aria-label="Outer"
        trigger={<span>Outer</span>}
        triggerType="click"
      >
        <Popover
          aria-label="Inner"
          trigger={<span>Inner</span>}
          triggerType="click"
        >
          <button type="button">Deep</button>
        </Popover>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Outer" }));
    await user.click(screen.getByRole("button", { name: "Inner" }));
    await user.click(screen.getByRole("button", { name: "Deep" }));

    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Inner" })).toBeInTheDocument();
  });
});

describe("Popover and an Escape handled in it", () => {
  it("stays open when a field in the panel uses up the Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onClose = vi.fn();
    const popupRole: PopoverPopupRole = "dialog";
    render(
      <Dialog onClose={onClose} open title="Edit">
        <Popover
          aria-label="Link"
          onOpenChange={onOpenChange}
          popupRole={popupRole}
          trigger={<span>Link</span>}
          triggerType="click"
        >
          <input
            aria-label="URL"
            onKeyDown={(event) => {
              // Like the link form of a RichTextEditor - closes itself only
              if (event.key === "Escape") event.preventDefault();
            }}
          />
        </Popover>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.click(screen.getByRole("textbox", { name: "URL" }));
    onOpenChange.mockClear();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("textbox", { name: "URL" })).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // The next Escape from the trigger closes the panel, not the Dialog
    screen.getByRole("button", { name: "Link" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open on the Escape that ends an IME composition", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Popover
        onOpenChange={onOpenChange}
        trigger={<span>Search</span>}
        triggerType="click"
      >
        <input aria-label="Query" />
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Search" }));
    onOpenChange.mockClear();
    const input = screen.getByRole("textbox", { name: "Query" });
    fireEvent.keyDown(input, { isComposing: true, key: "Escape" });
    fireEvent.keyDown(input, { key: "Escape", keyCode: 229 });
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("Popover flipping", () => {
  // The panel's content is this tall - the panel no taller than its max
  // height
  let panelHeight = 100;
  let resize: (() => void) | undefined;

  const layout = (trigger: Partial<DOMRect>) => {
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("popover")) return trigger as DOMRect;
        return getRect.call(this);
      },
    );
    const isPanel = (element: HTMLElement) =>
      element.getAttribute("role") === "dialog";
    const height = (element: HTMLElement) =>
      Math.min(panelHeight, parseFloat(element.style.maxHeight) || Infinity);
    for (const property of ["offsetHeight", "clientHeight"] as const) {
      vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(
        function (this: HTMLElement) {
          return isPanel(this) ? height(this) : 0;
        },
      );
    }
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return isPanel(this) ? panelHeight : 0;
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        disconnect() {
          resize = undefined;
        }
        observe() {}
        unobserve() {}
      },
    );
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    panelHeight = 100;
    resize = undefined;
  });

  const panel = () => screen.getByRole("dialog");

  it("keeps a short panel below when it fits there", async () => {
    // 768 - 610 px below: less than a list's 240px, more than the panel's
    layout({ bottom: 610, height: 30, left: 10, right: 110, top: 580 });
    render(
      <Popover open position="bottom" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );

    await act(() => sleep(20));
    expect(panel()).toHaveClass("top-full");
    expect(panel().style.maxHeight).toBe("");
  });

  it("flips once the content grows, and stops observing it on closing", async () => {
    layout({ bottom: 610, height: 30, left: 10, right: 110, top: 580 });
    const { rerender } = render(
      <Popover open position="bottom" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );

    await act(() => sleep(20));
    expect(panel()).toHaveClass("top-full");

    panelHeight = 300;
    act(() => resize?.());
    expect(panel()).toHaveClass("bottom-full");

    rerender(
      <Popover open={false} position="bottom" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );
    expect(resize).toBeUndefined();
  });

  it("holds a panel that fits on neither side to the larger room", async () => {
    // 768 - 430 - 16 = 322px below, 400 - 16 = 384px above
    layout({ bottom: 430, height: 30, left: 10, right: 110, top: 400 });
    panelHeight = 600;
    render(
      <Popover open position="bottom" trigger={<span>Trigger</span>}>
        Panel
      </Popover>,
    );

    await act(() => sleep(20));
    expect(panel()).toHaveClass("bottom-full");
    expect(panel().style.maxHeight).toBe("384px");

    // Held to the room, it is measured by its content - it stays there
    act(() => resize?.());
    expect(panel()).toHaveClass("bottom-full");
    expect(panel().style.maxHeight).toBe("384px");

    // Content that shrinks lets it go back below
    panelHeight = 200;
    act(() => resize?.());
    expect(panel()).toHaveClass("top-full");
    expect(panel().style.maxHeight).toBe("");
  });
});

describe("Popover renders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("nothing anew once mounted closed", async () => {
    const onRender = vi.fn();
    render(
      <Profiler id="popover" onRender={onRender}>
        <Popover trigger={<span>Trigger</span>} triggerType="click">
          Panel
        </Popover>
      </Profiler>,
    );

    await act(() => sleep(50));
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it("the panel of a reopened hover popover where the trigger is now", async () => {
    const user = userEvent.setup();
    let triggerTop = 100;
    const getRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (!this.classList.contains("popover")) return getRect.call(this);
        return {
          bottom: triggerTop + 30,
          height: 30,
          top: triggerTop,
        } as DOMRect;
      },
    );
    // Where the panel is when it first shows up in the page
    const tops: string[] = [];
    function Content() {
      const ref = useRef<HTMLSpanElement>(null);
      useLayoutEffect(() => {
        tops.push(
          ref.current!.closest<HTMLElement>(".pointer-events-none")!.style.top,
        );
      }, []);
      return <span ref={ref}>Panel</span>;
    }

    render(
      <Popover trigger={<span>Trigger</span>}>
        <Content />
      </Popover>,
    );

    await user.hover(screen.getByText("Trigger"));
    await user.unhover(screen.getByText("Trigger"));
    await act(() => sleep(60));
    expect(screen.queryByText("Panel")).toBeNull();

    // The page scrolled while it was closed
    triggerTop = 300;
    await user.hover(screen.getByText("Trigger"));
    expect(tops).toEqual(["100px", "300px"]);
  });
});

describe("Popover in a right-to-left part of the page", () => {
  it("gives its panel, a portal in the body, the direction of its trigger", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <Popover
          aria-label="Filters"
          trigger={<span>Filters</span>}
          triggerType="click"
        >
          <button type="button">Apply</button>
        </Popover>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = screen.getByRole("dialog", { name: "Filters" });
    expect(panel.closest("[dir]")).toHaveAttribute("dir", "rtl");
    expect(panel.closest("[dir]")?.parentElement).toBe(document.body);
  });
});

describe("Popover names", () => {
  it("names a hover panel by its trigger", async () => {
    const user = userEvent.setup();
    render(<Popover trigger={<span>Opening hours</span>}>Mon–Fri</Popover>);

    await user.hover(screen.getByText("Opening hours"));
    expect(
      screen.getByRole("dialog", { name: "Opening hours" }),
    ).toHaveTextContent("Mon–Fri");
  });
});

describe("Popover in a shadow root", () => {
  it("closes on a click on its trigger - not a click outside", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const container = document.createElement("div");
    host.attachShadow({ mode: "open" }).append(container);
    const onOpenChange = vi.fn();

    render(
      <Popover
        onOpenChange={onOpenChange}
        trigger={<span>Filters</span>}
        triggerType="click"
      >
        Panel
      </Popover>,
      { container },
    );

    // What a click in the page dispatches - composed, out of the root
    const click = (element: Element) => {
      for (const type of ["mousedown", "mouseup", "click"]) {
        act(() => {
          element.dispatchEvent(
            new MouseEvent(type, { bubbles: true, composed: true }),
          );
        });
      }
    };

    const trigger = container.querySelector("[role=button]")!;
    click(trigger);
    click(screen.getByText("Panel"));
    click(trigger);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    host.remove();
  });
});
