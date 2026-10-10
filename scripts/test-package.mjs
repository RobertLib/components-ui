// Tests the package as npm publishes it - the files `npm pack` takes, in the
// node_modules of an app: its manifest and the imports of its modules, the
// types in each module resolution of TypeScript, the exports in Node, the
// "use client" of the modules and the Vite plugin, also under another name.
// Needs the build of the package - `npm run build:lib`, which `npm ci` runs.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { normalizePath } from "vite";
import { buildApp, createApp, entryOf, missingClasses } from "./vite-app.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Runs npm - by the script of the npm that runs the test, else by name. */
function npm(args, options) {
  const script = process.env.npm_execpath;
  if (script && /\.[cm]?js$/.test(script)) {
    return execFileSync(process.execPath, [script, ...args], options);
  }
  // A script of cmd on Windows, which Node runs only through a shell
  return execFileSync("npm", args, {
    ...options,
    shell: process.platform === "win32",
  });
}

/**
 * The files `npm pack` puts in the package - packed from a copy of the
 * library whose manifest has no scripts: npm runs `prepare` for `npm pack`,
 * which would build the package again - npm 10 also with --ignore-scripts.
 */
function packedFiles(t) {
  const folder = mkdtempSync(join(tmpdir(), "components-ui-pack-"));
  t.after(() => rmSync(folder, { force: true, recursive: true }));
  cpSync(root, folder, {
    recursive: true,
    // None of them in the package
    filter: (path) =>
      !/^(?:\.git|node_modules|dist-docs|playwright-report|test-results)$/.test(
        relative(root, path).split(/[\\/]/)[0],
      ) && !/^(?:\.DS_Store|.*\.sw.)$/.test(basename(path)),
  });
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  delete manifest.scripts;
  writeFileSync(join(folder, "package.json"), JSON.stringify(manifest));
  const output = npm(["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: folder,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const json = JSON.parse(output);
  // An array up to npm 11, by the name of the package in npm 12
  const [pack] = Array.isArray(json) ? json : Object.values(json);
  return pack.files.map((file) => file.path);
}

/**
 * Puts `files` of the library in the node_modules of the app in `directory`
 * as the package `name`, with links to the packages of the library the app
 * would install itself. The folder of the package.
 */
function install(directory, files, name) {
  const modules = join(directory, "node_modules");
  const target = join(modules, name);
  for (const file of files) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    cpSync(join(root, file), join(target, file));
  }
  const manifest = JSON.parse(readFileSync(join(target, "package.json")));
  writeFileSync(
    join(target, "package.json"),
    JSON.stringify({ ...manifest, name }, null, 2),
  );
  for (const link of [
    "@tailwindcss",
    "@types",
    "lucide-react",
    "react",
    "react-dom",
    "scheduler",
    "tailwindcss",
    "vite",
  ]) {
    if (!existsSync(join(modules, link))) {
      symlinkSync(
        join(root, "node_modules", link),
        join(modules, link),
        "junction",
      );
    }
  }
  return target;
}

/** The module each name of the public API comes from, in `dist`. */
function modulesOfExports(dist) {
  const folder = join(dist, "components/ui");
  const modules = new Map();
  for (const [, named, local, from] of readFileSync(
    join(folder, "index.js"),
    "utf8",
  ).matchAll(/^import (?:\{([^}]*)\}|(\w+)) from "([^"]+)";$/gm)) {
    for (const name of named?.split(",") ?? [local]) {
      modules.set(name.trim(), join(folder, from));
    }
  }
  return modules;
}

/** The errors of TypeScript for `files` of the app in `directory`. */
function typeErrors(directory, files, moduleResolution) {
  const options = {
    strict: true,
    noEmit: true,
    // The declarations of the package too
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: {
      [ts.ModuleResolutionKind.Bundler]: ts.ModuleKind.ESNext,
      [ts.ModuleResolutionKind.Node16]: ts.ModuleKind.Node16,
      [ts.ModuleResolutionKind.NodeNext]: ts.ModuleKind.NodeNext,
    }[moduleResolution],
    moduleResolution,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    types: [],
  };
  const program = ts.createProgram(
    files.map((file) => join(directory, file)),
    options,
  );
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const file = diagnostic.file
      ? `${normalizePath(relative(directory, diagnostic.file.fileName))}: `
      : "";
    return file + ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  });
}

