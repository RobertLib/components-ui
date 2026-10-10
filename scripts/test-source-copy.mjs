import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import ts from "typescript";
import { build } from "vite";
import { exportSource } from "./export-source.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("A source copy works in a standalone Vite app", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "components-ui-source-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  // Files of Finder and of Vim in the library - not of it, as its
  // `.gitignore` says. Those it has already stay
  const foreign = ["src/hooks/.DS_Store", "src/components/ui/.badge.tsx.swp"]
    .map((file) => join(root, file))
    .filter((file) => !existsSync(file));
  for (const file of foreign) writeFileSync(file, "");
  t.after(() => {
    for (const file of foreign) rmSync(file, { force: true });
  });
  exportSource(directory);
  const source = join(directory, "src");

  await t.test(
    "exports library files and the license without tests or an app entry",
    () => {
      const files = readdirSync(source, { recursive: true, encoding: "utf8" });
      assert.ok(files.includes("components/ui/index.ts"));
      assert.ok(files.includes("i18n/en.ts"));
      assert.ok(files.includes("i18n/cs.ts"));
      assert.ok(files.includes("ui-styles.css"));
      // Tells bundlers that no module of the library runs code as it loads
      assert.equal(
        JSON.parse(
          readFileSync(join(source, "components/ui/package.json"), "utf8"),
        ).sideEffects,
        false,
      );
      assert.ok(!files.includes("index.ts"));
      assert.ok(!files.includes("styles.css"));
      assert.ok(!files.includes("test"));
      assert.ok(!files.some((file) => /\.test\.tsx?$/.test(file)));
      // Nor those of the system and editors - the sync would take them for
      // the library's
      assert.deepEqual(
        files.filter((file) => /(^|[\\/])\./.test(file)),
        [],
      );
      assert.equal(
        readFileSync(join(directory, "LICENSE"), "utf8"),
        readFileSync(join(root, "LICENSE"), "utf8"),
      );
    },
  );

  symlinkSync(
    join(root, "node_modules"),
    join(directory, "node_modules"),
    "junction",
  );
  writeFileSync(
    join(directory, "package.json"),
    '{"private":true,"type":"module"}\n',
  );
  writeFileSync(
    join(source, "main.tsx"),
    `import { createRoot } from "react-dom/client";
import { Button, UIProvider, cs } from "./components/ui";
import "./index.css";
createRoot(document.getElementById("root")!).render(
  <UIProvider locale={cs}><Button>Save</Button></UIProvider>,
);
`,
  );
  writeFileSync(join(source, "css.d.ts"), 'declare module "*.css";\n');
  writeFileSync(
    join(source, "index.css"),
    '@import "tailwindcss";\n@import "./ui-styles.css";\n',
  );
  writeFileSync(
    join(directory, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
  );

  await t.test(
    "typechecks all copied modules with browser types and ES2023",
    () => {
      const files = readdirSync(source, { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => join(source, file));
      const program = ts.createProgram(files, {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
        types: ["react", "react-dom"],
      });
      const errors = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
        file: diagnostic.file?.fileName,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      }));
      assert.deepEqual(errors, []);
    },
  );

  await t.test(
    "builds the local public API and stylesheet without React Compiler",
    async () => {
      const result = await build({
        configFile: false,
        root: directory,
        logLevel: "silent",
        plugins: [react(), tailwindcss()],
        build: { write: false },
      });
      assert.ok(!Array.isArray(result) && "output" in result);
      const css = result.output.find((file) => file.fileName.endsWith(".css"));
      assert.ok(css && css.type === "asset");
      assert.match(String(css.source), /--color-primary-600/);
      assert.match(String(css.source), /\.cui-/);
      const scripts = result.output.filter((file) => file.type === "chunk");
      assert.ok(scripts.length > 0);
      assert.ok(
        scripts.every((file) => !file.code.includes("process.env.NODE_ENV")),
      );
    },
  );

  await t.test("leaves out of an app what it does not use", async () => {
    // The code the modules of the library render into the bundle, by module
    // - before minifying, as the bundler leaves it. React and the icons stay
    // outside. Without the `"sideEffects": false` of the library, which lets
    // a bundler leave out a module without reading it - it must stay true.
    const library = realpathSync(source);
    const flag = join(source, "components/ui/package.json");
    const bundle = async (entry) => {
      writeFileSync(join(directory, "tree-shaking.tsx"), entry);
      const result = await build({
        configFile: false,
        root: directory,
        logLevel: "silent",
        plugins: [react()],
        build: {
          write: false,
          minify: false,
          rolldownOptions: {
            input: join(directory, "tree-shaking.tsx"),
            external: [/^(react|react-dom|lucide-react)($|\/)/],
          },
        },
      });
      assert.ok(!Array.isArray(result) && "output" in result);
      const modules = {};
      for (const file of result.output) {
        if (file.type !== "chunk") continue;
        for (const [id, module] of Object.entries(file.modules)) {
          if (module.renderedLength > 0 && id.startsWith(library)) {
            modules[relative(library, id)] = module.code;
          }
        }
      }
      return modules;
    };

    renameSync(flag, `${flag}.off`);
    try {
      // Code that runs as a module loads stays in every app that imports the
      // module - mark the call `/* @__PURE__ */` or build the value in a
      // function called so. Not only for the minifier: the Vite plugin of the
      // library reads the code the bundler renders.
      assert.deepEqual(
        await bundle('import "./src/components/ui";\n'),
        {},
        "importing the public API without using it adds code",
      );
      assert.deepEqual(
        Object.keys(
          await bundle(
            'import { Button } from "./src/components/ui";\nconsole.log(Button);\n',
          ),
        ),
        Object.keys(
          await bundle(
            'import Button from "./src/components/ui/button";\nconsole.log(Button);\n',
          ),
        ),
        "a component from the public API takes more than from its module",
      );
    } finally {
      renameSync(`${flag}.off`, flag);
    }
  });
});

test("The export runs by a link to its folder", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "components-ui-scripts-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  // It writes `dist-source` of the library - removed after, if new
  const output = join(root, "dist-source");
  if (!existsSync(output)) {
    t.after(() => rmSync(output, { recursive: true, force: true }));
  }
  // Node runs the file the link leads to
  const scripts = join(directory, "scripts");
  symlinkSync(join(root, "scripts"), scripts, "junction");

  const result = spawnSync(
    process.execPath,
    [join(scripts, "export-source.mjs")],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Source copy exported to /);
  assert.ok(existsSync(join(output, "src/components/ui/index.ts")));
});
