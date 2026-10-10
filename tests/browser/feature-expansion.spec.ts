import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/?scenario=feature-expansion");
});

test("phone country, repeated fields, submit and reset", async ({ page }) => {
  const phone = page.getByRole("textbox", { name: /^Phone/ });
  await phone.fill("905 123 456");
  await page.getByRole("combobox", { name: /Country/ }).selectOption("SK");
  await page.getByRole("button", { name: "Add item" }).click();
  const contact2 = page.getByRole("textbox", { name: /^Contact 2/ });
  await expect(contact2).toBeFocused();
  await contact2.fill("Robin");
  await page.getByRole("button", { name: "Move item 2 up" }).click();
  await expect(page.getByRole("textbox", { name: /^Contact 1/ })).toHaveValue(
    "Robin",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByLabel("Saved profile")).toContainText(
    '"phone":"+421905123456"',
  );
  await expect(page.getByLabel("Saved profile")).toContainText(
    '"contacts.0.name":"Robin"',
  );
  await page.getByRole("button", { name: "Reset profile" }).click();
  await expect(phone).toHaveValue("+420777123456");
  await expect(page.getByRole("textbox", { name: /^Contact 1/ })).toHaveValue(
    "Eva",
  );
  await expect(contact2).toHaveCount(0);
});

test("required phone drafts without digits cannot submit before blur", async ({
  page,
}) => {
  const phone = page.getByRole("textbox", { name: /^Phone/ });
  const saved = page.getByLabel("Saved profile");
  for (const text of ["+", "abc", "   "]) {
    await phone.fill(text);
    await phone.press("Enter");
    await expect(saved).toHaveText("");
    await expect(phone).toBeFocused();
    expect(
      await phone.evaluate(
        (element) => (element as HTMLInputElement).validity.valid,
      ),
    ).toBe(false);
  }
  await phone.fill("777999999");
  await phone.press("Enter");
  await expect(saved).toContainText('"phone":"+420777999999"');
});

test("a controlled phone keeps its accepted country after rejected edits and external changes", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=input-validation");
  const phone = page.getByRole("textbox", { name: /^Controlled phone/ });
  const country = page.getByRole("combobox");
  const form = page.getByRole("form", { name: "Input validation" });
  const isValid = () =>
    form.evaluate((element) => (element as HTMLFormElement).checkValidity());
  await phone.fill("+421905123456");
  await expect(phone).toHaveValue("+420777123456");
  await expect(country).toHaveValue("CZ");
  expect(await isValid()).toBe(true);

  await page.getByRole("button", { name: "Replace phone" }).click();
  await expect(phone).toHaveValue("+421905123456");
  await expect(country).toHaveValue("SK");
  expect(await isValid()).toBe(true);
  await page.getByRole("button", { name: "Replace phone" }).click();
  await expect(country).toHaveValue("CZ");
  expect(await isValid()).toBe(true);
  await phone.press("Enter");
  await expect(page.getByLabel("Saved values")).toContainText(
    '"phone":"+420777123456"',
  );
});

test("an overflowing color draft blocks native submission and blur restores its previous value", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=input-validation");
  const color = page.getByRole("textbox", { name: /^Color/ });
  const form = page.getByRole("form", { name: "Input validation" });
  await color.fill("hsl(1e308turn 100% 50%)");
  await form.evaluate((element) =>
    (element as HTMLFormElement).requestSubmit(),
  );
  expect(
    await color.evaluate(
      (element) => (element as HTMLInputElement).validity.valid,
    ),
  ).toBe(false);
  await expect(page.getByLabel("Saved values")).toHaveText("");
  await color.press("Tab");
  await expect(color).toHaveValue("#ff0000");
  await expect(page.getByRole("alert")).toContainText("is not a color");
  await form.evaluate((element) =>
    (element as HTMLFormElement).requestSubmit(),
  );
  await expect(page.getByLabel("Saved values")).toContainText(
    '"color":"#ff0000"',
  );
});

