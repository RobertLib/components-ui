import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./password-strength";

describe("getPasswordStrength", () => {
  it("scores nothing as very weak", () => {
    expect(getPasswordStrength("")).toBe(0);
  });

  it("counts little for repeats, runs, years and common words", () => {
    for (const password of [
      "aaaaaaaaaa",
      "12345678",
      "abcdefgh",
      "password",
      "P@ssw0rd",
      "Heslo2026",
      "qwertz123",
    ]) {
      expect(getPasswordStrength(password), password).toBe(0);
    }
    expect(getPasswordStrength("hello123")).toBe(1);
  });

  it("grows with the length and the kinds of characters", () => {
    expect(getPasswordStrength("kqzvmxrt")).toBe(1);
    expect(getPasswordStrength("Kq7zVm2x")).toBe(2);
    expect(getPasswordStrength("Xk9#mP2$vL")).toBe(3);
    expect(getPasswordStrength("Xk9#mP2$vLw4")).toBe(4);
    expect(getPasswordStrength("correct horse battery staple")).toBe(4);
  });

  it("counts letters of other alphabets", () => {
    expect(getPasswordStrength("Žluťoučký kůň")).toBeGreaterThanOrEqual(3);
    expect(getPasswordStrength("密码安全很重要")).toBeGreaterThanOrEqual(2);
  });
});
