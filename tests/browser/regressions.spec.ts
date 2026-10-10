import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

for (const [kind, valid] of [
  ["date", "2026-09-24"],
  ["time", "09:30"],
  ["datetime-local", "2026-09-24T09:30"],
  ["month", "2026-09"],
  ["week", "2026-W39"],
]) {
  test(`invalid loaded ${kind} values are empty for display, validation and submission`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/browser/?scenario=loaded-picker-value&kind=${kind}`,
    );
    const form = page.getByRole("form", { name: "Loaded picker form" });
    const required = page.getByRole("combobox", { name: "Required value:" });
    const optional = page.getByRole("combobox", { name: "Optional value:" });
    const formState = () =>
      form.evaluate((element) => ({
        valid: (element as HTMLFormElement).checkValidity(),
        data: [...new FormData(element as HTMLFormElement)],
      }));
    await expect(required).toHaveValue("");
    await expect(optional).toHaveValue("");
    expect(await formState()).toEqual({
      valid: false,
      data: [
        ["required", ""],
        ["optional", ""],
      ],
    });

    await page.getByRole("button", { name: "Load valid value" }).click();
    await expect(required).not.toHaveValue("");
    expect(await formState()).toEqual({
      valid: true,
      data: [
        ["required", valid],
        ["optional", valid],
      ],
    });
    await page.getByRole("button", { name: "Submit loaded values" }).click();
    await expect(page.getByLabel("Submitted picker values")).toHaveText(
      JSON.stringify([
        ["required", valid],
        ["optional", valid],
      ]),
    );

    await page.getByRole("button", { name: "Load invalid value" }).click();
    await expect(required).toHaveValue("");
    expect(await formState()).toEqual({
      valid: false,
      data: [
        ["required", ""],
        ["optional", ""],
      ],
    });
  });
}

test("a backdrop press dismisses the menu before the mobile drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/?scenario=drawer-menu");
  await page.getByRole("button", { name: "Open drawer" }).click();
  const drawer = page.getByRole("dialog", { name: "Main navigation" });
  await expect(drawer).toBeVisible();
  await page.getByRole("button", { name: "Drawer actions" }).click();
  await expect(page.getByRole("menu")).toBeVisible();

  await page.mouse.click(380, 650);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await page.mouse.click(380, 650);
  await expect(drawer).toHaveCount(0);
});

for (const key of ["Escape", "F2"]) {
  test(`closing a popover with ${key} returns focus from a shadow field`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=shadow-popover");
    const trigger = page.getByRole("button", { name: "Open shadow panel" });
    await trigger.click();
    const field = page.getByRole("textbox", { name: "Shadow field" });
    await field.focus();
    await expect(field).toBeFocused();
    await field.press(key);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("tree and editor toolbar navigation follow focus inside a shadow root", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=shadow-keyboard");
  const tree = page.getByRole("tree", { name: "Shadow tree" });
  const one = tree.getByRole("treeitem", { name: "One", exact: true });
  const two = tree.getByRole("treeitem", { name: "Two", exact: true });
  const three = tree.getByRole("treeitem", { name: "Three", exact: true });
  await one.focus();
  await one.press("ArrowDown");
  await expect(two).toBeFocused();
  await two.press("ArrowDown");
  await expect(three).toBeFocused();
  await three.press("Home");
  await expect(one).toBeFocused();

  const bold = page.locator("[data-tool='bold']");
  const italic = page.locator("[data-tool='italic']");
  const underline = page.locator("[data-tool='underline']");
  await bold.focus();
  await bold.press("ArrowRight");
  await expect(italic).toBeFocused();
  await italic.press("End");
  await expect(underline).toBeFocused();
  await underline.press("Home");
  await expect(bold).toBeFocused();
});

test("removing tags and attachments preserves focus inside a shadow root", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=shadow-keyboard");
  const removeBeta = page.getByRole("button", {
    name: "Remove beta",
    exact: true,
  });
  const removeAlpha = page.getByRole("button", {
    name: "Remove alpha",
    exact: true,
  });
  await removeBeta.focus();
  await removeBeta.press("Delete");
  await expect(removeBeta).toHaveCount(0);
  await expect(removeAlpha).toBeFocused();
  await removeAlpha.press("Delete");
  await expect(
    page.getByRole("textbox", { name: "Shadow tags:" }),
  ).toBeFocused();

  const removeA = page.getByRole("button", {
    name: "Remove a.pdf",
    exact: true,
  });
  const removeB = page.getByRole("button", {
    name: "Remove b.pdf",
    exact: true,
  });
  await removeA.focus();
  await removeA.press("Enter");
  await expect(removeA).toHaveCount(0);
  await expect(removeB).toBeFocused();
});

test("keyboard-highlighted shadow commands scroll into view", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=shadow-keyboard");
  await page.getByRole("button", { name: "Open shadow commands" }).click();
  const search = page.getByRole("combobox", {
    name: "Type a command or search…",
  });
  const first = page.getByRole("option", { name: "Command 0", exact: true });
  const last = page.getByRole("option", { name: "Command 79", exact: true });
  await expect(last).not.toBeInViewport();
  await search.press("End");
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(last).toBeInViewport();
  await search.press("Home");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(first).toBeInViewport();
});

for (const timeline of [false, true]) {
  for (const change of ["resources", "date"]) {
    test(`changing ${change} cancels keyboard selection in ${timeline ? "timeline" : "day"} view`, async ({
      page,
    }) => {
      await page.goto(
        `/tests/browser/?scenario=calendar-keyboard&timeline=${timeline}`,
      );
      const slot = page.locator("[data-slot='0-0']");
      await slot.focus();
      await slot.press(timeline ? "Shift+ArrowRight" : "Shift+ArrowDown");
      await expect(page.getByText(/^Selected: Room A,/)).toHaveCount(1);
      await page.keyboard.press(change === "resources" ? "F2" : "F3");
      await expect(page.getByText(/^Selected:/)).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByLabel("Keyboard slot ranges")).toHaveText("0");

      // The updated grid can still start and commit a fresh range.
      await page.locator("[data-slot='0-0']").focus();
      await page.keyboard.press(
        timeline ? "Shift+ArrowRight" : "Shift+ArrowDown",
      );
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Keyboard slot ranges")).toHaveText("1");
    });
  }
}

for (const allDisabled of [false, true]) {
  test(`a required checkbox group with ${allDisabled ? "disabled" : "empty"} choices blocks native submission and focuses its group`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `/tests/browser/?scenario=empty-checkbox-group&allDisabled=${allDisabled}`,
    );
    const group = page.getByRole("group", { name: "Channels:" });
    const submissions = page.getByLabel("Submissions");

    await page.getByRole("button", { name: "Report validity" }).click();
    await expect(page.getByLabel("Reported validity")).toHaveText("false");
    await expect(group).toBeFocused();
    await page.getByRole("button", { name: "Request submit" }).click();
    await expect(submissions).toHaveText("[]");
    await expect(group).toBeFocused();
    await page.getByRole("button", { name: "Native submit" }).click();
    await expect(submissions).toHaveText("[]");
    await expect(group).toBeFocused();

    await page.getByRole("button", { name: "Enable choices" }).click();
    await page.getByRole("button", { name: "Request submit" }).click();
    await expect(submissions).toHaveText("[]");
    const email = page.getByRole("checkbox", { name: "Email" });
    await expect(email).toBeFocused();
    await email.check();
    await page.getByRole("button", { name: "Report validity" }).click();
    await expect(page.getByLabel("Reported validity")).toHaveText("true");
    await page.getByRole("button", { name: "Request submit" }).click();
    await expect(submissions).toHaveText('[["email"]]');
    await page.getByRole("button", { name: "Native submit" }).click();
    await expect(submissions).toHaveText('[["email"],["email"]]');
    expect(errors).toEqual([]);
  });
}

test("a large finite percentage keeps its value while editing and submitting", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=large-percent-number");
  const input = page.getByRole("spinbutton", { name: "Percentage:" });
  const form = page.getByRole("form", { name: "Large percentage form" });
  const submittedValue = () =>
    form.evaluate((element) =>
      Number(new FormData(element as HTMLFormElement).get("percentage")),
    );

  await expect.poll(submittedValue).toBe(1e307);
  await input.focus();
  await expect(input).toHaveValue("1" + "0".repeat(309));
  await input.fill("2" + "0".repeat(309));
  await expect(page.getByLabel("Percentage changes")).toHaveText("[2e+307]");
  await expect.poll(submittedValue).toBe(2e307);

  await page.getByRole("button", { name: "Move focus" }).click();
  await expect.poll(submittedValue).toBe(2e307);
  await expect(input).not.toHaveValue(/Infinity|∞|^0\s*%$/);
  await expect(page.getByLabel("Percentage changes")).toHaveText("[2e+307]");
});

for (const controlled of [false, true]) {
  test(`${controlled ? "A controlled" : "An uncontrolled"} PIN keeps its IME draft until composition ends`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/browser/?scenario=pin-composition&controlled=${controlled}`,
    );
    const first = page.getByRole("textbox", { name: "Digit 1 of 4" });
    const third = page.getByRole("textbox", { name: "Digit 3 of 4" });
    const form = page.getByRole("form", { name: "Code form" });
    const submittedCode = () =>
      form.evaluate((element) =>
        new FormData(element as HTMLFormElement).get("code"),
      );
    await first.focus();

    await first.evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(element, "12");
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "12",
          inputType: "insertCompositionText",
          isComposing: true,
        }),
      );
    });

    await expect(first).toHaveValue("12");
    await expect(first).toBeFocused();
    await expect(page.getByLabel("Code changes")).toHaveText("[]");
    await expect(page.getByLabel("Completed codes")).toHaveText("[]");
    expect(await submittedCode()).toBe("");

    await first.evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent("compositionend", {
          bubbles: true,
          data: "12",
        }),
      );
    });
    await expect(page.getByLabel("Code changes")).toHaveText('["12"]');
    await expect(first).toHaveValue("1");
    await expect(third).toBeFocused();
    expect(await submittedCode()).toBe("12");

    // Some input methods deliver a final input event after compositionend.
    await first.evaluate((element) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(element, "12");
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "12",
          inputType: "insertCompositionText",
          isComposing: false,
        }),
      );
    });
    await expect(page.getByLabel("Code changes")).toHaveText('["12"]');
    await expect(first).toHaveValue("1");
    await expect(third).toBeFocused();
    expect(await submittedCode()).toBe("12");

    await page.keyboard.type("34");
    await expect(page.getByLabel("Completed codes")).toHaveText('["1234"]');
    expect(await submittedCode()).toBe("1234");
  });
}

