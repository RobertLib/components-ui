import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Splitter, { type SplitterProps } from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

const handle = (name?: string) =>
  name
    ? screen.getByRole("separator", { name })
    : screen.getAllByRole("separator")[0];

/** The size a pane is rendered with - its flex grow. */
const paneSize = (text: string) =>
  Number(
    screen
      .getByText(text)
      .closest("[id$='-pane-0'], [id*='-pane-']")
      ?.getAttribute("style")
      ?.match(/--splitter-pane-size:\s*([\d.]+)/)?.[1],
  );

function renderSplitter(props: Partial<SplitterProps> = {}) {
  return render(
    <Splitter defaultSizes={[30, 70]} paneLabels={["Orders"]} {...props}>
      <div>List</div>
      <div>Detail</div>
    </Splitter>,
  );
}

/** Lays the page out right to left - jsdom knows no `dir`. */
function mockRightToLeft() {
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return new Proxy(style, {
      get: (target, property) => {
        if (property === "direction") return "rtl";
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

/** Gives the splitter a size - jsdom lays nothing out. */
function sizeSplitter(width = 1000, height = 500) {
  const root = handle().parentElement as HTMLElement;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    bottom: height,
    height,
    left: 0,
    right: width,
    toJSON: () => ({}),
    top: 0,
    width,
    x: 0,
    y: 0,
  });
}

function drag(element: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(element, {
    button: 0,
    clientX: from,
    clientY: from,
    isPrimary: true,
    pointerId: 1,
  });
  fireEvent.pointerMove(element, { clientX: to, clientY: to, pointerId: 1 });
}

describe("Splitter", () => {
  it("renders the panes with separators between them", () => {
    render(
      <Splitter defaultSizes={[20, 50, 30]}>
        <div>Folders</div>
        {null}
        <div>Messages</div>
        <div>Message</div>
      </Splitter>,
    );

    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(2);
    expect(paneSize("Folders")).toBe(20);
    expect(paneSize("Messages")).toBe(50);

    const [first] = separators;
    expect(first).toHaveAccessibleName("Resize pane 1");
    expect(first).toHaveAttribute("aria-orientation", "vertical");
    expect(first).toHaveAttribute("aria-valuenow", "20");
    expect(first).toHaveAttribute("aria-valuemin", "0");
    expect(first).toHaveAttribute("aria-valuemax", "70");
    expect(first).toHaveAttribute("aria-valuetext", "20%");
    expect(first).toHaveAttribute("tabindex", "0");
    // It controls the pane before it
    const controlled = document.getElementById(
      first.getAttribute("aria-controls") ?? "",
    );
    expect(controlled).toHaveTextContent("Folders");
  });

  it("is named after the pane before the handle", () => {
    renderSplitter();
    expect(handle("Orders")).toBeInTheDocument();
  });

  it("shares the space equally without default sizes", () => {
    render(
      <Splitter>
        <div>A</div>
        <div>B</div>
        <div>C</div>
        <div>D</div>
      </Splitter>,
    );
    expect(paneSize("C")).toBe(25);
  });

  it("writes the value as the language does", () => {
    render(
      <UIProvider locale={cs}>
        <Splitter defaultSizes={[30, 70]}>
          <div>A</div>
          <div>B</div>
        </Splitter>
      </UIProvider>,
    );
    expect(handle()).toHaveAccessibleName("Změnit velikost panelu 1");
    // With a no-break space
    expect(handle()).toHaveAttribute("aria-valuetext", "30\u00a0%");
  });
});

describe("Splitter keyboard", () => {
  it("moves a handle with the arrow keys, Shift, Home and End", async () => {
    const user = userEvent.setup();
    const onSizesChange = vi.fn();
    renderSplitter({ maxSizes: [60, 100], minSizes: [20, 0], onSizesChange });

    await user.tab();
    expect(handle("Orders")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onSizesChange).toHaveBeenLastCalledWith([31, 69]);
    expect(handle("Orders")).toHaveAttribute("aria-valuenow", "31");

    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(handle("Orders")).toHaveAttribute("aria-valuenow", "21");
    // Stops at the minimum
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle("Orders")).toHaveAttribute("aria-valuenow", "20");

    await user.keyboard("{End}");
    expect(handle("Orders")).toHaveAttribute("aria-valuenow", "60");
    expect(handle("Orders")).toHaveAttribute("aria-valuemax", "60");
    await user.keyboard("{Home}");
    expect(handle("Orders")).toHaveAttribute("aria-valuenow", "20");
    expect(handle("Orders")).toHaveAttribute("aria-valuemin", "20");
  });

  it("moves a handle towards the first pane with Right in a right-to-left page", async () => {
    const user = userEvent.setup();
    mockRightToLeft();
    renderSplitter();

    await user.tab();
    // The first pane is on the right - Left moves the handle away from it
    await user.keyboard("{ArrowLeft}");
    expect(handle()).toHaveAttribute("aria-valuenow", "31");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "29");
  });

  it("moves a handle of stacked panes with Up and Down", async () => {
    const user = userEvent.setup();
    renderSplitter({ orientation: "vertical" });

    expect(handle()).toHaveAttribute("aria-orientation", "horizontal");
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(handle()).toHaveAttribute("aria-valuenow", "31");
    // The keys of the other direction are left alone
    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "31");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(handle()).toHaveAttribute("aria-valuenow", "29");
  });

  it("collapses a collapsible pane with Enter and restores it", async () => {
    const user = userEvent.setup();
    renderSplitter({ collapsible: [true, false], minSizes: [20, 0] });

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "0");
    // Hidden and out of the Tab order
    const pane = screen.getByText("List").parentElement as HTMLElement;
    expect(pane).toHaveAttribute("inert");

    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "32");
    expect(pane).not.toHaveAttribute("inert");
  });

  it("collapses the pane after the handle when that one is collapsible", async () => {
    const user = userEvent.setup();
    renderSplitter({ collapsible: [false, true] });

    await user.tab();
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "100");
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "30");
  });

  it("restores a collapsed pane with Enter before collapsing the other", async () => {
    const user = userEvent.setup();
    renderSplitter({ collapsible: [true, true] });

    await user.tab();
    // The pane after the handle collapses at the end
    await user.keyboard("{End}");
    expect(handle()).toHaveAttribute("aria-valuenow", "100");

    // Enter restores it, again collapses the pane before the handle
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "30");
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "0");
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "30");
  });

  it("collapses a pane stepped past its minimum", async () => {
    const user = userEvent.setup();
    renderSplitter({ collapsible: [true, false], minSizes: [25, 0] });

    await user.tab();
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(handle()).toHaveAttribute("aria-valuenow", "25");
    expect(handle()).toHaveAttribute("aria-valuemin", "0");
    await user.keyboard("{ArrowLeft}");
    expect(handle()).toHaveAttribute("aria-valuenow", "0");
    // Back at its minimum
    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "25");
  });

  it("does nothing on Enter without a collapsible pane", async () => {
    const user = userEvent.setup();
    const onSizesChange = vi.fn();
    renderSplitter({ onSizesChange });

    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSizesChange).not.toHaveBeenCalled();
  });
});