test(
  "The package as npm publishes it",
  {
    // Not skipped in CI, which builds the package as it installs
    skip:
      !existsSync(join(root, "dist/index.js")) &&
      !process.env.CI &&
      "needs the package build - npm run build:lib",
  },
  async (t) => {
    const files = packedFiles(t);
    const directory = createApp(t, "components-ui-package-");
    const target = install(directory, files, "components-ui");
    const dist = join(target, "dist");
    const manifest = JSON.parse(readFileSync(join(target, "package.json")));

    await t.test("has the files of the manifest, not the tests", () => {
      const exported = Object.values(manifest.exports).flatMap((value) =>
        typeof value === "string" ? [value] : Object.values(value),
      );
      for (const file of [
        manifest.main,
        manifest.types,
        ...exported,
        "./src/components/ui/package.json",
        "./LICENSE",
      ]) {
        assert.ok(files.includes(file.replace(/^\.\//, "")), file);
      }
      assert.deepEqual(
        files.filter(
          (file) => /\.test\.tsx?$/.test(file) || file.startsWith("src/test/"),
        ),
        [],
      );
    });

    await t.test("declares each package its modules import", () => {
      // The Vite plugin imports Vite - for Yarn PnP and pnpm with a global
      // store, a package sees only those it declares
      const declared = new Set([
        manifest.name,
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
      ]);
      const builtins = new Set(builtinModules);
      const undeclared = [];
      for (const file of files) {
        if (
          !/^(?:dist\/.*\.js|dist\/.*\.d\.ts|src\/components\/ui\/vite\.(?:js|d\.ts))$/.test(
            file,
          )
        ) {
          continue;
        }
        // `import … from "x"`, `export … from "x"`, `import "x"` and the
        // `import("x")` of a declaration
        for (const [, statement, query] of readFileSync(
          join(target, file),
          "utf8",
        ).matchAll(
          /^\s*(?:(?:import|export)\b[^;"'`]*?\bfrom\s*|import\s*)["']([^"'./][^"']*)["']|\bimport\(\s*["']([^"'./][^"']*)["']\s*\)/gm,
        )) {
          const specifier = statement ?? query;
          const parts = specifier.split("/");
          const name = parts
            .slice(0, specifier.startsWith("@") ? 2 : 1)
            .join("/");
          if (
            !specifier.startsWith("node:") &&
            !builtins.has(name) &&
            !declared.has(name)
          ) {
            undeclared.push(`${file}: ${specifier}`);
          }
        }
      }
      assert.deepEqual(undeclared, []);
      assert.equal(manifest.peerDependenciesMeta?.vite?.optional, true);
    });

    await t.test(
      "leaves the source maps and the types out of Tailwind's sources",
      () => {
        const styles = readFileSync(join(dist, "styles.css"), "utf8");
        assert.match(styles, /^@source "\.\/";$/m);
        assert.match(styles, /^@source not "\.\/\*\*\/\*\.map";$/m);
        assert.match(styles, /^@source not "\.\/types";$/m);
      },
    );

    await t.test(
      "marks the modules with React for the client, not the helpers",
      () => {
        const isClient = (file) =>
          readFileSync(file, "utf8").startsWith('"use client";');
        const unmarked = [];
        const modules = readdirSync(dist, { recursive: true, encoding: "utf8" })
          .filter((file) => file.endsWith(".js"))
          .map((file) => join(dist, file));
        for (const file of modules) {
          const code = readFileSync(file, "utf8");
          if (
            /^import .* from "(?:react|react-dom|lucide-react)(?:\/[^"]*)?";$/m.test(
              code,
            ) &&
            !isClient(file)
          ) {
            unmarked.push(normalizePath(relative(dist, file)));
          }
        }
        assert.deepEqual(unmarked, []);

        // The entries re-export both - neither is a boundary of the client
        assert.ok(!isClient(join(dist, "index.js")));
        assert.ok(!isClient(join(dist, "components/ui/index.js")));
        const moduleOf = modulesOfExports(dist);
        for (const name of [
          "Button",
          "DataTable",
          "UIProvider",
          "useMessages",
        ]) {
          assert.ok(isClient(moduleOf.get(name)), name);
        }
        // The helpers the Installation page names for server components
        for (const name of [
          "cn",
          "formatMessage",
          "getColorSchemeScript",
          "getFieldError",
          "readQueryFromSearch",
        ]) {
          assert.ok(!isClient(moduleOf.get(name)), name);
        }
      },
    );

    await t.test("resolves its exports in Node", () => {
      const result = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `const ui = await import("components-ui");
const plugin = await import("components-ui/vite");
console.log(JSON.stringify({
  button: typeof ui.Button,
  plugin: typeof plugin.default,
  styles: import.meta.resolve("components-ui/styles.css"),
}));`,
        ],
        { cwd: directory, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        button: "function",
        plugin: "function",
        styles: pathToFileURL(join(dist, "styles.css")).href,
      });
    });

    await t.test(
      "types the package in each module resolution of TypeScript",
      () => {
        writeFileSync(
          join(directory, "src/app.tsx"),
          `import { Button, cs, readQueryFromSearch, UIProvider } from "components-ui";
import type { ButtonProps } from "components-ui";

const props: ButtonProps = { children: "Save", variant: "outline" };
// @ts-expect-error - a typed component, not \`any\`
export const notANumber: number = Button;
export const query = readQueryFromSearch("?page=2");

export const App = () => (
  <UIProvider locale={cs}>
    <Button {...props} />
  </UIProvider>
);
`,
        );
        writeFileSync(
          join(directory, "vite.config.ts"),
          `import componentsUi from "components-ui/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [componentsUi()] });
// @ts-expect-error - it takes no options: the types resolve
componentsUi({});
`,
        );
        for (const resolution of ["Bundler", "Node16", "NodeNext"]) {
          assert.deepEqual(
            typeErrors(
              directory,
              ["src/app.tsx", "vite.config.ts"],
              ts.ModuleResolutionKind[resolution],
            ),
            [],
            resolution,
          );
        }
      },
    );

    await t.test(
      "follows transitive package imports and ignores unrelated dependency cycles",
      async () => {
        const modules = join(directory, "node_modules");
        for (const [name, dependencies, exports, files] of [
          [
            "wrapper-a",
            { "wrapper-b": "*" },
            "./index.js",
            { "index.js": 'export { Button } from "wrapper-b/button";' },
          ],
          [
            "wrapper-b",
            { "components-ui": "*", "wrapper-a": "*" },
            { "./button": "./button.js" },
            { "button.js": 'export { Button } from "components-ui";' },
          ],
          [
            "unrelated-a",
            { "unrelated-b": "*" },
            "./index.js",
            { "index.js": "export const value = 1;" },
          ],
          [
            "unrelated-b",
            { "unrelated-a": "*" },
            "./index.js",
            { "index.js": "export const value = 2;" },
          ],
        ]) {
          const folder = join(modules, name);
          mkdirSync(folder);
          writeFileSync(
            join(folder, "package.json"),
            JSON.stringify({
              name,
              version: "1.0.0",
              type: "module",
              dependencies,
              exports,
            }),
          );
          for (const [file, code] of Object.entries(files)) {
            writeFileSync(join(folder, file), code);
          }
        }
        writeFileSync(
          join(directory, "src/index.css"),
          '@import "tailwindcss";\n@import "components-ui/styles.css";\n',
        );
        writeFileSync(
          join(directory, "src/main.tsx"),
          `${entryOf(["Button"], "wrapper-a")}\nimport { value } from "unrelated-a";\nglobalThis.unrelated = value;\n`,
        );
        const isLibrary = (id) => id.startsWith(normalizePath(`${dist}/`));
        const { default: componentsUi } = await import(
          pathToFileURL(join(target, "src/components/ui/vite.js")).href
        );
        const full = await buildApp(directory, { isLibrary });
        const used = await buildApp(directory, {
          isLibrary,
          plugins: [componentsUi()],
        });
        assert.equal(used.js, full.js);
        assert.deepEqual(missingClasses(used, full), []);
        assert.ok(
          used.css.length < full.css.length / 2,
          JSON.stringify({
            used: used.css.length,
            full: full.css.length,
            warnings: used.warnings,
          }),
        );
        assert.deepEqual(used.warnings, []);
      },
    );

    await t.test(
      "keeps all classes for a CommonJS wrapper of the package",
      async () => {
        const wrapper = join(directory, "node_modules", "commonjs-wrapper");
        mkdirSync(wrapper);
        writeFileSync(
          join(wrapper, "package.json"),
          JSON.stringify({
            name: "commonjs-wrapper",
            version: "1.0.0",
            main: "./index.cjs",
            peerDependencies: { "components-ui": "*" },
          }),
        );
        writeFileSync(
          join(wrapper, "index.cjs"),
          'module.exports = require("components-ui").Button;\n',
        );
        writeFileSync(
          join(directory, "src/index.css"),
          '@import "tailwindcss";\n@import "components-ui/styles.css";\n',
        );
        writeFileSync(
          join(directory, "src/main.tsx"),
          'import "./index.css";\nimport Button from "commonjs-wrapper";\nglobalThis.button = Button;\n',
        );
        const isLibrary = (id) => id.startsWith(normalizePath(`${dist}/`));
        const { default: componentsUi } = await import(
          pathToFileURL(join(target, "src/components/ui/vite.js")).href
        );
        const full = await buildApp(directory, { isLibrary });
        const used = await buildApp(directory, {
          isLibrary,
          plugins: [componentsUi()],
        });
        assert.equal(used.js, full.js);
        assert.equal(used.css, full.css);
        assert.deepEqual(missingClasses(used, full), []);
        assert.equal(used.warnings.length, 1);
        assert.match(
          used.warnings[0],
          /cannot follow CommonJS require calls .*index\.cjs/,
        );
      },
    );

    await t.test(
      "follows npm aliases of the library from wrapper packages",
      async () => {
        const modules = join(directory, "node_modules");
        symlinkSync(target, join(modules, "ui-alias"), "junction");
        const wrapper = join(modules, "alias-wrapper");
        mkdirSync(wrapper);
        writeFileSync(
          join(wrapper, "package.json"),
          JSON.stringify({
            name: "alias-wrapper",
            version: "1.0.0",
            type: "module",
            dependencies: {
              "ui-alias": `npm:components-ui@${manifest.version}`,
            },
            exports: "./index.js",
          }),
        );
        writeFileSync(
          join(wrapper, "index.js"),
          'export { Button } from "ui-alias";',
        );
        writeFileSync(
          join(directory, "src/index.css"),
          '@import "tailwindcss";\n@import "components-ui/styles.css";\n',
        );
        writeFileSync(
          join(directory, "src/main.tsx"),
          entryOf(["Button"], "alias-wrapper"),
        );
        const isLibrary = (id) => id.startsWith(normalizePath(`${dist}/`));
        const { default: componentsUi } = await import(
          pathToFileURL(join(target, "src/components/ui/vite.js")).href
        );

        // Vite is already available to the build. Keep only runtime peers in
        // this fixture: a missing optional dependency of Vite must not make
        // the conservative fallback hide a failure to recognize the alias.
        const manifestPath = join(target, "package.json");
        const originalManifest = readFileSync(manifestPath);
        const runtimeManifest = structuredClone(manifest);
        delete runtimeManifest.peerDependencies.vite;
        delete runtimeManifest.peerDependenciesMeta.vite;
        writeFileSync(manifestPath, JSON.stringify(runtimeManifest));
        try {
          const full = await buildApp(directory, { isLibrary });
          const used = await buildApp(directory, {
            isLibrary,
            plugins: [componentsUi()],
          });
          assert.equal(used.js, full.js);
          assert.deepEqual(missingClasses(used, full), []);
          assert.ok(used.css.length < full.css.length / 2);
          assert.deepEqual(used.warnings, []);
        } finally {
          writeFileSync(manifestPath, originalManifest);
        }
      },
    );

    await t.test(
      "leaves the classes of the components the app does not use out",
      async (t) => {
        const app = (directory, name) => {
          const build = normalizePath(
            join(directory, "node_modules", name, "dist"),
          );
          return {
            isLibrary: (id) => id.startsWith(`${build}/`),
            plugin: import(
              pathToFileURL(
                join(
                  directory,
                  "node_modules",
                  name,
                  "src/components/ui/vite.js",
                ),
              ).href
            ),
          };
        };
        // Also published under a scope, as the Installation page says for a
        // registry of a company
        const scoped = createApp(t, "components-ui-package-scoped-");
        install(scoped, files, "@acme/components-ui");
        for (const [folder, name, entries] of [
          [directory, "components-ui", [["Button"], ["Calendar", "DataTable"]]],
          [scoped, "@acme/components-ui", [["Button"]]],
        ]) {
          writeFileSync(
            join(folder, "src/index.css"),
            `@import "tailwindcss";\n@import "${name}/styles.css";\n`,
          );
          const { isLibrary, plugin } = app(folder, name);
          const { default: componentsUi } = await plugin;
          for (const names of entries) {
            writeFileSync(join(folder, "src/main.tsx"), entryOf(names, name));
            const full = await buildApp(folder, { isLibrary });
            const used = await buildApp(folder, {
              isLibrary,
              plugins: [componentsUi()],
            });
            const label = `${name}: ${names}`;
            assert.equal(used.js, full.js, `${label}: the scripts changed`);
            assert.deepEqual(missingClasses(used, full), [], label);
            assert.ok(
              used.css.length < full.css.length,
              `${label}: ${used.css.length} of ${full.css.length} characters`,
            );
            assert.deepEqual(used.warnings, [], label);
          }
        }
      },
    );
  },
);
