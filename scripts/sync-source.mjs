// Copies the library into the `src` of an app as a source copy - and updates
// such a copy: `npm run sync:source -- ../my-app/src`. A manifest in the
// copy (`.components-ui.json`) lists the files the library put there with
// their hashes, so an update replaces and removes those alone - never a file
// of the app, also not one in `hooks/`, `utils/` or `providers/` next to the
// library's. The catalogs of the app (`i18n/en.ts`, `i18n/cs.ts`) are
// written once, as templates. A library file changed in the copy stops the
// update, unless `--force` - a local fix belongs in the library.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exportSource } from "./export-source.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

export const MANIFEST = ".components-ui.json";

/** The catalogs of the app - templates, written when missing, then its own. */
export const APP_FILES = new Set(["i18n/en.ts", "i18n/cs.ts"]);

const hashOf = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

/** The files under `directory`, as paths with forward slashes. */
function listFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(directory, join(entry.parentPath, entry.name))
        .split(sep)
        .join("/"),
    );
}

function libraryVersion() {
  const { version } = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  let commit = null;
  try {
    // `-dirty` for a library with changes not committed yet
    commit = execFileSync("git", ["describe", "--always", "--dirty"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // Not a git checkout - the version alone
  }
  return { commit, version };
}

/** Removes the folders left empty on the way from `file` up to `top`. */
function removeEmptyFolders(file, top) {
  for (
    let folder = dirname(file);
    folder.startsWith(top) && folder !== top;
    folder = dirname(folder)
  ) {
    if (readdirSync(folder).length > 0) return;
    rmdirSync(folder);
  }
}

/**
 * Syncs the source copy in `target` (the `src` of an app) with the library.
 * Returns what it did - or, with `dryRun`, what it would do.
 */
export function syncSource(target, { dryRun = false, force = false } = {}) {
  const exported = mkdtempSync(join(tmpdir(), "components-ui-sync-"));

  try {
    exportSource(exported);
    // The license goes with the components
    copyFileSync(
      join(exported, "LICENSE"),
      join(exported, "src/components/ui/LICENSE"),
    );
    const source = join(exported, "src");
    const files = listFiles(source).sort();

    const manifestPath = join(target, MANIFEST);
    const previous = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, "utf8"))
      : null;
    const known = previous?.files ?? {};

    const result = {
      added: [],
      changedLocally: [],
      kept: [],
      removed: [],
      templates: [],
      updated: [],
    };

    for (const file of files) {
      const destination = join(target, file);
      if (APP_FILES.has(file)) {
        if (!existsSync(destination)) result.templates.push(file);
        continue;
      }
      if (!existsSync(destination)) {
        result.added.push(file);
        continue;
      }
      const current = hashOf(destination);
      if (current === hashOf(join(source, file))) continue;
      // Changed since the last sync - by hand, not by the library
      if (known[file] && known[file] !== current) {
        result.changedLocally.push(file);
      }
      result.updated.push(file);
    }

    const exportedFiles = new Set(files);
    for (const [file, hash] of Object.entries(known)) {
      if (exportedFiles.has(file)) continue;
      const destination = join(target, file);
      if (!existsSync(destination)) continue;
      // A file of the library no more - kept when changed in the copy
      if (hashOf(destination) === hash) result.removed.push(file);
      else result.kept.push(file);
    }

    if (result.changedLocally.length > 0 && !force) {
      const error = new Error(
        `Library files changed in the copy - move the changes into the library, or run again with --force to replace them:\n  ${result.changedLocally.join("\n  ")}`,
      );
      error.result = result;
      throw error;
    }

    if (dryRun) return result;

    for (const file of [
      ...result.templates,
      ...result.added,
      ...result.updated,
    ]) {
      const destination = join(target, file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(source, file), destination);
    }
    for (const file of result.removed) {
      const destination = join(target, file);
      rmSync(destination);
      removeEmptyFolders(destination, resolve(target));
    }

    const manifest = {
      ...libraryVersion(),
      files: Object.fromEntries(
        files
          .filter((file) => !APP_FILES.has(file))
          .map((file) => [file, hashOf(join(source, file))]),
      ),
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    return result;
  } finally {
    rmSync(exported, { force: true, recursive: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith("--"));
  if (!target) {
    console.error(
      "Usage: npm run sync:source -- <the src of the app> [--dry-run] [--force]",
    );
    process.exit(1);
  }

  try {
    const dryRun = args.includes("--dry-run");
    const result = syncSource(resolve(target), {
      dryRun,
      force: args.includes("--force"),
    });
    const report = [
      ["Added", result.added],
      ["Updated", result.updated],
      ["Removed", result.removed],
      ["Templates written", result.templates],
      ["Kept - changed in the copy, no more in the library", result.kept],
    ];
    for (const [title, list] of report) {
      if (list.length > 0) console.log(`${title}:\n  ${list.join("\n  ")}`);
    }
    console.log(
      dryRun
        ? "Dry run - nothing was written."
        : `The source copy in ${target} is up to date.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
