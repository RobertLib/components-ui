import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "./checkbox";

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe("Checkbox", () => {
  it("sizes the box and the label by dim - md by default", () => {
    render(
      <>
        <Checkbox dim="xs" label="Extra small" />
        <Checkbox label="Medium" />
        <Checkbox dim="lg" label="Large" />
      </>,
    );

    expect(screen.getByRole("checkbox", { name: "Extra small" })).toHaveClass(
      "size-3",
    );
    expect(screen.getByRole("checkbox", { name: "Medium" })).toHaveClass(
      "size-4",
      "mt-0.5",
    );
    expect(screen.getByRole("checkbox", { name: "Large" })).toHaveClass(
      "size-5",
    );
    expect(screen.getByText("Medium")).toHaveClass("text-sm");
    expect(screen.getByText("Large")).toHaveClass("text-base");
  });

  it("stays a native checkbox of the form at any size", () => {
    render(
      <form aria-label="Terms">
        <Checkbox defaultChecked dim="sm" label="Agree" name="agree" />
      </form>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Agree" });
    expect(checkbox.tagName).toBe("INPUT");
    expect(new FormData(getForm()).get("agree")).toBe("on");
  });

  it("takes any content as its label, and names the checkbox with it", () => {
    render(
      <Checkbox
        label={
          <>
            I accept the <a href="/terms">terms</a>
          </>
        }
      />,
    );

    expect(screen.getByRole("checkbox")).toHaveAccessibleName(
      "I accept the terms",
    );
    expect(screen.getByRole("link", { name: "terms" })).toBeInTheDocument();
  });

  it("does not change while read-only - neither by a click nor by Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Checkbox label="Controlled" onChange={onChange} checked readOnly />
        <Checkbox defaultChecked={false} label="Uncontrolled" readOnly />
      </>,
    );

    const controlled = screen.getByRole("checkbox", { name: "Controlled" });
    await user.click(controlled);
    expect(controlled).toBeChecked();
    // Focusable, unlike a disabled one
    expect(controlled).toHaveFocus();
    await user.keyboard(" ");
    expect(controlled).toBeChecked();

    const uncontrolled = screen.getByRole("checkbox", { name: "Uncontrolled" });
    await user.click(screen.getByText("Uncontrolled"));
    expect(uncontrolled).not.toBeChecked();

    expect(onChange).not.toHaveBeenCalled();
    expect(controlled).toHaveAttribute("aria-readonly", "true");
    expect(controlled).toHaveAttribute("data-readonly");
    expect(controlled).toBeEnabled();
  });

  it("reports the first change once it is no longer read-only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox label="Notify" onChange={onChange} readOnly />,
    );

    await user.click(screen.getByRole("checkbox"));
    rerender(<Checkbox label="Notify" onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("submits a read-only checkbox, and does not validate it", () => {
    render(
      <form aria-label="Terms">
        <Checkbox defaultChecked label="Newsletter" name="news" readOnly />
        <Checkbox label="Terms" name="terms" readOnly required />
      </form>,
    );

    expect(new FormData(getForm()).get("news")).toBe("on");
    // It could not be checked - so it does not block the form
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: /Terms/ })
        .required,
    ).toBe(false);
    expect(getForm().checkValidity()).toBe(true);
    expect(screen.getByRole("checkbox", { name: /Terms/ })).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("keeps a controlled read-only checkbox after a form reset", async () => {
    function Settings() {
      const [checked] = useState(true);
      return (
        <form aria-label="Settings">
          <Checkbox checked={checked} label="Beta" name="beta" readOnly />
        </form>
      );
    }

    render(<Settings />);
    act(() => getForm().reset());

    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
