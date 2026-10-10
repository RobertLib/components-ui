import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
