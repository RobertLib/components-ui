import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Autocomplete from "./autocomplete";
import Dialog from "./dialog";
import Popover from "./popover";

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
