import { expect, test } from "@playwright/test";

test("chart keyboard points, legend and data disclosure", async ({
  page,
}, testInfo) => {
  await page.goto("/tests/browser/?scenario=new-components");
  const first = page.getByRole("img", { name: "January: Sales 10, Cost 5" });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("img", { name: "February: Sales 20, Cost 12" }),
  ).toBeFocused();
  await expect(page.getByText("Sales: 20", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cost", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cost", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByText("Show data table").click();
  await expect(
    page.getByRole("table", { name: "Monthly results" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("new-components.png"),
    fullPage: true,
  });
});

test("transfer native validation, limits, submit and reset", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=new-components");
  await page.getByRole("button", { name: "Save members" }).click();
  await expect(page.getByText("Select at least 1 item.")).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search available items" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Add all visible items" }).click();
  await expect(
    page.getByRole("button", { name: "Add all visible items" }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("list", { name: "Available", exact: true })
      .getByRole("checkbox", { name: "Locked" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save members" }).click();
  await expect(page.getByLabel("Saved members")).toHaveText("a,b");
  await page.getByRole("button", { name: "Reset members" }).click();
  await expect(
    page.getByRole("list", { name: "Selected", exact: true }),
  ).toHaveText("No items");
});

test("gallery loads, zooms, navigates and restores focus", async ({
  page,
}, testInfo) => {
  await page.goto("/tests/browser/?scenario=new-components");
  const trigger = page.getByRole("button", { name: "Open gallery" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Picture gallery" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Teal picture" })).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await expect(dialog.getByText("150%")).toBeVisible();
  await dialog.getByRole("button", { name: "Next image" }).click();
  await expect(dialog.getByText("Second caption")).toBeVisible();
  await expect(dialog.getByText("100%")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(dialog.getByText("First caption")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("gallery.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("a Prague recurrence retains 9:00 in a New York browser", async ({
  browser,
}) => {
  const context = await browser.newContext({ timezoneId: "America/New_York" });
  const page = await context.newPage();
  await page.goto("/tests/browser/?scenario=named-zone");
  await expect(
    page.getByRole("button", { name: /^Prague meeting,/ }),
  ).toHaveAccessibleName(/9:00.*10:00/);
  await context.close();
});
