import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vitest/config";

// These files change process.env.TZ to test local Date behavior. Node only
// applies those changes in a process's main thread, not in worker threads.
const timeZoneTests = [
  "src/utils/date.test.ts",
  "src/components/datetime-picker/grid-keyboard.test.tsx",
  "src/components/date-range-picker/midnight-dst.test.tsx",
  "src/components/calendar/{calendar,date-utils,drag,midnight-dst,recurrence,skipped-day,ssr}.test.{ts,tsx}",
];

// Unit and component tests of the library - `npm test`. The React Compiler
// runs here too, so the tests exercise the code the package ships.
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
    css: false,
    environment: "jsdom",
    restoreMocks: true,
    setupFiles: ["src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: timeZoneTests,
        },
      },
      {
        extends: true,
        plugins: [
          {
            name: "components-ui:time-zone-processes",
            // Keep these tests in processes even when --pool=threads is
            // requested for the rest of the suite. A config hook runs after
            // Vitest applies the CLI options to this project.
            config: () => ({ test: { pool: "forks" } }),
          },
        ],
        test: { name: "timezones", include: timeZoneTests, pool: "forks" },
      },
    ],
  },
});
