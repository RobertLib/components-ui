import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRef, useState } from "react";
import { Info, Search } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMask, type MaskedValue } from "./input-mask";
import { cs } from "../i18n/cs";
import Input from "./input";
import UIProvider from "../providers/ui-provider";

afterEach(() => {
  vi.useRealTimers();
});

const textbox = (name: RegExp | string) =>
  screen.getByRole<HTMLInputElement>("textbox", { name });

/** The value of an input with `|` at the caret. */
const withCaret = (input: HTMLInputElement) =>
  `${input.value.slice(0, input.selectionStart ?? 0)}|${input.value.slice(input.selectionStart ?? 0)}`;

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
    expect(search).toHaveClass("px-1", "py-0.5");
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

  it("size the password toggle as the field - 22 and 26 px when small", () => {
    render(
      <>
        <Input aria-label="Extra small" dim="xs" type="password" />
        <Input aria-label="Small" dim="sm" type="password" />
        <Input aria-label="Medium" type="password" />
      </>,
    );

    const [extraSmall, small, medium] = screen.getAllByRole("button", {
      name: "Show password",
    });
    expect(extraSmall).toHaveClass("py-0", "text-sm");
    expect(small).toHaveClass("py-0.5", "text-sm");
    expect(medium).toHaveClass("py-1", "text-base");
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

  it("is a target of 24 × 24 px, also in an extra small field", () => {
    render(
      <>
        <Input clearable defaultValue="Prague" dim="xs" label="City" />
        <Input clearable defaultValue="Brno" dim="sm" label="Town" />
      </>,
    );

    const [extraSmall, small] = screen.getAllByRole("button", {
      name: "Clear",
    });
    // Reaching over the padding of the field rather than making it taller
    expect(extraSmall).toHaveClass("size-6", "-my-0.5");
    // A small field is as high as the button with its padding
    expect(small).toHaveClass("size-6");
    expect(small).not.toHaveClass("-my-0.5");
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

describe("Input mask", () => {
  it("formats the text as it is typed and refuses other characters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input label="PSČ" mask="### ##" onChange={onChange} />);

    const input = textbox(/PSČ/);
    // A numeric keyboard on phones, and no corrections of words
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("autocorrect", "off");

    await user.type(input, "12a3");
    expect(withCaret(input)).toBe("123|");
    await user.keyboard("45");
    expect(withCaret(input)).toBe("123 45|");
    // The letter changed nothing - no change for it
    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange.mock.lastCall?.[0].target.value).toBe("123 45");

    // A complete value takes no more, as with maxLength
    await user.keyboard("6");
    expect(input).toHaveValue("123 45");
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it("deletes across literals and keeps the caret in place", async () => {
    const user = userEvent.setup();
    render(<Input defaultValue="12345" label="PSČ" mask="### ##" />);

    const input = textbox(/PSČ/);
    expect(input).toHaveValue("123 45");

    // Backspace after the space deletes the digit before it
    await user.click(input);
    input.setSelectionRange(4, 4);
    await user.keyboard("{Backspace}");
    expect(withCaret(input)).toBe("12|4 5");

    // Delete before the space deletes the digit after it
    input.setSelectionRange(3, 3);
    await user.keyboard("{Delete}");
    expect(withCaret(input)).toBe("124|");

    await user.keyboard("{Backspace}");
    expect(withCaret(input)).toBe("12|");
  });

  it("moves on past a literal, also a typed one", async () => {
    const user = userEvent.setup();
    render(<Input defaultValue="1245" label="PSČ" mask="### ##" />);

    const input = textbox(/PSČ/);
    await user.click(input);
    input.setSelectionRange(2, 2);
    await user.keyboard("3");
    expect(withCaret(input)).toBe("123 |45");

    input.setSelectionRange(3, 3);
    await user.keyboard(" ");
    expect(withCaret(input)).toBe("123 |45");
  });

  it("replaces a selection, and keeps it when nothing fits", async () => {
    const user = userEvent.setup();
    render(<Input defaultValue="123 45" label="PSČ" mask="### ##" />);

    const input = textbox(/PSČ/);
    await user.click(input);
    input.setSelectionRange(1, 5);
    await user.keyboard("x");
    expect(input).toHaveValue("123 45");
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 5]);

    await user.keyboard("9");
    expect(withCaret(input)).toBe("19|5");
  });

  it("reads pasted text with or without its literals", async () => {
    const user = userEvent.setup();
    render(<Input label="Telefon" mask="+420 ### ### ###" />);

    const input = textbox(/Telefon/);
    await user.click(input);
    await user.paste("+420 777 123 456");
    expect(withCaret(input)).toBe("+420 777 123 456|");

    await user.clear(input);
    await user.paste("777123456");
    expect(input).toHaveValue("+420 777 123 456");

    // A typed digit goes after the literal prefix
    await user.clear(input);
    await user.keyboard("6");
    expect(withCaret(input)).toBe("+420 6|");
    // Backspace takes the digit and with it the prefix
    await user.keyboard("{Backspace}");
    expect(input).toHaveValue("");
  });

  it("formats a controlled value of the parent, also a raw one", async () => {
    const user = userEvent.setup();
    const changes: MaskedValue[] = [];

    function Ico() {
      const [ico, setIco] = useState("123");
      return (
        <>
          <Input
            label="IČO"
            mask="#### ####"
            onChange={() => {}}
            onMaskChange={(value) => {
              changes.push(value);
              setIco(value.raw);
            }}
            value={ico}
          />
          <output>{ico}</output>
        </>
      );
    }
    render(<Ico />);

    const input = textbox(/IČO/);
    expect(input).toHaveValue("123");

    await user.type(input, "45678");
    expect(input).toHaveValue("1234 5678");
    expect(screen.getByRole("status")).toHaveTextContent("12345678");
    expect(changes.at(-1)).toEqual({
      complete: true,
      formatted: "1234 5678",
      raw: "12345678",
    });
    expect(changes.at(-2)?.complete).toBe(false);
  });

  it("shows the value of the parent when it refuses a change", async () => {
    const user = userEvent.setup();
    render(
      <Input label="PSČ" mask="### ##" onChange={() => {}} value="11100" />,
    );

    const input = textbox(/PSČ/);
    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(input).toHaveValue("111 00");
  });

  it("submits the formatted text, or with unmask the characters alone", () => {
    render(
      <form aria-label="Address">
        <Input defaultValue="12345" label="PSČ" mask="### ##" name="zip" />
        <Input
          defaultValue="+420 777 123 456"
          label="Telefon"
          mask="+420 ### ### ###"
          name="phone"
          unmask
        />
      </form>,
    );

    const data = new FormData(screen.getByRole("form", { name: "Address" }));
    expect(data.get("zip")).toBe("123 45");
    expect(data.getAll("phone")).toEqual(["777123456"]);
    // The field shows the text - the hidden input has the name
    expect(textbox(/Telefon/)).toHaveValue("+420 777 123 456");
    expect(textbox(/Telefon/)).not.toHaveAttribute("name");
  });

  it("brings back the defaultValue on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Input defaultValue="12345" label="PSČ" mask="### ##" />
        <button type="reset">Reset</button>
      </form>,
    );

    const input = textbox(/PSČ/);
    await user.clear(input);
    await user.type(input, "999");
    expect(input).toHaveValue("999");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("123 45");
  });

  it("works with the register() of React Hook Form", async () => {
    const user = userEvent.setup();
    const values: Record<string, string> = { zip: "11000" };
    let element: HTMLInputElement | null = null;
    // What `register()` does: its ref writes the default into the element
    const register = (name: string) => ({
      name,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        values[name] = event.target.value;
      },
      ref: (input: HTMLInputElement | null) => {
        if (!input || element === input) return;
        element = input;
        input.value = values[name];
      },
    });
    render(
      <form>
        <Input label="PSČ" mask="### ##" {...register("zip")} />
      </form>,
    );

    const input = textbox(/PSČ/);
    expect(input).toHaveValue("110 00");
    expect(input).toHaveAttribute("name", "zip");

    await user.clear(input);
    await user.type(input, "60200");
    expect(values.zip).toBe("602 00");
    expect(applyMask("### ##", values.zip).raw).toBe("60200");

    // `setValue()` writes the element - also without the literals
    act(() => {
      element!.value = "74601";
    });
    await user.tab();
    expect(input).toHaveValue("746 01");
  });

  it("is invalid while filled in only in part", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <Input label="IČO" mask="########" />
      </UIProvider>,
    );

    const input = textbox(/IČO/);
    // Empty is up to `required`
    expect(input).toBeValid();

    await user.type(input, "2727");
    expect(input).toBeInvalid();
    expect(input.validationMessage).toBe("Zadejte celou hodnotu.");

    await user.type(input, "0342");
    expect(input).toBeValid();
  });

  it("leaves a validity message of the page alone", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="IČO" mask="########" ref={ref} />);

    act(() => ref.current!.setCustomValidity("Unknown company"));
    fireEvent.change(ref.current!, { target: { value: "1" } });
    expect(ref.current!.validationMessage).toBe("Enter the complete value.");
    fireEvent.change(ref.current!, { target: { value: "" } });
    expect(ref.current!.validationMessage).toBe("");

    act(() => ref.current!.setCustomValidity("Unknown company"));
    fireEvent.change(ref.current!, { target: { value: "12345678" } });
    expect(ref.current!.validationMessage).toBe("Unknown company");
  });

  it("waits for an input method to finish composing", () => {
    const onChange = vi.fn();
    render(<Input label="Kód" mask="@@-##" onChange={onChange} />);

    const input = textbox(/Kód/);
    input.focus();
    fireEvent.compositionStart(input);
    // The composed text shows as it is
    fireEvent.input(input, { isComposing: true, target: { value: "ab1" } });
    expect(input).toHaveValue("ab1");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("ab-1");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].target.value).toBe("ab-1");
    expect(withCaret(input)).toBe("ab-1|");
  });

  it("takes placeholders of your own", async () => {
    const user = userEvent.setup();
    render(
      <Input
        label="SPZ"
        mask="#AA ####"
        maskTokens={{
          A: { pattern: /[A-Z]/, transform: (char) => char.toUpperCase() },
        }}
      />,
    );

    const input = textbox(/SPZ/);
    // Letters in the mask - no numeric keyboard
    expect(input).not.toHaveAttribute("inputmode");
    await user.type(input, "1ab2345");
    expect(input).toHaveValue("1AB 2345");
  });

  it("keeps the clear button, the floating label and the prefix working", async () => {
    const user = userEvent.setup();
    const onMaskChange = vi.fn();
    render(
      <Input
        clearable
        defaultValue="777123456"
        floating
        label="Mobil"
        mask="### ### ###"
        onMaskChange={onMaskChange}
        prefix="+420"
      />,
    );

    const input = textbox(/Mobil/);
    expect(input).toHaveValue("777 123 456");
    expect(screen.getByText("Mobil")).toHaveClass("text-xs");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(input).toHaveValue("");
    expect(onMaskChange).toHaveBeenCalledWith({
      complete: false,
      formatted: "",
      raw: "",
    });
  });

  it("is left out of the types without a caret", () => {
    render(
      <Input defaultValue={12} label="Count" mask="### ##" type="number" />,
    );

    expect(screen.getByRole("spinbutton", { name: /Count/ })).toHaveValue(12);
  });

  it("renders the formatted value on the server and hydrates", async () => {
    const field = (
      <Input defaultValue="12345" label="PSČ" mask="### ##" name="zip" unmask />
    );

    const html = renderToString(field);
    expect(html).toContain('value="123 45"');
    expect(html).toContain('value="12345"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});

describe("Input labels", () => {
  it("take content, which names the field", () => {
    render(
      <>
        <Input
          label={
            <span className="inline-flex items-center gap-1">
              <Info aria-hidden="true" size={14} />
              IBAN
            </span>
          }
        />
        <Input
          floating
          label={
            <>
              Město <em>(doručení)</em>
            </>
          }
        />
      </>,
    );

    expect(textbox("IBAN:")).toBeInTheDocument();
    expect(textbox("Město (doručení)")).toBeInTheDocument();
  });

  it("render nothing for an empty label", () => {
    const { container } = render(<Input aria-label="Search" label="" />);
    expect(container.querySelector("label")).toBeNull();
  });
});

describe("Input readOnly", () => {
  it("marks the field for styles and hides the clear button", () => {
    render(<Input clearable defaultValue="Praha" label="Město" readOnly />);

    const input = textbox(/Město/);
    expect(input).toHaveAttribute("data-readonly");
    expect(input).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("leaves an editable field unmarked", () => {
    render(<Input label="Město" />);
    expect(textbox(/Město/)).not.toHaveAttribute("data-readonly");
  });
});

describe("Input required mark", () => {
  it("is a star hidden from screen readers, with a class to hide it by", () => {
    render(
      <>
        <Input label="Name" required />
        <Input floating label="City" required />
      </>,
    );

    const marks = screen.getAllByText("*");
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(mark).toHaveClass("cui-required-mark");
    }
    expect(textbox("Name:")).toBeRequired();
  });
});

describe("Input passwordStrength", () => {
  it("shows a meter and a text once there is a password", async () => {
    const user = userEvent.setup();
    render(<Input label="Heslo" passwordStrength type="password" />);

    const input = screen.getByLabelText(/Heslo/);
    expect(screen.queryByText(/Password strength/)).toBeNull();

    await user.type(input, "heslo");
    expect(screen.getByText("Password strength: very weak")).toBeVisible();
    expect(input).toHaveAccessibleDescription("Password strength: very weak");

    await user.clear(input);
    await user.type(input, "Kůň-Pije_Vodu-7x!");
    expect(screen.getByText("Password strength: strong")).toBeVisible();

    await user.clear(input);
    expect(screen.queryByText(/Password strength/)).toBeNull();
  });

  it("tells screen readers the strength once the typing pauses", () => {
    vi.useFakeTimers();
    render(
      <UIProvider locale={cs}>
        <Input label="Heslo" passwordStrength type="password" />
      </UIProvider>,
    );

    const status = screen.getByRole("status");
    const input = screen.getByLabelText(/Heslo/);
    const type = (value: string) =>
      fireEvent.change(input, { target: { value } });
    fireEvent.focus(input);

    type("abc");
    expect(status).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(800));
    expect(status).toHaveTextContent("Síla hesla: velmi nízká");

    // Still typing - the new strength waits for the pause
    type("abc-Def-9x!q");
    act(() => vi.advanceTimersByTime(300));
    expect(status).toHaveTextContent("Síla hesla: velmi nízká");
    act(() => vi.advanceTimersByTime(500));
    expect(status).toHaveTextContent("Síla hesla: vysoká");

    // Leaving the field ends it
    fireEvent.blur(input);
    expect(status).toBeEmptyDOMElement();
  });

  it("takes a scorer of your own", async () => {
    const user = userEvent.setup();
    const score = vi.fn((password: string) => (password.length >= 4 ? 9 : 1));
    render(<Input label="PIN" passwordStrength={score} type="password" />);

    await user.type(screen.getByLabelText(/PIN/), "123");
    expect(screen.getByText("Password strength: weak")).toBeVisible();
    await user.type(screen.getByLabelText(/PIN/), "4");
    // Out of range - the strongest
    expect(screen.getByText("Password strength: strong")).toBeVisible();
    expect(score).toHaveBeenLastCalledWith("1234");
  });

  it("is only for passwords", async () => {
    const user = userEvent.setup();
    render(<Input label="Name" passwordStrength />);

    await user.type(textbox(/Name/), "secret");
    expect(screen.queryByText(/Password strength/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
