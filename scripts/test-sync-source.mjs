import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MANIFEST, syncSource } from "./sync-source.mjs";

/** The `src` of an app with files of its own, also next to the library's. */
function createApp(t) {
  const directory = mkdtempSync(join(tmpdir(), "components-ui-app-"));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const src = join(directory, "src");
  for (const [file, content] of Object.entries({
    "main.tsx": "// the app\n",
    "hooks/use-session.ts": "// a hook of the app\n",
    "i18n/en.ts": "// the texts of the app\n",
  })) {
    mkdirSync(join(src, file, ".."), { recursive: true });
    writeFileSync(join(src, file), content);
  }
  return src;
}

const read = (src, file) => readFileSync(join(src, file), "utf8");

test("Syncing a source copy", async (t) => {
  await t.test("copies the library and keeps the files of the app", (t) => {
    const src = createApp(t);
    const result = syncSource(src);

    assert.ok(result.added.includes("components/ui/index.ts"));
    assert.ok(existsSync(join(src, "components/ui/LICENSE")));
    assert.ok(existsSync(join(src, "ui-styles.css")));
    // The catalogs of the app - a template only where there is none
    assert.equal(read(src, "i18n/en.ts"), "// the texts of the app\n");
    assert.deepEqual(result.templates, ["i18n/cs.ts"]);
    assert.equal(read(src, "hooks/use-session.ts"), "// a hook of the app\n");
    assert.equal(read(src, "main.tsx"), "// the app\n");

    const manifest = JSON.parse(read(src, MANIFEST));
    assert.ok(manifest.version);
    assert.ok(manifest.files["components/ui/button.tsx"]);
    assert.ok(!("i18n/en.ts" in manifest.files));
    assert.ok(!("hooks/use-session.ts" in manifest.files));

    // Nothing to do the next time
    assert.deepEqual(syncSource(src).updated, []);
  });

  await t.test("stops at a library file changed in the copy", (t) => {
    const src = createApp(t);
    syncSource(src);
    writeFileSync(join(src, "components/ui/badge.tsx"), "// patched\n");

    assert.throws(() => syncSource(src), /components\/ui\/badge\.tsx/);
    assert.equal(read(src, "components/ui/badge.tsx"), "// patched\n");

    const result = syncSource(src, { force: true });
    assert.deepEqual(result.updated, ["components/ui/badge.tsx"]);
    assert.notEqual(read(src, "components/ui/badge.tsx"), "// patched\n");
  });

  await t.test("removes the files the library no longer has", (t) => {
    const src = createApp(t);
    syncSource(src);

    // Files of an older version of the library - one changed in the copy
    const manifest = JSON.parse(read(src, MANIFEST));
    for (const file of ["components/ui/old.tsx", "utils/old/helper.ts"]) {
      mkdirSync(join(src, file, ".."), { recursive: true });
      writeFileSync(join(src, file), "// old\n");
    }
    manifest.files["components/ui/old.tsx"] = "changed since";
    // The hash of "// old\n" - unchanged since the library put it there
    manifest.files["utils/old/helper.ts"] = createHash("sha256")
      .update("// old\n")
      .digest("hex");
    writeFileSync(join(src, MANIFEST), JSON.stringify(manifest));

    const dryRun = syncSource(src, { dryRun: true });
    assert.deepEqual(dryRun.removed, ["utils/old/helper.ts"]);
    assert.ok(existsSync(join(src, "utils/old/helper.ts")));

    const result = syncSource(src);
    assert.deepEqual(result.removed, ["utils/old/helper.ts"]);
    assert.deepEqual(result.kept, ["components/ui/old.tsx"]);
    // Its folder went with it
    assert.ok(!existsSync(join(src, "utils/old")));
    assert.ok(existsSync(join(src, "components/ui/old.tsx")));
  });
});
