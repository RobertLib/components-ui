import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import docgen from "./docs/plugins/docgen.ts";

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The documentation site - `npm run dev` / `npm run build:docs`.
// The library itself is built by vite.lib.config.ts.
export default defineConfig({
  // Relative asset URLs, so the built docs work from any sub-path
  base: "./",
  build: {
    outDir: "dist-docs",
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    docgen(),
  ],
  resolve: {
    // The docs import the library by its package name, like a project would
    alias: [
      {
        find: /^components-ui\/styles\.css$/,
        replacement: resolve("./src/styles.css"),
      },
      { find: /^components-ui$/, replacement: resolve("./src/index.ts") },
    ],
  },
});
