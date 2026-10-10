import type { Plugin } from "vite";

/**
 * Leaves the classes of the components an app does not use out of its CSS
 * (see `vite.js`). Add it to the plugins of the app's `vite.config.ts`.
 */
export default function componentsUi(): Plugin;
