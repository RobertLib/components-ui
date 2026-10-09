import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import IconButton from "./icon-button";
import type { LinkComponentProps } from "../../providers/router";
import UIProvider from "../../providers/ui-provider";

describe("IconButton", () => {
  it("colors its icon by color - and by the deprecated variant", () => {
    const { rerender } = render(
      <IconButton aria-label="Delete" color="danger">
        <Trash />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("text-danger-500", "dark:text-danger-400");

    rerender(
      <IconButton aria-label="Delete" variant="primary">
        <Trash />
      </IconButton>,
    );
    expect(button).toHaveClass("text-primary-500");

    // The new name wins
    rerender(
      <IconButton aria-label="Delete" color="secondary" variant="primary">
        <Trash />
      </IconButton>,
    );
    expect(button).toHaveClass("text-secondary-500");
    expect(button).not.toHaveClass("text-primary-500");
  });

  it("is as big as the icon without a size, as high as a Button with one", () => {
    const { rerender } = render(
      <IconButton aria-label="Edit">
        <Pencil size={20} />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Edit" });
    expect(button).toHaveClass("-m-1", "p-1");

    for (const [size, box, icon] of [
      ["sm", "size-6.5", "[&_svg]:size-4"],
      ["md", "size-8.5", "[&_svg]:size-4.5"],
      ["lg", "size-10.5", "[&_svg]:size-5"],
    ] as const) {
      rerender(
        <IconButton aria-label="Edit" size={size}>
          <Pencil size={20} />
        </IconButton>,
      );
      expect(button).toHaveClass(box, icon);
      expect(button).not.toHaveClass("-m-1");
    }
  });

  it("has a border with bordered - and the md size without its own", () => {
    const { rerender } = render(
      <IconButton aria-label="More" bordered>
        <Pencil />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "More" });
    expect(button).toHaveClass("border-[1.5px]", "border-neutral-300");
    expect(button).toHaveClass("size-8.5");
    expect(button).not.toHaveClass("-m-1");

    rerender(
      <IconButton aria-label="More" bordered size="sm">
        <Pencil />
      </IconButton>,
    );
    expect(button).toHaveClass("size-6.5");
  });

  it("is a link of the router with href", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const links: string[] = [];
    function RouterLink({ href, ...props }: LinkComponentProps) {
      links.push(href);
      return <a href={href} {...props} />;
    }

    render(
      <UIProvider router={{ Link: RouterLink }}>
        <IconButton aria-label="Edit order" href="/orders/42" onClick={onClick}>
          <Pencil />
        </IconButton>
      </UIProvider>,
    );

    const link = screen.getByRole("link", { name: "Edit order" });
    expect(link).toHaveAttribute("href", "/orders/42");
    expect(links).toContain("/orders/42");
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("cannot be opened as a disabled link", () => {
    const onAuxClick = vi.fn();
    render(
      <IconButton
        aria-label="Edit order"
        disabled
        href="/orders/42"
        onAuxClick={onAuxClick}
      >
        <Pencil />
      </IconButton>,
    );

    const link = screen.getByRole("link", { name: "Edit order" });
    expect(link).not.toHaveAttribute("href");
    expect(link).toHaveAttribute("aria-disabled", "true");
    fireEvent(
      link,
      new MouseEvent("auxclick", {
        bubbles: true,
        button: 1,
        cancelable: true,
      }),
    );
    expect(onAuxClick).not.toHaveBeenCalled();
  });

  it("keeps a loading link focusable, but it does not navigate", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Edit" href="/edit" loading onClick={onClick}>
        <Pencil />
      </IconButton>,
    );

    const link = screen.getByRole("link", { name: "Edit" });
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(link).toHaveAttribute("aria-disabled", "true");
    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows its name in a tooltip - on keyboard focus at once", async () => {
    const user = userEvent.setup();
    render(
      <IconButton aria-label="Delete" tooltip>
        <Trash />
      </IconButton>,
    );

    await user.tab();
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Delete");
    // The tooltip says the name - it does not describe the button with it
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("is named by a text tooltip without an aria-label", async () => {
    const user = userEvent.setup();
    render(
      <IconButton tooltip="Archive">
        <Trash />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Archive" });
    await user.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Archive");
  });

  it("is described by a tooltip that says more than its name", async () => {
    const user = userEvent.setup();
    render(
      <IconButton aria-label="Delete" tooltip="Delete for good">
        <Trash />
      </IconButton>,
    );

    await user.tab();
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAccessibleDescription("Delete for good");
  });

  it("shows the tooltip on hover after a delay", () => {
    vi.useFakeTimers();
    try {
      render(
        <IconButton aria-label="Delete" tooltip>
          <Trash />
        </IconButton>,
      );

      fireEvent.mouseEnter(
        screen.getByRole("button", { name: "Delete" }).closest("div")!,
      );
      expect(screen.queryByRole("tooltip")).toBeNull();
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole("tooltip")).toHaveTextContent("Delete");
    } finally {
      vi.useRealTimers();
    }
  });
});
