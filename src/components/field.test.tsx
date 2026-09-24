import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Field from "./field";
import Input from "./input";
import Select from "./select";
import UIProvider from "../providers/ui-provider";

describe("Field", () => {
  it("gives the control its label, description and error", () => {
    render(
      <Field
        description="With the country code"
        error="Invalid number"
        label="Phone"
        required
      >
        {(controlProps) => <input {...controlProps} required type="tel" />}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Phone:" });
    expect(input).toHaveAccessibleDescription(
      "Invalid number With the country code",
    );
    expect(input).toBeInvalid();
    expect(input).toHaveAttribute("aria-required", "true");
    // The star is for the eye
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("derives the ids from its id", () => {
    render(
      <Field description="Help" error="Bad" id="iban" label="IBAN">
        {(controlProps) => <input {...controlProps} />}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "IBAN:" });
    expect(input).toHaveAttribute("id", "iban");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "iban-error iban-description",
    );
    expect(input).toHaveAttribute("aria-labelledby", "iban-label");
    expect(screen.getByText("Help")).toHaveAttribute("id", "iban-description");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "iban-error");
  });

  it("names a control a label cannot, and focuses it from the label", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Rating">
        {(controlProps) => (
          <div
            {...controlProps}
            aria-valuemax={5}
            aria-valuemin={0}
            aria-valuenow={3}
            role="slider"
            tabIndex={0}
          />
        )}
      </Field>,
    );

    const slider = screen.getByRole("slider", { name: "Rating:" });
    await user.click(screen.getByText("Rating:"));
    expect(slider).toHaveFocus();
  });

  it("leaves the focus to the browser for a labelable control", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Color">
        {(controlProps) => <input {...controlProps} type="color" />}
      </Field>,
    );

    await user.click(screen.getByText("Color:"));
    expect(screen.getByLabelText("Color:")).toHaveFocus();
  });

  it("renders an element as it is, and leaves out what it is not given", () => {
    render(
      <Field className="w-64" data-testid="field" id="note">
        <textarea aria-label="Note" id="note" />
      </Field>,
    );

    expect(screen.getByTestId("field")).toHaveClass("w-64", "flex");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Note" })).toBeVisible();
  });

  it("follows the label suffix of the locale", () => {
    render(
      <UIProvider messages={{ form: { labelSuffix: " :" } }}>
        <Field label="Couleur">
          {(controlProps) => <input {...controlProps} />}
        </Field>
      </UIProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Couleur :" })).toBeVisible();
  });

  it("passes no ARIA attributes the field does not need", () => {
    render(
      <Field>
        {(controlProps) => <input {...controlProps} aria-label="Plain" />}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Plain" });
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-labelledby");
    expect(input).not.toHaveAttribute("aria-required");
    expect(input.id).not.toBe("");
  });

  it("renders on the server with the ids it hydrates with", async () => {
    const field = (
      <Field description="Help" error="Bad" label="Code" required>
        {(controlProps) => <input {...controlProps} />}
      </Field>
    );

    const html = renderToString(field);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "Code:" }),
    ).toHaveAccessibleDescription("Bad Help");

    act(() => root.unmount());
    container.remove();
  });
});

describe("Field around the library's fields", () => {
  it("keeps the invalid and required state it passes", () => {
    render(
      <>
        <Field error="Required" label="Title" required>
          {(controlProps) => <Input {...controlProps} />}
        </Field>
        <Field error="Required" label="Size" required>
          {(controlProps) => (
            <Select {...controlProps} options={[{ label: "S", value: "s" }]} />
          )}
        </Field>
      </>,
    );

    for (const field of [
      screen.getByRole("textbox", { name: /Title/ }),
      screen.getByRole("combobox", { name: /Size/ }),
    ]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAttribute("aria-required", "true");
    }
  });
});