test("a phone edit after composition does not reuse the previous IME completion", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=pin-composition&controlled=true");
  const first = page.getByRole("textbox", { name: "Digit 1 of 4" });
  await first.focus();
  await first.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(element, "12");
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "12",
        inputType: "insertCompositionText",
        isComposing: true,
      }),
    );
  });
  await first.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "12" }),
    );
  });
  await expect(page.getByLabel("Code changes")).toHaveText('["12"]');
  await expect(
    page.getByRole("textbox", { name: "Digit 3 of 4" }),
  ).toBeFocused();

  // This input method sends no trailing input after compositionend. A
  // later phone edit has no keydown and happens to produce the same text.
  await first.focus();
  await first.evaluate((element) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(element, "12");
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "2",
        inputType: "insertText",
        isComposing: false,
      }),
    );
  });
  await expect(first).toHaveValue("2");
  await expect(page.getByLabel("Code changes")).toHaveText('["12","22"]');
  await expect(
    page.getByRole("textbox", { name: "Digit 2 of 4" }),
  ).toBeFocused();
  const form = page.getByRole("form", { name: "Code form" });
  expect(
    await form.evaluate((element) =>
      new FormData(element as HTMLFormElement).get("code"),
    ),
  ).toBe("22");
});

test("IME confirmation Enter leaves a destructive dialog open", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=confirm-composition");
  const field = page.getByRole("textbox", { name: "Type DELETE to confirm" });
  await field.fill("DELETE");
  await field.dispatchEvent("keydown", {
    key: "Enter",
    keyCode: 13,
    isComposing: true,
  });
  await expect(page.getByLabel("Confirmed actions")).toHaveText("0");
  await field.dispatchEvent("keydown", {
    key: "Enter",
    keyCode: 229,
    isComposing: false,
  });
  await expect(page.getByLabel("Confirmed actions")).toHaveText("0");
  await expect(field).toBeFocused();

  await field.press("Enter");
  await expect(page.getByLabel("Confirmed actions")).toHaveText("1");
});

