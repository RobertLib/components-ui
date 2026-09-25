import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "./button";
import IconButton from "./icon-button";

const auxClick = (element: Element) =>
  fireEvent(
    element,
    new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true }),
  );

describe("Button as a link", () => {
  it("cannot be opened in a new tab while disabled", () => {
    const onAuxClick = vi.fn();
    render(
      <Button disabled link="/users/new" onAuxClick={onAuxClick} tabIndex={0}>
        New user
      </Button>,
    );

    const link = screen.getByRole("link", { name: "New user" });
    auxClick(link);
    expect(onAuxClick).not.toHaveBeenCalled();
    // No URL for a middle click, dragging or the context menu to open
    expect(link).not.toHaveAttribute("href");
    expect(link).not.toHaveAttribute("tabindex");
  });

  it("passes a middle click on while enabled", () => {
    const onAuxClick = vi.fn();
    render(
      <Button link="/users/new" onAuxClick={onAuxClick}>
        New user
      </Button>,
    );

    const link = screen.getByRole("link", { name: "New user" });
    expect(auxClick(link)).toBe(true);
    expect(onAuxClick).toHaveBeenCalledTimes(1);
    expect(link).not.toHaveAttribute("draggable");
  });
});

describe("Button icons", () => {
  it("shows icons around the label - named by the label only", () => {
    render(
      <Button
        endIcon={<svg data-testid="end" />}
        startIcon={<svg data-testid="start" />}
      >
        Export
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Export" });
    expect(screen.getByTestId("start").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("end").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(button).toHaveClass("gap-1.5");
    expect(button.firstElementChild).toContainElement(
      screen.getByTestId("start"),
    );
    expect(button.lastElementChild).toContainElement(screen.getByTestId("end"));
  });

  it("puts the spinner in place of the start icon while loading", () => {
    const { container, rerender } = render(
      <Button loading startIcon={<svg data-testid="start" />}>
        Save
      </Button>,
    );

    expect(screen.queryByTestId("start")).toBeNull();
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBe(screen.getByRole("button").firstElementChild);

    // Without a start icon it sits at the same place
    rerender(
      <Button endIcon={<svg data-testid="end" />} loading>
        Save
      </Button>,
    );
    expect(container.querySelector(".animate-spin")).toBe(
      screen.getByRole("button").firstElementChild,
    );
    expect(screen.getByTestId("end")).toBeInTheDocument();
  });

  it("replaces the icon of an icon button with the spinner", () => {
    const { container } = render(
      <Button aria-label="Refresh" loading size="icon">
        <svg data-testid="icon" />
      </Button>,
    );

    expect(screen.queryByTestId("icon")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("stretches to the width of its container", () => {
    render(
      <>
        <Button fullWidth>Sign in</Button>
        <Button fullWidth link="/help">
          Help
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass(
      "w-full",
    );
    expect(screen.getByRole("link", { name: "Help" })).toHaveClass("w-full");
  });

  it("renders the label alone without icons", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.children).toHaveLength(0);
    expect(button).not.toHaveClass("gap-1.5");
  });
});

describe("IconButton", () => {
  it("keeps the focus and does nothing while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <IconButton aria-label="Refresh" onClick={onClick}>
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    act(() => button.focus());

    rerender(
      <IconButton aria-label="Refresh" loading onClick={onClick}>
        <svg />
      </IconButton>,
    );
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <IconButton aria-label="Refresh" disabled onClick={onClick}>
        <svg />
      </IconButton>,
    );
    expect(button).toBeDisabled();
  });
});

describe("A loading button in a clickable container", () => {
  it("reaches no onClick around it, like a disabled button", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <Button loading>Save</Button>
        <Button link="/orders" loading>
          Orders
        </Button>
        <IconButton aria-label="Refresh" loading>
          <svg />
        </IconButton>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("link", { name: "Orders" }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
