import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRef, useState } from "react";
import { Search } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { cs } from "../i18n/cs";
import Input from "./input";
import UIProvider from "../providers/ui-provider";

describe("Input adornments", () => {
  it("show inside the border, and a click on them focuses the field", async () => {
    const user = userEvent.setup();
    render(<Input label="Price" prefix="≈" suffix="Kč" />);

    const input = screen.getByRole("textbox", { name: /Price/ });
    const frame = input.parentElement!;
    expect(frame).toContainElement(screen.getByText("Kč"));
    expect(frame).toContainElement(screen.getByText("≈"));
    // The frame draws the border - the input sits in it
    expect(frame).toHaveClass("border", "rounded-md");
    expect(input).not.toHaveClass("form-control");

    await user.click(screen.getByText("Kč"));
    expect(input).toHaveFocus();
  });

  it("keep the focus in the field on a press, and leave their controls alone", async () => {
    const user = userEvent.setup();
    const onUnit = vi.fn();
    render(
      <Input
        label="Weight"
        suffix={
          <button onClick={onUnit} type="button">
            kg
          </button>
        }
      />,
    );

    const press = fireEvent.mouseDown(
      screen.getByRole("textbox").parentElement!,
    );
    // Cancelled - the focus does not move to the page
    expect(press).toBe(false);

    await user.click(screen.getByRole("button", { name: "kg" }));
    expect(onUnit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "kg" })).toHaveFocus();
  });

  it("keep the sizes, the error and the floating label working", () => {
    render(
      <>
        <Input dim="sm" error="Required" label="Search" prefix={<Search />} />
        <Input floating label="Amount" prefix="$" />
        <Input floating label="Discount" suffix="%" />
      </>,
    );

    const search = screen.getByRole("textbox", { name: /Search/ });
    expect(search).toHaveClass("px-1", "py-0");
    expect(search.parentElement).toHaveClass("border-danger-500!");
    expect(search).toHaveAccessibleDescription("Required");
    expect(search).toBeInvalid();

    // A prefix takes the place of the resting label
    expect(screen.getByText("Amount")).toHaveClass("text-xs");
    expect(screen.getByText("Discount")).not.toHaveClass("text-xs");
    // Still next to the input, where the autofill selector finds it
    expect(screen.getByText("Discount")).toHaveClass(
      "[&:has(~input:autofill)]:text-xs",
    );
  });

  it("work with the password toggle", async () => {
    const user = userEvent.setup();
    render(<Input label="Password" prefix="🔒" type="password" />);

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("type", "text");
  });

  it("give a password with a floating label the corners of the button group", () => {
    render(<Input floating label="Password" type="password" />);

    // The frame, not the label floating in it, is the first of the group -
    // the group rounds the corners of its first and last child
    const input = screen.getByLabelText("Password");
    const frame = input.parentElement!;
    expect(frame).toHaveClass("border");
    expect(frame.parentElement).toHaveClass("btn-group");
    expect(frame.parentElement!.firstElementChild).toBe(frame);
    expect(frame).toContainElement(screen.getByText("Password"));
  });

  it("leave a field without them as it was", () => {
    render(<Input label="Name" />);

    const input = screen.getByRole("textbox", { name: /Name/ });
    expect(input).toHaveClass("form-control");
    expect(input.parentElement).toHaveClass("relative");
    expect(input.parentElement).not.toHaveClass("border");
  });

  it("keep the focus and the typing while one comes and goes", async () => {
    const user = userEvent.setup();
    function Username() {
      const [value, setValue] = useState("");
      return (
        <Input
          label="Username"
          onChange={(event) => setValue(event.target.value)}
          // A check mark once the name is long enough
          suffix={value.length >= 3 ? "✓" : null}
          value={value}
        />
      );
    }
    render(<Username />);

    const input = screen.getByRole("textbox", { name: /Username/ });
    await user.click(input);
    await user.keyboard("abcdef");

    expect(screen.getByText("✓")).toBeVisible();
    expect(input.parentElement).toHaveClass("border");
    // The same input - a new one would have lost the focus and the typing
    expect(screen.getByRole("textbox", { name: /Username/ })).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("abcdef");
  });

  it("join a password without them to its toggle", () => {
    render(<Input label="Password" type="password" />);

    // The group rounds the corners of its children - the input is inside one
    const input = screen.getByLabelText(/Password/);
    expect(input).toHaveClass("form-control", "rounded-e-none!");
    expect(input.closest(".btn-group")).toContainElement(
      screen.getByRole("button", { name: "Show password" }),
    );
  });
});

describe("Input clearable", () => {
  it("clears an uncontrolled field and moves the focus into it", async () => {
    const user = userEvent.setup();
    render(<Input clearable defaultValue="Prague" label="City" />);

    const input = screen.getByRole("textbox", { name: /City/ });
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    // Nothing left to clear
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    await user.type(input, "Brno");
    expect(screen.getByRole("button", { name: "Clear" })).toBeVisible();
  });

  it("gives a controlled onChange an event with an empty value", async () => {
    const user = userEvent.setup();
    const values: string[] = [];

    function City() {
      const [city, setCity] = useState("Prague");
      return (
        <Input
          clearable
          label="City"
          onChange={(event) => {
            values.push(event.target.value);
            setCity(event.target.value);
          }}
          value={city}
        />
      );
    }

    render(<City />);
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(values).toEqual([""]);
    expect(screen.getByRole("textbox", { name: /City/ })).toHaveValue("");
  });

  it("keeps a value the parent does not clear", async () => {
    const user = userEvent.setup();
    render(<Input clearable label="City" onChange={() => {}} value="Prague" />);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("textbox", { name: /City/ })).toHaveValue("Prague");
  });

  it("is operated from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <Input clearable defaultValue="Praha" label="Město" />
      </UIProvider>,
    );

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Vymazat" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: /Město/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /Město/ })).toHaveFocus();
  });

  it("is not offered where the value cannot or should not be cleared", () => {
    render(
      <>
        <Input
          clearable
          defaultValue="secret"
          label="Password"
          type="password"
        />
        <Input clearable defaultValue={5} label="Count" type="number" />
        <Input clearable defaultValue="Prague" disabled label="Disabled" />
        <Input clearable defaultValue="Prague" label="Read only" readOnly />
      </>,
    );

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("is a target of 24 × 24 px, also in a small field", () => {
    render(<Input clearable defaultValue="Prague" dim="sm" label="City" />);

    // Reaching over the padding of the field rather than making it taller
    expect(screen.getByRole("button", { name: "Clear" })).toHaveClass(
      "size-6",
      "-my-0.5",
    );
  });

  it("hides the browser's own clear button of a search field", () => {
    render(
      <Input
        aria-label="Search"
        clearable
        defaultValue="invoices"
        type="search"
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveClass(
      "[&::-webkit-search-cancel-button]:hidden",
    );
  });

  it("keeps the ref of the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input clearable label="City" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("textbox", { name: /City/ }));
  });
});

describe("Input on the server", () => {
  it("renders a framed field and hydrates without a mismatch", async () => {
    const field = (
      <Input
        clearable
        defaultValue="Prague"
        description="Where the goods go"
        floating
        label="City"
        prefix="→"
        suffix="CZ"
      />
    );

    const html = renderToString(field);
    expect(html).toContain('aria-label="Clear"');
    expect(html).toContain("Where the goods go");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