test("a confirm dialog's content is as far from its footer as from its header", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=confirm-composition");
  const dialog = page.getByRole("alertdialog", { name: "Delete record?" });
  await expect(dialog).toBeVisible();

  const gaps = await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
    const footer = element.querySelector("[data-dialog-footer]")!;
    const header = element.querySelector("header")!.getBoundingClientRect();
    const first = footer.parentElement!.firstElementChild!;
    const last = footer.previousElementSibling!;
    return {
      bottom:
        footer.getBoundingClientRect().top -
        last.getBoundingClientRect().bottom,
      top: first.getBoundingClientRect().top - header.bottom,
    };
  });
  expect(gaps.top).toBeGreaterThan(0);
  expect(gaps.bottom).toBeCloseTo(gaps.top, 0);
});

test("content after a dialog's footer keeps the footer at the bottom", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=footer-form");
  const dialog = page.getByRole("dialog", { name: "Edit name" });
  await expect(dialog).toBeVisible();

  const layout = await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
    const footer = element.querySelector("[data-dialog-footer]")!;
    const form = footer.parentElement!;
    const header = element.querySelector("header")!.getBoundingClientRect();
    const field = footer.previousElementSibling!.getBoundingClientRect();
    const after = footer.nextElementSibling!.getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    return {
      // Inside the border of the dialog, which places the footer
      bottom:
        element.getBoundingClientRect().bottom -
        parseFloat(getComputedStyle(element).borderBottomWidth),
      footerBottom: footerBox.bottom,
      between: after.top - field.bottom,
      fieldMargin: parseFloat(
        getComputedStyle(footer.previousElementSibling!).marginBottom,
      ),
      last: footerBox.top - after.bottom,
      top: form.getBoundingClientRect().top - header.bottom,
    };
  });
  expect(layout.footerBottom).toBeCloseTo(layout.bottom, 0);
  expect(layout.fieldMargin).toBeGreaterThan(0);
  expect(layout.between).toBeCloseTo(layout.fieldMargin, 0);
  expect(layout.last).toBeCloseTo(layout.top, 0);
});

test("Tab in a dialog passes over a link in an editor's text", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=editor-dialog");
  const dialog = page.getByRole("dialog", { name: "Edit note" });
  const editor = dialog.getByRole("textbox", { name: "Note" });
  const after = dialog.getByRole("button", { name: "After editor" });
  await expect(editor.getByRole("link", { name: "the guide" })).toBeVisible();
  await editor.click();
  await expect(editor).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(editor).toBeFocused();
});

for (const kind of ["number", "tags"] as const) {
  test(`a hidden ${kind} field retains its validation and follows corrected values`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/browser/?scenario=form-validity-activity&kind=${kind}`,
    );
    const form = page.getByRole("form", { name: "Validated activity form" });
    const isValid = () =>
      form.evaluate((element) => (element as HTMLFormElement).checkValidity());
    await expect.poll(isValid).toBe(false);

    await page.getByRole("button", { name: "Toggle validated fields" }).click();
    await expect(page.getByLabel("Validated field visibility")).toHaveText(
      "hidden",
    );
    expect(await isValid()).toBe(false);
    if (kind === "number") {
      expect(
        await form.evaluate((element) =>
          new FormData(element as HTMLFormElement).get("amount"),
        ),
      ).toBe("11");
    }

    await page.getByRole("button", { name: "Make hidden field valid" }).click();
    await expect.poll(isValid).toBe(true);
    expect(
      await form.evaluate((element) =>
        Array.from(new FormData(element as HTMLFormElement).entries()),
      ),
    ).toEqual([
      [
        kind === "number" ? "amount" : "tags",
        kind === "number" ? "10" : "Ready",
      ],
    ]);
    await page.getByRole("button", { name: "Submit validated fields" }).click();
    await expect(page.getByLabel("Validated form submitted")).toHaveText(
      "true",
    );
    await expect(page.getByLabel("Validated field visibility")).toHaveText(
      "hidden",
    );
  });
}

async function startEditorUpload(page: Page) {
  const editor = page.getByRole("textbox", { name: "Note" });
  await editor.focus();
  await editor.evaluate((element) => {
    const text = element.querySelector("p")?.firstChild;
    if (!text) throw new Error("The editor's initial paragraph is missing.");
    const range = document.createRange();
    range.setStart(text, text.textContent?.length ?? 0);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        files: [new File(["png"], "shot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    element.dispatchEvent(event);
  });
  await expect(editor).toHaveAttribute("aria-busy", "true");
}

for (const controlled of [false, true]) {
  test(`resetting hidden ${controlled ? "controlled" : "uncontrolled"} choices follows their latest defaults`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/browser/?scenario=choice-reset-activity&controlled=${controlled}`,
    );
    const form = page.getByRole("form", { name: "Choice activity form" });
    const values = () =>
      form.evaluate((element) =>
        Array.from(new FormData(element as HTMLFormElement).entries()),
      );
    const isValid = () =>
      form.evaluate((element) => (element as HTMLFormElement).checkValidity());
    await page.getByRole("button", { name: "Toggle choice fields" }).click();
    await expect(page.getByLabel("Choice field visibility")).toHaveText(
      "hidden",
    );
    await page.getByRole("button", { name: "Update hidden choices" }).click();
    const expected = [
      ["select", "b"],
      ["multiple", "b"],
      ["radios", "b"],
      ["segments", "b"],
      ["checkbox", "yes"],
      ["switch", "yes"],
      ["checks", "b"],
    ];
    // Native uncontrolled checkboxes keep their current checked state when
    // defaultChecked changes; the new default takes effect on reset.
    await expect
      .poll(values)
      .toEqual(
        controlled
          ? expected
          : expected.filter(
              ([name]) => name !== "checkbox" && name !== "switch",
            ),
      );
    await page.getByRole("button", { name: "Reset hidden choices" }).click();
    await expect.poll(values).toEqual(expected);
    expect(await isValid()).toBe(true);
    await page.getByRole("button", { name: "Submit hidden choices" }).click();
    await expect(page.getByLabel("Choice form submitted")).toHaveText("true");
    if (controlled) {
      await page
        .getByRole("button", { name: "Clear hidden checkbox group" })
        .click();
      await expect.poll(isValid).toBe(false);
      await page.getByRole("button", { name: "Update hidden choices" }).click();
      await expect.poll(isValid).toBe(true);
    }
    await expect(page.getByLabel("Choice field visibility")).toHaveText(
      "hidden",
    );
  });
}

