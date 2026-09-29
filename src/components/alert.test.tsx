import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Alert, { type AlertProps } from "./alert";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";
import { colorOf, contrast } from "../test/contrast";

describe("Alert", () => {
  it.each([
    ["danger", "alert", "assertive"],
    ["warning", "alert", "assertive"],
    ["success", "status", "polite"],
    ["info", "status", "polite"],
  ] as const)("announces a %s as %s", (type, role, live) => {
    render(<Alert type={type}>Message</Alert>);

    // The live value never contradicts the role
    expect(screen.getByRole(role)).toHaveAttribute("aria-live", live);
  });

  it("renders nothing without children", () => {
    const { container } = render(<Alert type="danger">{null}</Alert>);

    expect(container).toBeEmptyDOMElement();
  });

  it("titles itself with a heading of the level given", () => {
    render(
      <>
        <Alert title="Saved">The order was saved.</Alert>
        <Alert headingLevel={4} title="Careful" type="warning">
          The price changed.
        </Alert>
      </>,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Saved" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 4, name: "Careful" }),
    ).toBeInTheDocument();
  });

  it("closes with a localized close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <Alert onClose={onClose} title="Saved">
        The order was saved.
      </Alert>,
    );

    await user.click(screen.getByRole("button", { name: "Close alert" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <UIProvider locale={cs}>
        <Alert onClose={onClose}>Objednávka byla uložena.</Alert>
      </UIProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Zavřít upozornění" }),
    ).toBeInTheDocument();
  });

  it("has no close button without onClose", () => {
    render(<Alert>Message</Alert>);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives the focus to the next control once it is closed", async () => {
    const user = userEvent.setup();

    function Page() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <>
          <button type="button">Before</button>
          {isOpen && (
            <Alert onClose={() => setIsOpen(false)} type="warning">
              The price changed.
            </Alert>
          )}
          <button type="button">After</button>
        </>
      );
    }

    render(<Page />);
    const close = screen.getByRole("button", { name: "Close alert" });
    close.focus();
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("shows its actions under the message", () => {
    render(
      <Alert actions={<button type="button">Retry</button>} type="danger">
        The payment was declined.
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toContainElement(
      screen.getByRole("button", { name: "Retry" }),
    );
  });

  it("writes every variant at 4.5:1 on its background", () => {
    const low: string[] = [];

    for (const variant of ["subtle", "solid", "outline"] as const) {
      for (const type of ["success", "danger", "warning", "info"] as const) {
        const props: AlertProps = { title: "Title", type, variant };
        const { container, unmount } = render(
          <Alert {...props}>Message</Alert>,
        );
        const root = container.firstElementChild as HTMLElement;
        const text = screen.getByText("Message").className;
        const title = screen.getByRole("heading").className;
        unmount();

        for (const dark of [false, true]) {
          // A tint - the lighter end of the gradient, or the flat fill
          const background =
            colorOf(root.className, "from", { dark }) ??
            colorOf(root.className, "bg", { dark })!;
          // The dark tint is translucent on the dark surface - it stays dark
          const backgrounds =
            variant === "subtle" && dark ? ["surface-dark"] : [background];

          for (const [name, className] of [
            ["text", text],
            ["title", title],
          ]) {
            for (const fill of backgrounds) {
              const color = colorOf(className, "text", { dark })!;
              if (contrast(color, fill) < 4.5) {
                low.push(
                  `${variant} ${type} ${name}${dark ? " dark" : ""}: ${color} on ${fill}`,
                );
              }
            }
          }
        }
      }
    }

    expect(low).toEqual([]);
  });
});