describe("Splitter pointer", () => {
  it("resizes the panes while a handle is dragged", () => {
    const onSizesChange = vi.fn();
    renderSplitter({ onSizesChange });
    sizeSplitter();

    drag(handle(), 300, 450);
    expect(onSizesChange).toHaveBeenLastCalledWith([45, 55]);
    expect(paneSize("List")).toBe(45);
    // The whole page shows the resize cursor meanwhile
    expect(document.body.style.cursor).toBe("col-resize");

    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(document.body.style.cursor).toBe("");
    // Moves after the release do nothing
    fireEvent.pointerMove(handle(), { clientX: 900, pointerId: 1 });
    expect(paneSize("List")).toBe(45);
  });

  it("follows the pointer in a right-to-left page", () => {
    mockRightToLeft();
    renderSplitter();
    sizeSplitter();

    // The first pane is on the right - dragging to the left widens it
    drag(handle(), 700, 550);
    expect(paneSize("List")).toBe(45);
  });

  it("drags stacked panes vertically", () => {
    renderSplitter({ orientation: "vertical" });
    sizeSplitter(1000, 500);

    drag(handle(), 150, 250);
    expect(paneSize("List")).toBe(50);
  });

  it("keeps the panes within their limits and collapses a collapsible one", () => {
    renderSplitter({
      collapsible: [true, false],
      maxSizes: [80, 100],
      minSizes: [20, 0],
    });
    sizeSplitter();

    drag(handle(), 300, 950);
    expect(paneSize("List")).toBe(80);

    fireEvent.pointerMove(handle(), { clientX: 150, pointerId: 1 });
    expect(paneSize("List")).toBe(20);

    // Below half the minimum
    fireEvent.pointerMove(handle(), { clientX: 90, pointerId: 1 });
    expect(paneSize("List")).toBe(0);
    fireEvent.pointerUp(handle(), { pointerId: 1 });

    // Enter restores the size before the drag
    act(() => handle().focus());
    fireEvent.keyDown(handle(), { key: "Enter" });
    expect(paneSize("List")).toBe(30);
  });

  it("cancels a drag with Escape - only the drag", () => {
    const onKeyDown = vi.fn();
    document.addEventListener("keydown", onKeyDown);
    renderSplitter();
    sizeSplitter();

    drag(handle(), 300, 600);
    expect(paneSize("List")).toBe(60);

    fireEvent.keyDown(handle(), { key: "Escape" });
    expect(paneSize("List")).toBe(30);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(document.body.style.cursor).toBe("");

    fireEvent.pointerMove(handle(), { clientX: 700, pointerId: 1 });
    expect(paneSize("List")).toBe(30);
    document.removeEventListener("keydown", onKeyDown);
  });

  it("follows only the pressed pointer and the primary button", () => {
    renderSplitter();
    sizeSplitter();

    fireEvent.pointerDown(handle(), {
      button: 2,
      clientX: 300,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle(), { clientX: 500, pointerId: 1 });
    expect(paneSize("List")).toBe(30);

    drag(handle(), 300, 400);
    fireEvent.pointerMove(handle(), { clientX: 800, pointerId: 2 });
    expect(paneSize("List")).toBe(40);
  });

  it("brings back the default ratio on a double click", async () => {
    const user = userEvent.setup();
    const onSizesChange = vi.fn();
    render(
      <Splitter defaultSizes={[20, 30, 50]} onSizesChange={onSizesChange}>
        <div>A</div>
        <div>B</div>
        <div>C</div>
      </Splitter>,
    );

    const second = screen.getAllByRole("separator")[1];
    act(() => second.focus());
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(onSizesChange).toHaveBeenLastCalledWith([20, 40, 40]);

    await user.dblClick(second);
    expect(onSizesChange).toHaveBeenLastCalledWith([20, 30, 50]);
  });
});

describe("Splitter state", () => {
  it("works controlled", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [sizes, setSizes] = useState([50, 50]);
      return (
        <>
          <Splitter onSizesChange={setSizes} sizes={sizes}>
            <div>A</div>
            <div>B</div>
          </Splitter>
          <button onClick={() => setSizes([0, 100])} type="button">
            Hide A
          </button>
        </>
      );
    }

    render(<Controlled />);
    await user.click(screen.getByRole("button", { name: "Hide A" }));
    expect(handle()).toHaveAttribute("aria-valuenow", "0");

    act(() => handle().focus());
    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "1");
  });

  it("restores a pane the parent collapsed to its size before", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [sizes, setSizes] = useState([25, 75]);
      return (
        <>
          <button onClick={() => setSizes([0, 100])} type="button">
            Hide filters
          </button>
          <Splitter
            collapsible={[true, false]}
            onSizesChange={setSizes}
            sizes={sizes}
          >
            <div>Filters</div>
            <div>Results</div>
          </Splitter>
        </>
      );
    }

    render(<Controlled />);
    await user.click(screen.getByRole("button", { name: "Hide filters" }));
    expect(handle()).toHaveAttribute("aria-valuenow", "0");

    act(() => handle().focus());
    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-valuenow", "25");
  });

  it("does not resize when the parent ignores the change", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderSplitter({ sizes: [40, 60] });

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "40");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`sizes`"));
  });

  it("remembers the sizes under a storage key", async () => {
    const user = userEvent.setup();
    const { unmount } = renderSplitter({ storageKey: "orders-split" });

    await user.tab();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(localStorage.getItem("orders-split")).toBe("[40,60]");
    unmount();

    renderSplitter({ storageKey: "orders-split" });
    expect(handle()).toHaveAttribute("aria-valuenow", "40");
  });

  it("saves a drag once it ends", () => {
    renderSplitter({ storageKey: "orders-split" });
    sizeSplitter();

    drag(handle(), 300, 500);
    expect(localStorage.getItem("orders-split")).toBeNull();
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(localStorage.getItem("orders-split")).toBe("[50,50]");
  });

  it("keeps saved sizes within the limits of the panes", () => {
    // Saved before the list got its minimum
    localStorage.setItem("orders-split", "[5,95]");
    renderSplitter({ minSizes: [20, 20], storageKey: "orders-split" });

    expect(handle()).toHaveAttribute("aria-valuenow", "20");
    expect(paneSize("Detail")).toBe(80);
  });

  it("falls back to the default sizes for saved ones out of range", () => {
    localStorage.setItem("orders-split", "[-1,50]");
    renderSplitter({ storageKey: "orders-split" });
    expect(handle()).toHaveAttribute("aria-valuenow", "30");

    cleanup();
    localStorage.setItem("orders-split", "[0,0]");
    renderSplitter({ storageKey: "orders-split" });
    expect(handle()).toHaveAttribute("aria-valuenow", "30");
  });

  it("ignores saved sizes that do not fit", () => {
    localStorage.setItem("orders-split", "[10,20,70]");
    renderSplitter({ storageKey: "orders-split" });
    expect(handle()).toHaveAttribute("aria-valuenow", "30");

    localStorage.setItem("other-split", "{broken");
    renderSplitter({ storageKey: "other-split" });
    expect(screen.getAllByRole("separator")[1]).toHaveAttribute(
      "aria-valuenow",
      "30",
    );
  });

  it("keeps splitters with the same key in step", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Splitter defaultSizes={[30, 70]} storageKey="shared">
          <div>A</div>
          <div>B</div>
        </Splitter>
        <Splitter defaultSizes={[30, 70]} storageKey="shared">
          <div>C</div>
          <div>D</div>
        </Splitter>
      </>,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    const [first, second] = screen.getAllByRole("separator");
    expect(first).toHaveAttribute("aria-valuenow", "31");
    expect(second).toHaveAttribute("aria-valuenow", "31");
  });

  it("works with blocked storage", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    renderSplitter({ storageKey: "orders-split" });

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "31");
  });

  it("stacks side-by-side panes on phones", () => {
    const { rerender } = renderSplitter();
    const root = handle().parentElement as HTMLElement;
    expect(root).toHaveClass("max-md:flex-col");
    expect(handle()).toHaveClass("max-md:hidden");

    rerender(
      <Splitter stackOnMobile={false}>
        <div>List</div>
        <div>Detail</div>
      </Splitter>,
    );
    expect(root).not.toHaveClass("max-md:flex-col");
    expect(handle()).not.toHaveClass("max-md:hidden");
  });
});

describe("Splitter on the server", () => {
  it("renders the default sizes, then the saved ones after hydrating", async () => {
    localStorage.setItem("orders-split", "[60,40]");
    const splitter = (
      <Splitter defaultSizes={[30, 70]} storageKey="orders-split">
        <div>List</div>
        <div>Detail</div>
      </Splitter>
    );

    const html = renderToString(splitter);
    expect(html).toContain('aria-valuenow="30"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, splitter, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("[role='separator']")).toHaveAttribute(
      "aria-valuenow",
      "60",
    );

    act(() => root.unmount());
    container.remove();
  });
});