for (const finished of [false, true]) {
  test(`replacing hidden editor content releases its ${finished ? "finished" : "pending"} upload`, async ({
    page,
  }) => {
    await page.goto(
      "/tests/browser/?scenario=editor-reset-activity&controlled=true",
    );
    await startEditorUpload(page);
    const form = page.getByRole("form", { name: "Editor activity form" });
    const state = () =>
      form.evaluate((element) => ({
        valid: (element as HTMLFormElement).checkValidity(),
        content: new FormData(element as HTMLFormElement).get("note"),
      }));
    await page.getByRole("button", { name: "Toggle editor" }).click();
    await expect(page.getByLabel("Editor visibility")).toHaveText("hidden");
    if (finished) {
      await page.getByRole("button", { name: "Finish editor upload" }).click();
    }
    expect((await state()).valid).toBe(false);
    await page.getByRole("button", { name: "Replace hidden editor" }).click();
    await expect(page.getByLabel("Editor upload aborted")).toHaveText("true");
    const expected = { valid: true, content: "<p>Replacement</p>" };
    await expect.poll(state).toEqual(expected);
    await page.getByRole("button", { name: "Finish editor upload" }).click();
    await expect.poll(state).toEqual(expected);
    await page.getByRole("button", { name: "Submit editor" }).click();
    await expect(page.getByLabel("Editor form submitted")).toHaveText("true");
    await expect(page.getByLabel("Editor visibility")).toHaveText("hidden");
    await page.getByRole("button", { name: "Toggle editor" }).click();
    await expect(page.getByRole("textbox", { name: "Note" })).toHaveText(
      "Replacement",
    );
    await expect(form.locator("img")).toHaveCount(0);
    await expect.poll(state).toEqual(expected);
  });
}

test("resetting a hidden editor releases its canceled upload's form blocker", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=editor-reset-activity");
  await startEditorUpload(page);
  const form = page.getByRole("form", { name: "Editor activity form" });
  const isValid = () =>
    form.evaluate((element) => (element as HTMLFormElement).checkValidity());
  await expect.poll(isValid).toBe(false);
  await page.getByRole("button", { name: "Toggle editor" }).click();
  await expect(page.getByLabel("Editor visibility")).toHaveText("hidden");
  expect(await isValid()).toBe(false);

  await page.getByRole("button", { name: "Reset hidden editor" }).click();
  await expect(page.getByLabel("Editor upload aborted")).toHaveText("true");
  await expect.poll(isValid).toBe(true);
  await page.getByRole("button", { name: "Finish editor upload" }).click();
  await expect
    .poll(() =>
      form.evaluate((element) =>
        new FormData(element as HTMLFormElement).get("note"),
      ),
    )
    .toBe("<p>Shot</p>");
  expect(await isValid()).toBe(true);
  await page.getByRole("button", { name: "Submit editor" }).click();
  await expect(page.getByLabel("Editor form submitted")).toHaveText("true");
  await expect(page.getByLabel("Editor visibility")).toHaveText("hidden");
});

