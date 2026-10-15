import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VirtualList, { type VirtualListHandle } from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import useVirtualList from "./use-virtual-list";

interface Order {
  id: number;
  number: string;
}

const orders = (count: number, from = 1): Order[] =>
  Array.from({ length: count }, (_, index) => ({
    id: from + index,
    number: `2026-${String(from + index).padStart(5, "0")}`,
  }));

// The view of the list is 200px high - five items of 40px
let viewHeight = 200;

beforeEach(() => {
  viewHeight = 200;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute("data-virtual-list") ? viewHeight : 0;
    },
  );
});

const scroller = () =>
  document.querySelector<HTMLElement>("[data-virtual-list]")!;
const list = () => screen.getByRole("list");
const items = () => screen.getAllByRole("listitem");
const texts = () => items().map((item) => item.textContent);

/** Scrolls the list to `scrollTop`, as the user would. */
function scrollTo(scrollTop: number) {
  act(() => {
    scroller().scrollTop = scrollTop;
    fireEvent.scroll(scroller());
  });
}

function renderList(
  props: Partial<React.ComponentProps<typeof VirtualList<Order>>> = {},
) {
  return render(
    <VirtualList<Order>
      aria-label="Orders"
      estimateSize={40}
      getItemKey={(order) => order.id}
      height={200}
      items={orders(1000)}
      renderItem={(order) => <span>{order.number}</span>}
      {...props}
    />,
  );
}

