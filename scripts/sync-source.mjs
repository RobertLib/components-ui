// Copies the library into the `src` of an app as a source copy - and updates
// such a copy: `npm run sync:source -- ../my-app/src`. A manifest in the
// copy (`.components-ui.json`) lists the files the library put there with
// their hashes, so an update replaces and removes those alone - never a file
// of the app, also not one in `hooks/`, `utils/` or `providers/` next to the
// library's. The catalogs of the app (`i18n/en.ts`, `i18n/cs.ts`) are
// written once, as templates. A library file changed in the copy stops the
// update, unless `--force` - a local fix belongs in the library. So does a
// file of the app at a path of the library, one the manifest does not list,
// unless `--adopt` takes it for the library's - `--force` replaces the files
// of the library alone, never one of the app. So do the files of a copy made
// by hand, which has no manifest yet: those equal to the library's are taken
// over as they are, the others may be an older version of the library or a
// change of the app, which the sync cannot tell apart. Line endings do not
// count - Git for Windows checks out text with CRLF. A link in the copy that
// leads out of it stops the sync: it writes and removes in the copy alone. So
// does a file of the copy where the library has a folder, or a folder where
// it has a file - the sync removes neither. A folder or a file the copy has
// by a name in other case - one name on macOS and Windows - is renamed to the
// library's, a folder with all in it. A folder with files of the app in it
// stops the sync, unless `--adopt`: the app imports them by the old name,
// which a build on Linux does not find. Git there does not see such a
// rename, so the sync says how to commit it - also on a later run, while Git
// keeps the old name. Each file is written next to its place, then renamed
// over it - a sync stopped halfway leaves no half of one.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  exportSource,
  isCopied,
  isMain,
  isSystemFile,
  SOURCE_FOLDERS,
} from "./export-source.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

export const MANIFEST = ".components-ui.json";

/** The catalogs of the app - templates, written when missing, then its own. */
export const APP_FILES = new Set(["i18n/en.ts", "i18n/cs.ts"]);

const USAGE = `Usage: npm run sync:source -- <the src of the app> [--dry-run] [--force] [--adopt]
  --dry-run  shows what would change - nothing is written
  --force    replaces the library files changed in the copy
  --adopt    replaces the files at paths of the library the manifest does not list,
             and renames in case a folder of the library with files of the app in it
Give the options after the --: npm keeps those before it for itself.`;

const sha256 = (content, encoding) =>
  createHash("sha256").update(content, encoding).digest("hex");

/**
 * The hash of a file - of a text with LF line endings, so that a checkout
 * with CRLF is the same file. A binary file - one with a NUL byte - as it is.
 */
function hashOf(file) {
  const content = readFileSync(file);
  if (content.includes(0)) return sha256(content);
  // Latin-1 keeps every byte - and no UTF-8 character has a CR or LF in it
  return sha256(content.toString("latin1").replaceAll("\r\n", "\n"), "latin1");
}

/**
 * Whether `file` is as the library put it there by `hash` of the manifest -
 * also one of the version 0.5.0, which hashed the bytes, CRLF and all: of
 * the file as it is, or with CRLF where it has LF now (a manifest made from
 * a checkout of the library with CRLF, the copy checked out with LF since).
 */
function isUnchanged(file, hash) {
  const content = readFileSync(file);
  if (hash === sha256(content)) return true;
  if (content.includes(0)) return false;
  const text = content.toString("latin1").replaceAll("\r\n", "\n");
  return (
    hash === sha256(text, "latin1") ||
    hash === sha256(text.replaceAll("\n", "\r\n"), "latin1")
  );
}

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

/**
 * What `path` is on the disk - the same for each name of a file and each way
 * to it through links. `undefined` for nothing there.
 */
function fileId(path) {
  const stat = statSync(path, { bigint: true, throwIfNoEntry: false });
  if (stat === undefined) return undefined;
  // A file system without ids of files (a network drive) - by the path on
  // the disk
  return stat.ino === 0n
    ? `path:${realpathSync.native(path)}`
    : `${stat.dev}:${stat.ino}`;
}

