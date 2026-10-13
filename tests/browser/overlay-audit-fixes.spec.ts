import { expect, test } from "@playwright/test";

const scenario = (kind: string) =>
  `/tests/browser/?scenario=overlay-audit-fixes&kind=${kind}`;

test("disabling a dropdown's fieldset closes its portaled menu", async ({
  page,
}) => {
  await page.goto(scenario("fieldset"));
  const trigger = page.getByRole("button", { name: "Actions", exact: true });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Disable actions" }).click();
  await expect(trigger).toBeDisabled();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByLabel("Menu open")).toHaveText("false");
  await expect(page.getByLabel("Delete count")).toHaveText("0");
  await page.getByRole("button", { name: "Enable actions" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.getByLabel("Delete count")).toHaveText("1");
});

test("a dropdown in the first legend stays enabled", async ({ page }) => {
  await page.goto(scenario("fieldset-legend"));
  const trigger = page.getByRole("button", { name: "Actions", exact: true });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Disable actions" }).click();
  await expect(trigger).toBeEnabled();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.getByLabel("Delete count")).toHaveText("1");
});

for (const kind of ["hidden", "hidden-autofocus", "shadow-hidden"]) {
  test(`${kind} custom modal returns focus to each reveal opener`, async ({
    page,
  }) => {
    await page.goto(scenario(kind));
    await page
      .getByTestId("retained-overlay-commit")
      .waitFor({ state: "attached" });
    for (const name of ["Show filters", "Show other filters"]) {
      const trigger = page.getByRole("button", { name, exact: true });
      await trigger.click();
      const field = page.getByRole("textbox", { name: "Custom search" });
      await expect(field).toBeFocused();
      await field.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });
}

test("a child dialog returns focus after its custom modal parent closes", async ({
  page,
}) => {
  await page.goto(scenario("nested-modal"));
  const trigger = page.getByRole("button", { name: "Open filters" });
  await trigger.click();
  await page.getByRole("button", { name: "Confirm action" }).click();
  await expect(
    page.getByRole("textbox", { name: "Child field" }),
  ).toBeFocused();
  const closeParent = page.getByRole("button", { name: "Close parent" });
  await closeParent.click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toHaveCount(0);
  await closeParent.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
