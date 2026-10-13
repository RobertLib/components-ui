import { expect, test, type Page } from "@playwright/test";

type RootMode = "light" | "open" | "closed";

declare global {
  interface Window {
    shadowControlsContainer: HTMLDivElement;
    shadowControlsRoot: Document | ShadowRoot;
  }
}

/** Mount existing fixtures in another root, retaining access to closed roots. */
async function mountFixture(
  page: Page,
  mode: RootMode,
  kind: "checkbox" | "table",
) {
  await page.goto("/tests/browser/?scenario=empty-checkbox-group");
  // Reuse served fixture modules without adding another page entry.
  await page.evaluate(`(async () => {
    const { createElement } = (await import("/node_modules/.vite-browser/deps/react.js")).default;
    const { createRoot } = (await import("/node_modules/.vite-browser/deps/react-dom_client.js")).default;
    const { EmptyCheckboxGroupFixture, TableFixture } = await import("/tests/browser/fixtures.tsx");
    const { default: css } = await import("/tests/browser/fixture.css?inline");
    document.getElementById("root").hidden = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = ${mode === "light" ? "document" : `host.attachShadow({ mode: ${JSON.stringify(mode)} })`};
    const container = document.createElement("div");
    if (root instanceof ShadowRoot) {
      const style = document.createElement("style");
      style.textContent = css;
      root.append(style, container);
    } else host.append(container);
    window.shadowControlsContainer = container;
    window.shadowControlsRoot = root;
    createRoot(container).render(createElement(
      ${kind === "checkbox" ? "EmptyCheckboxGroupFixture" : "TableFixture"},
      ${kind === "checkbox" ? "{ allDisabled: false }" : "null"},
    ));
  })()`);
  await expect
    .poll(() =>
      page.evaluate(() => window.shadowControlsContainer.childElementCount),
    )
    .toBeGreaterThan(0);
}

for (const mode of ["light", "open", "closed"] as const) {
  test(`invalid empty checkbox groups focus their group in a ${mode} root`, async ({
    page,
  }) => {
    await mountFixture(page, mode, "checkbox");
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.evaluate(() => {
        window.shadowControlsContainer.querySelector("form")!.requestSubmit();
      });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.shadowControlsRoot.activeElement ===
              window.shadowControlsContainer.querySelector("fieldset"),
          ),
        )
        .toBe(true);
    }
    expect(
      await page.evaluate(
        () =>
          window.shadowControlsContainer.querySelector(
            'output[aria-label="Submissions"]',
          )!.textContent,
      ),
    ).toBe("[]");
  });

  test(`the second touch tap edits a focused cell in a ${mode} root`, async ({
    page,
  }) => {
    await mountFixture(page, mode, "table");
    const tapCell = () =>
      page.evaluate(() => {
        const cell = window.shadowControlsContainer.querySelector<HTMLElement>(
          'tbody td[data-column-key="name"]',
        )!;
        // Deliver a touch tap without the browser's double-click fallback.
        // Native focus follows pointerdown, before click.
        cell.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            composed: true,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
          }),
        );
        cell.focus();
        cell.click();
      });

    await tapCell();
    expect(
      await page.evaluate(
        () => window.shadowControlsContainer.querySelector("input") === null,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () =>
          window.shadowControlsRoot.activeElement ===
          window.shadowControlsContainer.querySelector(
            'tbody td[data-column-key="name"]',
          ),
      ),
    ).toBe(true);

    await tapCell();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const field =
            window.shadowControlsContainer.querySelector<HTMLInputElement>(
              'input[aria-label="Name"]',
            );
          return (
            field?.value === "Adam" &&
            window.shadowControlsRoot.activeElement === field
          );
        }),
      )
      .toBe(true);
  });
}