/**
 * Whether `a` and `b` are one file - `Badge.tsx` and `badge.tsx` on macOS and
 * Windows, two files on Linux.
 */
function isSameFile(a, b) {
  const id = fileId(a);
  return id !== undefined && id === fileId(b);
}

/**
 * `renameSync`, tried again for a few seconds on Windows - an antivirus or
 * the search indexer holds a file just written for a moment (EPERM, EACCES,
 * EBUSY), as graceful-fs knows.
 */
function rename(from, to) {
  for (let delay = 10; ; delay *= 2) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      if (
        process.platform !== "win32" ||
        !["EACCES", "EBUSY", "EPERM"].includes(error.code) ||
        delay > 2560
      ) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}

/**
 * What is wrong with `file` of the manifest of the copy in `top` - `null`
 * for a file of the copy with a hash.
 */
function entryProblem(top, file, hash) {
  if (typeof hash !== "string") return "a file without a hash";
  const path = resolve(top, file);
  if (
    isAbsolute(file) ||
    file.split(/[\\/]/).includes("..") ||
    !path.startsWith(top + sep)
  ) {
    return "a file out of the copy";
  }
  // `hooks/` - the sync reads what it lists. One without the slash, as
  // `components/ui/data-table`, it tells by the folders of the library
  if (/[\\/]$/.test(file)) return "a folder, not a file";
  // `./hooks/x.ts` or `hooks\x.ts` - the file `hooks/x.ts` by another path,
  // which the sync would take for one the library no longer has, and remove
  if (file.includes("\\") || posix.normalize(file) !== file) {
    return "a path not in the form hooks/x.ts";
  }
  return null;
}

/**
 * The files of the library the manifest in `target` lists, with their
 * hashes - none for a copy without one. A path out of the copy stops the
 * sync: it removes the files listed.
 */
function readManifest(target) {
  const path = join(target, MANIFEST);
  if (!existsSync(path)) return {};

  const text = readFileSync(path, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    // A conflict of a merge, say - the bare error would not name the file
    throw new Error(
      `${MANIFEST} is not valid JSON - fix the manifest: ${error.message}`,
    );
  }
  // An object with its files, as the sync writes it. Not `[]` or `{}`: the
  // sync would take the copy for one made by hand - a copy without a manifest
  const isObject = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isObject(manifest) || !isObject(manifest.files)) {
    throw new Error(`${MANIFEST} has no list of files - fix the manifest.`);
  }
  const { files } = manifest;
  const top = resolve(target);
  for (const [file, hash] of Object.entries(files)) {
    const problem = entryProblem(top, file, hash);
    if (problem) {
      throw new Error(
        `${MANIFEST} lists ${problem} - fix the manifest: ${file}`,
      );
    }
  }
  return files;
}

/**
 * The version of the library in `library` and its commit for the manifest -
 * by the tag of a release also without a message (`git tag v0.6.1`, as the
 * releases have it), with `-dirty` where the files a copy takes differ from
 * the commit: changed, removed, or new and not in Git yet. Tests and files
 * Git ignores do not count, nor the rest of the library.
 */
export function libraryVersion(library = root) {
  const { version } = JSON.parse(
    readFileSync(join(library, "package.json"), "utf8"),
  );
  const git = (...args) =>
    execFileSync("git", ["-C", library, ...args], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  let commit = null;
  try {
    commit = git("describe", "--tags", "--always").trim();
    // `XY path` - a rename with the old path in a record after it
    const records = git(
      ...["status", "--porcelain", "-z", "--untracked-files=all", "--"],
      ...SOURCE_FOLDERS.map((folder) => `src/${folder}`),
      ...["src/styles.css", "LICENSE"],
    ).split("\0");
    const changed = [];
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (record.length < 4) continue;
      changed.push(record.slice(3));
      if (/[RC]/.test(record.slice(0, 2))) changed.push(records[++index]);
    }
    if (
      changed.some(
        (file) => !file.startsWith("src/") || isCopied(file.slice(4)),
      )
    ) {
      commit += "-dirty";
    }
  } catch {
    // Not a git checkout - the version alone
  }
  return { commit, version };
}

