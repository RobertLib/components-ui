import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  libraryVersion,
  MANIFEST,
  shellWord,
  syncSource,
} from "./sync-source.mjs";

const script = fileURLToPath(new URL("sync-source.mjs", import.meta.url));

/** The `src` of an app with files of its own, also next to the library's. */
function createApp(t, prefix = "components-ui-app-") {
  const directory = mkdtempSync(join(tmpdir(), prefix));
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

const hashOf = (content) => createHash("sha256").update(content).digest("hex");

const readManifest = (src) => JSON.parse(read(src, MANIFEST));

const writeManifest = (src, manifest) =>
  writeFileSync(join(src, MANIFEST), JSON.stringify(manifest));

/**
 * Whether the file system of the app takes `Badge.tsx` and `badge.tsx` for
 * one file - macOS and Windows do, Linux does not.
 */
const isCaseInsensitive = (src) => existsSync(join(src, "MAIN.TSX"));

/**
 * Renames `from` in `src` to `to` - by way of another name, as a rename in
 * case alone may do nothing where the two names are one.
 */
function renameInCase(src, from, to) {
  renameSync(join(src, from), join(src, `${to}.renaming`));
  renameSync(join(src, `${to}.renaming`), join(src, to));
}

/** The environment of the tests - without the options of npm, if npm ran them. */
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^npm_config_(adopt|dry_run|force)$/.test(name),
  ),
);

/** Runs the command line in the library - its exit code and its output. */
const run = (...args) => runWith({}, ...args);

