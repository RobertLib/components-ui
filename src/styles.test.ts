import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "styles.css"),
  "utf8",
);

// The helpers the Theming page documents for the markup of an app
const PUBLIC_CLASSES = new Set([
  "btn",
  "btn-group",
  "form-control",
  "rich-text",
  "rich-text-editor",
]);

describe("The stylesheet", () => {
  it("prefixes the classes only the components use", () => {
    // The class selectors - not the utilities of @apply, comments or paths
    const rules = stylesheet
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/"[^"]*"/g, "")
      .replace(/@apply[^;]*;/g, "");
    const classes = new Set(
      Array.from(rules.matchAll(/\.([a-z][\w-]*)/g), ([, name]) => name),
    );
    const utility = /@utility\s+([\w-]+)/.exec(rules)?.[1];
    if (utility) classes.add(utility);

    const unprefixed = [...classes].filter(
      (name) => !PUBLIC_CLASSES.has(name) && !name.startsWith("cui-"),
    );
    // `.drawer`, `.navbar` or `.link` would meet the classes of the page -
    // of DaisyUI, Bootstrap, the app itself
    expect(unprefixed).toEqual([]);
  });
});
