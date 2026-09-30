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
  publicDir: false,
  optimizeDeps: { entries: ["tests/browser/index.html"] },
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
});
