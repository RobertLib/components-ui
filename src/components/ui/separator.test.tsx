import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Separator from "./separator";

describe("Separator", () => {
  it("is a horizontal separator", () => {
    render(<Separator className="my-6" />);

    const separator = screen.getByRole("separator");
    expect(separator).not.toHaveAttribute("aria-orientation");
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
    expect(separator).toHaveClass("h-px", "w-full", "my-6");
    // A line of a system color in forced colors mode, which drops fills
    expect(separator).toHaveClass("forced-colors:bg-[CanvasText]");
  });

  it("stands upright in a row", () => {
    render(<Separator orientation="vertical" />);

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
    expect(separator).toHaveClass("w-px", "self-stretch");
  });

  it("is hidden from assistive technology when decorative", () => {
    const { container } = render(<Separator decorative />);

    expect(screen.queryByRole("separator")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("role", "none");
  });

  it("is named by its label", () => {
    const { container } = render(<Separator label="or" />);

    expect(screen.getByRole("separator", { name: "or" })).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
    // A line on each side of the label
    expect(container.querySelectorAll(".flex-1")).toHaveLength(2);
  });

  it("puts the label at an end of the line", () => {
    const { container } = render(
      <>
        <Separator label="Billing address" labelPosition="start" />
        <Separator label="End" labelPosition="end" />
      </>,
    );

    const [start, end] = Array.from(container.children);
    expect(start.firstElementChild).toHaveTextContent("Billing address");
    expect(start.children).toHaveLength(2);
    expect(end.lastElementChild).toHaveTextContent("End");
    expect(end.children).toHaveLength(2);
  });

  it("leaves the label as text when decorative", () => {
    render(<Separator decorative label="or" orientation="vertical" />);

    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.getByText("or").parentElement).toHaveClass("flex-col");
  });
});