test("an editor upload finishing while hidden stays blocked until its image is applied", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=editor-reset-activity");
  await startEditorUpload(page);
  const form = page.getByRole("form", { name: "Editor activity form" });
  await page.getByRole("button", { name: "Toggle editor" }).click();
  await expect(page.getByLabel("Editor visibility")).toHaveText("hidden");
  await page.getByRole("button", { name: "Finish editor upload" }).click();
  await page.getByRole("button", { name: "Submit editor" }).click();
  await expect(page.getByLabel("Editor form submitted")).toHaveText("false");
  expect(
    await form.evaluate((element) =>
      (element as HTMLFormElement).checkValidity(),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Toggle editor" }).click();
  await expect(page.getByLabel("Editor visibility")).toHaveText("visible");
  await expect
    .poll(() =>
      form.evaluate((element) => ({
        valid: (element as HTMLFormElement).checkValidity(),
        content: new FormData(element as HTMLFormElement).get("note"),
      })),
    )
    .toEqual({
      valid: true,
      content: '<p>Shot<img src="/late.png" alt=""></p>',
    });
  await page.getByRole("button", { name: "Submit editor" }).click();
  await expect(page.getByLabel("Editor form submitted")).toHaveText("true");
  await expect(page.getByLabel("Editor visibility")).toHaveText("visible");
});

test("a native reset clears Activity-hidden fields and cancels their upload", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=form-reset-activity");
  await page.getByRole("textbox", { name: "Title" }).fill("Changed");
  const tags = page.getByRole("textbox", { name: "Tags" });
  await tags.fill("New");
  await tags.press("Enter");
  await page.locator("input[type=file]").setInputFiles({
    buffer: Buffer.from("contents"),
    mimeType: "text/plain",
    name: "new.txt",
  });
  await expect(page.getByText("new.txt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle form fields" }).click();
  await expect(page.getByLabel("Form field visibility")).toHaveText("hidden");
  await page.getByRole("button", { name: "Reset hidden fields" }).click();
  await expect(page.getByLabel("Upload aborted")).toHaveText("true");
  await page.getByRole("button", { name: "Finish pending upload" }).click();
  await page.getByRole("button", { name: "Toggle form fields" }).click();

  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Initial",
  );
  await expect(page.getByLabel("Completed uploads")).toHaveText("0");
  const form = page.getByRole("form", { name: "Reset activity form" });
  await expect
    .poll(() =>
      form.evaluate((element) =>
        Array.from(new FormData(element as HTMLFormElement).entries()),
      ),
    )
    .toEqual([
      ["title", "Initial"],
      ["tags", "Initial"],
      ["attachments", "initial-file"],
    ]);
  await expect(page.getByText("new.txt", { exact: true })).toHaveCount(0);
});

for (const kind of ["date", "range"]) {
  for (const initiallyHidden of [false, true]) {
    test(`a ${kind} calendar validates hidden constraints (initially hidden: ${initiallyHidden})`, async ({
      page,
    }) => {
      await page.goto(
        `/tests/browser/?scenario=calendar-validity-activity&kind=${kind}&initiallyHidden=${initiallyHidden}`,
      );
      const form = page.getByRole("form", { name: "Calendar activity form" });
      const valid = () =>
        form.evaluate((element) =>
          (element as HTMLFormElement).checkValidity(),
        );
      await expect.poll(valid).toBe(true);
      if (!initiallyHidden) {
        await page
          .getByRole("button", { name: "Toggle calendar field" })
          .click();
      }
      await expect(page.getByLabel("Calendar field visibility")).toHaveText(
        "hidden",
      );

      await page
        .getByRole("button", { name: "Restrict calendar dates" })
        .click();
      await expect.poll(valid).toBe(false);
      expect(
        await form.evaluate((element) =>
          new FormData(element as HTMLFormElement).get("calendar"),
        ),
      ).toBe(kind === "range" ? "2026-09-10/2026-09-12" : "2026-09-10");

      await page.getByRole("button", { name: "Allow calendar dates" }).click();
      await expect.poll(valid).toBe(true);
      await page
        .getByRole("button", { name: "Submit calendar", exact: true })
        .click();
      await expect(page.getByLabel("Calendar form submitted")).toHaveText(
        "true",
      );
      await expect(page.getByLabel("Calendar field visibility")).toHaveText(
        "hidden",
      );
    });
  }
}

test("a required upload finishing while hidden permits native form submission", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=upload-activity");
  await page.locator("input[type=file]").setInputFiles({
    buffer: Buffer.from("contents"),
    mimeType: "text/plain",
    name: "first.txt",
  });
  const submit = page.getByRole("button", { name: "Submit uploaded files" });
  await expect(page.getByLabel("Pending uploads")).toHaveText("1");
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Toggle upload fields" }).click();
  await expect(page.getByLabel("Upload field visibility")).toHaveText("hidden");
  await page.getByRole("button", { name: "Finish first upload" }).click();
  await expect(page.getByLabel("Stored upload results")).toHaveText(
    "first.txt",
  );
  await expect(page.getByLabel("Pending uploads")).toHaveText("0");
  await expect(submit).toBeEnabled();

  const form = page.getByRole("form", { name: "Background upload form" });
  await expect
    .poll(() =>
      form.evaluate((element) => (element as HTMLFormElement).checkValidity()),
    )
    .toBe(true);
  expect(
    await form.evaluate((element) =>
      new FormData(element as HTMLFormElement).getAll("attachments"),
    ),
  ).toEqual(["first.txt"]);
  await submit.click();
  await expect(page.getByLabel("Upload form submitted")).toHaveText("true");
  await expect(page.getByLabel("Upload field visibility")).toHaveText("hidden");
});

for (const completion of ["separate tasks", "the same task"] as const) {
  test(`uploads completing in ${completion} while hidden preserve the consumer's latest results`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=upload-activity");
    await page.locator("input[type=file]").setInputFiles(
      ["first.txt", "second.txt"].map((name) => ({
        buffer: Buffer.from("contents"),
        mimeType: "text/plain",
        name,
      })),
    );
    await page.getByRole("button", { name: "Toggle upload fields" }).click();
    if (completion === "the same task") {
      await page.getByRole("button", { name: "Finish all uploads" }).click();
    } else {
      await page.getByRole("button", { name: "Finish first upload" }).click();
      await expect(page.getByLabel("Stored upload results")).toHaveText(
        "first.txt",
      );
      await page.getByRole("button", { name: "Finish second upload" }).click();
    }
    await expect(page.getByLabel("Stored upload results")).toHaveText(
      "first.txt,second.txt",
    );
  });
}

