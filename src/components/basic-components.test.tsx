import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Button from "./button";
import { cs } from "../i18n/cs";
import Pagination from "./pagination";
import Spinner from "./spinner";
import Stepper from "./stepper";
import Switch from "./switch";
import UIProvider from "../providers/ui-provider";

describe("Button", () => {
  it("is disabled and busy while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("type", "button");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a link that does not navigate while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled link="/users/new" onClick={onClick}>
        New user
      </Button>,
    );

    const link = screen.getByRole("link", { name: "New user" });
    expect(link).toHaveAttribute("href", "/users/new");
    expect(link).toHaveAttribute("aria-disabled", "true");

    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passes ref, data, ARIA and event props on to the link", async () => {
    const user = userEvent.setup();
    const onMouseEnter = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button
        aria-describedby="hint"
        data-testid="new-user"
        link="/users/new"
        name="ignored"
        onMouseEnter={onMouseEnter}
        ref={ref}
      >
        New user
      </Button>,
    );

    const link = screen.getByRole("link", { name: "New user" });
    expect(ref.current).toBe(link);
    expect(link).toHaveAttribute("data-testid", "new-user");
    expect(link).toHaveAttribute("aria-describedby", "hint");
    // A button-only attribute stays behind
    expect(link).not.toHaveAttribute("name");

    await user.hover(link);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});

describe("Switch", () => {
  it("is a checkbox with the switch role", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        error="Required"
        label="Notifications"
        onChange={(event) => onChange(event.target.checked)}
      />,
    );

    const toggle = screen.getByRole("switch", { name: /Notifications/ });
    expect(toggle).toHaveAccessibleDescription("Required");
    expect(toggle).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByText("Notifications"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(toggle).toBeChecked();
  });
});

describe("Pagination", () => {
  it("pages by numbers from the total", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Pagination
        currentPage={1}
        onChange={onChange}
        pageSize={20}
        total={45}
      />,
    );

    expect(screen.getByText("1–20 of 45")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Last page" }));
    expect(onChange).toHaveBeenCalledWith("last");

    rerender(
      <Pagination
        currentPage={3}
        onChange={onChange}
        pageSize={20}
        total={45}
      />,
    );
    expect(screen.getByText("41–45 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("follows the page info of a cursor connection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Pagination
        onChange={onChange}
        pageInfo={{
          endCursor: "c20",
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "c1",
        }}
      />,
    );

    // A connection cannot jump to its end
    expect(screen.queryByRole("button", { name: "Last page" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith("next", "c20");
  });
});

describe("Stepper", () => {
  const steps = [
    { id: 1, title: "Details" },
    { id: 2, title: "Documents" },
    { id: 3, isClickable: false, title: "Review" },
  ];

  it("shows the progress without buttons when read-only", () => {
    render(<Stepper currentStepId={2} steps={steps} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("2. Documents").parentElement).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("reports clicks on the steps that can be clicked", async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(
      <Stepper currentStepId={2} onStepClick={onStepClick} steps={steps} />,
    );

    await user.click(screen.getByRole("button", { name: "1. Details" }));
    expect(onStepClick).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "3. Review" })).toBeDisabled();
  });
});

describe("Spinner", () => {
  it("tells screen readers what it shows", () => {
    const { rerender } = render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");

    rerender(
      <UIProvider locale={cs}>
        <Spinner />
        <Spinner label="Ukládání..." />
      </UIProvider>,
    );
    const [loading, saving] = screen.getAllByRole("status");
    expect(loading).toHaveTextContent("Načítání...");
    expect(saving).toHaveTextContent("Ukládání...");
  });
});
