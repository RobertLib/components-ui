/**
 * Leaves the classes of the components an app does not use out of its CSS
 * (see `vite.js`). Add it to the plugins of the app's `vite.config.ts`.
 *
 * A `Plugin` of Vite, typed by its shape: this file imports no types of
 * Vite, so that an app without it (Next.js, webpack) type-checks a source
 * copy as well - also with `skipLibCheck: false`.
 */
export default function componentsUi(): {
  name: "components-ui";
  apply: "build";
};
