import { act, render } from "@testing-library/react";
import { useEffect } from "react";
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