/**
 * The folders and the file on the way to `file` that the copy in `top` has by
 * a name in other case - `Data-Table` for `data-table` on macOS and Windows,
 * which take the two for one; none on Linux, where they are two. As `[from,
 * to]` to rename in order: `from` goes by the new name of the folder above.
 * `listings` keeps the folders read.
 */
function namesInOtherCase(top, file, listings) {
  const renames = [];
  let path = "";
  for (const name of file.split("/")) {
    const folder = join(top, path);
    const next = path === "" ? name : `${path}/${name}`;
    // Not there - nor anything under it
    if (!existsSync(join(top, next))) break;
    if (!listings.has(folder)) listings.set(folder, readdirSync(folder));
    const names = listings.get(folder);
    // There by a name in other case - the one the file system found for it
    const other = names.includes(name)
      ? undefined
      : names.find(
          (entry) =>
            entry.toLowerCase() === name.toLowerCase() &&
            isSameFile(join(folder, entry), join(folder, name)),
        );
    if (other !== undefined) {
      renames.push([path === "" ? other : `${path}/${other}`, next]);
    }
    path = next;
  }
  return renames;
}

/**
 * The files the renames in case of `renamed` in the copy in `top` would move
 * along that are not the library's - of the app, in a folder renamed. By
 * their names now. `isLibraryFile` tells a path of the library or of its
 * manifest.
 */
function appFilesRenamed(top, renamed, isLibraryFile) {
  const files = [];
  for (const [from, to] of renamed) {
    // A folder once - a file or a folder renamed in it is in it
    if (renamed.some(([, outer]) => from.startsWith(`${outer}/`))) continue;
    const folder = join(top, from);
    if (!statSync(folder).isDirectory()) continue;
    const entries = readdirSync(folder, {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      // A link too - an import through it fails as well
      if (entry.isDirectory()) continue;
      const name = relative(folder, join(entry.parentPath, entry.name))
        .split(sep)
        .join("/");
      // Of Finder or an editor - nothing imports those
      if (name.split("/").some(isSystemFile)) continue;
      if (!isLibraryFile(`${to}/${name}`)) files.push(`${from}/${name}`);
    }
  }
  return files;
}

/**
 * The file on the way to `file` in the copy in `top` - where the library has
 * a folder, which the sync cannot make. `undefined` for none.
 */
function fileOnTheWay(top, file) {
  let path = "";
  for (const name of file.split("/").slice(0, -1)) {
    path = path === "" ? name : `${path}/${name}`;
    // Through a link to a folder too
    const stat = statSync(join(top, path), { throwIfNoEntry: false });
    if (stat === undefined) return undefined;
    if (!stat.isDirectory()) return path;
  }
  return undefined;
}

/**
 * The paths of the library `files` that Git keeps by a name in other case in
 * the copy in `top` - renamed in case by a sync before, and not committed
 * yet. As `[from, to]`, by the name Git keeps. None without Git or out of a
 * repository, and none where the file system tells case apart: two files
 * there.
 */
function trackedInOtherCase(top, files) {
  let tracked;
  try {
    tracked = execFileSync("git", ["-C", top, "ls-files", "-z"], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).split("\0");
  } catch {
    // No Git, or not in a repository - the renames of this sync alone
    return [];
  }
  // The folders and the files of the library by their lower case
  const names = new Map();
  for (const file of files) {
    let path = "";
    for (const name of file.split("/")) {
      path = path === "" ? name : `${path}/${name}`;
      names.set(path.toLowerCase(), path);
    }
  }
  const renames = new Map();
  for (const file of tracked) {
    let path = "";
    for (const name of file.split("/")) {
      path = path === "" ? name : `${path}/${name}`;
      const library = names.get(path.toLowerCase());
      if (library === undefined) break;
      if (library === path) continue;
      // The first name in other case - a folder once, with all in it
      if (isSameFile(join(top, path), join(top, library))) {
        renames.set(path, library);
      }
      break;
    }
  }
  return [...renames];
}

/**
 * Removes the folders left empty on the way from `file` up to `top` - not a
 * link to a folder, which is the app's, nor those above it.
 */
function removeEmptyFolders(file, top) {
  for (
    let folder = dirname(file);
    folder.startsWith(top) && folder !== top;
    folder = dirname(folder)
  ) {
    if (lstatSync(folder).isSymbolicLink()) return;
    if (readdirSync(folder).length > 0) return;
    rmdirSync(folder);
  }
}

/**
 * Where `path` leads through the links on its way, by the names on the disk -
 * `realpathSync` keeps the case a path was typed in on macOS. Also a path not
 * there yet, or through a link to nothing: where writing would make it.
 * `null` for links in a loop.
 */
function leadsTo(path, links = 0) {
  try {
    return realpathSync.native(path);
  } catch {
    // Not there, or a link to nothing - by the folder above
  }
  const folder = dirname(path);
  if (folder === path) return path;
  const above = leadsTo(folder, links);
  if (above === null) return null;
  const at = join(above, basename(path));
  let link = false;
  try {
    link = lstatSync(at).isSymbolicLink();
  } catch {
    // Not there - made in the folder above
  }
  if (!link) return at;
  // More links than a path goes through - a loop
  if (links >= 40) return null;
  return leadsTo(resolve(above, readlinkSync(at)), links + 1);
}

/**
 * What `path` itself is, not where a link leads - `undefined` for nothing
 * there, also under a file, which has nothing in it.
 */
function lstatOf(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return undefined;
    throw error;
  }
}

