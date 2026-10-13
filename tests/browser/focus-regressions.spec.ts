import { expect, test } from "@playwright/test";

const scenario = (kind: string) =>
  `/tests/browser/?scenario=focus-regressions&kind=${kind}`;

test("initially hidden dialogs leave shortcuts available and work after reveal", async ({
  page,
}) => {
  await page.goto(scenario("hidden-dialog"));
  await page.getByTestId("hidden-dialog-commit").waitFor({ state: "attached" });
  await page.locator("body").press("F2");
  await expect(page.getByLabel("Shortcut count")).toHaveText("1");

  const trigger = page.getByRole("button", { name: "Show retained dialog" });
  await trigger.click();
  const field = page.getByRole("textbox", { name: "Retained field:" });
  await expect(field).toBeFocused();
  await field.press("F2");
  await expect(page.getByLabel("Shortcut count")).toHaveText("1");
  await field.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press("F2");
  await expect(page.getByLabel("Shortcut count")).toHaveText("2");
});

test("opening a hidden popover leaves visible dialog Escape available", async ({
  page,
}) => {
  await page.goto(scenario("hidden-popover"));
  await expect(
    page.getByRole("textbox", { name: "Visible field:" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open hidden layer" }).click();
  await expect(page.getByTestId("hidden-popover-commit")).toHaveAttribute(
    "data-open",
    "true",
  );
  await page.getByRole("textbox", { name: "Visible field:" }).press("Escape");
  await expect(page.getByLabel("Close count")).toHaveText("1");
});

test("closing the last shadow tab moves focus to its neighbor", async ({
  page,
}) => {
  await page.goto(scenario("tabs"));
  const last = page.getByRole("tab", { name: "B", exact: true });
  await last.focus();
  await last.press("Delete");
  await expect(last).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "A", exact: true })).toBeFocused();
});

test("advancing a shadow stepper focuses the new content", async ({ page }) => {
  await page.goto(scenario("stepper"));
  const next = page.getByRole("button", { name: "Next", exact: true });
  await next.focus();
  await next.press("Enter");
  await expect(page.getByRole("group", { name: "2. B" })).toBeFocused();
});

test("a shadow Field label focuses its custom control", async ({ page }) => {
  await page.goto(scenario("field"));
  await page.locator("label").click();
  await expect(page.getByRole("slider", { name: "Volume:" })).toBeFocused();
});

test("deleting inside a shadow masked input preserves the caret", async ({
  page,
}) => {
  await page.goto(scenario("input-mask"));
  const input = page.getByRole("textbox", { name: "Masked value:" });
  await input.focus();
  await input.evaluate((element) =>
    (element as HTMLInputElement).setSelectionRange(4, 4),
  );
  await input.press("Backspace");
  await expect(input).toHaveValue("124 5");
  expect(
    await input.evaluate(
      (element) => (element as HTMLInputElement).selectionStart,
    ),
  ).toBe(2);
});

test("shadow tag suggestions follow keyboard highlighting into view", async ({
  page,
}) => {
  await page.goto(scenario("tags"));
  const input = page.getByRole("combobox", { name: "Suggested tags:" });
  await input.fill("Suggestion");
  const first = page.getByRole("option", {
    name: "Suggestion 00",
    exact: true,
  });
  const last = page.getByRole("option", { name: "Suggestion 49", exact: true });
  await expect(last).not.toBeInViewport();
  await input.press("ArrowDown");
  await input.press("ArrowUp");
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(last).toBeInViewport();
  await input.press("ArrowDown");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(first).toBeInViewport();
});

test("a canceled slider key leaves its value and callbacks unchanged", async ({
  page,
}) => {
  await page.goto(scenario("slider"));
  const slider = page.getByRole("slider", { name: "Volume:" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByLabel("Slider changes")).toHaveText("0");
});

test.describe("zoned date editing", () => {
  test.use({ timezoneId: "Europe/Prague" });
  test("saves the selected day in the cell's original time zone", async ({
    page,
  }) => {
    await page.goto(scenario("zoned-date"));
    await page.getByRole("cell").dblclick();
    const input = page.getByRole("combobox", { name: "Joined" });
    await expect(input).toHaveValue("09/24/2026");
    await input.fill("09/26/2026");
    await input.press("Enter");
    await expect(page.getByLabel("Saved date")).toHaveText(
      "2026-09-27T03:00:00.000Z|America/New_York",
    );
  });
});
