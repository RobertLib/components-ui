import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Alert from "./alert";

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
});
