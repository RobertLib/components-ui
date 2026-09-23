// Adds the file extensions to the relative imports of the type declarations
// in dist/types. TypeScript projects with `moduleResolution: "node16"` or
// `"nodenext"` resolve only such imports in an ES module package - without
// them they would see every type of the library as `any`, without an error.
// Runs after `tsc -p tsconfig.lib.json` (`npm run build:lib`).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/types", import.meta.url));

// `from "./x"`, `import "./x"` and `import("./x")` - also of `.` and `..`
const RELATIVE_IMPORT =
  /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}(?:\/[^"']*)?)\2/g;

/** `./button` -> `./button.js`, `./autocomplete` -> `./autocomplete/index.js` */
function withExtension(file, specifier) {
  if (/\.(js|json)$/.test(specifier)) return specifier;

  const target = resolve(dirname(file), specifier);
  if (existsSync(`${target}.d.ts`)) return `${specifier}.js`;
  if (existsSync(join(target, "index.d.ts"))) return `${specifier}/index.js`;

  throw new Error(`${file}: cannot resolve the import "${specifier}"`);
}

function* declarationFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* declarationFiles(path);
    else if (entry.name.endsWith(".d.ts")) yield path;
  }
}

let updatedFiles = 0;

for (const file of declarationFiles(root)) {
  const source = readFileSync(file, "utf8");
  const updated = source.replace(
    RELATIVE_IMPORT,
    (_, prefix, quote, specifier) =>
      `${prefix}${quote}${withExtension(file, specifier)}${quote}`,
  );

  if (updated !== source) {
    writeFileSync(file, updated);
    updatedFiles += 1;
  }
}

console.log(`Import extensions added in ${updatedFiles} declaration files`);
