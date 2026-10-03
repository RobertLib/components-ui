import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

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
      filter: (path) => !/\.test\.tsx?$/.test(path),
    });
  }

  cpSync(join(root, "src/styles.css"), join(source, "ui-styles.css"));
  cpSync(join(root, "LICENSE"), join(directory, "LICENSE"));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const destination = join(root, "dist-source");
  exportSource(destination);
  console.log(`Source copy exported to ${destination}`);
}