/** Runs the command line with `env` - the options npm kept for itself, say. */
const runWith = (env, ...args) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...environment, ...env },
  });

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
    // Written next to it, then renamed over it
    assert.ok(!existsSync(join(src, `${MANIFEST}.tmp`)));

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
    manifest.files["utils/old/helper.ts"] = hashOf("// old\n");
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

  await t.test("stops at a file of the app at a path of the library", (t) => {
    const src = createApp(t);
    syncSource(src);
    // A version of the library before it had the hook - the app has its own
    const manifest = readManifest(src);
    delete manifest.files["hooks/use-url-state.ts"];
    writeManifest(src, manifest);
    writeFileSync(join(src, "hooks/use-url-state.ts"), "// of the app\n");

    assert.throws(
      () => syncSource(src),
      /--adopt[^]*\n {2}hooks\/use-url-state\.ts$/,
    );
    assert.equal(read(src, "hooks/use-url-state.ts"), "// of the app\n");

    const result = syncSource(src, { adopt: true });
    assert.deepEqual(result.updated, ["hooks/use-url-state.ts"]);
    assert.notEqual(read(src, "hooks/use-url-state.ts"), "// of the app\n");
  });

  await t.test(
    "replaces with --force the library files, not the app's",
    (t) => {
      const src = createApp(t);
      syncSource(src);
      // A library file patched in the copy - and a hook of the app at a path
      // the library takes up since
      writeFileSync(join(src, "components/ui/badge.tsx"), "// patched\n");
      const manifest = readManifest(src);
      delete manifest.files["hooks/use-url-state.ts"];
      writeManifest(src, manifest);
      writeFileSync(join(src, "hooks/use-url-state.ts"), "// of the app\n");

      assert.throws(
        () => syncSource(src, { force: true }),
        /--adopt[^]*\n {2}hooks\/use-url-state\.ts$/,
      );
      assert.throws(() => syncSource(src, { adopt: true }), /--force/);
      // A sync that stops writes nothing - also not the file --force is for
      assert.equal(read(src, "components/ui/badge.tsx"), "// patched\n");
      assert.equal(read(src, "hooks/use-url-state.ts"), "// of the app\n");
      const dryRun = syncSource(src, { dryRun: true, force: true });
      assert.deepEqual(dryRun.updated, ["components/ui/badge.tsx"]);
      assert.doesNotMatch(dryRun.stop, /--force/);

      const result = syncSource(src, { adopt: true, force: true });
      assert.equal(result.stop, null);
      assert.deepEqual(result.updated, [
        "components/ui/badge.tsx",
        "hooks/use-url-state.ts",
      ]);
      assert.notEqual(read(src, "components/ui/badge.tsx"), "// patched\n");
      assert.notEqual(read(src, "hooks/use-url-state.ts"), "// of the app\n");
    },
  );

  await t.test("takes over a copy made by hand, without a manifest", (t) => {
    const src = createApp(t);
    syncSource(src);
    rmSync(join(src, MANIFEST));
    // A file the library does not have, at a path like the library's - the
    // sync removes only what a manifest lists
    writeFileSync(join(src, "components/ui/old.tsx"), "// old\n");

    // The same files as the library's - taken over as they are
    const same = syncSource(src);
    assert.deepEqual([...same.added, ...same.updated, ...same.removed], []);
    assert.ok(readManifest(src).files["components/ui/button.tsx"]);
    assert.ok(!("components/ui/old.tsx" in readManifest(src).files));

    // An older version of the library, or a change - the sync cannot tell
    rmSync(join(src, MANIFEST));
    writeFileSync(join(src, "components/ui/badge.tsx"), "// older\n");
    assert.throws(() => syncSource(src), /components\/ui\/badge\.tsx/);
    assert.ok(!existsSync(join(src, MANIFEST)));

    const result = syncSource(src, { adopt: true });
    assert.deepEqual(result.notFromLibrary, ["components/ui/badge.tsx"]);
    assert.deepEqual(result.updated, ["components/ui/badge.tsx"]);
    assert.deepEqual(result.removed, []);
    assert.equal(read(src, "components/ui/old.tsx"), "// old\n");
    assert.equal(read(src, "main.tsx"), "// the app\n");
  });

  await t.test("goes by the text of a file, not its line endings", (t) => {
    const src = createApp(t);
    syncSource(src);
    // Also of a library checked out with CRLF already, by Git for Windows
    const crlf = (text) =>
      text.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n");

    // A checkout of Git for Windows - CRLF all over
    const badge = read(src, "components/ui/badge.tsx");
    writeFileSync(join(src, "components/ui/badge.tsx"), crlf(badge));
    assert.deepEqual(syncSource(src).updated, []);

    const manifest = readManifest(src);
    for (const [file, content] of Object.entries({
      // A file the library had - checked out with CRLF since
      "utils/old.ts": crlf("// old\n"),
      // A binary one, whose CR LF bytes are no line ending
      "utils/old.bin": "\0\r\n",
    })) {
      writeFileSync(join(src, file), content);
      manifest.files[file] = hashOf(content.replaceAll("\r\n", "\n"));
    }
    // A manifest of 0.5.0 hashed the bytes - also the CR of an older badge
    writeFileSync(join(src, "components/ui/badge.tsx"), crlf("// older\n"));
    manifest.files["components/ui/badge.tsx"] = hashOf(crlf("// older\n"));
    writeManifest(src, manifest);

    const result = syncSource(src);
    assert.deepEqual(result.removed, ["utils/old.ts"]);
    assert.deepEqual(result.kept, ["utils/old.bin"]);
    assert.deepEqual(result.updated, ["components/ui/badge.tsx"]);
    assert.equal(read(src, "components/ui/badge.tsx"), badge);

    // A manifest of 0.5.0 made from a checkout with CRLF, the copy checked
    // out with LF since - by a colleague on macOS, say
    const older = readManifest(src);
    for (const [file, content] of Object.entries({
      "components/ui/card.tsx": "// older\n",
      "utils/older.ts": "// older\n",
    })) {
      writeFileSync(join(src, file), content);
      older.files[file] = hashOf(crlf(content));
    }
    writeManifest(src, older);
    const lf = syncSource(src);
    assert.deepEqual(lf.changedLocally, []);
    assert.deepEqual(lf.updated, ["components/ui/card.tsx"]);
    assert.deepEqual(lf.removed, ["utils/older.ts"]);
  });

  await t.test("never touches a file out of the copy", (t) => {
    const src = createApp(t);
    syncSource(src);
    const manifest = readManifest(src);
    const outside = join(src, "../outside.txt");
    writeFileSync(outside, "// not of the copy\n");

    // The copy itself too - no file in it
    for (const file of [
      "../outside.txt",
      "hooks/../../outside.txt",
      outside,
      ".",
    ]) {
      // One at a time - the manifest of the sync with this one entry more
      writeManifest(src, {
        ...manifest,
        files: { ...manifest.files, [file]: hashOf("// not of the copy\n") },
      });

      for (const options of [{ dryRun: true }, {}]) {
        assert.throws(() => syncSource(src, options), {
          message: `${MANIFEST} lists a file out of the copy - fix the manifest: ${file}`,
        });
      }
      assert.ok(existsSync(outside));
    }
  });

  await t.test("never writes through a link out of the copy", (t) => {
    const src = createApp(t);
    syncSource(src);
    const manifest = readManifest(src);
    // `hooks` linked to a folder of another project - with a file the library
    // had, which the sync would remove, and none it has, which it would add
    const outside = join(src, "../outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "old.ts"), "// old\n");
    rmSync(join(src, "hooks"), { recursive: true });
    // A junction on Windows - a link to a folder without the rights of an admin
    symlinkSync(outside, join(src, "hooks"), "junction");
    manifest.files["hooks/old.ts"] = hashOf("// old\n");
    writeManifest(src, manifest);
    // A file to add in the copy itself - not written either
    rmSync(join(src, "components/ui/button.tsx"));

    for (const options of [
      { dryRun: true },
      {},
      { adopt: true, force: true },
    ]) {
      assert.throws(
        () => syncSource(src, options),
        /Links in the copy that lead out of it[^]*\n {2}hooks$/,
      );
    }
    assert.deepEqual(readdirSync(outside), ["old.ts"]);
    assert.ok(!existsSync(join(src, "components/ui/button.tsx")));
    assert.deepEqual(readManifest(src), manifest);

    // A file linked to one out of the copy - written through, it would change
    // that one. Links to files need the rights of an admin on Windows
    if (process.platform === "win32") return;
    rmSync(join(src, "hooks"));
    syncSource(src);
    writeFileSync(join(outside, "badge.tsx"), "// of another project\n");
    rmSync(join(src, "components/ui/badge.tsx"));
    symlinkSync(
      join(outside, "badge.tsx"),
      join(src, "components/ui/badge.tsx"),
    );
    assert.throws(
      () => syncSource(src, { adopt: true, force: true }),
      /\n {2}components\/ui\/badge\.tsx$/,
    );
    assert.equal(
      readFileSync(join(outside, "badge.tsx"), "utf8"),
      "// of another project\n",
    );
  });

  await t.test("follows a link in the copy in any case of its path", (t) => {
    const src = createApp(t);
    if (!isCaseInsensitive(src)) {
      t.skip("one case of a path where the file system tells case apart");
      return;
    }
    syncSource(src);
    // `hooks` linked to a folder in the copy by its whole path, `providers`
    // to one not there yet - and the copy given as `SRC`, which macOS and
    // Windows take for `src`. A file to write through each
    mkdirSync(join(src, "lib"));
    renameSync(join(src, "hooks"), join(src, "lib/hooks"));
    symlinkSync(join(src, "lib/hooks"), join(src, "hooks"), "junction");
    rmSync(join(src, "lib/hooks/use-url-state.ts"));
    rmSync(join(src, "providers"), { recursive: true });
    symlinkSync(join(src, "lib/providers"), join(src, "providers"), "junction");
    const typed = join(src, "../SRC");

    const result = syncSource(typed);
    assert.ok(result.added.includes("hooks/use-url-state.ts"));
    assert.ok(result.added.includes("providers/router.ts"));
    // Written where the links lead - the folder of one made by the sync
    assert.ok(lstatSync(join(src, "hooks")).isSymbolicLink());
    assert.ok(lstatSync(join(src, "providers")).isSymbolicLink());
    assert.ok(existsSync(join(src, "lib/hooks/use-url-state.ts")));
    assert.ok(existsSync(join(src, "lib/providers/router.ts")));
    assert.equal(
      read(src, "lib/hooks/use-session.ts"),
      "// a hook of the app\n",
    );

    // A link to nothing out of the copy - the sync would make it there
    rmSync(join(src, "providers"));
    rmSync(join(src, "lib/providers"), { recursive: true });
    const nowhere = join(src, "../nowhere");
    symlinkSync(join(nowhere, "providers"), join(src, "providers"), "junction");
    assert.throws(
      () => syncSource(typed),
      /Links in the copy that lead out of it[^]*\n {2}providers$/,
    );
    assert.ok(!existsSync(nowhere));
  });

  await t.test(
    "never removes a file of the library listed by another path",
    (t) => {
      const src = createApp(t);
      syncSource(src);
      // `old-hooks` linked to `hooks` - a file the library no longer has there
      // is the library's through the link
      symlinkSync(join(src, "hooks"), join(src, "old-hooks"), "junction");
      const manifest = readManifest(src);
      manifest.files["old-hooks/use-url-state.ts"] =
        manifest.files["hooks/use-url-state.ts"];
      writeManifest(src, manifest);

      const result = syncSource(src);
      assert.deepEqual(result.removed, []);
      assert.deepEqual(result.kept, []);
      assert.ok(existsSync(join(src, "hooks/use-url-state.ts")));
      assert.ok(
        !Object.hasOwn(readManifest(src).files, "old-hooks/use-url-state.ts"),
      );
    },
  );

  await t.test("leaves a link to a folder it empties", (t) => {
    const src = createApp(t);
    syncSource(src);
    // `utils/old` linked to a folder of the app in the copy, with the last
    // file in it one the library had
    mkdirSync(join(src, "lib/old"), { recursive: true });
    writeFileSync(join(src, "lib/old/x.ts"), "// old\n");
    symlinkSync(join(src, "lib/old"), join(src, "utils/old"), "junction");
    const manifest = readManifest(src);
    manifest.files["utils/old/x.ts"] = hashOf("// old\n");
    writeManifest(src, manifest);

    const result = syncSource(src);
    assert.deepEqual(result.removed, ["utils/old/x.ts"]);
    assert.ok(lstatSync(join(src, "utils/old")).isSymbolicLink());
    assert.deepEqual(readdirSync(join(src, "lib/old")), []);
  });

  await t.test("refuses to sync into the library itself", () => {
    const library = fileURLToPath(new URL("..", import.meta.url));
    for (const target of [library, join(library, "src")]) {
      assert.throws(
        () => syncSource(target, { dryRun: true }),
        /in the library itself/,
      );
    }
  });

  await t.test("never writes the manifest through a link", (t) => {
    const src = createApp(t);
    syncSource(src);
    const temporary = join(src, `${MANIFEST}.tmp`);
    // Left by a sync stopped halfway
    writeFileSync(temporary, "{");
    syncSource(src);
    assert.ok(!existsSync(temporary));
    assert.ok(readManifest(src).files["components/ui/button.tsx"]);

    // A folder there, or where a file is written first - removing it would
    // take what is in it. Stops the sync before it writes anything, also a
    // dry run
    writeFileSync(join(src, "components/ui/badge.tsx"), "// patched\n");
    for (const file of [
      `${MANIFEST}.tmp`,
      "components/ui/badge.tsx.components-ui.tmp",
    ]) {
      mkdirSync(join(src, file));
      writeFileSync(join(src, file, "notes.txt"), "// of the app\n");
      for (const options of [{ dryRun: true, force: true }, { force: true }]) {
        assert.throws(() => syncSource(src, options), {
          message: `Folders in the copy where the sync writes a file first, then renames it - remove them:\n  ${file}`,
        });
      }
      assert.equal(read(src, `${file}/notes.txt`), "// of the app\n");
      assert.equal(read(src, "components/ui/badge.tsx"), "// patched\n");
      rmSync(join(src, file), { recursive: true });
    }
    syncSource(src, { force: true });

    // Links to files need the rights of an admin on Windows
    if (process.platform === "win32") return;
    const outside = join(src, "../outside.json");
    const nowhere = join(src, "../nowhere.json");
    writeFileSync(outside, "// not of the copy\n");
    // Where the manifest is written first - a link to a file out of the copy,
    // and one to none, which writing would make. Removed, not written through
    for (const link of [outside, nowhere]) {
      symlinkSync(link, temporary);
      syncSource(src, { dryRun: true });
      assert.ok(lstatSync(temporary).isSymbolicLink());

      syncSource(src);
      assert.equal(lstatSync(temporary, { throwIfNoEntry: false }), undefined);
      assert.ok(lstatSync(join(src, MANIFEST)).isFile());
      assert.ok(readManifest(src).files["components/ui/button.tsx"]);
    }
    assert.equal(readFileSync(outside, "utf8"), "// not of the copy\n");
    assert.ok(!existsSync(nowhere));
  });

  await t.test("never leaves a file written halfway", (t) => {
    const src = createApp(t);
    syncSource(src);
    const badge = read(src, "components/ui/badge.tsx");
    const hook = read(src, "hooks/use-url-state.ts");
    // An older badge, and the hook of the library gone
    const manifest = readManifest(src);
    writeFileSync(join(src, "components/ui/badge.tsx"), "// older\n");
    manifest.files["components/ui/badge.tsx"] = hashOf("// older\n");
    writeManifest(src, manifest);
    rmSync(join(src, "hooks/use-url-state.ts"));
    // Left by a sync stopped while it wrote them - by Ctrl+C or a full disk
    const halves = {
      "components/ui/badge.tsx.components-ui.tmp": badge.slice(0, 20),
      "hooks/use-url-state.ts.components-ui.tmp": hook.slice(0, 20),
    };
    for (const [file, content] of Object.entries(halves)) {
      writeFileSync(join(src, file), content);
    }
    // Read while the sync writes - by the dev server of the app, say. Not on
    // Windows, which refuses to rename over an open file
    const reader =
      process.platform === "win32"
        ? undefined
        : openSync(join(src, "components/ui/badge.tsx"), "r");
    if (reader !== undefined) t.after(() => closeSync(reader));

    const result = syncSource(src);
    assert.deepEqual(result.updated, ["components/ui/badge.tsx"]);
    assert.deepEqual(result.added, ["hooks/use-url-state.ts"]);
    assert.equal(read(src, "components/ui/badge.tsx"), badge);
    assert.equal(read(src, "hooks/use-url-state.ts"), hook);
    // Gone - not left in the app, nor listed
    for (const file of Object.keys(halves)) {
      assert.ok(!existsSync(join(src, file)), file);
    }
    assert.deepEqual(
      Object.keys(readManifest(src).files).filter((file) =>
        file.endsWith(".tmp"),
      ),
      [],
    );
    // Written next to it, then renamed over it - the old badge stays whole
    // for one who reads it
    if (reader === undefined) return;
    const buffer = Buffer.alloc(100);
    const length = readSync(reader, buffer, 0, buffer.length, 0);
    assert.equal(buffer.subarray(0, length).toString(), "// older\n");
  });

  await t.test("leaves the files of Finder and editors to the app", (t) => {
    const src = createApp(t);
    syncSource(src);
    // Listed by a sync that copied them from the library - one as it was
    // then, one Finder rewrote since, the swap file of Vim
    const manifest = readManifest(src);
    const files = {
      "components/ui/.DS_Store": hashOf(""),
      "hooks/.DS_Store": hashOf("rewritten since"),
      "components/ui/.badge.tsx.swp": hashOf(""),
    };
    for (const [file, hash] of Object.entries(files)) {
      writeFileSync(join(src, file), "");
      manifest.files[file] = hash;
    }
    writeManifest(src, manifest);

    // Neither removed nor kept as the library's - left out of the manifest
    const result = syncSource(src);
    assert.equal(result.stop, null);
    assert.deepEqual(
      [...result.removed, ...result.kept, ...result.changedLocally],
      [],
    );
    for (const file of Object.keys(files)) {
      assert.ok(existsSync(join(src, file)), file);
      assert.ok(!(file in readManifest(src).files), file);
    }
  });

  await t.test("follows a file the library renamed in case", (t) => {
    const src = createApp(t);
    syncSource(src);
    const folder = join(src, "components/ui");
    const badge = read(src, "components/ui/badge.tsx");
    // The badges in the folder - `Badge.tsx` and `badge.tsx` are one file on
    // macOS and Windows, two on Linux
    const badges = () =>
      readdirSync(folder).filter((name) => /^badge\.tsx$/i.test(name));

    /** A copy of a version of the library with `Badge.tsx`, as `content`. */
    const older = (content) => {
      rmSync(join(folder, "badge.tsx"));
      writeFileSync(join(folder, "Badge.tsx"), content);
      const manifest = readManifest(src);
      delete manifest.files["components/ui/badge.tsx"];
      manifest.files["components/ui/Badge.tsx"] = hashOf("// older\n");
      writeManifest(src, manifest);
    };

    const isOneFile = isCaseInsensitive(src);
    const renamed = [["components/ui/Badge.tsx", "components/ui/badge.tsx"]];

    older("// older\n");
    const result = syncSource(src);
    if (isOneFile) {
      // Renamed, then updated as the file the manifest lists by the old name
      assert.deepEqual(result.renamed, renamed);
      assert.deepEqual(result.updated, ["components/ui/badge.tsx"]);
      assert.deepEqual([...result.added, ...result.removed], []);
    } else {
      assert.deepEqual(result.removed, ["components/ui/Badge.tsx"]);
      assert.deepEqual(result.added, ["components/ui/badge.tsx"]);
    }
    // By the new name - not lost with the old one
    assert.deepEqual(badges(), ["badge.tsx"]);
    assert.equal(read(src, "components/ui/badge.tsx"), badge);
    assert.deepEqual(
      Object.keys(readManifest(src).files).filter((file) =>
        /badge\.tsx$/i.test(file),
      ),
      ["components/ui/badge.tsx"],
    );

    // Changed in the copy since - kept, or replaced by --force where the two
    // names are one file
    older("// patched\n");
    if (isOneFile) {
      assert.throws(() => syncSource(src), /--force[^]*Badge\.tsx$/);
      // A sync that stops renames nothing either
      assert.deepEqual(badges(), ["Badge.tsx"]);
      assert.equal(read(src, "components/ui/Badge.tsx"), "// patched\n");
      const forced = syncSource(src, { force: true });
      assert.deepEqual(forced.renamed, renamed);
      assert.deepEqual(forced.updated, ["components/ui/badge.tsx"]);
      assert.deepEqual(badges(), ["badge.tsx"]);
    } else {
      const kept = syncSource(src);
      assert.deepEqual(kept.kept, ["components/ui/Badge.tsx"]);
      assert.deepEqual(kept.added, ["components/ui/badge.tsx"]);
      assert.equal(read(src, "components/ui/Badge.tsx"), "// patched\n");
    }
    assert.equal(read(src, "components/ui/badge.tsx"), badge);
  });

  await t.test("follows a folder the library renamed in case", (t) => {
    const src = createApp(t);
    if (!isCaseInsensitive(src)) {
      t.skip("two folders where the file system tells case apart");
      return;
    }
    syncSource(src);
    const folder = join(src, "components/ui");
    // A version of the library with `Data-Table/Index.tsx`, before it had
    // `types.ts`
    renameInCase(src, "components/ui/data-table", "components/ui/Data-Table");
    renameInCase(
      src,
      "components/ui/Data-Table/index.tsx",
      "components/ui/Data-Table/Index.tsx",
    );
    rmSync(join(folder, "Data-Table/types.ts"));
    const manifest = readManifest(src);
    manifest.files = Object.fromEntries(
      Object.entries(manifest.files)
        .filter(([file]) => file !== "components/ui/data-table/types.ts")
        .map(([file, hash]) => [
          file
            .replace(
              /^components\/ui\/data-table\//,
              "components/ui/Data-Table/",
            )
            .replace(/\/Data-Table\/index\.tsx$/, "/Data-Table/Index.tsx"),
          hash,
        ]),
    );
    // A file it had then, no more now - of the library too, and the file of
    // Finder, which nothing imports: the folder goes with them, no stop
    writeFileSync(join(folder, "Data-Table/old.tsx"), "// old\n");
    manifest.files["components/ui/Data-Table/old.tsx"] = hashOf("// old\n");
    writeManifest(src, manifest);
    writeFileSync(join(folder, "Data-Table/.DS_Store"), "");

    const renamed = [
      ["components/ui/Data-Table", "components/ui/data-table"],
      [
        "components/ui/data-table/Index.tsx",
        "components/ui/data-table/index.tsx",
      ],
    ];
    const dryRun = syncSource(src, { dryRun: true });
    assert.deepEqual(dryRun.renamed, renamed);
    assert.deepEqual(dryRun.appFilesRenamed, []);
    assert.equal(dryRun.stop, null);
    assert.deepEqual(dryRun.added, ["components/ui/data-table/types.ts"]);
    assert.deepEqual(dryRun.removed, ["components/ui/Data-Table/old.tsx"]);
    assert.deepEqual(dryRun.updated, []);
    assert.ok(readdirSync(folder).includes("Data-Table"));
    const plan = run(src, "--dry-run");
    assert.equal(plan.status, 0);
    assert.match(
      plan.stdout,
      /Renamed in case[^\n]*files of the app[^\n]*\n {2}components\/ui\/Data-Table -> components\/ui\/data-table\n/,
    );
    // Out of a repository Git knows nothing - the commands for the renames
    // of the sync
    assert.match(
      plan.stdout,
      /\n {2}git -C .* add -- components\/ui\/data-table\n/,
    );

    assert.deepEqual(syncSource(src).renamed, renamed);
    const names = readdirSync(folder);
    assert.ok(names.includes("data-table") && !names.includes("Data-Table"));
    assert.deepEqual(
      readdirSync(join(folder, "data-table"))
        .filter((name) =>
          ["index.tsx", "types.ts", "old.tsx", ".DS_Store"].includes(name),
        )
        .sort(),
      [".DS_Store", "index.tsx", "types.ts"],
    );
    assert.ok(
      Object.keys(readManifest(src).files).every(
        (file) => !/Data-Table|Index\.tsx/.test(file),
      ),
    );

    // Nothing to do the next time
    const again = syncSource(src, { dryRun: true });
    assert.deepEqual(
      [...again.renamed, ...again.added, ...again.updated, ...again.removed],
      [],
    );
  });

  await t.test(
    "stops at files of the app in a folder to rename in case",
    (t) => {
      const src = createApp(t);
      if (!isCaseInsensitive(src)) {
        t.skip("two folders where the file system tells case apart");
        return;
      }
      // Folders of the app by names of the library in other case - imported
      // by them, which a build on Linux would not find after a rename
      renameInCase(src, "hooks", "Hooks");
      mkdirSync(join(src, "Components"));
      writeFileSync(join(src, "Components/Header.tsx"), "// of the app\n");
      const folders = () =>
        readdirSync(src)
          .filter((name) => /^(components|hooks)$/i.test(name))
          .sort();

      const stop =
        /--adopt[^]*:\n {2}Components -> components\n {4}Components\/Header\.tsx\n {2}Hooks -> hooks\n {4}Hooks\/use-session\.ts$/;
      const dryRun = syncSource(src, { dryRun: true });
      assert.deepEqual(dryRun.appFilesRenamed, [
        "Components/Header.tsx",
        "Hooks/use-session.ts",
      ]);
      assert.match(dryRun.stop, stop);
      // The whole plan, then why a real run would stop
      const plan = run(src, "--dry-run");
      assert.equal(plan.status, 1);
      assert.match(plan.stdout, /Renamed in case[^\n]*\n {2}Components -> /);
      assert.match(plan.stderr, /\n {4}Hooks\/use-session\.ts\n/);
      assert.match(plan.stderr, /a real run would stop/);

      // A sync that stops writes and renames nothing - also not with --force
      for (const options of [{}, { force: true }]) {
        assert.throws(() => syncSource(src, options), stop);
      }
      assert.deepEqual(folders(), ["Components", "Hooks"]);
      assert.ok(!existsSync(join(src, MANIFEST)));

      // --adopt renames them with all in them
      const adopted = syncSource(src, { adopt: true });
      assert.deepEqual(adopted.renamed, [
        ["Components", "components"],
        ["Hooks", "hooks"],
      ]);
      assert.deepEqual(folders(), ["components", "hooks"]);
      assert.ok(readdirSync(join(src, "components")).includes("Header.tsx"));
      assert.equal(read(src, "hooks/use-session.ts"), "// a hook of the app\n");
    },
  );

  await t.test("renames a file of a copy made by hand in case", (t) => {
    const src = createApp(t);
    if (!isCaseInsensitive(src)) {
      t.skip("two files where the file system tells case apart");
      return;
    }
    syncSource(src);
    const folder = join(src, "components/ui");
    const badge = read(src, "components/ui/badge.tsx");
    const badges = () =>
      readdirSync(folder).filter((name) => /^badge\.tsx$/i.test(name));
    const renamed = [["components/ui/Badge.tsx", "components/ui/badge.tsx"]];

    // No manifest - a file as the library's, and a catalog of the app the
    // library imports by its name
    rmSync(join(src, MANIFEST));
    renameInCase(src, "components/ui/badge.tsx", "components/ui/Badge.tsx");
    renameInCase(src, "i18n/en.ts", "i18n/EN.ts");
    const same = syncSource(src);
    assert.deepEqual(same.renamed, [...renamed, ["i18n/EN.ts", "i18n/en.ts"]]);
    assert.deepEqual([...same.added, ...same.updated, ...same.templates], []);
    assert.deepEqual(badges(), ["badge.tsx"]);
    assert.ok(readdirSync(join(src, "i18n")).includes("en.ts"));
    assert.equal(read(src, "i18n/en.ts"), "// the texts of the app\n");
    assert.ok(readManifest(src).files["components/ui/badge.tsx"]);

    // Another one - the sync stops and renames nothing; --adopt renames it
    // and replaces it
    rmSync(join(src, MANIFEST));
    rmSync(join(folder, "badge.tsx"));
    writeFileSync(join(folder, "Badge.tsx"), "// older\n");
    assert.throws(() => syncSource(src), /--adopt[^]*badge\.tsx$/);
    assert.deepEqual(badges(), ["Badge.tsx"]);
    const adopted = syncSource(src, { adopt: true });
    assert.deepEqual(adopted.renamed, renamed);
    assert.deepEqual(adopted.updated, ["components/ui/badge.tsx"]);
    assert.deepEqual(badges(), ["badge.tsx"]);
    assert.equal(read(src, "components/ui/badge.tsx"), badge);
  });

  await t.test("tells how to commit the renames in case", (t) => {
    // A space in the path - the commands quote it
    const src = createApp(t, "components-ui app-");
    const git = (...args) =>
      spawnSync("git", ["-C", join(src, ".."), ...args], { encoding: "utf8" });
    if (!isCaseInsensitive(src) || git("--version").status !== 0) {
      t.skip("no Git, or no renames where the file system tells case apart");
      return;
    }
    /** Runs Git in the app - its output, failing on an error. */
    const inApp = (...args) => {
      const result = git(...args);
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const commit = (message) =>
      inApp(
        ...["-c", "user.name=Test", "-c", "user.email=test@example.com"],
        ...["-c", "commit.gpgsign=false", "commit", "--no-verify", "-qm"],
        message,
      );

    // A copy made by hand of a version of the library with `Badge.tsx` and
    // `Data-Table/Index.tsx`, before it had `types.ts` - with a file of the
    // app in the folder, which --adopt takes along, committed in the app. Git
    // ignores case on macOS and Windows: a rename in case alone it does not
    // see
    syncSource(src);
    rmSync(join(src, MANIFEST));
    renameInCase(src, "components/ui/badge.tsx", "components/ui/Badge.tsx");
    renameInCase(src, "components/ui/data-table", "components/ui/Data-Table");
    renameInCase(
      src,
      "components/ui/Data-Table/index.tsx",
      "components/ui/Data-Table/Index.tsx",
    );
    rmSync(join(src, "components/ui/Data-Table/types.ts"));
    writeFileSync(
      join(src, "components/ui/Data-Table/extra.tsx"),
      "// of the app\n",
    );
    inApp("init", "-q");
    inApp("add", "-A");
    commit("The copy");

    // The plan says it too - the folder once, with all in it
    const commands = (output) =>
      output
        .split("\n")
        .filter((line) => line.startsWith("  git "))
        .map((line) => line.trim());
    // The copy by a path from the folder of the app - the commands give its
    // whole path, as the sync finds it from there, which works out of that
    // folder too
    const inParent = (...args) =>
      spawnSync(process.execPath, [script, "src", "--adopt", ...args], {
        cwd: join(src, ".."),
        encoding: "utf8",
        env: environment,
      });
    const plan = inParent("--dry-run");
    const sync = inParent();
    assert.equal(sync.status, 0, sync.stderr);
    // `/private/var` for `/var` on macOS, say
    const parent = spawnSync(process.execPath, ["-p", "process.cwd()"], {
      cwd: join(src, ".."),
      encoding: "utf8",
    }).stdout.trim();
    const path = shellWord(join(parent, "src"));
    assert.deepEqual(commands(sync.stdout), [
      `git -C ${path} rm -r --cached -q --ignore-unmatch -- components/ui/Badge.tsx components/ui/Data-Table`,
      `git -C ${path} add -- components/ui/badge.tsx components/ui/data-table`,
    ]);
    assert.deepEqual(commands(plan.stdout), commands(sync.stdout));
    // And a sync again before the commit - with nothing to rename, while Git
    // keeps the old names
    const again = inParent();
    assert.equal(again.status, 0, again.stderr);
    assert.doesNotMatch(again.stdout, /Renamed in case/);
    assert.deepEqual(commands(again.stdout), commands(sync.stdout));

    for (const command of commands(sync.stdout)) {
      const result = spawnSync(command, { encoding: "utf8", shell: true });
      assert.equal(result.status, 0, result.stderr);
    }
    inApp("add", "-A");
    commit("The sync");
    // By the names of the library - which a build on Linux looks for
    const files = inApp("ls-files", "src/components/ui").split("\n");
    for (const file of [
      "badge.tsx",
      "data-table/index.tsx",
      "data-table/types.ts",
      "data-table/extra.tsx",
    ]) {
      assert.ok(files.includes(`src/components/ui/${file}`), file);
    }
    assert.deepEqual(
      files.filter((file) => /Badge|Data-Table|Index/.test(file)),
      [],
    );
    // Committed - no more to say
    assert.deepEqual(commands(inParent().stdout), []);
  });

  await t.test("refuses a manifest it cannot go by", (t) => {
    const src = createApp(t);
    syncSource(src);
    const text = (manifest) =>
      typeof manifest === "string" ? manifest : JSON.stringify(manifest);

    for (const [manifest, error] of [
      // A conflict of a merge left in it
      [
        '{\n<<<<<<< HEAD\n  "files": {}\n}\n',
        /\.components-ui\.json is not valid JSON - fix the manifest: /,
      ],
      [
        { files: ["components/ui/badge.tsx"] },
        /\.components-ui\.json has no list of files/,
      ],
      // No object with files, as the sync writes - not taken for a copy
      // without a manifest
      ...[
        "[]",
        "1",
        '"x"',
        "true",
        "null",
        "{}",
        '{"version":"0.5.0"}',
        '{"files":null}',
      ].map((manifest) => [
        manifest,
        /\.components-ui\.json has no list of files - fix the manifest\.$/,
      ]),
      [
        { files: { "components/ui/badge.tsx": 1 } },
        /\.components-ui\.json lists a file without a hash - fix the manifest: components\/ui\/badge\.tsx$/,
      ],
      // Folders - one by its slash, one of the library that is there
      [
        { files: { "hooks/": hashOf("") } },
        /\.components-ui\.json lists a folder, not a file - fix the manifest: hooks\/$/,
      ],
      [
        { files: { "components/ui/data-table": hashOf("") } },
        /\.components-ui\.json lists a folder, not a file - fix the manifest: components\/ui\/data-table$/,
      ],
    ]) {
      writeFileSync(join(src, MANIFEST), text(manifest));
      assert.throws(() => syncSource(src, { dryRun: true }), error);
      assert.throws(() => syncSource(src), error);
      assert.equal(read(src, MANIFEST), text(manifest));
    }
    assert.ok(existsSync(join(src, "components/ui/data-table/index.tsx")));
    // An empty list is one - of no file yet
    writeManifest(src, { files: {} });
    assert.equal(syncSource(src, { dryRun: true }).stop, null);

    // The path of a library file written another way - the sync would take it
    // for a file the library no longer has, and remove the library's
    const hook = hashOf(read(src, "hooks/use-url-state.ts"));
    for (const file of [
      "./hooks/use-url-state.ts",
      "hooks//use-url-state.ts",
      "hooks/./use-url-state.ts",
      "hooks/use-url-state.ts/.",
      "hooks\\use-url-state.ts",
    ]) {
      writeManifest(src, { files: { [file]: hook } });
      for (const options of [{ dryRun: true }, {}]) {
        assert.throws(() => syncSource(src, options), {
          message: `${MANIFEST} lists a path not in the form hooks/x.ts - fix the manifest: ${file}`,
        });
      }
      assert.ok(existsSync(join(src, "hooks/use-url-state.ts")));
    }

    // The command line names the manifest too - not a bare error of JSON
    writeFileSync(join(src, MANIFEST), "{");
    const result = run(src, "--dry-run");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^\.components-ui\.json is not valid JSON/);
  });

  await t.test("stops at a file or a folder of the copy in the way", (t) => {
    const src = createApp(t);
    syncSource(src);
    const manifest = readManifest(src);
    // A file of the app where the library has a folder, and a folder where
    // it has a file - one the manifest lists, rightly
    const folder = join(src, "components/ui");
    rmSync(join(folder, "data-table"), { recursive: true });
    writeFileSync(join(folder, "data-table"), "// of the app\n");
    rmSync(join(folder, "badge.tsx"));
    mkdirSync(join(folder, "badge.tsx"));
    writeFileSync(join(folder, "badge.tsx/index.tsx"), "// of the app\n");

    const stop =
      /Files in the copy where the library has a folder - rename or remove them, the sync does not:\n {2}components\/ui\/data-table\nFolders in the copy where the library has a file - rename or remove them, the sync does not:\n {2}components\/ui\/badge\.tsx$/;
    const dryRun = syncSource(src, { dryRun: true });
    assert.deepEqual(dryRun.filesInTheWay, ["components/ui/data-table"]);
    assert.deepEqual(dryRun.foldersInTheWay, ["components/ui/badge.tsx"]);
    assert.match(dryRun.stop, stop);
    const plan = run(src, "--dry-run");
    assert.equal(plan.status, 1);
    assert.match(plan.stderr, /\n {2}components\/ui\/data-table\n/);
    // No option makes the sync remove them
    for (const options of [{}, { adopt: true, force: true }]) {
      assert.throws(() => syncSource(src, options), stop);
    }
    assert.equal(read(src, "components/ui/data-table"), "// of the app\n");
    assert.equal(
      read(src, "components/ui/badge.tsx/index.tsx"),
      "// of the app\n",
    );
    assert.deepEqual(readManifest(src), manifest);

    // A file of a version of the library before the folder, as it put it
    // there - removed first, then the folder is written
    rmSync(join(folder, "badge.tsx"), { recursive: true });
    writeFileSync(join(folder, "data-table"), "// old\n");
    manifest.files["components/ui/data-table"] = hashOf("// old\n");
    // And a folder of the app where a file was that the library has no more
    // - nothing of the library to remove
    mkdirSync(join(src, "utils/old.ts"));
    writeFileSync(join(src, "utils/old.ts/notes.txt"), "// of the app\n");
    manifest.files["utils/old.ts"] = hashOf("// old\n");
    writeManifest(src, manifest);
    const result = syncSource(src);
    assert.deepEqual(result.removed, ["components/ui/data-table"]);
    assert.deepEqual(result.kept, []);
    assert.ok(result.added.includes("components/ui/data-table/index.tsx"));
    assert.ok(existsSync(join(folder, "data-table/index.tsx")));
    assert.ok(existsSync(join(folder, "badge.tsx")));
    assert.equal(read(src, "utils/old.ts/notes.txt"), "// of the app\n");
    assert.ok(!("utils/old.ts" in readManifest(src).files));
  });

  await t.test("quotes a path in its commands for the shell", () => {
    for (const [platform, value, word] of [
      ["linux", "../my-app/src", "../my-app/src"],
      ["darwin", "/Users/jan/my app/src", "'/Users/jan/my app/src'"],
      ["linux", "/home/jan/it's/src", "'/home/jan/it'\\''s/src'"],
      // cmd.exe keeps single quotes as they are - double ones on Windows,
      // which PowerShell takes too
      ["win32", "..\\my-app\\src", "..\\my-app\\src"],
      ["win32", "C:\\Users\\RUNNER~1\\src", "C:\\Users\\RUNNER~1\\src"],
      ["win32", "C:\\Users\\Jan\\my app\\src", '"C:\\Users\\Jan\\my app\\src"'],
      ["win32", "D:\\R&D\\src", '"D:\\R&D\\src"'],
    ]) {
      assert.equal(shellWord(value, platform), word, `${platform} ${value}`);
    }
  });

  await t.test(
    "plans the whole sync in a dry run, also where it stops",
    (t) => {
      const src = createApp(t);
      syncSource(src);
      writeFileSync(join(src, "components/ui/badge.tsx"), "// patched\n");
      rmSync(join(src, "components/ui/button.tsx"));
      const manifest = readManifest(src);
      writeFileSync(join(src, "utils/old.ts"), "// old\n");
      manifest.files["utils/old.ts"] = hashOf("// old\n");
      writeManifest(src, manifest);

      const result = syncSource(src, { dryRun: true });
      assert.deepEqual(result.added, ["components/ui/button.tsx"]);
      assert.deepEqual(result.removed, ["utils/old.ts"]);
      assert.deepEqual(result.changedLocally, ["components/ui/badge.tsx"]);
      assert.match(result.stop, /--force/);

      const dryRun = run(src, "--dry-run");
      assert.equal(dryRun.status, 1);
      assert.match(dryRun.stdout, /Added:\n {2}components\/ui\/button\.tsx/);
      assert.match(dryRun.stdout, /Removed:\n {2}utils\/old\.ts/);
      assert.match(dryRun.stderr, /components\/ui\/badge\.tsx/);
      assert.match(dryRun.stderr, /a real run would stop/);
      assert.ok(!existsSync(join(src, "components/ui/button.tsx")));

      // Without the conflict the plan passes
      assert.equal(run(src, "--dry-run", "--force").status, 0);
    },
  );

  await t.test("takes a --dry-run npm kept for itself for a dry run", (t) => {
    const src = createApp(t);

    // `npm run sync:source ../app/src --dry-run` - without the `--`
    const dryRun = runWith({ npm_config_dry_run: "true" }, src);
    assert.equal(dryRun.status, 0);
    assert.match(dryRun.stdout, /Dry run - nothing was written\.$/m);
    assert.ok(!existsSync(join(src, MANIFEST)));
    assert.ok(!existsSync(join(src, "components")));

    // A --force npm kept stays npm's - the sync stops, and says where it goes
    syncSource(src);
    writeFileSync(join(src, "components/ui/badge.tsx"), "// patched\n");
    const stopped = runWith({ npm_config_force: "true" }, src);
    assert.equal(stopped.status, 1);
    assert.ok(
      stopped.stderr.includes(
        `npm kept --force for itself - give the options after the --: npm run sync:source -- ${shellWord(src)} --force\n`,
      ),
      stopped.stderr,
    );
    assert.equal(read(src, "components/ui/badge.tsx"), "// patched\n");

    // Also in a dry run - which the command keeps
    const both = runWith(
      { npm_config_dry_run: "true", npm_config_force: "true" },
      src,
    );
    assert.equal(both.status, 1);
    assert.ok(
      both.stderr.includes(
        `npm run sync:source -- ${shellWord(src)} --dry-run --force\n`,
      ),
      both.stderr,
    );
    // No word of npm where the options came after the `--`
    assert.doesNotMatch(run(src, "--dry-run").stderr, /npm kept/);
  });

  await t.test("refuses a command line it does not know", (t) => {
    const src = createApp(t);

    // A typo of --dry-run, a short option, a folder that is not there
    for (const args of [
      [src, "--dryrun"],
      ["-n", src],
      [src, join(src, "other")],
      [join(src, "typo")],
      [],
    ]) {
      const result = run(...args);
      assert.equal(result.status, 1, args.join(" "));
      assert.ok(!existsSync(join(src, MANIFEST)), args.join(" "));
    }
    assert.match(run(src, "--dryrun").stderr, /Usage: npm run sync:source/);
    assert.ok(!existsSync(join(src, "typo")));

    assert.equal(run(src, "--dry-run").status, 0);
    assert.ok(!existsSync(join(src, MANIFEST)));
  });

  await t.test("runs by a link to its folder", (t) => {
    const src = createApp(t);
    // Node runs the file the link leads to
    const scripts = join(src, "../scripts");
    symlinkSync(dirname(script), scripts, "junction");

    const result = spawnSync(
      process.execPath,
      [join(scripts, "sync-source.mjs"), src, "--dry-run"],
      { encoding: "utf8", env: environment },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dry run - nothing was written\.$/m);
  });
});

