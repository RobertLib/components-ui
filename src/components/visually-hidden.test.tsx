import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import VisuallyHidden from "./visually-hidden";

describe("VisuallyHidden", () => {
  it("hides content from the eye, not from screen readers", () => {
    render(
      <button type="button">
        <svg aria-hidden="true" />
        <VisuallyHidden>Delete order 1042</VisuallyHidden>
      </button>,
    );

    const label = screen.getByText("Delete order 1042");
    expect(label.tagName).toBe("SPAN");
    expect(label).toHaveClass("sr-only");
    expect(
      screen.getByRole("button", { name: "Delete order 1042" }),
    ).toBeInTheDocument();
  });

  it("shows focusable content while it has the focus", async () => {
    const user = userEvent.setup();
    render(
      <VisuallyHidden className="fixed top-2 left-2" focusable>
        <a href="#main">Skip to content</a>
      </VisuallyHidden>,
    );

    const wrapper = screen.getByText("Skip to content").parentElement;
    // Hidden unless the focus is in it - then only the page's classes apply
    expect(wrapper).toHaveClass("not-focus-within:sr-only", "fixed", "top-2");
    expect(wrapper).not.toHaveClass("sr-only");

    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
  });
});