describe("VirtualList", () => {
  it("renders only the items in view, with the room of the others", () => {
    renderList();

    // Five in view and four below - the rest are padding
    expect(items()).toHaveLength(9);
    expect(texts()[0]).toBe("2026-00001");
    expect(texts().at(-1)).toBe("2026-00009");
    expect(list().style.paddingTop).toBe("0px");
    expect(list().style.paddingBottom).toBe(`${991 * 40}px`);
    expect(scroller()).toHaveStyle({ height: "200px" });
  });

  it("is a named list whose items tell their position", () => {
    renderList();

    expect(screen.getByRole("region", { name: "Orders" })).toBe(scroller());
    expect(scroller()).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("list", { name: "Orders" })).toBeInTheDocument();
    expect(items()[2]).toHaveAttribute("aria-posinset", "3");
    expect(items()[2]).toHaveAttribute("aria-setsize", "1000");
  });

  it("is no region without a name", () => {
    render(
      <VirtualList
        height={200}
        items={["a", "b"]}
        renderItem={(item) => item}
      />,
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(scroller()).toHaveAttribute("tabindex", "0");
  });

  it("renders the items scrolled to", () => {
    renderList();

    scrollTo(100 * 40);
    // Four above the view, five in it, four below
    expect(texts()[0]).toBe("2026-00097");
    expect(texts()).toContain("2026-00101");
    expect(texts().at(-1)).toBe("2026-00109");
    expect(list().style.paddingTop).toBe(`${96 * 40}px`);
    expect(screen.queryByText("2026-00001")).not.toBeInTheDocument();
  });

  it("renders more items for a taller view", () => {
    viewHeight = 400;
    renderList({ height: 400 });
    expect(items()).toHaveLength(14);
  });

  it("scrolls to an item by its index", () => {
    const handle = createRef<VirtualListHandle>();
    renderList({ handleRef: handle });

    act(() => handle.current!.scrollToIndex(500, { align: "start" }));
    expect(scroller().scrollTop).toBe(500 * 40);
    expect(screen.getByText("2026-00501")).toBeInTheDocument();

    // At the end of the view
    act(() => handle.current!.scrollToIndex(700, { align: "end" }));
    expect(scroller().scrollTop).toBe(701 * 40 - 200);
    expect(screen.getByText("2026-00701")).toBeInTheDocument();

    // In the middle
    act(() => handle.current!.scrollToIndex(300, { align: "center" }));
    expect(scroller().scrollTop).toBe(300 * 40 - 80);

    // `auto` scrolls only as far as it must - not at all for one in view
    act(() => handle.current!.scrollToIndex(301));
    expect(scroller().scrollTop).toBe(300 * 40 - 80);
    act(() => handle.current!.scrollToIndex(400));
    expect(scroller().scrollTop).toBe(401 * 40 - 200);

    // Out of the range - the first or the last item
    act(() => handle.current!.scrollToIndex(5000, { align: "start" }));
    expect(scroller().scrollTop).toBe(999 * 40);
  });

  it("keeps the item with the focus while it is scrolled away", async () => {
    const user = userEvent.setup();
    renderList({
      renderItem: (order) => <button type="button">{order.number}</button>,
    });

    await user.click(screen.getByRole("button", { name: "2026-00003" }));
    scrollTo(300 * 40);

    const kept = screen.getByRole("button", { name: "2026-00003" });
    expect(kept).toHaveFocus();
    // Out of the flow of the others, where it belongs
    const item = kept.closest<HTMLElement>("[role=listitem]")!;
    expect(item.style.position).toBe("absolute");
    expect(item.style.top).toBe(`${2 * 40}px`);
    // Before the rendered ones, in the order of the list
    expect(items()[0]).toBe(item);

    // Gone once the focus leaves the list
    await user.click(document.body);
    expect(
      screen.queryByRole("button", { name: "2026-00003" }),
    ).not.toBeInTheDocument();
  });

  it("places the items by their measured heights", () => {
    // The observers and the elements each observes
    const observers = new Map<
      Element,
      (entries: ResizeObserverEntry[]) => void
    >();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        notify: (entries: ResizeObserverEntry[]) => void;
        constructor(callback: ResizeObserverCallback) {
          this.notify = (entries) =>
            callback(entries, this as unknown as ResizeObserver);
        }
        observe(element: Element) {
          observers.set(element, this.notify);
        }
        unobserve(element: Element) {
          observers.delete(element);
        }
        disconnect() {}
      },
    );
    // The items are 100px high - the first one 300px
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const height =
          this.dataset.index === undefined
            ? 0
            : this.dataset.index === "0"
              ? 300
              : 100;
        return { height, top: 0 } as DOMRect;
      },
    );

    renderList();
    const rendered = items();
    act(() =>
      observers.get(rendered[0])!(
        rendered.map(
          (target) => ({ target }) as unknown as ResizeObserverEntry,
        ),
      ),
    );

    // The rest is estimated as the nine measured ones are on average
    const average = (300 + 8 * 100) / 9;
    // The first one fills the view now - and four below it
    expect(items()).toHaveLength(5);
    // Below them: four measured items, and the others estimated
    expect(parseFloat(list().style.paddingBottom)).toBeCloseTo(
      4 * 100 + (1000 - 9) * average,
    );
    vi.unstubAllGlobals();
  });

  it("places the item scrolled to again as the items before it are measured", () => {
    const observers = new Map<
      Element,
      (entries: ResizeObserverEntry[]) => void
    >();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        notify: (entries: ResizeObserverEntry[]) => void;
        constructor(callback: ResizeObserverCallback) {
          this.notify = (entries) =>
            callback(entries, this as unknown as ResizeObserver);
        }
        observe(element: Element) {
          observers.set(element, this.notify);
        }
        unobserve(element: Element) {
          observers.delete(element);
        }
        disconnect() {}
      },
    );
    // Every item is 100px high, not the 40px estimated
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          height: this.dataset.index === undefined ? 0 : 100,
          top: 0,
        } as DOMRect;
      },
    );
    const measure = () => {
      const rendered = items();
      act(() =>
        observers.get(rendered[0])!(
          rendered.map(
            (target) => ({ target }) as unknown as ResizeObserverEntry,
          ),
        ),
      );
    };
    const handle = createRef<VirtualListHandle>();
    renderList({ handleRef: handle });

    act(() => handle.current!.scrollToIndex(500, { align: "start" }));
    expect(scroller().scrollTop).toBe(500 * 40);

    // Measured - the others are estimated as high: the item is placed again
    measure();
    expect(scroller().scrollTop).toBe(500 * 100);
    expect(screen.getByText("2026-00501")).toBeInTheDocument();

    // Not once the user scrolls on their own
    fireEvent.wheel(scroller());
    scrollTo(500 * 100 + 30);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          height: this.dataset.index === undefined ? 0 : 50,
          top: 0,
        } as DOMRect;
      },
    );
    measure();
    // The item at the top of the view stays there instead, 30px of it
    // scrolled past - four 50px items after the start of the rendered ones
    expect(scroller().scrollTop).toBeCloseTo(
      parseFloat(list().style.paddingTop) + 4 * 50 + 30,
    );
    expect(texts()[4]).toBe("2026-00501");
    vi.unstubAllGlobals();
  });

  it("keeps the view on its items when items are put before them", () => {
    function Chat() {
      const [messages, setMessages] = useState(() => orders(100, 101));
      return (
        <>
          <button
            onClick={() => setMessages([...orders(20, 81), ...messages])}
            type="button"
          >
            Older
          </button>
          <VirtualList
            estimateSize={40}
            getItemKey={(order) => order.id}
            height={200}
            items={messages}
            renderItem={(order) => order.number}
          />
        </>
      );
    }
    render(<Chat />);

    // 2026-00111 at the top of the view, 10px of it scrolled past
    scrollTo(10 * 40 + 10);
    expect(texts()).toContain("2026-00111");

    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    expect(scroller().scrollTop).toBe(30 * 40 + 10);
    expect(texts()).toContain("2026-00111");
    expect(items()[0]).toHaveAttribute("aria-posinset", String(30 - 4 + 1));
  });

  it("asks for more items as the view nears the end - once for each length", async () => {
    let resolve: () => void = () => {};
    const onEndReached = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { rerender } = renderList({ items: orders(50), onEndReached });

    expect(onEndReached).not.toHaveBeenCalled();
    // Unknown length while more may come
    expect(items()[0]).toHaveAttribute("aria-setsize", "-1");

    scrollTo(50 * 40 - 200 - 100);
    expect(onEndReached).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading more…")).toBeInTheDocument();
    expect(list()).toHaveAttribute("aria-busy", "true");

    // Scrolling on while it loads asks for nothing more
    scrollTo(50 * 40 - 200);
    expect(onEndReached).toHaveBeenCalledTimes(1);

    await act(async () => resolve());
    expect(screen.queryByText("Loading more…")).not.toBeInTheDocument();
    // The same items - no new page - are not asked for again
    scrollTo(50 * 40 - 210);
    expect(onEndReached).toHaveBeenCalledTimes(1);

    rerender(
      <VirtualList<Order>
        aria-label="Orders"
        estimateSize={40}
        getItemKey={(order) => order.id}
        height={200}
        items={orders(100)}
        onEndReached={onEndReached}
        renderItem={(order) => order.number}
      />,
    );
    scrollTo(100 * 40 - 200);
    expect(onEndReached).toHaveBeenCalledTimes(2);

    // The last page
    await act(async () => resolve());
    rerender(
      <VirtualList<Order>
        aria-label="Orders"
        estimateSize={40}
        getItemKey={(order) => order.id}
        hasMore={false}
        height={200}
        items={orders(120)}
        onEndReached={onEndReached}
        renderItem={(order) => order.number}
      />,
    );
    scrollTo(120 * 40 - 200);
    expect(onEndReached).toHaveBeenCalledTimes(2);
    expect(items()[0]).toHaveAttribute("aria-setsize", "120");
  });

  it("fills a short list at once", () => {
    const onEndReached = vi.fn();
    const props = {
      estimateSize: 40,
      getItemKey: (order: Order) => order.id,
      height: 200,
      onEndReached,
      renderItem: (order: Order) => order.number,
    };
    const { rerender } = render(<VirtualList {...props} items={orders(3)} />);
    expect(onEndReached).toHaveBeenCalledTimes(1);

    // The same items as new objects - nothing new to ask for
    rerender(<VirtualList {...props} items={orders(3)} />);
    expect(onEndReached).toHaveBeenCalledTimes(1);
    // Other items - another search
    rerender(<VirtualList {...props} items={orders(3, 501)} />);
    expect(onEndReached).toHaveBeenCalledTimes(2);
  });

  it("shows an error with a retry when loading more fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const onEndReached = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce(undefined);
    renderList({ items: orders(3), onEndReached });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("More items could not be loaded.");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onEndReached).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the loading and the error rows of the parent", () => {
    const onEndReached = vi.fn();
    const { rerender } = renderList({
      items: orders(3),
      loadingMore: true,
      onEndReached,
    });
    expect(screen.getByText("Loading more…")).toBeInTheDocument();
    expect(onEndReached).not.toHaveBeenCalled();

    rerender(
      <VirtualList
        height={200}
        items={orders(3)}
        loadMoreError="The server is busy."
        onEndReached={onEndReached}
        renderItem={(order) => order.number}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The server is busy.");
    expect(onEndReached).not.toHaveBeenCalled();
  });

  it("asks for older items at the start", () => {
    const onStartReached = vi.fn(() => new Promise<void>(() => {}));
    renderList({ items: orders(100), onStartReached });

    // At the top already
    expect(onStartReached).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading more…")).toBeInTheDocument();
  });

  it("shows `empty` only once there is nothing more to load", () => {
    const props = {
      empty: <p>No orders</p>,
      height: 200,
      onEndReached: () => new Promise<void>(() => {}),
      renderItem: () => null,
    };
    const { rerender } = render(<VirtualList {...props} items={[]} />);
    expect(screen.queryByText("No orders")).not.toBeInTheDocument();
    expect(screen.getByText("Loading more…")).toBeInTheDocument();

    // The server had none
    rerender(
      <VirtualList {...props} hasMore={false} items={[]} loadingMore={false} />,
    );
    expect(screen.getByText("No orders")).toBeInTheDocument();
  });

  it("shows `empty` for no items", () => {
    render(
      <VirtualList
        empty={<p>No orders</p>}
        height={200}
        items={[]}
        renderItem={() => null}
      />,
    );
    expect(screen.getByText("No orders")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("gives the items their classes and passes its ref and attributes on", () => {
    const ref = createRef<HTMLDivElement>();
    renderList({
      className: "rounded border",
      "data-testid": "orders",
      itemClassName: (order) => (order.id % 2 ? "odd" : "even"),
      listClassName: "divide-y",
      maxHeight: "50vh",
      ref,
    } as Partial<React.ComponentProps<typeof VirtualList<Order>>>);

    expect(ref.current).toBe(scroller());
    expect(screen.getByTestId("orders")).toBe(scroller());
    expect(scroller()).toHaveClass("rounded", "border", "overflow-y-auto");
    expect(scroller().style.maxHeight).toBe("50vh");
    expect(list()).toHaveClass("divide-y");
    expect(items()[0]).toHaveClass("odd");
    expect(items()[1]).toHaveClass("even");
  });

  it("scrolls with the page", () => {
    let listTop = 300;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          height: 0,
          top: this.getAttribute("role") === "list" ? listTop : 0,
        } as DOMRect;
      },
    );
    const scrollToSpy = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => {});
    let scrollY = 0;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    const handle = createRef<VirtualListHandle>();
    renderList({ handleRef: handle, height: undefined, useWindowScroll: true });

    // No container of its own
    expect(scroller()).not.toHaveAttribute("tabindex");
    expect(scroller()).not.toHaveClass("overflow-y-auto");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    // The page scrolled the list 4000px up
    listTop = -4000;
    scrollY = 4300;
    act(() => {
      fireEvent.scroll(window);
    });
    expect(texts()).toContain("2026-00101");
    expect(screen.queryByText("2026-00001")).not.toBeInTheDocument();

    act(() => handle.current!.scrollToIndex(10, { align: "start" }));
    expect(scrollToSpy).toHaveBeenCalledWith({
      behavior: "auto",
      top: 4300 - 4000 + 10 * 40,
    });
  });

  it("speaks Czech", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <UIProvider locale={cs}>
        <VirtualList
          height={200}
          items={orders(2)}
          onEndReached={() => Promise.reject(new Error("down"))}
          renderItem={(order) => order.number}
        />
      </UIProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Další položky se nepodařilo načíst.",
    );
    expect(
      screen.getByRole("button", { name: "Zkusit znovu" }),
    ).toBeInTheDocument();
  });

  it("hydrates the items of the server without a mismatch", async () => {
    const page = (
      <VirtualList
        aria-label="Orders"
        estimateSize={40}
        getItemKey={(order) => order.id}
        height={200}
        items={orders(1000)}
        onEndReached={() => {}}
        renderItem={(order) => order.number}
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(within(container).getAllByRole("listitem")).toHaveLength(9);

    act(() => root.unmount());
    container.remove();
  });

  it("renders the first items on the server", () => {
    const html = renderToString(
      <VirtualList
        estimateSize={40}
        height={200}
        items={orders(1000)}
        renderItem={(order) => order.number}
      />,
    );
    // The view and the overscan below it
    expect(html).toContain("2026-00001");
    expect(html).toContain("2026-00009");
    expect(html).not.toContain("2026-00010");
    expect(html).toContain('role="listitem"');
  });
});

