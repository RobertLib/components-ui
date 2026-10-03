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
