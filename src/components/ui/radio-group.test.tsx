import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import RadioGroup from "./radio-group";
import SegmentedControl from "./segmented-control";

const plans = [
  { label: "Free", value: "free" },
  { label: "Team", value: "team" },
  { label: "Enterprise", value: "enterprise" },
];

const radio = (name: string) =>
  screen.getByRole<HTMLInputElement>("radio", { name });

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe.each([
  ["RadioGroup", RadioGroup],
  ["SegmentedControl", SegmentedControl],
] as const)("%s empty option", (_name, Control) => {
  const options = [
    { label: "None", value: "" },
    { label: "Team", value: "team" },
  ];

  it("starts and resets unselected, but allows choosing the empty option", () => {
    const field = () => (
      <form aria-label="Order">
        <Control label="Plan" name="plan" options={options} required />
      </form>
    );
    const { rerender } = render(field());
    const form = getForm();
    expect(radio("None")).not.toBeChecked();
    expect(radio("Team")).not.toBeChecked();
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).has("plan")).toBe(false);

    fireEvent.click(radio("None"));
    expect(radio("None")).toBeChecked();
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("plan")).toBe("");

    act(() => form.reset());
    rerender(field());
    expect(radio("None")).not.toBeChecked();
    expect(radio("Team")).not.toBeChecked();
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).has("plan")).toBe(false);
  });

  it.each(["defaultValue", "value"] as const)(
    "keeps an explicitly empty %s selected after reset",
    (prop) => {
      render(
        <form aria-label="Order">
          <Control
            label="Plan"
            name="plan"
            options={options}
            required
            {...{ [prop]: "" }}
          />
        </form>,
      );
      expect(radio("None")).toBeChecked();
      fireEvent.click(radio("Team"));
      act(() => getForm().reset());
      expect(radio("None")).toBeChecked();
      expect(getForm().checkValidity()).toBe(true);
      expect(new FormData(getForm()).get("plan")).toBe("");
    },
  );
});

describe("RadioGroup read-only", () => {
  it("keeps the pick on a click, focusable, and says it is read-only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        defaultValue="team"
        label="Plan"
        onChange={onChange}
        options={plans}
        readOnly
      />,
    );

    await user.click(radio("Free"));
    expect(radio("Team")).toBeChecked();
    expect(radio("Free")).not.toBeChecked();
    expect(radio("Free")).toHaveFocus();
    await user.click(screen.getByText("Enterprise"));
    expect(radio("Team")).toBeChecked();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-readonly",
      "true",
    );
    expect(radio("Free")).toBeEnabled();
  });

  it("moves the focus with the arrow keys without picking - round, past disabled options", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup
        aria-label="Plan"
        defaultValue="free"
        options={[plans[0], { ...plans[1], disabled: true }, plans[2]]}
        readOnly
      />,
    );

    await user.tab();
    expect(radio("Free")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(radio("Enterprise")).toHaveFocus();
    expect(radio("Free")).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(radio("Free")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(radio("Enterprise")).toHaveFocus();
    await user.keyboard(" ");
    expect(radio("Free")).toBeChecked();
  });

  it("swaps Left and Right in a right-to-left page", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl" style={{ direction: "rtl" }}>
        <RadioGroup
          aria-label="Plan"
          defaultValue="free"
          options={plans}
          orientation="horizontal"
          readOnly
        />
      </div>,
    );

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(radio("Team")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(radio("Free")).toHaveFocus();
  });

  it("submits the pick and is not validated", () => {
    render(
      <form aria-label="Order">
        <RadioGroup
          defaultValue="team"
          label="Plan"
          name="plan"
          options={plans}
          readOnly
        />
        <RadioGroup
          label="Shipping"
          name="shipping"
          options={plans}
          readOnly
          required
        />
      </form>,
    );

    expect(new FormData(getForm()).get("plan")).toBe("team");
    expect(getForm().checkValidity()).toBe(true);
    expect(
      screen.getByRole("radiogroup", { name: /Shipping/ }),
    ).toHaveAttribute("aria-required", "true");
  });

  it("keeps a controlled pick - and picks again once it is not read-only", async () => {
    const user = userEvent.setup();

    function Plan() {
      const [plan, setPlan] = useState("free");
      const [locked, setLocked] = useState(true);
      return (
        <>
          <RadioGroup
            aria-label="Plan"
            onChange={(event) => setPlan(event.target.value)}
            options={plans}
            readOnly={locked}
            value={plan}
          />
          <button onClick={() => setLocked(false)} type="button">
            Unlock
          </button>
        </>
      );
    }

    render(<Plan />);
    await user.click(radio("Team"));
    expect(radio("Free")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Unlock" }));
    await user.click(radio("Team"));
    expect(radio("Team")).toBeChecked();
  });
});

