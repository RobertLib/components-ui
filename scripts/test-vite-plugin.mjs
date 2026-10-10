import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build, normalizePath } from "vite";
import { exportSource } from "./export-source.mjs";
import {
  buildApp,
  classesOf,
  createApp,
  entryOf,
  missingClasses,
  styles,
} from "./vite-app.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

// The plugin of the package - its build and the files npm publishes - is
// tested in test-package.mjs

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
    "keeps the classes of transformed modules loaded by globs and dynamic imports",
    async () => {
      mkdirSync(join(source, "mdx-pages"), { recursive: true });
      write("mdx-pages/page.mdx", "<Button>Example</Button>\n");
      const mdx = {
        name: "mdx-pages",
        transform: (_code, id) =>
          id.split("?")[0].endsWith(".mdx")
            ? 'export { Button as default } from "../components/ui";'
            : undefined,
      };
      for (const entry of [
        'globalThis.pages = import.meta.glob("./mdx-pages/*.mdx", { eager: true });',
        'globalThis.pages = import.meta.glob("./mdx-pages/page.?dx", { eager: true });',
        'const name = "page"; globalThis.pages = import(`./mdx-pages/${name}.mdx`);',
        'const name = "page"; globalThis.pages = import(`./mdx-pages/${name}.mdx?component`);',
      ]) {
        write("main.tsx", `import "./index.css";\n${entry}\n`);
        const full = await buildApp(directory, { isLibrary, plugins: [mdx] });
        const app = await buildApp(directory, {
          isLibrary,
          plugins: [mdx, componentsUi()],
        });
        assert.equal(app.js, full.js, entry);
        assert.equal(app.css, full.css, entry);
        assert.deepEqual(missingClasses(app, full), [], entry);
        assert.equal(app.warnings.length, 1, entry);
        assert.match(
          app.warnings[0],
          /cannot read the module .*page\.mdx/,
          entry,
        );
      }
    },
  );

  await t.test(
    "optimizes script globs beside unused transformed modules",
    async () => {
      mkdirSync(join(source, "mdx-pages"), { recursive: true });
      write("mdx-pages/page.mdx", "<Button>Example</Button>\n");
      write(
        "mdx-pages/page.tsx",
        'export { Button as default } from "../components/ui";\n',
      );
      for (const entry of [
        'globalThis.pages = import.meta.glob("./mdx-pages/*.tsx", { eager: true });',
        'const name = "page"; globalThis.pages = import(`./mdx-pages/${name}.tsx`);',
        'const name = "page"; globalThis.pages = import(`./mdx-pages/${name}.tsx?component`);',
      ]) {
        write("main.tsx", `import "./index.css";\n${entry}\n`);
        const full = await buildApp(directory, { isLibrary });
        const app = await buildApp(directory, {
          isLibrary,
          plugins: [componentsUi()],
        });
        assert.equal(app.js, full.js, entry);
        assert.deepEqual(missingClasses(app, full), [], entry);
        assert.deepEqual(app.warnings, [], entry);
        assert.ok(app.css.length < full.css.length / 2, entry);
      }
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

  await t.test(
    "checks excluded modules with queries and preserved symlink paths",
    async () => {
      symlinkSync(source, join(directory, "linked-src"), "junction");
      for (const [from, preserveSymlinks] of [
        ["./components/ui/separator.tsx?injected", false],
        ["../linked-src/components/ui/separator.tsx?injected", true],
      ]) {
        const imports = {
          name: "imports-with-query",
          config: () => ({ resolve: { preserveSymlinks } }),
          transform: (code, id) =>
            id.endsWith("/src/main.tsx")
              ? `${code}\nimport Separator from ${JSON.stringify(from)};\nglobalThis.separator = Separator;\n`
              : undefined,
        };
        write("main.tsx", entryOf(["Button"]));
        await assert.rejects(
          buildApp(directory, {
            isLibrary,
            plugins: [imports, componentsUi()],
          }),
          /src\/components\/ui\/separator\.tsx, which the plugin left out of Tailwind's sources/,
          from,
        );
      }
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

  await t.test("works with the paths typed in other case", async (t) => {
    // One folder on macOS and Windows - Vite gives the ids of the modules by
    // the names on the disk, also for a root typed in other case
    const other = directory.toUpperCase();
    if (other === directory || !existsSync(other)) {
      t.skip("the file system tells case apart");
      return;
    }
    write("main.tsx", entryOf(["Button"]));
    const app = await buildApp(directory, {
      isLibrary,
      plugins: [componentsUi()],
    });
    const { default: typed } = await import(
      pathToFileURL(join(other, "src/components/ui/vite.js")).href
    );
    const typedApp = await buildApp(other, { isLibrary, plugins: [typed()] });
    assert.deepEqual(typedApp.warnings, []);
    assert.equal(typedApp.css, app.css);
  });

  await t.test(
    "works in a folder with characters of a glob in its name",
    async (t) => {
      // As the store of pnpm names its folders - `.pnpm/@acme+ui@1.0.0`,
      // `components-ui@0.6.1(react@19.2.0)` - and a scope; braces Tailwind
      // would expand
      const other = createApp(
        t,
        "components-ui-vite-@acme+ui(react@19)[x]{y}-",
      );
      exportSource(other);
      symlinkSync(
        join(root, "node_modules"),
        join(other, "node_modules"),
        "junction",
      );
      writeFileSync(
        join(other, "src/index.css"),
        '@import "tailwindcss";\n@import "./ui-styles.css";\n',
      );
      writeFileSync(join(other, "src/main.tsx"), entryOf(["Button"]));
      const { default: plugin } = await import(
        pathToFileURL(join(other, "src/components/ui/vite.js")).href
      );
      const otherLibrary = normalizePath(join(other, "src"));
      const isOtherLibrary = (id) =>
        id.startsWith(`${otherLibrary}/`) && !id.endsWith("/src/main.tsx");
      const full = await buildApp(other, { isLibrary: isOtherLibrary });
      const app = await buildApp(other, {
        isLibrary: isOtherLibrary,
        plugins: [plugin()],
      });
      assert.deepEqual(missingClasses(app, full), []);
      assert.ok(
        app.css.length < full.css.length / 2,
        `${app.css.length} of ${full.css.length} characters`,
      );
    },
  );

  await t.test("loads by the imports the docs show - by Node too", async () => {
    // Vite reads vite.config.ts by Node itself with `configLoader: "native"`
    // (a default to come) - an import without the extension it warns of
    const imports = [
      "README.md",
      "docs/pages/installation.tsx",
      "src/components/ui/vite.js",
    ].flatMap((file) =>
      Array.from(
        readFileSync(join(root, file), "utf8").matchAll(
          /import componentsUi from "(\.[^"]+)"/g,
        ),
        ([, specifier]) => specifier,
      ),
    );
    assert.ok(imports.length >= 3, imports.join(", "));
    for (const specifier of imports) {
      const plugin = await import(
        pathToFileURL(join(directory, specifier)).href
      );
      assert.equal(typeof plugin.default, "function", specifier);
    }
  });
});
