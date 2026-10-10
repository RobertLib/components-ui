import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PhoneInput from "./phone-input";
const countries = [
  { code: "CZ", callingCode: "420" },
  { code: "SK", callingCode: "421" },
];

describe("PhoneInput", () => {
  it("normalizes national input and submits only the international number", () => {
    const onChange = vi.fn();
    const { container } = render(
      <form>
        <PhoneInput
          countries={countries}
          defaultCountry="CZ"
          label="Phone"
          name="phone"
          onChange={onChange}
        />
      </form>,
    );
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: "777 123 456" },
    });
    expect(onChange).toHaveBeenLastCalledWith("+420777123456", {
      country: "CZ",
      isPossible: true,
      isValid: true,
    });
    expect(
      new FormData(container.querySelector("form")!).getAll("phone"),
    ).toEqual(["+420777123456"]);
    fireEvent.blur(screen.getByLabelText(/^Phone/));
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+420777123456");
  });
  it("holds the number of an uncontrolled field in the form by onChange", async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    const { container } = render(
      <form>
        <PhoneInput
          countries={countries}
          defaultCountry="CZ"
          label="Phone"
          name="phone"
          onChange={() =>
            seen.push(
              new FormData(container.querySelector("form")!).get("phone"),
            )
          }
        />
      </form>,
    );

    // Typed, and a country picked
    await user.type(screen.getByLabelText(/^Phone/), "77");
    await user.selectOptions(screen.getByRole("combobox"), "SK");
    expect(seen).toEqual(["+4207", "+42077", "+42177"]);
  });
  it("detects international prefixes and keeps national digits when selecting another country", async () => {
    const user = userEvent.setup();
    const changeCountry = vi.fn();
    render(
      <PhoneInput
        countries={countries}
        defaultCountry="CZ"
        label="Phone"
        onCountryChange={changeCountry}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: "00421 905 123 456" },
    });
    expect(screen.getByRole("combobox")).toHaveValue("SK");
    expect(changeCountry).toHaveBeenLastCalledWith("SK");
    await user.selectOptions(screen.getByRole("combobox"), "CZ");
    fireEvent.blur(screen.getByLabelText(/^Phone/));
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+420905123456");
  });
  it("preserves controlled values and reports clear as an empty value", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PhoneInput
        clearable
        countries={countries}
        label="Phone"
        onChange={onChange}
        value="+420777123456"
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: "+421905123456" },
    });
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+420777123456");
    rerender(
      <PhoneInput
        clearable
        countries={countries}
        label="Phone"
        onChange={onChange}
        value="+421905123456"
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Clear/ }));
    expect(onChange).toHaveBeenLastCalledWith("", {
      country: "SK",
      isPossible: false,
      isValid: false,
    });
  });
  it("keeps the country and validity aligned with accepted controlled values", async () => {
    const onChange = vi.fn();
    const onCountryChange = vi.fn();
    const content = (value: string) => (
      <form>
        <PhoneInput
          countries={countries}
          label="Phone"
          name="phone"
          onChange={onChange}
          onCountryChange={onCountryChange}
          value={value}
        />
      </form>
    );
    const { container, rerender } = render(content("+420777123456"));
    const form = container.querySelector("form")!;
    const input = screen.getByLabelText(/^Phone/);
    const picker = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "+421905123456" } });
    expect(onCountryChange).toHaveBeenLastCalledWith("SK");
    expect(onChange).toHaveBeenLastCalledWith("+421905123456", {
      country: "SK",
      isPossible: true,
      isValid: true,
    });
    expect(input).toHaveValue("+420777123456");
    expect(picker).toHaveValue("CZ");
    expect(form.checkValidity()).toBe(true);

    rerender(content("+420777999999"));
    expect(picker).toHaveValue("CZ");
    expect(form.checkValidity()).toBe(true);
    rerender(content("+421905123456"));
    expect(picker).toHaveValue("SK");
    expect(form.checkValidity()).toBe(true);

    await userEvent.setup().selectOptions(picker, "CZ");
    expect(input).toHaveValue("+421905123456");
    expect(picker).toHaveValue("SK");
    expect(form.checkValidity()).toBe(true);
    rerender(content("+420905123456"));
    expect(picker).toHaveValue("CZ");
    expect(form.checkValidity()).toBe(true);
  });
  it("retains the selected country when calling prefixes are shared", async () => {
    render(
      <PhoneInput
        countries={[
          { code: "US", callingCode: "1" },
          { code: "CA", callingCode: "1" },
        ]}
        defaultCountry="CA"
        defaultValue="+14165551234"
        label="Phone"
      />,
    );
    const picker = screen.getByRole("combobox");
    expect(picker).toHaveValue("CA");
    await userEvent.setup().selectOptions(picker, "US");
    expect(picker).toHaveValue("US");
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: "+12125551234" },
    });
    expect(picker).toHaveValue("US");
  });
  it.each(
    (["value", "defaultValue"] as const).flatMap((prop) =>
      [
        "00421 905 123 456",
        " +421905123456 ",
        "+ 421 905 123 456",
        "+(421) 905 123 456",
        "00 421 905 123 456",
      ].map((value) => [prop, value] as const),
    ),
  )("detects the country of an incoming international %s=%j", (prop, value) => {
    render(
      <form aria-label="Contact">
        <PhoneInput
          {...{ [prop]: value }}
          countries={countries}
          defaultCountry="CZ"
          label="Phone"
          name="phone"
        />
      </form>,
    );
    expect(screen.getByRole("combobox")).toHaveValue("SK");
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+421905123456");
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("phone")).toBe("+421905123456");
  });
  it("detects a formatted controlled update without changing national-number handling", () => {
    const content = (value: string) => (
      <PhoneInput
        countries={countries}
        defaultCountry="CZ"
        label="Phone"
        value={value}
      />
    );
    const { rerender } = render(content("777 123 456"));
    expect(screen.getByRole("combobox")).toHaveValue("CZ");
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+420777123456");
    rerender(content("00 (421) 905 123 456"));
    expect(screen.getByRole("combobox")).toHaveValue("SK");
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+421905123456");
    expect(screen.getByLabelText(/^Phone/)).toBeValid();
  });
  it("respects an explicitly controlled country when the value has another prefix", () => {
    render(
      <PhoneInput
        countries={countries}
        country="SK"
        label="Phone"
        value="+420777123456"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("SK");
    expect(screen.getByLabelText(/^Phone/)).toBeInvalid();
  });
  it.each([
    ["+", true],
    ["abc", true],
    ["   ", true],
    ["+", false],
    ["abc", false],
    ["   ", false],
  ])(
    "blocks a required digitless draft %j before blur with validate=%s",
    (text, validate) => {
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const { container } = render(
        <form onSubmit={onSubmit}>
          <PhoneInput
            countries={countries}
            defaultCountry="CZ"
            label="Phone"
            name="phone"
            required
            validate={validate}
          />
        </form>,
      );
      const input = screen.getByLabelText(/^Phone/);
      const form = container.querySelector("form")!;
      fireEvent.change(input, { target: { value: text } });
      expect(input).toHaveValue(text);
      act(() => form.requestSubmit());
      expect(input).toBeInvalid();
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: "777123456" } });
      act(() => form.requestSubmit());
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(new FormData(form).get("phone")).toBe("+420777123456");
    },
  );
  it("allows an optional empty number but validates a nonempty draft", () => {
    const { rerender } = render(<PhoneInput label="Phone" />);
    const input = screen.getByLabelText(/^Phone/);
    expect(input).toBeValid();
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toBeInvalid();
    fireEvent.blur(input);
    expect(input).toHaveValue("");
    expect(input).toBeValid();

    rerender(<PhoneInput label="Phone" validate={false} />);
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toBeValid();
  });
  it("validates incomplete input and resets both the value and selected country", async () => {
    const { container } = render(
      <form>
        <PhoneInput
          countries={countries}
          defaultCountry="CZ"
          defaultValue="+420777123456"
          label="Phone"
          name="phone"
          required
        />
      </form>,
    );
    const form = container.querySelector("form")!;
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: "+4211" },
    });
    expect(form.checkValidity()).toBe(false);
    act(() => form.reset());
    await waitFor(() =>
      expect(screen.getByLabelText(/^Phone/)).toHaveValue("+420777123456"),
    );
    expect(screen.getByRole("combobox")).toHaveValue("CZ");
    expect(form.checkValidity()).toBe(true);
  });
  it("follows new defaults until editing and respects a disabled fieldset", () => {
    const { container, rerender } = render(
      <form>
        <PhoneInput
          defaultCountry="CZ"
          defaultValue="777123456"
          label="Phone"
          name="phone"
        />
      </form>,
    );
    rerender(
      <form>
        <PhoneInput
          defaultCountry="CZ"
          defaultValue="777999999"
          label="Phone"
          name="phone"
        />
      </form>,
    );
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("+420777999999");
    rerender(
      <form>
        <fieldset disabled>
          <PhoneInput defaultCountry="CZ" label="Phone" name="phone" required />
        </fieldset>
      </form>,
    );
    expect(screen.getByLabelText(/^Phone/)).toBeDisabled();
    expect(new FormData(container.querySelector("form")!).has("phone")).toBe(
      false,
    );
  });
  it("keeps the national digits after the calling code a number carries when picking a country", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PhoneInput
        countries={countries}
        defaultCountry="CZ"
        label="Phone"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/^Phone/);
    const picker = screen.getByRole("combobox");
    // A calling code of a country the picker does not offer
    fireEvent.change(input, { target: { value: "+49 30 1234567" } });
    await user.selectOptions(picker, "SK");
    expect(onChange).toHaveBeenLastCalledWith("+421301234567", {
      country: "SK",
      isPossible: true,
      isValid: true,
    });
    // A calling code of no known country stays as it is
    fireEvent.change(input, { target: { value: "+7 912 345 67 89" } });
    await user.selectOptions(picker, "CZ");
    expect(onChange).toHaveBeenLastCalledWith("+79123456789", {
      country: "CZ",
      isPossible: true,
      isValid: false,
    });
    expect(picker).toHaveValue("CZ");
    fireEvent.blur(input);
    expect(input).toHaveValue("+79123456789");
    expect(input).toBeInvalid();
  });
  it("keeps the national digits of a controlled number of another country than the controlled one", async () => {
    const onChange = vi.fn();
    const onCountryChange = vi.fn();
    render(
      <PhoneInput
        countries={countries}
        country="CZ"
        label="Phone"
        onChange={onChange}
        onCountryChange={onCountryChange}
        value="+421905123456"
      />,
    );
    await userEvent.setup().selectOptions(screen.getByRole("combobox"), "SK");
    expect(onCountryChange).toHaveBeenLastCalledWith("SK");
    expect(onChange).toHaveBeenLastCalledWith("+421905123456", {
      country: "SK",
      isPossible: true,
      isValid: true,
    });
  });
  it.each([
    "‪+420 777 123 456‬",
    "⁦+420 777 123 456⁩",
    "‎+420 777 123 456‏",
    "؜00420 777 123 456",
  ])("reads a number with bidi marks %j as international", (text) => {
    const onChange = vi.fn();
    render(
      <PhoneInput
        defaultCountry="GB"
        defaultValue={text}
        label="Phone"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/^Phone/);
    expect(screen.getByRole("combobox")).toHaveValue("CZ");
    expect(input).toHaveValue("+420777123456");
    fireEvent.change(input, { target: { value: text.replace("777", "778") } });
    expect(onChange).toHaveBeenLastCalledWith("+420778123456", {
      country: "CZ",
      isPossible: true,
      isValid: true,
    });
  });
  it.each([
    ["+44 (0)20 7946 0958", "+442079460958"],
    ["0044 ( 0 ) 20 7946 0958", "+442079460958"],
    ["+(44) (0)20 7946 0958", "+442079460958"],
    // A national trunk prefix stays as typed
    ["(0)20 7946 0958", "+4402079460958"],
  ])(
    "drops the (0) after an international calling code of %j",
    (text, value) => {
      const onChange = vi.fn();
      render(
        <PhoneInput defaultCountry="GB" label="Phone" onChange={onChange} />,
      );
      fireEvent.change(screen.getByLabelText(/^Phone/), {
        target: { value: text },
      });
      expect(onChange).toHaveBeenLastCalledWith(value, {
        country: "GB",
        isPossible: true,
        isValid: true,
      });
    },
  );
  it.each([
    ["０９０１２３４５６７８", "+8109012345678"],
    ["090-１２３４-5678", "+8109012345678"],
    ["＋８１ ９０ １２３４ ５６７８", "+819012345678"],
    ["００８１（０）９０１２３４５６７８", "+819012345678"],
  ])("reads the full-width digits of %j", (text, value) => {
    const onChange = vi.fn();
    render(
      <PhoneInput defaultCountry="JP" label="Phone" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: text },
    });
    expect(onChange).toHaveBeenLastCalledWith(value, {
      country: "JP",
      isPossible: true,
      isValid: true,
    });
  });
  it("takes the main country of a shared calling code unless the selected one shares it", () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <PhoneInput
        defaultCountry="CZ"
        defaultValue="+12125551234"
        label="Phone"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("US");
    fireEvent.change(screen.getByLabelText(/^Phone/), {
      target: { value: "+12125551235" },
    });
    expect(onChange).toHaveBeenLastCalledWith("+12125551235", {
      country: "US",
      isPossible: true,
      isValid: true,
    });
    unmount();

    // Also of a list of the app's, whatever its order
    render(
      <PhoneInput
        countries={[
          { code: "CZ", callingCode: "420" },
          { code: "KZ", callingCode: "7" },
          { code: "RU", callingCode: "7" },
        ]}
        defaultCountry="CZ"
        defaultValue="+79123456789"
        label="Phone"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("RU");
  });
  it("keeps the app's ref attached while typing and picking a country", async () => {
    const user = userEvent.setup();
    const ref = vi.fn();
    render(
      <form>
        <PhoneInput
          countries={countries}
          defaultCountry="CZ"
          label="Phone"
          ref={ref}
        />
      </form>,
    );
    const input = screen.getByLabelText(/^Phone/);
    await user.type(input, "777");
    await user.selectOptions(screen.getByRole("combobox"), "SK");
    expect(ref.mock.calls).toEqual([[input]]);
  });
  it("leaves the focus in the picker with a ref that focuses the field once attached", async () => {
    const focus = (element: HTMLInputElement | null) => element?.focus();
    render(
      <PhoneInput
        countries={countries}
        defaultCountry="CZ"
        label="Phone"
        ref={focus}
      />,
    );
    const picker = screen.getByRole("combobox");
    expect(screen.getByLabelText(/^Phone/)).toHaveFocus();
    await userEvent.setup().selectOptions(picker, "SK");
    expect(picker).toHaveValue("SK");
    expect(picker).toHaveFocus();
  });
  it("renders custom country lists on the server without a DOM", () => {
    expect(
      renderToString(
        <PhoneInput
          countries={[{ code: "EG", callingCode: "20" }]}
          defaultCountry="EG"
          defaultValue="1012345678"
          label="Phone"
          name="phone"
        />,
      ),
    ).toContain("+201012345678");
  });
});
