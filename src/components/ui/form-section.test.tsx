import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Button from "./button";
import FormSection from "./form-section";
import Input from "./input";

describe("FormSection", () => {
  it("is a group of fields named by its heading", () => {
    render(
      <FormSection
        actions={<Button size="sm">Edit</Button>}
        description="Where the invoices go."
        title="Billing address"
      >
        <Input label="Street" />
      </FormSection>,
    );

    const group = screen.getByRole("group", { name: "Billing address" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveAccessibleDescription("Where the invoices go.");
    expect(
      screen.getByRole("heading", { level: 2, name: "Billing address" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Street:" }),
    ).toBeInTheDocument();
    // In the legend, beside the heading - not in the name of the group
    expect(
      screen.getByRole("button", { name: "Edit" }).closest("legend"),
    ).not.toBeNull();
  });

  it("takes the level of its heading", () => {
    render(<FormSection headingLevel={3} title="Contacts" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Contacts" }),
    ).toBeInTheDocument();
  });

  it("passes its attributes and ref to the fieldset", () => {
    const ref = createRef<HTMLFieldSetElement>();
    render(
      <FormSection
        aria-describedby="hint"
        className="mt-8"
        data-testid="section"
        description="Help"
        ref={ref}
        title="Contacts"
      />,
    );

    const section = screen.getByTestId("section");
    expect(ref.current).toBe(section);
    expect(section).toHaveClass("min-w-0", "mt-8");
    expect(section.getAttribute("aria-describedby")).toMatch(
      /-description hint$/,
    );
  });

  it("disables its fields, but not its actions", () => {
    render(
      <FormSection actions={<Button>Unlock</Button>} disabled title="Contract">
        <Input label="Number" />
      </FormSection>,
    );

    expect(screen.getByRole("textbox", { name: "Number:" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeEnabled();
  });

  it("lays out its fields with a FormGrid", () => {
    render(
      <FormSection
        columns={2}
        labelPosition="start"
        labelWidth="9rem"
        title="Company"
      >
        <Input label="Name" />
      </FormSection>,
    );

    const grid = screen
      .getByRole("textbox", { name: "Name:" })
      .closest("[data-label-position]") as HTMLElement;
    expect(grid).toHaveAttribute("data-label-position", "start");
    expect(grid).toHaveClass("@container/cui-form", "clear-both");
    expect(grid.style.getPropertyValue("--cui-label-width")).toBe("9rem");
    expect(grid.firstElementChild).toHaveClass("@3xl/cui-form:grid-cols-2");
  });

  it("has no legend without a title", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FormSection
        actions={<Button onClick={onClick}>Add</Button>}
        data-testid="section"
      >
        <Input label="Name" />
      </FormSection>,
    );

    const section = screen.getByTestId("section");
    expect(section.querySelector("legend")).toBeNull();
    expect(section).not.toHaveAttribute("aria-labelledby");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("lets a name of yours win", () => {
    render(
      <>
        <span id="own">Own name</span>
        <FormSection aria-labelledby="own" title="Contacts" />
      </>,
    );

    expect(screen.getByRole("group", { name: "Own name" })).toBeInTheDocument();
  });
});