/**
 * The links in the copy in `top` that the sync would write or remove `files`
 * through out of it - a folder linked to one of another project, say.
 */
function linksOut(top, files) {
  const realTop = realpathSync.native(top);
  const links = new Set();
  for (const file of files) {
    let path = top;
    for (const name of file.split("/")) {
      path = join(path, name);
      const stat = lstatOf(path);
      // Not there yet - made in the folder above, which is in the copy
      if (!stat) break;
      if (!stat.isSymbolicLink()) continue;
      if (!leadsTo(path)?.startsWith(realTop + sep)) {
        links.add(relative(top, path).split(sep).join("/"));
        break;
      }
    }
  }
  return [...links];
}

/** Where the sync writes `file` first - then renames it over it. */
const temporaryOf = (file) => `${file}.components-ui.tmp`;

/** Why a sync with `options` stops at the files of `result` - `null` if not. */
function stopReason(result, { adopt, force }) {
  const reasons = [];
  if (result.changedLocally.length > 0 && !force) {
    reasons.push(
      `Library files changed in the copy - move the changes into the library, or run again with --force to replace them:\n  ${result.changedLocally.join("\n  ")}`,
    );
  }
  if (result.notFromLibrary.length > 0 && !adopt) {
    reasons.push(
      `Files at paths of the library that the manifest does not list - of the app, or of a copy made by hand (an older version of the library or a change, the sync cannot tell): rename those of the app, or run again with --adopt to replace them with the library's:\n  ${result.notFromLibrary.join("\n  ")}`,
    );
  }
  if (result.appFilesRenamed.length > 0 && !adopt) {
    // Each folder with the files of the app in it
    const folders = result.renamed.flatMap(([from, to]) => {
      const files = result.appFilesRenamed.filter((file) =>
        file.startsWith(`${from}/`),
      );
      return files.length > 0
        ? [`${from} -> ${to}`, ...files.map((file) => `  ${file}`)]
        : [];
    });
    reasons.push(
      `Files of the app in folders the sync renames in case - the app imports them by the old name of the folder, which a build on Linux does not find: rename the folders yourself, and the imports of them, or run again with --adopt to rename the folders with all in them:\n  ${folders.join("\n  ")}`,
    );
  }
  if (result.filesInTheWay.length > 0) {
    reasons.push(
      `Files in the copy where the library has a folder - rename or remove them, the sync does not:\n  ${result.filesInTheWay.join("\n  ")}`,
    );
  }
  if (result.foldersInTheWay.length > 0) {
    reasons.push(
      `Folders in the copy where the library has a file - rename or remove them, the sync does not:\n  ${result.foldersInTheWay.join("\n  ")}`,
    );
  }
  return reasons.length > 0 ? reasons.join("\n") : null;
}