test("The version of the library in the manifest", (t) => {
  // A library in a repository of its own, released by a tag without a
  // message, as the releases of the library are tagged
  const library = mkdtempSync(join(tmpdir(), "components-ui-library-"));
  t.after(() => rmSync(library, { force: true, recursive: true }));
  const git = (...args) =>
    spawnSync(
      "git",
      [
        ...["-C", library, "-c", "user.name=Test"],
        ...["-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"],
        ...["-c", "tag.gpgsign=false", ...args],
      ],
      { encoding: "utf8" },
    );
  if (git("--version").status !== 0) {
    t.skip("no Git");
    return;
  }
  const write = (file, content = "// a file\n") => {
    mkdirSync(join(library, file, ".."), { recursive: true });
    writeFileSync(join(library, file), content);
  };
  write("package.json", '{"version":"1.2.3"}\n');
  write("LICENSE");
  write("src/hooks/use-a.ts");
  for (const args of [
    ["init", "-q"],
    ["add", "-A"],
    ["commit", "--no-verify", "-qm", "1.2.3"],
    ["tag", "v1.2.3"],
  ]) {
    const result = git(...args);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.deepEqual(libraryVersion(library), {
    commit: "v1.2.3",
    version: "1.2.3",
  });

  // Not in a copy - a test, a file of the system, the docs
  write("src/hooks/use-a.test.ts");
  write("src/hooks/.DS_Store");
  write("docs/guide.md");
  assert.equal(libraryVersion(library).commit, "v1.2.3");

  // A file of the copy not in Git yet - the sync takes it along
  write("src/hooks/use-b.ts");
  assert.equal(libraryVersion(library).commit, "v1.2.3-dirty");
  rmSync(join(library, "src/hooks/use-b.ts"));
  // And one changed since the commit
  write("src/hooks/use-a.ts", "// changed\n");
  assert.equal(libraryVersion(library).commit, "v1.2.3-dirty");
});