for (const controlled of [false, true]) {
  test(`prefilled ${controlled ? "controlled" : "uncontrolled"} inputs normalize values and validate external updates`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/browser/?scenario=prefilled-inputs&controlled=${controlled}`,
    );
    const form = page.getByRole("form", { name: "Prefilled inputs" });
    const color = page.getByRole("textbox", { name: /^Color/ });
    const saved = page.getByLabel("Saved values");
    const submissions = page.getByLabel("Submissions");
    const submit = () =>
      form.evaluate((element) => (element as HTMLFormElement).requestSubmit());
    await expect(page.getByRole("combobox")).toHaveValue("SK");
    await expect(page.getByRole("textbox", { name: /^Phone/ })).toHaveValue(
      "+421905123456",
    );
    await expect(color).toHaveValue("rgb(255, 0, 0)");
    await submit();
    await expect(submissions).toHaveText("1");
    await expect(saved).toContainText('"phone":"+421905123456"');
    await expect(saved).toContainText('"color":"rgb(255, 0, 0)"');

    await page.getByRole("button", { name: "Toggle alpha" }).click();
    await expect(color).toHaveValue("rgba(255, 0, 0, 0.5)");
    await submit();
    await expect(submissions).toHaveText("2");
    await expect(saved).toContainText('"color":"rgba(255, 0, 0, 0.5)"');

    for (const button of ["Load invalid color", "Load empty color"]) {
      // Keyboard activation moves focus away from the invalid field, so
      // Firefox's native validation popup cannot intercept a pointer click.
      await page.getByRole("button", { name: button }).press("Enter");
      await expect(color).toHaveValue(
        button === "Load invalid color" ? "hsl(1e308turn 100% 50%)" : "",
      );
      await submit();
      await expect(submissions).toHaveText("2");
      expect(
        await color.evaluate(
          (element) => (element as HTMLInputElement).validity.valid,
        ),
      ).toBe(false);
    }
    await page.getByRole("button", { name: "Load valid color" }).press("Enter");
    await expect(color).toHaveValue("rgba(255, 0, 0, 0.5)");
    await submit();
    await expect(submissions).toHaveText("3");
    await expect(saved).toContainText('"color":"rgba(255, 0, 0, 0.5)"');
  });
}

test("retained steps keep nodes, file selections and values across layout changes", async ({
  page,
}) => {
  const name = page.getByRole("textbox", { name: /^Name/ });
  await name.fill("Robin");
  await name.evaluate((element) =>
    element.setAttribute("data-retained-check", "same"),
  );
  await page.getByRole("button", { name: "2. Documents" }).click();
  const file = page.getByLabel(/^Document:/);
  await file.setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("note"),
  });
  await page.getByRole("button", { name: "3. Review" }).click();
  await page.setViewportSize({ width: 480, height: 900 });
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.getByRole("button", { name: "1. Details" }).click();
  await expect(name).toHaveValue("Robin");
  await expect(name).toHaveAttribute("data-retained-check", "same");
  await page.getByRole("button", { name: "2. Documents" }).click();
  expect(
    await file.evaluate(
      (element: HTMLInputElement) => element.files?.[0]?.name,
    ),
  ).toBe("note.txt");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByLabel("Saved profile")).toContainText(
    '"name":"Robin"',
  );
});

test("native validation reveals an invalid inactive step", async ({ page }) => {
  const name = page.getByRole("textbox", { name: /^Name/ });
  await name.fill("");
  await page.getByRole("button", { name: "3. Review" }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(name).toBeVisible();
  await expect(name).toBeFocused();
  await expect(page.getByLabel("Saved profile")).toHaveText("");
});

test("menubar switches open menus, handles submenus and restores focus", async ({
  page,
}) => {
  const file = page.getByRole("menuitem", { name: "File", exact: true });
  await file.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "New", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(page.getByRole("menu")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("menuitem", { name: "Copy", exact: true }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(page.getByLabel("Command", { exact: true })).toHaveText("copy");
  await expect(
    page.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeFocused();
  await file.click();
  const exp = page.getByRole("menuitem", { name: "Export", exact: true });
  await page.getByRole("menu").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("menuitem", { name: "PDF", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Escape");
  await expect(exp).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Escape");
  await expect(file).toBeFocused();
});

test("custom editor tools insert sanitized HTML at the selection and join undo history", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: /^Message/ });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "Insert signature", exact: true })
    .click();
  await expect(editor).toContainText("Support");
  expect(await editor.locator("script").count()).toBe(0);
  await expect(editor.locator("em")).toHaveText("Support");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveText("Hello");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor).toContainText("Support");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Control+Shift+S");
  await expect(editor).toContainText("!");
});

test("nested group virtualization scrolls to later groups and collapses their descendants", async ({
  page,
}) => {
  const table = page.getByRole("table", { name: "Grouped people" });
  await expect(table).toHaveAttribute("aria-rowcount", "362");
  const body = table.locator("tbody");
  expect(await body.locator("tr[data-row-index]").count()).toBeLessThan(100);
  await page
    .getByRole("button", { name: "Team: Team 0 (30 rows)", exact: true })
    .click();
  await expect(table).toHaveAttribute("aria-rowcount", "328");
  await expect(page.getByText("Person 0", { exact: true })).toHaveCount(0);
  const scroller = table.locator("..");
  await scroller.evaluate(
    (element) => (element.scrollTop = element.scrollHeight),
  );
  await expect(page.getByText("Person 299", { exact: true })).toBeVisible();
});

test("donut controls fit the viewport and the feature layout has no horizontal overflow", async ({
  page,
}, testInfo) => {
  const chart = page.getByRole("region", { name: "Market share" });
  await chart.getByRole("button", { name: "Small", exact: true }).click();
  await expect(chart.getByRole("img")).toHaveCount(1);
  await chart.getByRole("button", { name: "Large", exact: true }).click();
  await expect(chart.getByText("No chart data")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("features.png"),
    fullPage: true,
  });
});

test("dropped directories retain nested paths and a reset ignores pending reads", async ({
  page,
}) => {
  const form = page.getByRole("form", { name: "Folder upload" });
  await form.evaluate((element) => {
    const fileEntry = (name: string) => ({
      name,
      isFile: true,
      isDirectory: false,
      file: (resolve: (file: File) => void) =>
        resolve(new File(["data"], name, { type: "text/plain" })),
    });
    const nested = {
      name: "nested",
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let sent = false;
        return {
          readEntries: (resolve: (entries: unknown[]) => void) => {
            resolve(sent ? [] : [fileEntry("b.txt")]);
            sent = true;
          },
        };
      },
    };
    const root = {
      name: "root",
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let batch = 0;
        return {
          readEntries: (resolve: (entries: unknown[]) => void) =>
            resolve([[fileEntry("a.txt")], [nested], []][batch++] ?? []),
        };
      },
    };
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: {
        types: ["Files"],
        files: [],
        items: [{ kind: "file", webkitGetAsEntry: () => root }],
      },
    });
    element.querySelector("[role=group]")?.dispatchEvent(event);
  });
  await expect(
    form.getByText("root/nested/b.txt", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save folder", exact: true }).click();
  await expect(page.getByLabel("Folder paths")).toHaveText(
    "root/a.txt,root/nested/b.txt",
  );
  await page.getByRole("button", { name: "Reset folder", exact: true }).click();
  await expect(form.getByText("root/a.txt", { exact: true })).toHaveCount(0);
  await form.evaluate((element) => {
    const host = window as typeof window & { finishDirectoryRead?: () => void };
    const root = {
      name: "late",
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (resolve: (entries: unknown[]) => void) => {
          host.finishDirectoryRead = () =>
            resolve([
              {
                name: "late.txt",
                isFile: true,
                isDirectory: false,
                file: (done: (file: File) => void) =>
                  done(new File(["late"], "late.txt")),
              },
            ]);
        },
      }),
    };
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: {
        types: ["Files"],
        files: [],
        items: [{ kind: "file", webkitGetAsEntry: () => root }],
      },
    });
    element.querySelector("[role=group]")?.dispatchEvent(event);
  });
  expect(
    await form.evaluate((element) =>
      (element as HTMLFormElement).checkValidity(),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Reset folder", exact: true }).click();
  await expect
    .poll(() =>
      form.evaluate((element) => (element as HTMLFormElement).checkValidity()),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const host = window as typeof window & { finishDirectoryRead?: () => void };
    host.finishDirectoryRead?.();
    await Promise.resolve();
  });
  await expect(form.getByText("late/late.txt", { exact: true })).toHaveCount(0);
});
