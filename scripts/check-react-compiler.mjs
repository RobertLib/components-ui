// Fails when the React Compiler cannot compile a component or hook of the
// library. The compiler skips such a function without a word - it still
// works, but without the memoization the components rely on (a DataTable
// sorted all its rows again on every render). Runs in `npm run lint`.
import babel from "@babel/core";
import reactCompiler from "babel-plugin-react-compiler";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");

/** The source files of the library - without the tests and their setup. */
function* sourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path !== join(src, "test")) yield* sourceFiles(path);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      yield path;
    }
  }
}

const failures = [];

for (const file of sourceFiles(src)) {
  const logEvent = (_, event) => {
    if (event.kind !== "CompileError" && event.kind !== "PipelineError") return;

    const line = event.detail?.loc?.start.line ?? event.fnLoc?.start.line;
    const reason = event.detail?.reason ?? String(event.data);
    failures.push(`${relative(root, file)}:${line ?? "?"} - ${reason}`);
  };

  babel.transformSync(readFileSync(file, "utf8"), {
    babelrc: false,
    configFile: false,
    filename: file,
    parserOpts: { plugins: ["typescript", "jsx"] },
    // The options of the builds (`reactCompilerPreset()`) plus the logger
    plugins: [[reactCompiler, { logger: { logEvent } }]],
  });
}

if (failures.length > 0) {
  console.error(
    `The React Compiler cannot compile ${failures.length} function(s):\n`,
  );
  failures.forEach((failure) => console.error(`  ${failure}`));
  process.exit(1);
}

console.log("The React Compiler compiles every component and hook");
