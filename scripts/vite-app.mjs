// Helpers of the tests that build an app with Vite and Tailwind - the tests
// of the Vite plugin (test-vite-plugin.mjs) and of the package
// (test-package.mjs).
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build } from "vite";

/**
 * An empty app in a temporary folder, with a page that loads `src/main.tsx`.
 * By the names on the disk, as Vite gives the ids of the modules - not the
 * short names of Windows (`RUNNER~1`) of the temporary folder.
 */
export function createApp(t, prefix) {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "src"));
  writeFileSync(
    join(directory, "package.json"),
    '{"private":true,"type":"module"}\n',
  );
  writeFileSync(
    join(directory, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
  );
  return directory;
}

/** An entry that imports `names` from `from` and uses them. */
export const entryOf = (names, from = "./components/ui") =>
  `import "./index.css";
import { ${names.join(", ")} } from "${from}";
(globalThis as { used?: unknown }).used = [${names.join(", ")}];
`;

/**
 * Builds the app in `directory`: its scripts and stylesheet, the code the
 * modules of the library (`isLibrary`) rendered into the bundle before
 * minifying, and the warnings of the build.
 */
export async function buildApp(
  directory,
  { isLibrary, plugins = [], alias = {} },
) {
  const warnings = [];
  const result = await build({
    configFile: false,
    root: directory,
    logLevel: "silent",
    customLogger: {
      info() {},
      warn: (message) => warnings.push(message),
      warnOnce: (message) => warnings.push(message),
      error() {},
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
    resolve: { alias },
    plugins: [react(), tailwindcss(), ...plugins],
    build: { write: false },
  });
  assert.ok(!Array.isArray(result) && "output" in result);
  const chunks = result.output.filter((file) => file.type === "chunk");
  return {
    css: result.output
      .filter((file) => file.fileName.endsWith(".css"))
      .map((file) => String(file.source))
      .join(""),
    js: chunks.map((file) => file.code).join("\n"),
    rendered: chunks
      .flatMap((file) => Object.entries(file.modules))
      .filter(([id, module]) => isLibrary(id) && module.renderedLength > 0)
      .map(([, module]) => module.code ?? "")
      .join("\n"),
    warnings: warnings.filter((message) =>
      message.includes("[plugin components-ui]"),
    ),
  };
}

/** The words of the strings in `code` - the classes among them. */
export function classesOf(code) {
  const classes = new Set();
  for (const match of code.matchAll(
    /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g,
  )) {
    for (const word of (match[1] ?? match[2] ?? match[3]).split(/\s+/)) {
      if (word) classes.add(word);
    }
  }
  return classes;
}

/** A class as a selector writes it - `CSS.escape`. */
function escapeClass(name) {
  let escaped = "";
  for (const [index, char] of [...name].entries()) {
    if (/\d/.test(char) && (index === 0 || (index === 1 && name[0] === "-"))) {
      escaped += `\\${char.charCodeAt(0).toString(16)} `;
    } else if (/[\w-]/.test(char) || char.charCodeAt(0) >= 0x80) {
      escaped += char;
    } else {
      escaped += `\\${char}`;
    }
  }
  return escaped;
}

/**
 * Whether `css` has a rule of the class - one whose selector starts with
 * it, not one that only names it (`:where(.group)`, `[&>.popover]:flex`).
 */
export function styles(css, name) {
  const selector = `.${escapeClass(name)}`;
  for (
    let index = css.indexOf(selector);
    index !== -1;
    index = css.indexOf(selector, index + 1)
  ) {
    const before = index === 0 ? "}" : css[index - 1];
    const after = css[index + selector.length];
    if (
      /[{},;\s]/.test(before) &&
      (after === undefined || /[\s,{:.[>+~)]/.test(after))
    ) {
      return true;
    }
  }
  return false;
}

/** The classes of the library's code that `full` styles and `app` does not. */
export const missingClasses = (app, full) =>
  [...classesOf(app.rendered)].filter(
    (name) => styles(full.css, name) && !styles(app.css, name),
  );
