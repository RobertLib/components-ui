import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

/** Ships the stylesheet next to the bundle, where its `@source "./"` points. */
const copyStyles = (): Plugin => ({
  name: "components-ui:copy-styles",
  generateBundle() {
    this.emitFile({
      fileName: "styles.css",
      source: readFileSync("src/styles.css", "utf8"),
      type: "asset",
    });
  },
});

const REACT = /^(react|react-dom|lucide-react)($|\/)/;

/**
 * Finds the modules that use React - directly or through another such module
 * (a hook built on a hook). They get the "use client" directive below; the
 * entry only re-exports, so it stays a plain module.
 */
const clientModules = new Set<string>();
const findClientModules = (): Plugin => ({
  name: "components-ui:client-modules",
  buildEnd() {
    const ids = [...this.getModuleIds()];
    let found = true;
    while (found) {
      found = false;
      for (const id of ids) {
        const info = this.getModuleInfo(id);
        if (!info || info.isEntry || clientModules.has(id)) continue;
        if (
          info.importedIds.some(
            (imported) => REACT.test(imported) || clientModules.has(imported),
          )
        ) {
          clientModules.add(id);
          found = true;
        }
      }
    }
  },
});

// Builds the publishable library into dist/ - `npm run build:lib`
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    copyStyles(),
    findClientModules(),
  ],
  publicDir: false,
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/index.ts",
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ["es"],
    },
    minify: false,
    outDir: "dist",
    rolldownOptions: {
      external: [REACT],
      output: {
        // One file per source module: a bundler takes only what an app
        // imports, and the directive below can mark single modules
        preserveModules: true,
        preserveModulesRoot: "src",
        // The modules that use React (components, hooks, providers) must run
        // on the client in React Server Components frameworks (Next.js App
        // Router). The others - the query, locale, error and date helpers -
        // stay plain modules that server components can call too.
        banner: (chunk) =>
          chunk.facadeModuleId && clientModules.has(chunk.facadeModuleId)
            ? '"use client";'
            : "",
      },
    },
    sourcemap: true,
  },
});
