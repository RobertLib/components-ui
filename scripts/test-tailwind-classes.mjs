// Run with: node --test scripts/test-tailwind-classes.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import {
  findNonCanonicalClasses,
  fixClasses,
} from "./check-tailwind-classes.mjs";

const stylesheet = new URL("../docs/styles.css", import.meta.url);
const designSystem = await __unstable__loadDesignSystem(
  readFileSync(stylesheet, "utf8"),
  { base: fileURLToPath(new URL(".", stylesheet)) },
);

test("finds literal classes after Unicode without changing JS negation", () => {
  const source =
    'const title = "ě 😀 中文"; const x = !filter; const classes = "start-0 end-0 start-0";';
  const findings = findNonCanonicalClasses(source, "fixture.tsx", designSystem);
  assert.deepEqual(
    findings.map(({ candidate }) => candidate),
    ["start-0", "end-0", "start-0"],
  );
  assert.equal(
    fixClasses(source, findings),
    'const title = "ě 😀 中文"; const x = !filter; const classes = "inset-s-0 inset-e-0 inset-s-0";',
  );
});

test("checks CSS @apply's last class and leaves selectors/comments intact", () => {
  const source =
    ".break-words { /* @apply start-0; */ @apply leading-relaxed break-words; }";
  const findings = findNonCanonicalClasses(source, "fixture.css", designSystem);
  assert.equal(
    fixClasses(source, findings),
    ".break-words { /* @apply start-0; */ @apply leading-relaxed wrap-break-word; }",
  );
});

test("checks template snippets and arbitrary variants as complete candidates", () => {
  const source =
    'const snippet = `<div className="[&_.break-words]:break-words start-0">${label}</div>`;';
  const findings = findNonCanonicalClasses(source, "fixture.tsx", designSystem);
  assert.equal(
    fixClasses(source, findings),
    'const snippet = `<div className="[&_.break-words]:wrap-break-word inset-s-0">${label}</div>`;',
  );
});

test("checks HTML class attributes without changing unrelated text", () => {
  const source = '<div title="start-0" class="start-0 end-0">start-0</div>';
  const findings = findNonCanonicalClasses(
    source,
    "fixture.html",
    designSystem,
  );
  assert.equal(
    fixClasses(source, findings),
    '<div title="start-0" class="inset-s-0 inset-e-0">start-0</div>',
  );
});

test("refuses overlapping replacement ranges", () => {
  assert.throws(
    () =>
      fixClasses("start-0", [
        { position: 0, candidate: "start-0", canonical: "inset-s-0" },
        { position: 0, candidate: "start-0", canonical: "inset-s-0" },
      ]),
    /Overlapping or invalid/,
  );
});
