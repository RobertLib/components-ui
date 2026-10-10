import { expect, test } from "@playwright/test";

for (const confirmation of ["Enter", "Tab", "blur"]) {
  test(`invalid date cell text stays editable on ${confirmation}`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=form-edit-regressions");
    const section = page.getByRole("region", { name: "Date cell editing" });
    await section.getByRole("cell").first().dblclick();
    const input = section.getByRole("combobox", { name: "Joined" });
    const outside = section.getByRole("textbox", {
      name: "Outside date editor",
    });
    await input.fill("02/31/2026");
    if (confirmation === "blur") await outside.click();
    else await input.press(confirmation);

    await expect(input).toHaveValue("02/31/2026");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const error = section.getByRole("alert");
    await expect(error).toContainText("02/31/2026");
    await expect(input).toHaveAttribute(
      "aria-describedby",
      (await error.getAttribute("id")) as string,
    );
    await expect(section.getByLabel("Saved cell dates")).toHaveText("[]");

    await input.fill("09/30/2026");
    if (confirmation === "blur") await outside.click();
    else await input.press(confirmation);

    await expect(section.getByLabel("Saved cell dates")).toHaveText(
      '["2026-09-30"]',
    );
    await expect(input).toHaveCount(0);
    await expect(section.getByRole("alert")).toHaveCount(0);
    if (confirmation === "Tab") {
      await expect(
        section.getByRole("textbox", { name: "Name" }),
      ).toBeFocused();
    } else if (confirmation === "blur") {
      await expect(outside).toBeFocused();
    } else {
      await expect(section.getByRole("cell").first()).toBeFocused();
    }
  });
}

test("an invalid popup draft cannot save an earlier valid date and remains keyboard correctable", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=form-edit-regressions");
  const section = page.getByRole("region", { name: "Date cell editing" });
  await section.getByRole("cell").first().dblclick();
  const input = section.getByRole("combobox", { name: "Joined" });
  const saved = section.getByLabel("Saved cell dates");
  await input.click();
  await input.fill("09/25/2026");
  await input.press("Enter");
  await expect(input).toHaveValue("09/25/2026");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(saved).toHaveText("[]");

  await input.click();
  await input.fill("02/31/2026");
  await input.press("Enter");
  await input.press("Enter");
  await expect(input).toHaveValue("02/31/2026");
  await expect(input).toBeFocused();
  await expect(section.getByRole("alert")).toContainText("02/31/2026");
  await expect(saved).toHaveText("[]");

  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(input).toHaveValue("02/31/2026");
  const selectedDay = page.getByRole("button", { name: "September 25, 2026" });
  // Opening by keyboard focuses the selected day after the popup mounts.
  // Wait for that transfer before returning to the input to test Tab.
  await expect(selectedDay).toBeFocused();
  await input.press("Tab");
  await expect(input).toBeFocused();
  await expect(saved).toHaveText("[]");
  await input.press("ArrowDown");
  await expect(selectedDay).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "September 26, 2026" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("09/26/2026");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(saved).toHaveText('["2026-09-26"]');
  await expect(input).toHaveCount(0);
});

test("a refused native file pick does not abandon a pending attachment removal", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=form-edit-regressions");
  const section = page.getByRole("region", { name: "Pending file removal" });
  const form = section.getByRole("form", { name: "Pending removal form" });
  const formState = () =>
    form.evaluate((element) => ({
      valid: (element as HTMLFormElement).checkValidity(),
      data: [...new FormData(element as HTMLFormElement)],
    }));
  const original = [["documents", "existing-id"]];
  expect(await formState()).toEqual({ valid: true, data: original });
  await section.getByRole("button", { name: "Remove existing.pdf" }).click();
  await expect(section.getByLabel("Removal pending")).toHaveText("true");
  expect(await formState()).toEqual({ valid: false, data: original });

  const picker = form.locator('input[type="file"]').first();
  await expect(picker).toHaveAttribute("accept", ".pdf");
  await picker.setInputFiles({
    name: "refused.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Only PDF files are accepted."),
  });
  await expect(section.getByLabel("Refused files")).toHaveText(
    '["refused.txt"]',
  );
  await expect(section.getByRole("alert")).toContainText("refused.txt");
  expect(await formState()).toEqual({ valid: false, data: original });
  await section.getByRole("button", { name: "Submit removal form" }).click();
  await expect(section.getByLabel("Removal form submissions")).toHaveText("0");

  await section
    .getByRole("button", { name: "Finish attachment removal" })
    .press("Enter");
  await expect(section.getByText("existing.pdf", { exact: true })).toHaveCount(
    0,
  );
  await expect.poll(formState).toEqual({ valid: true, data: [] });
  await section.getByRole("button", { name: "Submit removal form" }).click();
  await expect(section.getByLabel("Removal form submissions")).toHaveText("1");
  await expect(section.getByLabel("Submitted removal values")).toHaveText("[]");
});

for (const shadow of [false, true]) {
  test(`native FormData omits unnamed Activity choices before first reveal and after hiding${shadow ? " in a configured shadow root" : ""}`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/browser/?scenario=form-edit-regressions&initiallyHidden=true&shadow=${shadow}`,
    );
    const section = page.getByRole("region", {
      name: "Unnamed activity choices",
    });
    const form = section.getByRole("form", { name: "Unnamed activity form" });
    // Activity renders hidden content later: require all native controls so
    // an empty subtree cannot make the omission assertion pass by accident.
    await expect(form.locator('input[type="radio"]')).toHaveCount(8);
    const values = [
      ["marker", "kept"],
      ["named-radio", "a"],
      ["named-segment", "b"],
    ];
    const formData = () =>
      form.evaluate((element) => [...new FormData(element as HTMLFormElement)]);
    await expect(section.getByLabel("Unnamed choice visibility")).toHaveText(
      "hidden",
    );
    expect(await formData()).toEqual(values);
    await section
      .getByRole("button", { name: "Submit unnamed choices" })
      .click();
    await expect(section.getByLabel("Submitted unnamed choices")).toHaveText(
      JSON.stringify(values),
    );

    await section
      .getByRole("button", { name: "Toggle unnamed choices" })
      .click();
    await expect(section.getByLabel("Unnamed choice visibility")).toHaveText(
      "visible",
    );
    await section
      .getByRole("radiogroup", { name: "Unnamed radios:" })
      .getByRole("radio", { name: "Second" })
      .check();
    const segments = section.getByRole("radiogroup", {
      name: "Unnamed segments:",
    });
    await segments.getByText("First", { exact: true }).click();
    await expect(segments.getByRole("radio", { name: "First" })).toBeChecked();
    expect(await formData()).toEqual(values);
    await section
      .getByRole("button", { name: "Toggle unnamed choices" })
      .click();
    await expect(section.getByLabel("Unnamed choice visibility")).toHaveText(
      "hidden",
    );
    expect(await formData()).toEqual(values);
    await section
      .getByRole("button", { name: "Submit unnamed choices" })
      .click();
    await expect(section.getByLabel("Submitted unnamed choices")).toHaveText(
      JSON.stringify(values),
    );
  });
}
