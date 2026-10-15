import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import useCzValidators from "./use-cz-validators";
import Input from "../components/ui/input";
import { CZ_MASKS } from "../components/ui/cz-masks";
import { cs } from "../i18n/ui/cs";
import { en } from "../i18n/ui/en";
import type { Locale } from "../i18n/ui/types";
import UIProvider from "../providers/ui-provider";

/** The validators in `locale` - `setLocale` and `rerender` switch it. */
function renderValidators(initialLocale: Locale) {
  let locale = initialLocale;
  const rendered = renderHook(() => useCzValidators(), {
    wrapper: ({ children }) => (
      <UIProvider locale={locale}>{children}</UIProvider>
    ),
  });
  const setLocale = (next: Locale) => {
    locale = next;
  };
  return { ...rendered, setLocale };
}

describe("useCzValidators", () => {
  it("says in Czech what is invalid", () => {
    const cz = renderValidators(cs).result.current;

    expect(cz.bankAccount("19-2000145398/0800")).toBe(
      "Zadejte platné číslo účtu.",
    );
    expect(cz.birthNumber("780123/4561")).toBe("Zadejte platné rodné číslo.");
    expect(cz.dic("CZ45274648")).toBe("Zadejte platné DIČ.");
    expect(cz.iban("CZ6608000000192000145399")).toBe("Zadejte platný IBAN.");
    expect(cz.ico("45274648")).toBe("Zadejte platné IČO.");
    expect(cz.postalCode("811 01")).toBe("Zadejte platné PSČ.");
  });

  it("says it in English", () => {
    const cz = renderValidators(en).result.current;

    expect(cz.bankAccount("1/0800")).toBe("Enter a valid account number.");
    expect(cz.birthNumber("1")).toBe("Enter a valid birth number.");
    expect(cz.dic("1")).toBe("Enter a valid tax ID (DIČ).");
    expect(cz.iban("1")).toBe("Enter a valid IBAN.");
    expect(cz.ico("1")).toBe("Enter a valid company ID (IČO).");
    expect(cz.postalCode("1")).toBe("Enter a valid postal code.");
  });

  it("returns nothing for a valid or an empty value", () => {
    const cz = renderValidators(cs).result.current;

    expect(cz.bankAccount("19-2000145399/0800")).toBeUndefined();
    expect(cz.birthNumber("780123/4562")).toBeUndefined();
    expect(cz.dic("CZ45274649")).toBeUndefined();
    expect(cz.iban("CZ65 0800 0000 1920 0014 5399")).toBeUndefined();
    expect(cz.ico("45274649")).toBeUndefined();
    expect(cz.postalCode("110 00")).toBeUndefined();

    // An empty field is up to `required`
    for (const value of ["", "  ", null, undefined]) {
      expect(cz.ico(value)).toBeUndefined();
    }
  });

  it("keeps the checks while the locale stays", () => {
    const { rerender, result, setLocale } = renderValidators(cs);
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);

    setLocale(en);
    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current.ico("1")).toBe("Enter a valid company ID (IČO).");
  });

  it("makes an Input invalid with the message of the locale", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    function CompanyForm() {
      const cz = useCzValidators();
      return (
        <form onSubmit={onSubmit}>
          <Input {...CZ_MASKS.ico} label="IČO" name="ico" validate={cz.ico} />
          <button type="submit">Uložit</button>
        </form>
      );
    }

    render(
      <UIProvider locale={cs}>
        <CompanyForm />
      </UIProvider>,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: /IČO/,
    });
    await user.type(input, "45274648");
    expect(input.validationMessage).toBe("Zadejte platné IČO.");
    await user.click(screen.getByRole("button", { name: "Uložit" }));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(input, "{Backspace}9");
    expect(input).toBeValid();
    await user.click(screen.getByRole("button", { name: "Uložit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
