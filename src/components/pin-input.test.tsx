import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PinInput from "./pin-input";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const cell = (index: number, length = 6) =>
  screen.getByRole<HTMLInputElement>("textbox", {
    name: `Digit ${index} of ${length}`,
  });

const cellValues = () =>
  screen
    .getAllByRole<HTMLInputElement>("textbox")
    .map((input) => input.value)
    .join("");

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe("PinInput", () => {
  it("is a group of cells named after their position", () => {
    render(<PinInput label="Verification code" length={4} />);

    expect(
      screen.getByRole("group", { name: "Verification code:" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(cell(2, 4)).toHaveAttribute("inputmode", "numeric");
    // The code a phone offers goes into the first cell
    expect(cell(1, 4)).toHaveAttribute("autocomplete", "one-time-code");
    expect(cell(2, 4)).toHaveAttribute("autocomplete", "off");
  });

  it("names the cells in the language of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <PinInput aria-label="Kód" length={4} />
        <PinInput aria-label="Heslo" length={4} type="alphanumeric" />
      </UIProvider>,
    );

    expect(
      screen.getByRole("textbox", { name: "Číslice 2 z 4" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Znak 3 z 4" })).toHaveAttribute(
      "inputmode",
      "text",
    );
  });

  it("moves on as digits are typed and reports the complete code", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(
      <PinInput
        aria-label="Code"
        length={4}
        onChange={onChange}
        onComplete={onComplete}
      />,
    );

    await user.click(cell(1, 4));
    await user.keyboard("12");
    expect(cell(3, 4)).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("12");
    expect(onComplete).not.toHaveBeenCalled();

    await user.keyboard("34");
    expect(cellValues()).toBe("1234");
    expect(onComplete).toHaveBeenCalledWith("1234");
    // The last cell keeps the focus
    expect(cell(4, 4)).toHaveFocus();
  });

  it("ignores characters the code does not take", async () => {
    const user = userEvent.setup();
    render(<PinInput aria-label="Code" length={4} />);

    await user.click(cell(1, 4));
    await user.keyboard("a 1-b2");

    expect(cellValues()).toBe("12");
  });

  it("takes letters when alphanumeric", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PinInput
        aria-label="Code"
        length={4}
        onChange={onChange}
        type="alphanumeric"
      />,
    );

    await user.click(screen.getByRole("textbox", { name: "Character 1 of 4" }));
    await user.keyboard("aB3-");

    expect(onChange).toHaveBeenLastCalledWith("aB3");
  });

  it("types the digit of a key whose layout types a letter on it", () => {
    render(<PinInput aria-label="Code" length={4} />);

    // The 2 key of a Czech keyboard types "ě" without Shift
    fireEvent.keyDown(cell(1, 4), { code: "Digit2", key: "ě" });

    expect(cellValues()).toBe("2");
    expect(cell(2, 4)).toHaveFocus();
  });

  it("moves on when a character is typed over the same one", async () => {
    const user = userEvent.setup();
    render(<PinInput aria-label="Code" defaultValue="1234" length={4} />);

    await user.click(cell(2, 4));
    await user.keyboard("2");

    expect(cell(3, 4)).toHaveFocus();
    expect(cellValues()).toBe("1234");
  });

  it("goes back with Backspace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PinInput
        aria-label="Code"
        defaultValue="123"
        length={4}
        onChange={onChange}
      />,
    );

    // The first empty cell - back to the previous one, which it clears
    await user.click(cell(4, 4));
    expect(cell(4, 4)).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith("12");
    expect(cell(3, 4)).toHaveFocus();

    // A filled cell clears itself, the characters after it move up
    await user.click(cell(1, 4));
    await user.keyboard("{Delete}");
    expect(onChange).toHaveBeenLastCalledWith("2");
    expect(cell(1, 4)).toHaveFocus();
  });

  it("moves between the filled cells with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<PinInput aria-label="Code" defaultValue="12" length={4} />);

    await user.click(cell(1, 4));
    await user.keyboard("{ArrowRight}");
    expect(cell(2, 4)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(cell(3, 4)).toHaveFocus();
    // Not past the first empty cell
    await user.keyboard("{ArrowRight}");
    expect(cell(3, 4)).toHaveFocus();

    await user.keyboard("{Home}");
    expect(cell(1, 4)).toHaveFocus();
    await user.keyboard("{End}");
    expect(cell(3, 4)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(cell(2, 4)).toHaveFocus();
  });

  it("gives a click after the first empty cell to that cell", async () => {
    const user = userEvent.setup();
    render(<PinInput aria-label="Code" defaultValue="1" length={4} />);

    await user.click(cell(4, 4));

    expect(cell(2, 4)).toHaveFocus();
  });

  it("is one tab stop - the first empty cell", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <PinInput aria-label="Code" defaultValue="12" length={4} />
        <button type="button">After</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(cell(3, 4)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("fills the cells from a pasted code", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<PinInput aria-label="Code" onComplete={onComplete} />);

    // Wherever it lands, spaces and dashes left out
    await user.click(cell(1));
    await user.paste("123 456");

    expect(cellValues()).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
    expect(cell(6)).toHaveFocus();
  });

  it("puts a part of a code in from the cell it is pasted into", async () => {
    const user = userEvent.setup();
    render(<PinInput aria-label="Code" defaultValue="1234" />);

    await user.click(cell(2));
    await user.paste("99");

    expect(cellValues()).toBe("1994");
    expect(cell(4)).toHaveFocus();
  });

  it("spreads a code the browser fills into the first cell", () => {
    const onComplete = vi.fn();
    render(<PinInput aria-label="Code" onComplete={onComplete} />);

    fireEvent.change(cell(1), { target: { value: "654321" } });

    expect(cellValues()).toBe("654321");
    expect(onComplete).toHaveBeenCalledWith("654321");
  });

  it("clears a cell a phone keyboard empties", () => {
    const onChange = vi.fn();
    render(
      <PinInput aria-label="Code" defaultValue="123" onChange={onChange} />,
    );

    fireEvent.change(cell(2), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith("13");
  });

  it("shows the value of a controlled field only", async () => {
    const user = userEvent.setup();

    function Verify() {
      const [code, setCode] = useState("");
      return (
        <PinInput
          aria-label="Code"
          length={4}
          onChange={(next) => setCode(next.replace("0", ""))}
          value={code}
        />
      );
    }

    render(<Verify />);
    await user.click(cell(1, 4));
    await user.keyboard("102");

    expect(cellValues()).toBe("12");
  });

  it("submits the joined code, and brings back the default on a reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Verify">
        <PinInput aria-label="Code" defaultValue="12" length={4} name="code" />
      </form>,
    );

    await user.click(cell(3, 4));
    await user.keyboard("34");
    expect(new FormData(getForm()).get("code")).toBe("1234");

    act(() => getForm().reset());
    expect(cellValues()).toBe("12");
    expect(new FormData(getForm()).get("code")).toBe("12");
  });

  it("requires every cell when required", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Verify">
        <PinInput aria-label="Code" length={4} name="code" required />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    await user.click(cell(1, 4));
    await user.keyboard("123");
    expect(getForm().checkValidity()).toBe(false);
    await user.keyboard("4");
    expect(getForm().checkValidity()).toBe(true);
  });

  it("neither submits nor validates a disabled field", () => {
    render(
      <form aria-label="Verify">
        <PinInput
          aria-label="Code"
          defaultValue="1"
          disabled
          name="code"
          required
        />
      </form>,
    );

    expect(cell(1)).toBeDisabled();
    expect(getForm().checkValidity()).toBe(true);
    expect(new FormData(getForm()).has("code")).toBe(false);
  });

  it("masks the characters", () => {
    const { container } = render(
      <PinInput aria-label="PIN" defaultValue="12" length={4} mask />,
    );

    const cells = container.querySelectorAll("input");
    expect(cells[0]).toHaveAttribute("type", "password");
    expect(cells[0]).toHaveValue("1");
  });

  it("focuses the first empty cell on mount with autoFocus", () => {
    render(<PinInput aria-label="Code" autoFocus defaultValue="12" />);

    expect(cell(3)).toHaveFocus();
  });

  it("calls onFocus and onBlur as the focus enters and leaves the cells", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <PinInput
          aria-label="Code"
          defaultValue="12"
          onBlur={onBlur}
          onFocus={onFocus}
        />
        <button type="button">After</button>
      </>,
    );

    await user.click(cell(1));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "After" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("is described by its error first, then its description", () => {
    render(
      <PinInput
        description="We sent it to +420 777 123 456."
        error="The code has expired."
        id="code"
        label="Code"
      />,
    );

    // The cells take the focus, so they carry the description
    for (const index of [1, 6]) {
      expect(cell(index)).toHaveAccessibleDescription(
        "The code has expired. We sent it to +420 777 123 456.",
      );
    }
    expect(cell(1)).toHaveAttribute("id", "code");
    expect(cell(1)).toHaveAttribute("aria-invalid", "true");
    expect(cell(2)).toHaveAttribute("id", "code-2");
  });

  it("points its label and its ref at the cells", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    render(<PinInput defaultValue="1" label="Code" ref={ref} />);

    expect(ref.current).toBe(cell(1));
    await user.click(screen.getByText("Code:"));
    expect(cell(2)).toHaveFocus();
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const field = (
      <PinInput defaultValue="12" label="Code" length={4} name="code" />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(field);
    document.body.append(container);

    expect(container.querySelectorAll("input[inputmode]")).toHaveLength(4);
    expect(
      container.querySelector<HTMLInputElement>("input[name='code']")?.value,
    ).toBe("12");

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(cell(3, 4)).toHaveAttribute("tabindex", "0");

    act(() => root.unmount());
    container.remove();
  });
});