describe("RadioGroup cards", () => {
  const shipping = [
    {
      description: "2 - 3 business days",
      icon: <svg data-testid="truck" />,
      label: "Standard",
      value: "standard",
    },
    { label: "Express", value: "express" },
    { disabled: true, label: "Pickup", value: "pickup" },
  ];

  it("names each card by its label and describes it by its description", () => {
    render(<RadioGroup label="Shipping" options={shipping} variant="card" />);

    expect(radio("Standard")).toHaveAccessibleDescription(
      "2 - 3 business days",
    );
    expect(radio("Express")).toHaveAccessibleName("Express");
    expect(screen.getByTestId("truck").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const card = radio("Standard").closest("label")!;
    expect(card).toHaveClass(
      "rounded-lg",
      "has-checked:border-primary-500",
      "has-focus-visible:outline-2",
    );
  });

  it.each(["default", "card"] as const)(
    "points no option at a description that renders nothing (%s)",
    (variant) => {
      render(
        <RadioGroup
          label="Plan"
          options={[
            // `isPro && "Pro only"`, `count && "…"`
            { description: false, label: "Free", value: "free" },
            { description: 0, label: "Team", value: "team" },
            { description: "", label: "Enterprise", value: "enterprise" },
          ]}
          variant={variant}
        />,
      );

      for (const name of ["Free", "Team", "Enterprise"]) {
        expect(radio(name)).not.toHaveAttribute("aria-describedby");
      }
      // Laid out as an option without a description
      if (variant === "default") {
        expect(radio("Free").closest("label")).toHaveClass("items-center");
      }
    },
  );

  it("picks a card by a click anywhere on it, and by the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="Shipping"
        onChange={onChange}
        options={shipping}
        variant="card"
      />,
    );

    await user.click(screen.getByText("2 - 3 business days"));
    expect(radio("Standard")).toBeChecked();
    await user.keyboard("{ArrowDown}");
    expect(radio("Express")).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(radio("Pickup")).toBeDisabled();
  });

  it("lays the options out in columns", () => {
    render(
      <>
        <RadioGroup
          aria-label="Cards"
          columns={2}
          options={plans}
          variant="card"
        />
        <RadioGroup aria-label="Plain" columns={3} options={plans} />
      </>,
    );

    const listOf = (name: string) =>
      within(screen.getByRole("radiogroup", { name }))
        .getByRole("radio", { name: "Free" })
        .closest("label")!.parentElement!;
    expect(listOf("Cards")).toHaveClass("grid", "gap-3");
    expect(listOf("Cards").style.getPropertyValue("--cui-columns")).toBe("2");
    expect(listOf("Plain")).toHaveClass("grid", "gap-x-4");
    expect(listOf("Plain").style.getPropertyValue("--cui-columns")).toBe("3");
  });
});

describe("RadioGroup labels", () => {
  it("take any content - of the group and of the options", () => {
    render(
      <RadioGroup
        label={<span>Plan</span>}
        options={[{ label: <b>Free</b>, value: "free" }]}
      />,
    );

    expect(screen.getByRole("radiogroup")).toHaveAccessibleName("Plan:");
    expect(radio("Free")).toBeInTheDocument();
  });
});