/**
 * Syncs the source copy in `target` (the `src` of an app) with the library.
 * Returns what it did - or, with `dryRun`, what it would do, with `stop`
 * saying why a real run would stop (`null` when it would not).
 */
export function syncSource(
  target,
  { adopt = false, dryRun = false, force = false } = {},
) {
  // A typo must not make a new folder with the whole library in it
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw new Error(`No folder ${target} - give the src of the app.`);
  }
  // Nor put the files of a copy into the library itself - its `src`, or the
  // whole library into its root
  const inLibrary = relative(
    realpathSync.native(root),
    realpathSync.native(target),
  );
  if (
    inLibrary !== ".." &&
    !inLibrary.startsWith(`..${sep}`) &&
    !isAbsolute(inLibrary)
  ) {
    throw new Error(
      `${target} is in the library itself - give the src of the app.`,
    );
  }
  const known = readManifest(target);
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

    const result = {
      added: [],
      appFilesRenamed: [],
      changedLocally: [],
      filesInTheWay: [],
      foldersInTheWay: [],
      kept: [],
      notFromLibrary: [],
      removed: [],
      renamed: [],
      stop: null,
      templates: [],
      trackedInOtherCase: [],
      updated: [],
    };

    // The paths of the manifest and of the library by their lower case -
    // macOS and Windows take `Badge.tsx` and `badge.tsx` for one file
    const knownPaths = new Map(
      Object.keys(known).map((file) => [file.toLowerCase(), file]),
    );
    const exportedPaths = new Map(
      files.map((file) => [file.toLowerCase(), file]),
    );
    // The old names of the folders and files to rename in case, by the new -
    // a folder once for all the files in it
    const renames = new Map();
    const listings = new Map();
    // The files of the copy on the way to files of the library
    const onTheWay = new Set();

    for (const file of files) {
      // Also a catalog of the app - the library imports it by its name
      for (const [from, to] of namesInOtherCase(target, file, listings)) {
        renames.set(to, from);
      }
      const destination = join(target, file);
      if (!existsSync(destination)) {
        // Or under a file of the copy, where the library has a folder
        const blocker = fileOnTheWay(target, file);
        if (blocker !== undefined) onTheWay.add(blocker);
        if (APP_FILES.has(file)) result.templates.push(file);
        else result.added.push(file);
        continue;
      }
      if (APP_FILES.has(file)) continue;
      // A folder of the copy where the library has a file - not one the sync
      // replaces, with what is in it
      if (!statSync(destination).isFile()) {
        result.foldersInTheWay.push(file);
        continue;
      }
      // As the library's - renamed in case above at most
      if (hashOf(destination) === hashOf(join(source, file))) continue;

      // The name the manifest lists it by - also the old one of a file the
      // library renamed in case, one file with the new one on macOS and
      // Windows
      const listed = [file, knownPaths.get(file.toLowerCase())].find(
        (name) =>
          name !== undefined &&
          Object.hasOwn(known, name) &&
          isSameFile(join(target, name), destination),
      );
      if (listed === undefined) {
        // Not put there by the library - or by a copy made by hand. Not for
        // --force: that one is for the files of the library changed by hand
        result.notFromLibrary.push(file);
        if (adopt) result.updated.push(file);
      } else if (!isUnchanged(destination, known[listed])) {
        // Changed since the last sync - by hand, not by the library
        result.changedLocally.push(listed);
        if (force) result.updated.push(file);
      } else {
        result.updated.push(file);
      }
    }
    // The folder above first - the files of the walk come after it
    result.renamed = [...renames].map(([to, from]) => [from, to]);
    // Those a rename would take along, of the app - not of the library, nor
    // of its manifest
    result.appFilesRenamed = appFilesRenamed(
      target,
      result.renamed,
      (file) =>
        exportedPaths.has(file.toLowerCase()) ||
        knownPaths.has(file.toLowerCase()),
    );

    const exportedFiles = new Set(files);
    // The files of the library in the copy by what they are on the disk - a
    // file the manifest lists by another path is one of them: by a name in
    // other case on macOS and Windows (renamed below), through a link to a
    // folder of the copy, by a short or a dotted name on Windows
    const libraryFiles = new Set(
      files.map((file) => fileId(join(target, file))).filter(Boolean),
    );
    for (const [file, hash] of Object.entries(known)) {
      if (exportedFiles.has(file)) continue;
      // Of Finder or an editor, which an older export took along - the
      // app's, left out of the manifest
      if (file.split("/").some(isSystemFile)) continue;
      const destination = join(target, file);
      if (!existsSync(destination)) continue;
      // A file of the library by another path - removing it would remove
      // the library's
      if (libraryFiles.has(fileId(destination))) continue;
      if (!statSync(destination).isFile()) {
        // `components/ui/data-table` - the sync reads what it lists
        if (files.some((name) => name.startsWith(`${file}/`))) {
          throw new Error(
            `${MANIFEST} lists a folder, not a file - fix the manifest: ${file}`,
          );
        }
        // A folder of the app where a file of the library was - not one to
        // remove
        continue;
      }
      // A file of the library no more - kept when changed in the copy
      if (isUnchanged(destination, hash)) result.removed.push(file);
      else result.kept.push(file);
    }
    // Those removed before the files are written are no more on the way
    result.filesInTheWay = [...onTheWay].filter(
      (file) =>
        !result.removed.some((removed) =>
          isSameFile(join(target, removed), join(target, file)),
        ),
    );
    result.trackedInOtherCase = trackedInOtherCase(resolve(target), files);

    const written = [...result.templates, ...result.added, ...result.updated];
    // Stops before it writes anything - also in a dry run, as a manifest out
    // of the copy does: no option makes the sync write out of it
    const links = linksOut(resolve(target), [
      ...written,
      ...result.removed,
      ...result.renamed.map(([, to]) => to),
    ]);
    if (links.length > 0) {
      throw new Error(
        `Links in the copy that lead out of it - the sync writes and removes in the copy alone:\n  ${links.join("\n  ")}`,
      );
    }
    // Where the files are written first - a folder there the sync does not
    // remove, with what is in it
    const temporaries = [`${MANIFEST}.tmp`, ...written.map(temporaryOf)];
    const folders = temporaries.filter((file) =>
      lstatOf(join(target, file))?.isDirectory(),
    );
    if (folders.length > 0) {
      throw new Error(
        `Folders in the copy where the sync writes a file first, then renames it - remove them:\n  ${folders.join("\n  ")}`,
      );
    }

    result.stop = stopReason(result, { adopt, force });
    if (dryRun) return result;
    if (result.stop) {
      const error = new Error(result.stop);
      error.result = result;
      throw error;
    }

    const manifestPath = join(target, MANIFEST);
    const temporary = `${manifestPath}.tmp`;
    // Left by a sync stopped halfway, or a link - removed, not written
    // through. Before the files: one it cannot remove stops the sync whole.
    // None is there under a file on the way, removed below
    for (const file of temporaries) {
      const path = join(target, file);
      if (lstatOf(path) !== undefined) rmSync(path, { force: true });
    }

    // Renamed in case first. A folder goes with all in it - the files of the
    // app too, which --adopt lets it take: one folder on macOS and Windows,
    // it cannot leave them by the old name
    for (const [from, to] of result.renamed) {
      const destination = join(target, to);
      // Straight where the file system renames in case - macOS and Windows
      // do. Else by way of another name: a rename in case alone may do
      // nothing where the two names are one
      try {
        rename(join(target, from), destination);
      } catch {
        // By way of another name below
      }
      if (!readdirSync(dirname(destination)).includes(basename(destination))) {
        const step = `${destination}.${randomUUID()}`;
        rename(join(target, from), step);
        try {
          rename(step, destination);
        } catch (error) {
          // Back to the old name - not left by one of the sync's
          try {
            rename(step, join(target, from));
          } catch {
            throw new Error(
              `${from} could not be renamed to ${to} (${error.message}) - it is at ${relative(target, step)} now, rename it to ${to} and run the sync again.`,
            );
          }
          throw error;
        }
      }
    }
    // Then removed - an old name in case still finds a file renamed above
    for (const file of result.removed) {
      const destination = join(target, file);
      rmSync(destination);
      removeEmptyFolders(destination, resolve(target));
    }
    for (const file of written) {
      const destination = join(target, file);
      // Also where a link to a folder not there yet leads
      mkdirSync(leadsTo(dirname(destination)), { recursive: true });
      // Written next to it, then renamed over it - a sync stopped halfway
      // leaves the old file whole, not half of the new one. As a new file:
      // one put there since, a link say, fails it, not written through
      const step = temporaryOf(destination);
      try {
        copyFileSync(join(source, file), step, constants.COPYFILE_EXCL);
        rename(step, destination);
      } finally {
        // Gone after the rename - not left behind by one that failed
        rmSync(step, { force: true });
      }
    }

    const manifest = {
      ...libraryVersion(),
      files: Object.fromEntries(
        files
          .filter((file) => !APP_FILES.has(file))
          .map((file) => [file, hashOf(join(source, file))]),
      ),
    };
    // Written next to it, then renamed over it - a sync stopped halfway
    // leaves the old manifest whole, not half of the new one. As a new file
    // ("wx"): one put there since, a link say, fails it, not written through
    try {
      writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
        flag: "wx",
      });
      rename(temporary, manifestPath);
    } finally {
      // Gone after the rename - not left behind by one that failed
      rmSync(temporary, { force: true });
    }

    return result;
  } finally {
    rmSync(exported, { force: true, recursive: true });
  }
}