for (const change of ["resize availability", "Activity"] as const) {
  test(`changing ${change} cancels a native column resize without saving its width`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=table-resize");
    const header = page.getByRole("columnheader", { name: "Name" });
    const handle = page.getByRole("separator", { name: "Resize Name" });
    const rect = await handle.boundingBox();
    if (!rect) throw new Error("The column resize handle is missing.");
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 5 });
    await expect(header).toHaveCSS("width", "260px");
    await expect
      .poll(() =>
        handle.evaluate((element) =>
          element.hasPointerCapture(
            Number(
              element
                .closest("[data-testid=resizing-table]")
                ?.getAttribute("data-pointer-id"),
            ),
          ),
        ),
      )
      .toBe(true);

    await page.keyboard.press(change === "Activity" ? "F3" : "F2");
    if (change === "Activity") {
      await expect(handle).toBeHidden();
    } else {
      await expect(handle).toHaveCount(0);
    }
    await page.mouse.up();
    await page.keyboard.press(change === "Activity" ? "F3" : "F2");
    await expect(handle).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(header).toHaveCSS("width", "200px");
    expect(
      await page
        .getByRole("table")
        .evaluate((element) =>
          (element as HTMLElement).style.getPropertyValue(
            "--data-table-drag-width",
          ),
        ),
    ).toBe("");

    // A new gesture must still work after the canceled handle was replaced.
    const fresh = await handle.boundingBox();
    if (!fresh) throw new Error("The column resize handle did not return.");
    await page.mouse.move(fresh.x + fresh.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(fresh.x + fresh.width / 2 + 30, y, { steps: 5 });
    await page.mouse.up();
    await expect(header).toHaveCSS("width", "230px");
  });
}

test("requesting the first cursor page blocks moves using the previous page's cursors", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=cursor-pagination");
  await page.getByRole("button", { name: "First page", exact: true }).click();
  const next = page.getByRole("button", { name: "Next page" });
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await next.click({ force: true });
  await expect(page.getByLabel("Cursor page requests")).toHaveText("first");

  await page.getByRole("button", { name: "Finish first page load" }).click();
  await next.click();
  await expect(page.getByLabel("Cursor page requests")).toHaveText(
    "first,next:filtered-page-end",
  );
});

for (const change of ["limit", "date", "Activity"] as const) {
  test(`changing the calendar ${change} cancels native slot selection`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=calendar-slots");
    const slot = page.locator("[data-slot='0-0']");
    await expect(slot).toBeVisible();
    const rect = await slot.boundingBox();
    if (!rect) throw new Error("The calendar slot is missing.");
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + rect.height, { steps: 5 });
    const preview = page.locator(".day-column > .border-dashed");
    await expect(preview).toHaveCount(1);
    await expect
      .poll(() =>
        slot.evaluate((element) =>
          element.hasPointerCapture(
            Number(
              element
                .closest("[data-testid=calendar-slots]")
                ?.getAttribute("data-pointer-id"),
            ),
          ),
        ),
      )
      .toBe(true);

    await page.keyboard.press(
      change === "limit" ? "F2" : change === "date" ? "F3" : "F4",
    );
    await page.mouse.up();
    await expect(page.getByLabel("Selected slot ranges")).toHaveText("0");
    if (change === "Activity") {
      await expect(page.getByLabel("Slot calendar visibility")).toHaveText(
        "hidden",
      );
      await page.keyboard.press("F4");
    } else if (change === "limit") {
      await page.keyboard.press("F3");
    }
    await expect(preview).toHaveCount(0);

    await expect(slot).toBeVisible();
    const fresh = await slot.boundingBox();
    if (!fresh) throw new Error("The calendar slot did not return.");
    await page.mouse.move(x, fresh.y + fresh.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, fresh.y + fresh.height * 1.5, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByLabel("Selected slot ranges")).toHaveText("1");
  });
}

test("new splitter limits cancel a native pointer drag before Escape", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=splitter-drag");
  const separator = page.getByRole("separator");
  const control = page.getByTestId("splitter-control");
  await expect(separator).toBeVisible();
  await expect(control).toBeVisible();
  const rect = await separator.boundingBox();
  const root = await control.boundingBox();
  if (!rect || !root) throw new Error("The splitter handle is missing.");
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + root.width * 0.2, y, { steps: 5 });
  await expect(separator).not.toHaveAttribute("aria-valuenow", "30");
  const changes = await page.getByLabel("Splitter changes").textContent();
  const hasCapture = () =>
    separator.evaluate((element) =>
      element.hasPointerCapture(
        Number(element.parentElement?.dataset.pointerId),
      ),
    );
  await expect.poll(hasCapture).toBe(true);

  await page.keyboard.press("F2");
  await expect(page.getByLabel("Splitter sizes")).toHaveText("[60,40]");
  await expect.poll(hasCapture).toBe(false);
  await page.keyboard.press("Escape");
  await page.mouse.move(x + root.width * 0.3, y);
  await page.mouse.up();
  await expect(page.getByLabel("Splitter sizes")).toHaveText("[60,40]");
  await expect(page.getByLabel("Splitter changes")).toHaveText(changes ?? "");
});

test("a table filter follows its query after Activity cancels a draft", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=filter-activity");
  const filter = page.getByRole("searchbox", { name: "Filter Name" });
  await expect(filter).toHaveValue("Original");
  await filter.fill("draft");
  await page.keyboard.press("F4");
  await expect(page.getByLabel("Filter visibility")).toHaveText("hidden");
  await page.waitForTimeout(350);
  await expect(page.getByLabel("Committed filter")).toHaveText("Original");
  await page.keyboard.press("F3");
  await expect(page.getByLabel("Committed filter")).toHaveText("External");
  await page.keyboard.press("F4");
  await expect(filter).toHaveValue("External");
  await expect(
    page.locator("tbody").getByRole("cell", { name: "External", exact: true }),
  ).toBeVisible();
  await filter.fill("Original");
  await expect(
    page.locator("tbody").getByRole("cell", { name: "Original", exact: true }),
  ).toBeVisible();
});

