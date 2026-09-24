import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cs } from "../i18n/cs";
import Stepper from "./stepper";
import UIProvider from "../providers/ui-provider";

const steps = [
  { id: 1, title: "Details" },
  { hasError: true, id: 2, title: "Documents" },
  { id: 3, title: "Review" },
  { id: 4, title: "Done" },
];

describe("Stepper states", () => {
  it("tells screen readers which steps are completed or failed", () => {
    render(<Stepper currentStepId={3} steps={steps} />);

    const step = (label: string) => screen.getByText(label).parentElement;

    expect(step("1. Details")).toHaveTextContent("1. Details, Completed");
    expect(step("2. Documents")).toHaveTextContent("2. Documents, Error");
    expect(step("3. Review")).toHaveAttribute("aria-current", "step");
    expect(step("3. Review")).not.toHaveTextContent(/Completed|Error/);
    expect(step("4. Done")).not.toHaveTextContent(/Completed|Error/);
  });

  it("describes the step buttons with their state", () => {
    render(
      <UIProvider locale={cs}>
        <Stepper currentStepId={3} onStepClick={vi.fn()} steps={steps} />
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: "1. Details" }),
    ).toHaveAccessibleDescription("Dokončeno");
    expect(
      screen.getByRole("button", { name: "2. Documents" }),
    ).toHaveAccessibleDescription("Chyba");

    const current = screen.getByRole("button", { name: "3. Review" });
    expect(current).toHaveAttribute("aria-current", "step");
    expect(current).not.toHaveAttribute("aria-describedby");
  });
});

/** Makes `useIsMobile` see a phone (`true`) or a desktop. */
function stubViewport(isPhone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: () => {},
    matches: isPhone && query.includes("max-width"),
    removeEventListener: () => {},
  }));
}

const wizardSteps = (next: () => void) => [
  {
    content: (
      <button onClick={next} type="button">
        Next
      </button>
    ),
    description: "Company and contact",
    id: "details",
    title: "Details",
  },
  {
    content: <input aria-label="Street" />,
    description: "Where the order goes",
    id: "shipping",
    title: "Shipping",
  },
  { id: "done", title: "Done" },
];

function Wizard({
  orientation,
}: {
  orientation: "horizontal" | "vertical" | "responsive";
}) {
  const [current, setCurrent] = useState("details");

  return (
    <Stepper
      currentStepId={current}
      onStepClick={(id) => setCurrent(String(id))}
      orientation={orientation}
      steps={wizardSteps(() => setCurrent("shipping"))}
    />
  );
}

describe("Vertical Stepper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the titles and descriptions of the steps", () => {
    render(<Stepper currentStepId={2} orientation="vertical" steps={steps} />);

    expect(screen.getByRole("list")).toHaveTextContent(
      /1\. Details, Completed.*2\. Documents, Error.*3\. Review.*4\. Done/,
    );
    expect(screen.getByText("Review").closest("[aria-current]")).toBeNull();
    expect(
      screen.getByText("Documents").closest("[aria-current]"),
    ).toHaveAttribute("aria-current", "step");
  });

  it("describes the step buttons with their description and state", () => {
    render(
      <Stepper
        currentStepId="shipping"
        onStepClick={vi.fn()}
        orientation="vertical"
        steps={wizardSteps(vi.fn())}
      />,
    );

    const details = screen.getByRole("button", { name: "1. Details" });
    expect(details).toHaveAccessibleDescription(
      "Company and contact Completed",
    );
    expect(details).toHaveTextContent("Details");

    const shipping = screen.getByRole("button", { name: "2. Shipping" });
    expect(shipping).toHaveAttribute("aria-current", "step");
    expect(shipping).toHaveAccessibleDescription("Where the order goes");
  });

  it("shows the content of the current step only", async () => {
    const user = userEvent.setup();
    render(<Wizard orientation="vertical" />);

    expect(screen.queryByRole("textbox", { name: "Street" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("textbox", { name: "Street" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Next" })).toBeNull(),
    );
  });

  it("moves the focus to the next step when its content goes away", async () => {
    const user = userEvent.setup();
    render(<Wizard orientation="vertical" />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("group", { name: "2. Shipping" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Street" })).toHaveFocus();
  });

  it("leaves the focus on a step button that was clicked", async () => {
    const user = userEvent.setup();
    render(<Wizard orientation="vertical" />);

    const shipping = screen.getByRole("button", { name: "2. Shipping" });
    await user.click(shipping);

    expect(shipping).toHaveFocus();
    expect(shipping).toHaveAttribute("aria-current", "step");
  });

  it("is used on phones with the responsive orientation", () => {
    stubViewport(true);
    render(
      <Stepper currentStepId={1} orientation="responsive" steps={steps} />,
    );

    // The titles are written out
    expect(screen.getByText("Review")).toBeVisible();
  });
});

describe("Horizontal Stepper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the content of the current step under the steps", async () => {
    const user = userEvent.setup();
    render(<Wizard orientation="horizontal" />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    // The content of the step before is gone at once - the focus goes on
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    const shipping = screen.getByRole("group", { name: "2. Shipping" });
    expect(shipping).toHaveFocus();
    expect(shipping).toContainElement(
      screen.getByRole("textbox", { name: "Street" }),
    );
  });

  it("puts the description into the tooltip and the description", () => {
    render(
      <Stepper
        currentStepId="details"
        onStepClick={vi.fn()}
        steps={wizardSteps(vi.fn())}
      />,
    );

    const shipping = screen.getByRole("button", { name: "2. Shipping" });
    expect(shipping).toHaveAttribute("title", "Shipping\nWhere the order goes");
    expect(shipping).toHaveAccessibleDescription("Where the order goes");
  });

  it("is used from the md breakpoint with the responsive orientation", () => {
    stubViewport(false);
    render(
      <Stepper currentStepId={1} orientation="responsive" steps={steps} />,
    );

    expect(screen.getByText("3. Review")).toHaveClass("sr-only");
    expect(screen.queryByText("Review")).toBeNull();
  });
});

describe("Stepper on the server", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the horizontal layout, then the vertical one on a phone", async () => {
    const stepper = <Wizard orientation="responsive" />;
    const html = renderToString(stepper);
    expect(html).toContain("1. Details");

    stubViewport(true);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, stepper, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    // After hydration the phone gets the vertical layout
    expect(within(container).getByText("Details")).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });
});
