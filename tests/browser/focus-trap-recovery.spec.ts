import { expect, test } from "@playwright/test";

for (const state of ["disabled", "hidden"] as const) {
  test(`dialog recovers focus when its previous control becomes ${state}`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=footer-form");
    const dialog = page.getByRole("dialog", { name: "Edit name" });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((panel, state) => {
      const save = panel.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )!;
      const behind = document.createElement("button");
      behind.textContent = "Behind dialog";
      document.querySelector("main")!.append(behind);
      save.focus();
      if (state === "disabled") save.disabled = true;
      else save.hidden = true;
      behind.focus();
    }, state);
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeFocused();
  });
}

test("dialog recovers focus on its panel when no control can receive it", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=footer-form");
  const dialog = page.getByRole("dialog", { name: "Edit name" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((panel) => {
    panel.querySelector<HTMLButtonElement>('button[type="submit"]')!.focus();
    for (const control of panel.querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >("button, input")) {
      control.disabled = true;
    }
    const behind = document.createElement("button");
    behind.textContent = "Behind dialog";
    document.querySelector("main")!.append(behind);
    behind.focus();
  });
  await expect(dialog).toBeFocused();
});

test("dialog keeps a shadow target outside the tab order as its return target", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=footer-form");
  const dialog = page.getByRole("dialog", { name: "Edit name" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((panel) => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const instructions = document.createElement("p");
    instructions.textContent = "Shadow instructions";
    instructions.tabIndex = -1;
    shadow.append(instructions);
    panel.append(host);
    instructions.focus();
    const behind = document.createElement("button");
    behind.textContent = "Behind dialog";
    document.querySelector("main")!.append(behind);
    behind.focus();
  });
  await expect(dialog.getByText("Shadow instructions")).toBeFocused();
});
