import { cpSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Whether a file by `name` is of the system or an editor - the `.DS_Store` of
 * Finder, the `.badge.tsx.swp` of Vim - which the `.gitignore` of the library
 * keeps out of it. No file of the library starts with a dot.
 */
export const isSystemFile = (name) =>
  name.startsWith(".") || /\.sw.$/.test(name);

/**
 * Whether Node runs the module of `url` itself - also by a link to it or its
 * folder: Node runs the file the link leads to. By `realpathSync`, as Node
 * does - its `.native` would give the case on the disk for a path typed in
 * other case, which Node keeps.
 */
export function isMain(url) {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(url);
  } catch {
    // No file - `node -e`, say
    return false;
  }
}

/** Generates a standalone source copy, without an application's entry file. */
export function exportSource(directory) {
  const source = join(directory, "src");
  rmSync(source, { recursive: true, force: true });
  mkdirSync(source, { recursive: true });

  for (const folder of [
    "components/ui",
    "providers",
    "hooks",
    "utils",
    "i18n",
  ]) {
    cpSync(join(root, "src", folder), join(source, folder), {
      recursive: true,
      filter: (path) =>
        !/\.test\.tsx?$/.test(path) && !isSystemFile(basename(path)),
    });
  }

  cpSync(join(root, "src/styles.css"), join(source, "ui-styles.css"));
  cpSync(join(root, "LICENSE"), join(directory, "LICENSE"));
}

if (isMain(import.meta.url)) {
  const destination = join(root, "dist-source");
  exportSource(destination);
  console.log(`Source copy exported to ${destination}`);
}
