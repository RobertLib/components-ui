import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CZ_MASKS } from "./cz-masks";
import Input from "./input";
import { applyMask } from "./input-mask";

const format = (preset: keyof typeof CZ_MASKS, text: string) =>
  applyMask(CZ_MASKS[preset].mask, text, CZ_MASKS[preset].maskTokens);

describe("CZ_MASKS", () => {
  it("formats a postal code and an IČO", () => {
    expect(format("postalCode", "11000")).toEqual({
      complete: true,
      formatted: "110 00",
      raw: "11000",
    });
    expect(format("ico", "45274649").complete).toBe(true);
    expect(format("ico", "4527464").complete).toBe(false);
  });

  it("takes a birth number of 10 digits, or of 9", () => {
    expect(format("birthNumber", "7801234562")).toEqual({
      complete: true,
      formatted: "780123/4562",
      raw: "7801234562",
    });
    expect(format("birthNumber", "530101/123")).toEqual({
      complete: true,
      formatted: "530101/123",
      raw: "530101123",
    });
    expect(format("birthNumber", "53010112").complete).toBe(false);
    // Digits of other scripts, as `#` takes them
    expect(format("birthNumber", "530101１２３４").raw).toBe("5301011234");
  });

  it("takes a DIČ of 8 to 10 digits, with or without CZ", () => {
    expect(format("dic", "45274649")).toEqual({
      complete: true,
      formatted: "CZ45274649",
      raw: "45274649",
    });
    expect(format("dic", "cz7801234562").formatted).toBe("CZ7801234562");
    expect(format("dic", "CZ530101123").complete).toBe(true);
    expect(format("dic", "CZ4527464").complete).toBe(false);
  });

  it("formats a Czech IBAN", () => {
    expect(format("iban", "6508000000192000145399")).toEqual({
      complete: true,
      formatted: "CZ65 0800 0000 1920 0014 5399",
      raw: "6508000000192000145399",
    });
  });

  it("spread onto Input, open a digit keyboard and fill in the postal code", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Input {...CZ_MASKS.postalCode} label="PSČ" />
        <Input {...CZ_MASKS.birthNumber} label="Rodné číslo" />
        <Input {...CZ_MASKS.dic} label="DIČ" />
      </>,
    );

    const postalCode = screen.getByRole("textbox", { name: /PSČ/ });
    expect(postalCode).toHaveAttribute("autocomplete", "postal-code");
    expect(postalCode).toHaveAttribute("inputmode", "numeric");

    const birthNumber = screen.getByRole("textbox", { name: /Rodné číslo/ });
    expect(birthNumber).toHaveAttribute("inputmode", "numeric");
    await user.type(birthNumber, "53010112");
    expect(birthNumber).toBeInvalid();
    await user.type(birthNumber, "3");
    expect(birthNumber).toHaveValue("530101/123");
    expect(birthNumber).toBeValid();
    await user.type(birthNumber, "45");
    expect(birthNumber).toHaveValue("530101/1234");

    const dic = screen.getByRole("textbox", { name: /DIČ/ });
    expect(dic).toHaveAttribute("inputmode", "numeric");
    await user.type(dic, "45274649");
    expect(dic).toHaveValue("CZ45274649");
    expect(dic).toBeValid();
  });
});