for (const change of ["bounds", "read-only", "Activity"] as const) {
  test(`changing ${change} cancels a slider's native pointer drag`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/?scenario=slider-drag");
    const thumb = page.getByRole("slider", { name: "Volume" });
    const control = page.getByTestId("slider-control");
    const rail = await thumb.locator("..").boundingBox();
    if (!rail) throw new Error("The slider track is missing.");
    const y = rail.y + rail.height / 2;
    await page.mouse.move(rail.x + rail.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(rail.x + rail.width * 0.75, y, { steps: 5 });
    await expect(thumb).toHaveAttribute("aria-valuenow", "75");
    const changes = await page.getByLabel("Slider changes").textContent();
    const hasCapture = () =>
      control.evaluate((element) =>
        element.hasPointerCapture(Number(element.dataset.pointerId)),
      );
    await expect.poll(hasCapture).toBe(true);

    const key =
      change === "bounds" ? "F2" : change === "read-only" ? "F3" : "F4";
    await page.keyboard.press(key);
    if (change === "bounds") {
      await expect(thumb).toHaveAttribute("aria-valuemax", "20");
    } else if (change === "read-only") {
      await expect(thumb).toHaveAttribute("aria-readonly", "true");
    } else {
      await expect(page.getByLabel("Slider visibility")).toHaveText("hidden");
    }
    await expect.poll(hasCapture).toBe(false);
    await page.keyboard.press("Escape");
    await page.mouse.move(rail.x + rail.width * 0.9, y);
    await page.mouse.up();
    await expect(page.getByLabel("Slider changes")).toHaveText(changes ?? "");
    await expect(page.getByLabel("Completed slider values")).toBeEmpty();

    if (change !== "bounds") await page.keyboard.press(key);
    await expect(thumb).toHaveAttribute(
      "aria-valuenow",
      change === "bounds" ? "20" : "75",
    );
    await expect(thumb.locator("span")).toHaveClass(
      /(?:^|\s)opacity-0(?:\s|$)/,
    );

    // The canceled pointer cannot resume, but a new gesture works normally.
    const position = await thumb.boundingBox();
    if (!position) throw new Error("The slider thumb is missing.");
    await page.mouse.move(position.x + position.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(rail.x + rail.width / 2, y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByLabel("Completed slider values")).toHaveText(
      change === "bounds" ? "10" : "50",
    );
  });
}

async function beginCalendarMove(page: Page) {
  await page.goto("/tests/browser/?scenario=calendar-move");
  const button = page.getByRole("button", { name: /^Review,/ });
  await button.scrollIntoViewIfNeeded();
  const event = await button.boundingBox();
  const target = await page
    .getByRole("cell", { name: "25", exact: true })
    .boundingBox();
  if (!event || !target) throw new Error("The calendar tiles are missing.");
  const x = event.x + event.width / 2;
  const y = event.y + event.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, y, { steps: 5 });
  await expect(page.getByTestId("review-preview")).toHaveAttribute(
    "data-moving",
    "true",
  );
}

test("a changed calendar limit cancels a native pointer move", async ({
  page,
}) => {
  await beginCalendarMove(page);
  await page.keyboard.press("F2");
  await expect(page.getByTestId("review-preview")).toHaveAttribute(
    "data-moving",
    "false",
  );
  await page.mouse.up();
  await expect(page.getByLabel("Committed moves")).toHaveText("0");
});

test("removing a calendar event cancels its native pointer move", async ({
  page,
}) => {
  await beginCalendarMove(page);
  await page.keyboard.press("F3");
  await expect(page.getByTestId("review-preview")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByLabel("Committed moves")).toHaveText("0");
  await page.getByRole("button", { name: /^Other,/ }).click();
  await expect(page.getByLabel("Opened event")).toHaveText("other");
});

test("Activity hiding clears a calendar move and restores pointer clicks", async ({
  page,
}) => {
  await beginCalendarMove(page);
  await page.keyboard.press("F4");
  await expect(page.getByLabel("Calendar visibility")).toHaveText("hidden");
  await page.mouse.up();
  await page.keyboard.press("F4");
  await expect(page.getByLabel("Calendar visibility")).toHaveText("visible");
  await expect(page.getByTestId("review-preview")).toHaveAttribute(
    "data-moving",
    "false",
  );
  await expect(page.getByLabel("Committed moves")).toHaveText("0");
  await page.getByRole("button", { name: /^Other,/ }).click();
  await expect(page.getByLabel("Opened event")).toHaveText("other");
});

