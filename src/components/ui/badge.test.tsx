import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";
import { describe, expect, it } from "vitest";
import Badge, { type BadgeColor, type BadgePlacement } from "./badge";
import IconButton from "./icon-button";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
import { colorOf, contrast } from "../../test/contrast";

const badgeOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-badge]")!;

describe("Badge", () => {
  it("shows the count - above max as the limit with a plus", () => {
    const { container, rerender } = render(<Badge count={7} />);
    expect(badgeOf(container)).toHaveTextContent(/^7$/);

    rerender(<Badge count={120} />);
    expect(badgeOf(container)).toHaveTextContent(/^99\+$/);

    rerender(<Badge count={12} max={9} />);
    expect(badgeOf(container)).toHaveTextContent(/^9\+$/);
  });

  it("writes the numbers as the language does", () => {
    const { container } = render(
      <UIProvider locale={cs}>
        <Badge count={12345} max={9999} />
      </UIProvider>,
    );

    expect(badgeOf(container).textContent).toBe(
      `${new Intl.NumberFormat("cs-CZ").format(9999)}+`,
    );
  });

  it("hides a count of 0 unless showZero", () => {
    const { container, rerender } = render(
      <Badge count={0} label="No messages">
        <Bell />
      </Badge>,
    );
    expect(badgeOf(container)).toHaveClass("scale-0", "opacity-0");
    // Hidden, it says nothing to screen readers either
    expect(screen.queryByText("No messages")).toBeNull();

    rerender(
      <Badge count={0} label="No messages" showZero>
        <Bell />
      </Badge>,
    );
    expect(badgeOf(container)).not.toHaveClass("scale-0");
    expect(badgeOf(container)).toHaveTextContent("0");
    expect(screen.getByText("No messages")).toHaveClass("sr-only");
  });

  it("shrinks away when invisible - a fade only with reduced motion", () => {
    const { container, rerender } = render(
      <Badge count={3}>
        <Bell />
      </Badge>,
    );
    const badge = badgeOf(container);
    expect(badge).toHaveClass("transition", "motion-reduce:transition-opacity");
    expect(badge).not.toHaveClass("scale-0");

    rerender(
      <Badge count={3} invisible>
        <Bell />
      </Badge>,
    );
    // The same element - it animates, it is not replaced
    expect(badgeOf(container)).toBe(badge);
    expect(badge).toHaveClass("scale-0", "opacity-0");
  });

  it("is decorative, or says its label visually hidden", () => {
    const { container, rerender } = render(<Badge count={3} />);
    expect(badgeOf(container)).toHaveAttribute("aria-hidden", "true");

    rerender(<Badge count={3} label="3 unread messages" />);
    expect(badgeOf(container)).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("3 unread messages")).toHaveClass("sr-only");
  });

  it("names a notification button through its label", () => {
    render(
      <>
        <IconButton>
          <Badge count={4} label="Notifications, 4 unread">
            <Bell aria-hidden="true" />
          </Badge>
        </IconButton>
        <IconButton aria-label="Messages, 2 unread">
          <Badge count={2}>
            <Bell aria-hidden="true" />
          </Badge>
        </IconButton>
      </>,
    );

    expect(
      screen.getByRole("button", { name: "Notifications, 4 unread" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Messages, 2 unread" }),
    ).toBeInTheDocument();
  });

  it("shows a dot without a number", () => {
    const { container } = render(
      <Badge dot>
        <Bell />
      </Badge>,
    );

    expect(badgeOf(container)).toBeEmptyDOMElement();
    expect(badgeOf(container)).toHaveClass("size-2.5");
    // Forced colors mode would drop its fill - it keeps its colors
    expect(badgeOf(container)).toHaveClass("forced-color-adjust-none");
  });

  it("renders nothing of its own without a count or a dot", () => {
    const { container } = render(<Badge />);
    expect(badgeOf(container)).toHaveClass("hidden");
  });

  it("sits on a corner of its child by start and end", () => {
    const placements: BadgePlacement[] = [
      "top-end",
      "top-start",
      "bottom-end",
      "bottom-start",
    ];
    const physical = /^(?:[a-z-]+:)*-?(?:left|right|ml|mr)(?:-|$)/;

    for (const placement of placements) {
      for (const overlap of ["rectangular", "circular"] as const) {
        const { container, unmount } = render(
          <Badge count={1} overlap={overlap} placement={placement}>
            <Bell />
          </Badge>,
        );
        const badge = badgeOf(container);
        const [vertical, horizontal] = placement.split("-");
        const insetSide = horizontal === "start" ? "s" : "e";
        expect(badge.parentElement).toHaveClass("relative");
        expect(badge.className).toMatch(
          new RegExp(`(^| )inset-${insetSide}-(0|\\[14%\\])( |$)`),
        );
        expect(badge.className).toMatch(
          new RegExp(`(^| )${vertical}-(0|\\[14%\\])( |$)`),
        );
        // Mirrored across in a right-to-left page
        expect(badge.className).toMatch(/rtl:-?translate-x-1\/2/);
        expect(
          badge.className.split(/\s+/).filter((name) => physical.test(name)),
        ).toEqual([]);
        unmount();
      }
    }
  });

  it("passes its props to the element around the child", () => {
    render(
      <Badge count={1} data-testid="anchor" id="bell">
        <Bell />
      </Badge>,
    );

    expect(screen.getByTestId("anchor")).toHaveAttribute("id", "bell");
    expect(screen.getByTestId("anchor").tagName).toBe("SPAN");
  });

  it("writes its number at 4.5:1 on each color", () => {
    const colors: BadgeColor[] = [
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "info",
      "neutral",
    ];
    const low: string[] = [];

    for (const color of colors) {
      const { container, unmount } = render(<Badge color={color} count={5} />);
      const { className } = badgeOf(container);
      unmount();

      for (const dark of [false, true]) {
        const text = colorOf(className, "text", { dark })!;
        const fill = colorOf(className, "bg", { dark })!;
        if (contrast(text, fill) < 4.5) {
          low.push(`${color}${dark ? " dark" : ""}: ${text} on ${fill}`);
        }
      }
    }

    expect(low).toEqual([]);
  });
});
