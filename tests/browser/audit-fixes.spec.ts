import { expect, test } from "@playwright/test";

const scenario = (kind: string) =>
  `/tests/browser/?scenario=audit-fixes&kind=${kind}`;

test("a focused shadow number field steps on wheel", async ({ page }) => {
  await page.goto(scenario("number"));
  const field = page.getByRole("spinbutton", { name: "Quantity:" });
  await field.focus();
  await field.dispatchEvent("wheel", {
    bubbles: true,
    cancelable: true,
    composed: true,
    deltaY: -100,
  });
  await expect(field).toHaveValue("6");
  await expect(page.getByLabel("Changed quantity")).toHaveText("6");
});

test("clearing a controlled shadow PIN focuses its first empty cell", async ({
  page,
}) => {
  await page.goto(scenario("pin-focus"));
  const cells = page.getByRole("textbox");
  await cells.nth(3).focus();
  await cells.nth(3).press("F2");
  await expect(cells.first()).toBeFocused();
  for (const cell of await cells.all()) await expect(cell).toHaveValue("");
  await cells.first().press("1");
  await expect(cells.first()).toHaveValue("1");
  await expect(cells.nth(1)).toBeFocused();
});

test("a canceled PIN key leaves its value and callbacks unchanged", async ({
  page,
}) => {
  await page.goto(scenario("pin-cancel"));
  const first = page.getByRole("textbox").first();
  await first.focus();
  await first.press("1");
  await expect(first).toHaveValue("");
  await expect(first).toBeFocused();
  await expect(page.getByLabel("PIN changes")).toHaveText("0");
});

for (const range of [false, true]) {
  test(`an edited ${range ? "range" : "single"} slider switches mode and submits the new shape`, async ({
    page,
  }) => {
    await page.goto(scenario(range ? "slider-range" : "slider-single"));
    const sliders = page.getByRole("slider");
    await sliders.first().focus();
    await sliders.first().press("ArrowRight");
    await expect(page.getByLabel("Changed slider")).toHaveText(
      range ? "[11,50]" : "11",
    );

    await page.getByRole("button", { name: "Switch slider mode" }).click();
    await expect(sliders).toHaveCount(range ? 1 : 2);
    await expect(sliders.first()).toHaveAttribute("aria-valuenow", "10");
    if (!range) {
      await expect(sliders.nth(1)).toHaveAttribute("aria-valuenow", "50");
    }
    await expect(page.getByRole("form")).not.toContainText("NaN");
    await sliders.first().focus();
    await sliders.first().press("ArrowRight");
    await expect(page.getByLabel("Changed slider")).toHaveText(
      range ? "11" : "[11,50]",
    );
    await page.getByRole("button", { name: "Save slider" }).click();
    await expect(page.getByLabel("Submitted slider")).toHaveText(
      range ? '["11"]' : '["11","50"]',
    );
  });
}

for (const method of ["push", "replace"] as const) {
  test(`a delayed ${method} navigation updates location without the Navigation API`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "navigation", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto(scenario(`delayed-${method}`));
    const initial = new URL(page.url());
    await expect(page.getByLabel("Router location")).toHaveText(
      initial.pathname + initial.search,
    );
    await page.getByRole("button", { name: "Navigate after delay" }).click();
    await page.waitForURL("**/orders?page=2");
    await expect(page.getByLabel("Router location")).toHaveText(
      "/orders?page=2",
    );
  });
}
