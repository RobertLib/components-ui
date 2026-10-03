import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Stepper from "./stepper";
const steps = [
  {
    id: "one",
    title: "Details",
    content: (
      <input aria-label="Name" defaultValue="Adam" name="name" required />
    ),
  },
  {
    id: "two",
    title: "Documents",
    content: <input aria-label="File" name="file" type="file" />,
  },
];

describe("retained Stepper content", () => {
  it("keeps uncontrolled fields and nodes across step and orientation changes", () => {
    const { container, rerender } = render(
      <form>
        <Stepper currentStepId="one" keepMounted steps={steps} />
      </form>,
    );
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "Eva" } });
    rerender(
      <form>
        <Stepper
          currentStepId="two"
          keepMounted
          orientation="vertical"
          steps={steps}
        />
      </form>,
    );
    expect(screen.getByLabelText("Name")).toBe(input);
    expect(input).toHaveValue("Eva");
    expect(input).not.toBeVisible();
    expect(new FormData(container.querySelector("form")!).get("name")).toBe(
      "Eva",
    );
    rerender(
      <form>
        <Stepper currentStepId="one" keepMounted steps={steps} />
      </form>,
    );
    expect(input).toBeVisible();
    expect(screen.getByLabelText("Name")).toBe(input);
  });
  it("reveals and focuses an invalid field in an inactive step", () => {
    const change = vi.fn();
    function Wizard() {
      const [step, setStep] = useState("two");
      return (
        <form>
          <Stepper
            currentStepId={step}
            keepMounted
            onStepClick={(id) => {
              change(id);
              setStep(String(id));
            }}
            steps={steps}
          />
        </form>
      );
    }
    render(<Wizard />);
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.invalid(input);
    expect(change).toHaveBeenCalledWith("one");
    expect(input).toBeVisible();
    expect(input).toHaveFocus();
  });
});