/** The options of the command line - `null` with an error for wrong ones. */
function readArguments(args) {
  try {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      args,
      options: {
        adopt: { type: "boolean" },
        "dry-run": { type: "boolean" },
        force: { type: "boolean" },
        help: { short: "h", type: "boolean" },
      },
    });
    if (values.help) return { help: true };
    if (positionals.length !== 1) {
      throw new Error("Give one folder - the src of the app.");
    }
    return {
      adopt: values.adopt ?? false,
      // `npm run sync:source ../app/src --dry-run`, the option before the
      // `--`, goes to npm - the script gets `npm_config_dry_run` in its place.
      // A dry run all the same - else a run asked not to write would write
      dryRun:
        (values["dry-run"] ?? false) ||
        process.env.npm_config_dry_run === "true",
      force: values.force ?? false,
      target: positionals[0],
    };
  } catch (error) {
    // An unknown option, e.g. `--dryrun` - a run with a typo must not write
    console.error(`${error.message}\n${USAGE}`);
    return null;
  }
}

/**
 * What to do when a sync stops without `--force` or `--adopt` that went to
 * `npm run` before its `--` - npm keeps those for itself, with an
 * `npm_config_` variable for the script. Not taken for the options of the
 * sync: npm sets them from its own settings too, and a sync without them
 * only stops. `null` when npm kept none.
 */
