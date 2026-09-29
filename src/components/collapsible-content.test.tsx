import { act, render, screen } from "@testing-library/react";
import { createRef, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CollapsibleContent from "./collapsible-content";

/**
 * Reads the height of the content in a passive effect that runs before the
 * effects of the content - what the browser may have painted by then.
 */
function HeightProbe({
  isOpen,
  onHeight,
}: {
  isOpen: boolean;
  onHeight: (height: string) => void;
}) {
  useEffect(() => {
    const content = document.getElementById("content");
    if (isOpen && content) onHeight(content.style.height);
  }, [isOpen, onHeight]);
  return null;
}

function Example({
  isOpen,
  onHeight,
}: {
  isOpen: boolean;
  onHeight: (height: string) => void;
}) {
  return (
    <>
      <HeightProbe isOpen={isOpen} onHeight={onHeight} />
      <CollapsibleContent duration={100} id="content" isOpen={isOpen}>
        Details
      </CollapsibleContent>
    </>
  );
}

describe("CollapsibleContent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the opening at no height before the browser paints", () => {
    vi.useFakeTimers();
    const onHeight = vi.fn();
    const { container, rerender } = render(
      <Example isOpen={false} onHeight={onHeight} />,
    );
    expect(container).toHaveTextContent("");

    rerender(<Example isOpen onHeight={onHeight} />);
    // Never the full height for a frame before the animation
    expect(onHeight).toHaveBeenCalledExactlyOnceWith("0px");

    const content = document.getElementById("content");
    act(() => vi.advanceTimersByTime(10));
    expect(content?.style.height).toMatch(/px$/);
    act(() => vi.advanceTimersByTime(100));
    expect(content?.style.height).toBe("auto");
  });

  it.each([0, 5])(
    "ends an opening of %i ms at the natural height",
    (duration) => {
      vi.useFakeTimers();
      const { rerender } = render(
        <CollapsibleContent duration={duration} id="content" isOpen={false}>
          Details
        </CollapsibleContent>,
      );
      rerender(
        <CollapsibleContent duration={duration} id="content" isOpen>
          Details
        </CollapsibleContent>,
      );
      act(() => vi.advanceTimersByTime(20));

      // Not the height measured for the animation, which comes after 10 ms
      const content = document.getElementById("content");
      expect(content?.style.height).toBe("auto");
      expect(content?.style.overflow).toBe("");
    },
  );

  it("clips the content only while it animates", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Example isOpen onHeight={() => {}} />);
    const content = () => document.getElementById("content");

    // Open from the start - focus rings at its edges show
    expect(content()?.style.overflow).toBe("");

    rerender(<Example isOpen={false} onHeight={() => {}} />);
    expect(content()?.style.overflow).toBe("hidden");
    act(() => vi.advanceTimersByTime(100));

    rerender(<Example isOpen onHeight={() => {}} />);
    expect(content()?.style.overflow).toBe("hidden");
    act(() => vi.advanceTimersByTime(100));
    expect(content()?.style.overflow).toBe("");
    expect(content()?.style.height).toBe("auto");
  });

  it("unmounts the content once it has closed", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <Example isOpen onHeight={() => {}} />,
    );
    expect(container).toHaveTextContent("Details");

    rerender(<Example isOpen={false} onHeight={() => {}} />);
    expect(container).toHaveTextContent("Details");
    act(() => vi.advanceTimersByTime(100));
    expect(container).toHaveTextContent("");
  });
});

describe("CollapsibleContent with keepMounted", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides closed content instead of unmounting it", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <CollapsibleContent duration={100} id="content" isOpen keepMounted>
        Details
      </CollapsibleContent>,
    );
    const content = container.querySelector("#content")!;

    rerender(
      <CollapsibleContent
        duration={100}
        id="content"
        isOpen={false}
        keepMounted
      >
        Details
      </CollapsibleContent>,
    );
    act(() => vi.advanceTimersByTime(100));
    expect(container.querySelector("#content")).toBe(content);
    expect(content).toHaveAttribute("hidden");
    expect(content).toHaveTextContent("Details");

    rerender(
      <CollapsibleContent duration={100} id="content" isOpen keepMounted>
        Details
      </CollapsibleContent>,
    );
    expect(content).not.toHaveAttribute("hidden");
  });

  it("renders closed content hidden from the start", () => {
    const { container } = render(
      <CollapsibleContent id="content" isOpen={false} keepMounted>
        Details
      </CollapsibleContent>,
    );

    expect(container.querySelector("#content")).toHaveAttribute("hidden");
  });

  it("passes its ref and attributes on and tells its state", () => {
    vi.useFakeTimers();
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <CollapsibleContent
        aria-label="Details"
        data-testid="content"
        duration={100}
        isOpen
        ref={ref}
        style={{ color: "red" }}
      >
        Details
      </CollapsibleContent>,
    );

    const content = screen.getByTestId("content");
    expect(ref.current).toBe(content);
    expect(content).toHaveAttribute("aria-label", "Details");
    expect(content).toHaveStyle({
      color: "rgb(255, 0, 0)",
      transitionDuration: "100ms",
    });
    expect(content).toHaveAttribute("data-state", "open");

    rerender(
      <CollapsibleContent
        data-testid="content"
        duration={100}
        isOpen={false}
        keepMounted
        ref={ref}
      >
        Details
      </CollapsibleContent>,
    );
    // Closed already while it animates out
    expect(content).toHaveAttribute("data-state", "closed");
    act(() => vi.advanceTimersByTime(100));
    expect(ref.current).toBe(content);
  });
});
