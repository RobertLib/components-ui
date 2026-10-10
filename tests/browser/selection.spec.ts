import { expect, test } from "@playwright/test";

test("a failed submit focuses a required Autocomplete and TreeSelect", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=required-selects");
  const save = page.getByRole("button", { name: "Save selects" });
  const city = page.getByRole("combobox", { name: "City:" });
  const category = page.getByRole("combobox", { name: /Category/ });

  // The browser focuses the hidden validation input - in Safari too - and
  // the field takes the focus over, at every submit (in Firefox only when it
  // does so once the browser is done)
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(city).toBeFocused();
    await expect(city).toHaveAttribute("aria-expanded", "false");
  }

  await city.click();
  await page.getByRole("option", { name: "Praha" }).click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(category).toBeFocused();
  }

  await category.click();
  await page.getByRole("treeitem", { name: "Garden" }).click();
  await save.click();
  await expect(page.getByLabel("Saved selects")).toHaveText(
    JSON.stringify({ city: "praha", category: "garden" }),
  );
});

test("a failed submit focuses a required Rating, DateCalendar and RepeatableField", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=required-fields");
  const save = page.getByRole("button", { name: "Save fields" });
  const score = page.getByRole("slider", { name: /Score/ });
  const day = page.locator("[data-focused-day='true']");
  const notes = page.getByRole("group", { name: "Notes" });

  // Each takes the focus over from its validation input at every submit -
  // Firefox focuses that input again only when it was let be at first
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(score).toBeFocused();
  }

  await score.press("ArrowRight");
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(day).toBeFocused();
  }

  await day.click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(notes).toBeFocused();
    await expect(notes).toContainText("Add at least 1 item.");
  }

  await page.getByRole("button", { name: "Add item" }).click();
  await save.click();
  await expect(page.getByLabel("Saved fields")).toContainText('"score":"1"');
});