function npmOptionsHint(options) {
  const kept = ["force", "adopt"].filter(
    (name) => !options[name] && process.env[`npm_config_${name}`] === "true",
  );
  if (kept.length === 0) return null;
  const command = [
    "npm run sync:source --",
    shellWord(options.target),
    options.dryRun && "--dry-run",
    (options.force || kept.includes("force")) && "--force",
    (options.adopt || kept.includes("adopt")) && "--adopt",
  ].filter(Boolean);
  return `npm kept ${kept.map((name) => `--${name}`).join(" and ")} for itself - give the options after the --: ${command.join(" ")}`;
}

/**
 * `value` as one word of a shell command - quoted when it has to be: in double
 * quotes on Windows, which cmd.exe and PowerShell take, in single quotes in
 * the shells of the others. A path on Windows has no `"`.
 */
export function shellWord(value, platform = process.platform) {
  if (platform === "win32") {
    return /^[\w.\\/:~-]+$/.test(value) ? value : `"${value}"`;
  }
  return /^[\w@%+=:,./-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * How to commit the renames in case in the copy in `target` - those of the
 * sync, `renamed`, and those Git keeps by the old name since one before,
 * `tracked`. Git ignores case on macOS and Windows: it keeps `Badge.tsx` for
 * a `badge.tsx` on the disk, and puts a file added in a folder renamed in
 * case under the old name too - which a build on Linux does not find. `null`
 * for no renames.
 */
function gitRenamesHint(target, renamed, tracked) {
  // A folder once, with all in it - a file renamed in it goes with it. Those
  // Git keeps each by its own name
  const renames = [
    ...new Map([
      ...renamed.filter(
        ([from]) => !renamed.some(([, to]) => from.startsWith(`${to}/`)),
      ),
      ...tracked,
    ]),
  ];
  if (renames.length === 0) return null;
  const paths = (index) =>
    renames.map((rename) => shellWord(rename[index])).join(" ");
  return [
    "Git ignores case on macOS and Windows and keeps the old names - after the sync, before you commit, run:",
    `  git -C ${shellWord(target)} rm -r --cached -q --ignore-unmatch -- ${paths(0)}`,
    `  git -C ${shellWord(target)} add -- ${paths(1)}`,
  ].join("\n");
}

if (isMain(import.meta.url)) {
  const options = readArguments(process.argv.slice(2));
  if (!options) process.exit(1);
  if (options.help) {
    console.log(USAGE);
    process.exit(0);
  }

  try {
    const { target, ...syncOptions } = options;
    const result = syncSource(resolve(target), syncOptions);
    const report = [
      ["Added", result.added],
      ["Updated", result.updated],
      ["Removed", result.removed],
      [
        "Renamed in case - a folder with all in it, also the files of the app",
        result.renamed.map(([from, to]) => `${from} -> ${to}`),
      ],
      ["Templates written", result.templates],
      ["Kept - changed in the copy, no more in the library", result.kept],
    ];
    for (const [title, list] of report) {
      if (list.length > 0) console.log(`${title}:\n  ${list.join("\n  ")}`);
    }
    // By its whole path - the sync takes the folder from the root of the
    // library, where `npm run` runs it, not from where it was typed
    const git = gitRenamesHint(
      resolve(target),
      result.renamed,
      result.trackedInOtherCase,
    );
    // Not for a dry run that would stop - no sync to commit
    if (git && !result.stop) console.log(git);
    if (!options.dryRun) {
      console.log(`The source copy in ${target} is up to date.`);
    } else if (result.stop) {
      // The whole plan first - then why a real run would stop
      console.error(result.stop);
      const hint = npmOptionsHint(options);
      if (hint) console.error(hint);
      console.error("Dry run - nothing was written; a real run would stop.");
      process.exit(1);
    } else {
      console.log("Dry run - nothing was written.");
    }
  } catch (error) {
    console.error(error.message);
    // A stop - not an error of the manifest or the folder
    const hint = error.result && npmOptionsHint(options);
    if (hint) console.error(hint);
    process.exit(1);
  }
}
