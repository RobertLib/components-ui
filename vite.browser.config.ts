import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Real-browser fixtures use the library's styles and compiler, without
// loading the documentation site's generated prop tables and examples.
export default defineConfig({
  cacheDir: "node_modules/.vite-browser",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // No fallback to the documentation's index.html for a missing file (an
  // image of a fixture) - its imports made Vite optimize a new dependency
  // mid-run and reload every page of the tests
  appType: "mpa",
  publicDir: false,
  optimizeDeps: { entries: ["tests/browser/*.html"] },
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
});
