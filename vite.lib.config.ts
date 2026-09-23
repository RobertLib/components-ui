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

// Builds the publishable library into dist/ - `npm run build:lib`
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), copyStyles()],
  publicDir: false,
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/index.ts",
      fileName: "index",
      formats: ["es"],
    },
    minify: false,
    outDir: "dist",
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^lucide-react($|\/)/],
      output: {
        // The components use hooks - React Server Components frameworks
        // (Next.js App Router) must render them on the client
        banner: '"use client";',
      },
    },
    sourcemap: true,
  },
});
