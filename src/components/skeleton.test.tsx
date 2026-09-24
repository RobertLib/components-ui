import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Skeleton from "./skeleton";

describe("Skeleton", () => {
  it("is a pulsing block hidden from screen readers", () => {
    const { container } = render(<Skeleton className="mb-2" />);

    const block = container.firstElementChild;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block).toHaveClass(
      "animate-pulse",
      "rounded",
      "h-4",
      "w-full",
      "mb-2",
    );
  });

  it("takes a width and a height", () => {
    const { container } = render(<Skeleton height="h-8" width="w-32" />);

    expect(container.firstElementChild).toHaveClass("h-8", "w-32");
    expect(container.firstElementChild).not.toHaveClass("h-4", "w-full");
  });

  it("is a circle of its own size", () => {
    const { container } = render(
      <>
        <Skeleton variant="circle" />
        <Skeleton height="h-12" variant="circle" width="w-12" />
      </>,
    );

    const [avatar, large] = container.children;
    expect(avatar).toHaveClass("rounded-full", "h-10", "w-10");
    expect(avatar).not.toHaveClass("rounded");
    expect(large).toHaveClass("h-12", "w-12");
  });

  it("draws lines of text - the last of several shorter", () => {
    const { container } = render(
      <Skeleton lines={3} variant="text" width="w-64" />,
    );

    const text = container.firstElementChild as HTMLElement;
    expect(text).toHaveAttribute("aria-hidden", "true");
    expect(text).toHaveClass("w-64");

    // Each line is as high as a line of the text around
    const lines = Array.from(text.children);
    expect(lines).toHaveLength(3);
    lines.forEach((line) => expect(line).toHaveClass("h-[1lh]"));

    const bars = lines.map((line) => line.firstElementChild);
    expect(bars[0]).toHaveClass("w-full", "animate-pulse");
    expect(bars[1]).toHaveClass("w-full");
    expect(bars[2]).toHaveClass("w-3/5");
  });

  it("draws one full line by default, and bars of a given height", () => {
    const { container } = render(
      <>
        <Skeleton variant="text" />
        <Skeleton height="h-2" lines={0} variant="text" />
      </>,
    );

    const [single, custom] = Array.from(container.children);
    expect(single.children).toHaveLength(1);
    expect(single.firstElementChild?.firstElementChild).toHaveClass(
      "w-full",
      "h-[0.75em]",
    );
    expect(custom.children).toHaveLength(1);
    expect(custom.firstElementChild?.firstElementChild).toHaveClass("h-2");
  });
});