for (const kind of ["dropdown", "context"] as const) {
  test(`Tab stays in a dialog opened from custom ${kind} content`, async ({
    page,
  }) => {
    await page.goto(`/tests/browser/?scenario=menu&kind=${kind}`);
    const trigger = page.getByRole("button", { name: "Record actions" });
    await trigger.focus();
    await page.keyboard.press(kind === "context" ? "Shift+F10" : "Enter");
    await page.getByRole("button", { name: "Edit record" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit record" });
    const field = dialog.getByRole("textbox", { name: "Name" });
    const save = dialog.getByRole("button", { name: "Save record" });
    await field.click();
    await expect(field).toBeFocused();

    // Real browser tab traversal must run, not just a synthetic keydown.
    await page.keyboard.press("Tab");
    await expect(dialog).toBeVisible();
    await expect(save).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(dialog).toBeVisible();
    await expect(field).toBeFocused();
  });

  test(`${kind} keeps keyboard navigation when an open submenu is removed`, async ({
    page,
  }) => {
    await page.goto(`/tests/browser/?scenario=updating-menu&kind=${kind}`);
    const trigger = page.getByRole("button", { name: "Dynamic actions" });
    await trigger.focus();
    await page.keyboard.press(kind === "context" ? "Shift+F10" : "Enter");
    await page.keyboard.press("ArrowRight");

    const submenu = page.getByRole("menu", { name: "More actions" });
    await expect(submenu).toBeFocused();

    // The fixture updates its items without clicking away from the menu.
    await page.keyboard.press("F2");
    await expect(submenu).toHaveCount(0);
    const menu = page.getByRole("menu", { name: "Dynamic actions" });
    await expect(menu).toBeFocused();

    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Picked action")).toHaveText("Archive record");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("CSV download uses the displayed value after a rejected optimistic edit", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=table");
  const cell = page.getByRole("cell", { name: "Adam", exact: true });
  await cell.dblclick();
  const editor = page.getByRole("textbox", { name: "Name", exact: true });
  await editor.fill("Eva");
  await editor.press("Enter");

  await expect(page.getByLabel("Consumer row")).toHaveText("Eva");
  await page.getByRole("button", { name: "Reject pending save" }).click();
  const restoredCell = page.getByRole("cell").filter({ hasText: "Adam" });
  await expect(restoredCell).toContainText("The name is taken.");

  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to CSV" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("people.csv");
  const path = await download.path();
  if (!path) throw new Error("The CSV download was not saved locally.");
  const csv = await readFile(path, "utf8");
  expect(csv.replace(/^\uFEFF/, "")).toBe("Name\r\nAdam");
});

test("a pending filter cannot page with the previous Relay response's cursor", async ({
  page,
}) => {
  await page.goto("/tests/browser/?scenario=cursor-router");
  const next = page.getByRole("button", { name: "Next page" });
  await expect(next).toBeEnabled();
  await page.getByRole("searchbox", { name: "Filter Name" }).fill("Eva");

  const requests = page
    .getByRole("list", { name: "Requested navigations" })
    .getByRole("listitem");
  await expect(requests).toHaveCount(1);

  // A disabled paging button may ignore the press while its query waits
  // for the router. Do not let Playwright wait for it to become enabled.
  await next.click({ force: true });
  const pendingRequests = await requests.allTextContents();
  for (const href of pendingRequests) {
    const params = new URL(href, "https://example.test").searchParams;
    expect(JSON.parse(params.get("filters") ?? "{}")).toEqual({ name: "Eva" });
    expect(params.has("after")).toBe(false);
    expect(params.has("before")).toBe(false);
  }

  // Once the loader supplies the filtered response, paging can resume
  // using that response's cursor.
  await page.getByRole("button", { name: "Finish navigation" }).click();
  await expect(
    page.locator("tbody").getByRole("cell", { name: "Eva", exact: true }),
  ).toBeVisible();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(requests.last()).toContainText("after=filtered-page-end");
  const params = new URL(
    (await requests.last().textContent()) ?? "",
    "https://example.test",
  ).searchParams;
  expect(JSON.parse(params.get("filters") ?? "{}")).toEqual({ name: "Eva" });
  expect(params.get("page")).toBe("2");
});

// WebKit ignores the keys of a click the page dispatches - a row passing
// such a click on to its link left the page instead of opening a new tab
for (const modifier of ["ControlOrMeta", "Shift"] as const) {
  test(`${modifier} + click on a row opens its link in a new tab`, async ({
    context,
    isMobile,
    page,
  }) => {
    test.skip(isMobile, "A phone has no keys to hold");
    await page.goto("/tests/browser/?scenario=row-links");
    for (const [name, order] of [
      ["Jana Nováková", 42],
      ["Petr Svoboda", 43],
    ] as const) {
      const opened = context.waitForEvent("page", { timeout: 5000 });
      await page
        .getByRole("cell", { name, exact: true })
        .click({ modifiers: [modifier] });
      const tab = await opened;
      await expect(tab).toHaveURL(new RegExp(`order=${order}$`));
      await tab.close();
      await expect(page).toHaveURL(/scenario=row-links$/);
    }

    // A plain click after them follows the link - Shift + click selected no
    // text between the rows, which the click would only clear
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe(
      "",
    );
    await page.getByRole("cell", { name: "Jana Nováková" }).click();
    await expect(page).toHaveURL(/order=42$/);
  });
}

// The browser clicks what holds both the press and the release - the row
// for a press on its button released on another cell
test("a press on a control of a row released on another cell opens nothing", async ({
  isMobile,
  page,
}) => {
  test.skip(isMobile, "A finger moved off a button scrolls the page");
  await page.goto("/tests/browser/?scenario=row-links");
  const clicks = await page.evaluateHandle(() => {
    const targets: string[] = [];
    document.addEventListener("click", (event) => {
      targets.push((event.target as Element).tagName);
    });
    return targets;
  });

  await page.getByRole("button", { name: "Archive" }).hover();
  await page.mouse.down();
  await page.getByRole("cell", { name: "Jana Nováková" }).hover();
  await page.mouse.up();
  await expect.poll(() => clicks.jsonValue()).toEqual(["TR"]);
  await expect(page).toHaveURL(/scenario=row-links$/);
});

// Chrome keeps the scrollbar of a right-to-left page on the right, unlike
// Firefox - the room of the scrollbar a dialog hides is kept on its side,
// or the page shifts sideways under the dialog
test("locking the page scroll keeps a right-to-left page in place", async ({
  baseURL,
  browserName,
  isMobile,
  playwright,
}) => {
  test.skip(
    browserName !== "chromium" || isMobile,
    "Classic scrollbars - of Chromium, shown with a width of their own",
  );
  // Headless Chromium hides the scrollbars otherwise
  const browser = await playwright.chromium.launch({
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/tests/browser/");
    // A string, run as it is - the module comes from the fixture server
    const shift = await page.evaluate(`(async () => {
      document.head.insertAdjacentHTML(
        "beforeend",
        "<style>::-webkit-scrollbar { width: 15px }</style>",
      );
      document.documentElement.dir = "rtl";
      document.body.style.minHeight = "300vh";
      const { lockPageScroll } = await import(
        "/src/components/ui/overlay-stack.ts"
      );
      const scrollbar = innerWidth - document.documentElement.clientWidth;
      const main = document.querySelector("main");
      const before = main.getBoundingClientRect();
      const unlock = lockPageScroll();
      const locked = main.getBoundingClientRect();
      unlock();
      return {
        left: locked.left - before.left,
        right: locked.right - before.right,
        scrollbar,
      };
    })()`);
    expect(shift).toEqual({ left: 0, right: 0, scrollbar: 15 });
  } finally {
    await browser.close();
  }
});
