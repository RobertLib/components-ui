import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build, normalizePath } from "vite";
import { exportSource } from "./export-source.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

/** An empty app in a temporary folder, with a page that loads `src/main.tsx`. */
function createApp(t, prefix) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
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
const entryOf = (names, from = "./components/ui") =>
  `import "./index.css";
import { ${names.join(", ")} } from "${from}";
(globalThis as { used?: unknown }).used = [${names.join(", ")}];
`;

/**
 * Builds the app in `directory`: its scripts and stylesheet, the code the
 * modules of the library (`isLibrary`) rendered into the bundle before
 * minifying, and the warnings of the build.
 */
async function buildApp(directory, { isLibrary, plugins = [], alias = {} }) {
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
function classesOf(code) {
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
function styles(css, name) {
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
const missingClasses = (app, full) =>
  [...classesOf(app.rendered)].filter(
    (name) => styles(full.css, name) && !styles(app.css, name),
  );

test("The Vite plugin of a source copy", async (t) => {
  const directory = createApp(t, "components-ui-vite-");
  exportSource(directory);
  symlinkSync(
    join(root, "node_modules"),
    join(directory, "node_modules"),
    "junction",
  );
  const source = join(directory, "src");
  writeFileSync(
    join(source, "index.css"),
    '@import "tailwindcss";\n@import "./ui-styles.css";\n',
  );
  const library = normalizePath(source);
  const isLibrary = (id) =>
    id.startsWith(`${library}/`) &&
    !/\/src\/(?:main\.tsx|ui\.ts|pages\/)/.test(id);
  const { default: componentsUi } = await import(
    pathToFileURL(join(source, "components/ui/vite.js")).href
  );
  const write = (file, code) => writeFileSync(join(source, file), code);

  await t.test(
    "leaves out the classes of the components the app does not use",
    async () => {
      for (const names of [
        ["Button"],
        ["Dialog", "Tooltip", "SnackbarProvider"],
        ["Calendar"],
        ["DataTable"],
        ["RichTextEditor"],
      ]) {
        write("main.tsx", entryOf(names));
        const full = await buildApp(directory, { isLibrary });
        const app = await buildApp(directory, {
          isLibrary,
          plugins: [componentsUi()],
        });
        assert.equal(app.js, full.js, `${names}: the scripts changed`);
        assert.deepEqual(missingClasses(app, full), [], `${names}`);
        assert.ok(app.css.length < full.css.length, `${names}: no smaller`);
        assert.deepEqual(app.warnings, []);
      }

      write("main.tsx", entryOf(["Button"]));
      const full = await buildApp(directory, { isLibrary });
      const app = await buildApp(directory, {
        isLibrary,
        plugins: [componentsUi()],
      });
      assert.ok(
        app.css.length < full.css.length / 2,
        `${app.css.length} of ${full.css.length} characters`,
      );
    },
  );

  await t.test("works in any place among the plugins", async () => {
    write("main.tsx", entryOf(["Select", "Tabs"]));
    const after = await buildApp(directory, {
      isLibrary,
      plugins: [componentsUi()],
    });
    const before = await buildApp(directory, { isLibrary });
    const first = await build({
      configFile: false,
      root: directory,
      logLevel: "silent",
      plugins: [componentsUi(), react(), tailwindcss()],
      build: { write: false },
    });
    const css = first.output
      .filter((file) => file.fileName.endsWith(".css"))
      .map((file) => String(file.source))
      .join("");
    assert.equal(css, after.css);
    assert.ok(after.css.length < before.css.length);
  });

  await t.test(
    "follows aliases, re-exports, import.meta.glob and dynamic imports",
    async () => {
      write(
        "ui.ts",
        'export { Calendar as AppCalendar } from "@/components/ui";\n',
      );
      mkdirSync(join(source, "pages"), { recursive: true });
      write(
        "pages/settings.tsx",
        'import { ColorInput } from "../components/ui";\nexport default ColorInput;\n',
      );
      write(
        "pages/reports.tsx",
        'import { Chart } from "../components/ui";\nexport default Chart;\n',
      );
      write(
        "main.tsx",
        `import "./index.css";
import { AppCalendar } from "./ui";
const pages = import.meta.glob("./pages/settings.tsx", { eager: true });
const name = "reports";
(globalThis as { used?: unknown }).used = [AppCalendar, pages, import(\`./pages/\${name}.tsx\`)];
`,
      );
      const alias = { "@": source };
      const full = await buildApp(directory, { isLibrary, alias });
      const app = await buildApp(directory, {
        isLibrary,
        alias,
        plugins: [componentsUi()],
      });
      assert.deepEqual(app.warnings, []);
      assert.deepEqual(missingClasses(app, full), []);
      assert.ok(app.css.length < full.css.length);
      // The code of each of them - their classes are in
      for (const module of ["Calendar", "ColorInput", "Chart"]) {
        write("main.tsx", entryOf([module]));
        const alone = await buildApp(directory, {
          isLibrary,
          plugins: [componentsUi()],
        });
        assert.deepEqual(
          [...classesOf(alone.rendered)].filter(
            (name) => styles(alone.css, name) && !styles(app.css, name),
          ),
          [],
          module,
        );
      }
    },
  );

  await t.test(
    "keeps all the classes, with a warning, where it cannot read a module",
    async () => {
      const routes = {
        name: "routes",
        resolveId: (id) => (id === "virtual:routes" ? "\0routes" : undefined),
        load: (id) =>
          id === "\0routes"
            ? 'export { Button as default } from "/src/components/ui";'
            : undefined,
      };
      write(
        "main.tsx",
        'import "./index.css";\nimport page from "virtual:routes";\n(globalThis as { used?: unknown }).used = page;\n',
      );
      const full = await buildApp(directory, { isLibrary, plugins: [routes] });
      const app = await buildApp(directory, {
        isLibrary,
        plugins: [routes, componentsUi()],
      });
      assert.equal(app.css, full.css);
      assert.equal(app.warnings.length, 1);
      assert.match(app.warnings[0], /cannot read the module "routes"/);
    },
  );

  await t.test(
    "fails a build with the code of a module it left out",
    async () => {
      // Another plugin adds an import the files of the app do not have
      const imports = {
        name: "imports",
        transform: (code, id) =>
          id.endsWith("/src/main.tsx")
            ? `${code}\nimport { Calendar as C } from "./components/ui";\nglobalThis.calendar = C;\n`
            : undefined,
      };
      write("main.tsx", entryOf(["Button"]));
      await assert.rejects(
        buildApp(directory, { isLibrary, plugins: [imports, componentsUi()] }),
        /left out of Tailwind's sources/,
      );
    },
  );

  await t.test("leaves a stylesheet imported as text alone", async () => {
    write(
      "main.tsx",
      'import "./index.css";\nimport text from "./index.css?raw";\nimport { Button } from "./components/ui";\n(globalThis as { used?: unknown }).used = [Button, text];\n',
    );
    const app = await buildApp(directory, {
      isLibrary,
      plugins: [componentsUi()],
    });
    assert.ok(app.js.includes("ui-styles.css"));
    assert.ok(!app.js.includes("@source not"));
  });
});

test(
  "The Vite plugin of the package",
  {
    skip:
      !existsSync(join(root, "dist/index.js")) &&
      "needs the package build - npm run build:lib",
  },
  async (t) => {
    const directory = createApp(t, "components-ui-vite-package-");
    const modules = join(directory, "node_modules");
    mkdirSync(modules);
    for (const name of [
      "@tailwindcss",
      "lucide-react",
      "react",
      "react-dom",
      "scheduler",
      "tailwindcss",
    ]) {
      symlinkSync(
        join(root, "node_modules", name),
        join(modules, name),
        "junction",
      );
    }
    symlinkSync(root, join(modules, "components-ui"), "junction");
    writeFileSync(
      join(directory, "src/index.css"),
      '@import "tailwindcss";\n@import "components-ui/styles.css";\n',
    );
    const build = normalizePath(join(root, "dist"));
    const isLibrary = (id) => id.startsWith(`${build}/`);
    const { default: componentsUi } = await import(
      pathToFileURL(join(root, "src/components/ui/vite.js")).href
    );

    for (const names of [["Button"], ["Calendar", "DataTable"]]) {
      writeFileSync(
        join(directory, "src/main.tsx"),
        entryOf(names, "components-ui"),
      );
      const full = await buildApp(directory, { isLibrary });
      const app = await buildApp(directory, {
        isLibrary,
        plugins: [componentsUi()],
      });
      assert.equal(app.js, full.js, `${names}: the scripts changed`);
      assert.deepEqual(missingClasses(app, full), [], `${names}`);
      assert.ok(app.css.length < full.css.length, `${names}: no smaller`);
      assert.deepEqual(app.warnings, []);
    }
  },
);
