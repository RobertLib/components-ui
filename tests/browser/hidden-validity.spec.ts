import { expect, test } from "@playwright/test";

for (const kind of ["number", "date", "tags"]) {
  for (const shadow of [false, true]) {
    test(`an initially hidden ${kind} blocks invalid submission${shadow ? " in a shadow root" : ""}`, async ({
      page,
    }) => {
      await page.goto(
        `/tests/browser/?scenario=hidden-validity&kind=${kind}&shadow=${shadow}`,
      );
      // Activity initially renders its hidden children at lower priority.
      // Wait for the actual form control before checking native validity.
      await expect(
        page.locator('input[name="value"], input[type="text"]'),
      ).not.toHaveCount(0);
      const submit = page.getByRole("button", { name: "Check and submit" });
      await submit.click();
      await expect(page.getByLabel("Validity")).toHaveText("false");
      await expect(page.getByLabel("Submissions")).toHaveText("0");
      await page.getByRole("button", { name: "Correct value" }).click();
      await submit.click();
      await expect(page.getByLabel("Validity")).toHaveText("true");
      await expect(page.getByLabel("Submissions")).toHaveText("1");
    });
  }
}