describe("useVirtualList", () => {
  afterEach(() => vi.restoreAllMocks());

  it("virtualizes markup of the app", () => {
    function Rows() {
      const {
        listRef,
        listStyle,
        measureRef,
        nearEnd,
        scrollRef,
        virtualItems,
      } = useVirtualList({
        count: 500,
        estimateSize: 20,
        // A new function at each render - the same keys
        getItemKey: (index) => `row-${index}`,
      });
      return (
        <div
          data-virtual-list=""
          ref={scrollRef}
          style={{ height: 200, overflowY: "auto" }}
        >
          <ul ref={listRef} style={listStyle}>
            {virtualItems.map((item) => (
              <li
                data-index={item.index}
                key={item.key}
                ref={measureRef}
                style={item.style}
              >
                Row {item.index + 1}
              </li>
            ))}
          </ul>
          <p>{nearEnd ? "end" : "more"}</p>
        </div>
      );
    }
    render(<Rows />);

    // Ten in view, four below
    expect(screen.getAllByRole("listitem")).toHaveLength(14);
    expect(screen.getByText("Row 14")).toBeInTheDocument();
    expect(screen.getByText("more")).toBeInTheDocument();

    scrollTo(500 * 20 - 200);
    expect(screen.getByText("Row 500")).toBeInTheDocument();
    expect(screen.getByText("end")).toBeInTheDocument();
  });
});
