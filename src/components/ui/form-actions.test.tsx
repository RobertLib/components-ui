import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cs } from "../../i18n/ui/cs";
import UIProvider from "../../providers/ui-provider";
import Button from "./button";
import FormActions from "./form-actions";

/** An IntersectionObserver the test drives - jsdom has none. */
function stubObserver() {
  const observers: {
    callback: IntersectionObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
    options?: IntersectionObserverInit;
    targets: Element[];
  }[] = [];

  class Observer {
    disconnect = vi.fn();
    entry;
    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.entry = {
        callback,
        disconnect: this.disconnect,
        options,
        targets: [] as Element[],
      };
      observers.push(this.entry);
    }
    observe(target: Element) {
      this.entry.targets.push(target);
    }
  }
  vi.stubGlobal("IntersectionObserver", Observer);

  /** Tells the observer where the bar is. */
  const report = (ratio: number, bottom: number) =>
    act(() => {
      const { callback, targets } = observers[0];
      callback(
        [
          {
            boundingClientRect: { bottom } as DOMRectReadOnly,
            intersectionRatio: ratio,
            rootBounds: { bottom: 600 } as DOMRectReadOnly,
            target: targets[0],
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

  return { observers, report };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FormActions", () => {
  it("holds the buttons of the form", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FormActions className="mt-6" data-testid="bar" ref={ref}>
        <Button variant="outline">Cancel</Button>
        <Button type="submit">Save</Button>
      </FormActions>,
    );

    const bar = screen.getByTestId("bar");
    expect(ref.current).toBe(bar);
    expect(bar).toHaveClass("flex", "mt-6");
    expect(bar).not.toHaveClass("sticky");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    // A live region in the page already, with nothing to say yet
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says the form has unsaved changes", () => {
    const { rerender } = render(
      <FormActions dirty>
        <Button type="submit">Save</Button>
      </FormActions>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");

    rerender(
      <FormActions dirty status="Saved 2 minutes ago">
        <Button type="submit">Save</Button>
      </FormActions>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved 2 minutes ago");
  });

  it("says it in Czech", () => {
    render(
      <UIProvider locale={cs}>
        <FormActions dirty />
      </UIProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Neuložené změny");
  });

  it("stays at the bottom while the end of the form is out of view", () => {
    const { observers, report } = stubObserver();
    render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}>
        <form>
          <FormActions data-testid="bar" sticky>
            <Button type="submit">Save</Button>
          </FormActions>
        </form>
      </div>,
    );

    const bar = screen.getByTestId("bar");
    expect(bar).toHaveClass("sticky", "bottom-0");
    // Watched in the element it scrolls in, 1 px short of its bottom
    expect(observers[0].targets).toEqual([bar]);
    expect(observers[0].options).toMatchObject({
      root: screen.getByTestId("scroller"),
      rootMargin: "0px 0px -1px 0px",
      threshold: [1],
    });

    // Stuck to the bottom edge - the fields scroll under it
    report(0.98, 600);
    expect(bar).toHaveAttribute("data-stuck", "");
    // At rest where the form ends
    report(1, 420);
    expect(bar).not.toHaveAttribute("data-stuck");
    // Scrolled away above
    report(0.4, 12);
    expect(bar).not.toHaveAttribute("data-stuck");
  });

  it("watches the page without a scrolling element around", () => {
    const { observers } = stubObserver();
    render(<FormActions sticky />);

    expect(observers[0].options?.root).toBeNull();
  });

  it("stops watching when it no longer sticks", () => {
    const { observers, report } = stubObserver();
    const { rerender } = render(<FormActions data-testid="bar" sticky />);
    report(0.5, 600);

    rerender(<FormActions data-testid="bar" />);
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(screen.getByTestId("bar")).not.toHaveAttribute("data-stuck");
  });

  it("works where there is no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<FormActions data-testid="bar" sticky />);

    expect(screen.getByTestId("bar")).not.toHaveAttribute("data-stuck");
  });
});
