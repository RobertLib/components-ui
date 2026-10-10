# components-ui

A React component library for business applications - forms, data tables,
calendars, dialogs and the app layout - built on Tailwind CSS and independent
of any backend or router.

- **Any backend** - `Autocomplete`, `DataTable` and `FileUpload` take
  functions and data instead of fetching, so REST, GraphQL (Relay connections)
  and data already in the browser all fit.
- **Any router** - links and navigation go through a small adapter: React
  Router, Next.js, TanStack Router or plain links.
- **Localized** - English and Czech built in, any other language as a locale
  object; source copies include typed catalogs for your application's texts
  under the same provider. Dates, month and weekday names come from `Intl`.
- **Themable** - Tailwind CSS v4 color tokens you override in one `@theme`
  block, dark mode included.
- **Typed and documented** - strict TypeScript, every prop described in the
  source; the documentation site shows every component live.

## Documentation

**<https://robertlib.github.io/components-ui/>** - live examples of every
component, prop tables generated from the source and guides.

The site is part of this repository. Run it locally with:

```sh
npm install
npm run dev          # http://localhost:5173
```

`npm run build:docs` builds it as a static site into `dist-docs/` (hash
routing - it works from any static host). The GitHub Actions workflow in
`.github/workflows/pages.yml` builds it and deploys it to GitHub Pages on
every push to `main`.

## Quick start

Requirements: React 19, Tailwind CSS 4.3 or newer and a bundler that sets
`process.env.NODE_ENV` (Vite, Next.js, webpack, …). An install from git
builds the package with Node.js 22.12 or newer.

1. **Install** - from the git repository by tag (npm builds the package on
   install), a local folder, or your registry (publishing there needs a scoped
   name and `"private": true` removed - see the
   [Installation](https://robertlib.github.io/components-ui/#/installation)
   page):

   ```sh
   npm install git+https://github.com/RobertLib/components-ui.git#v0.7.2
   ```

   If npm reports that the `prepare` script of `components-ui` is not allowed
   to run (`install-scripts`), approve it - npm builds the package with it
   when it installs from git:

   ```sh
   npm install-scripts approve components-ui
   ```

   A tarball made with `npm pack` already contains the build: npm may still
   list its `prepare` script in that warning, but has nothing to run.

2. **Import the styles** after Tailwind:

   ```css
   @import "tailwindcss";
   @import "components-ui/styles.css";
   ```

   With Vite 8, the plugin of the library leaves the classes of the
   components your app does not use out of the CSS of a build (8 kB with gzip
   instead of 25 kB for an app with a `Button`):

   ```ts
   // vite.config.ts
   import componentsUi from "components-ui/vite";

   export default defineConfig({
     plugins: [react(), tailwindcss(), componentsUi()],
   });
   ```

3. **Render the providers** and use the components:

   ```tsx
   import { Button, cs, SnackbarProvider, UIProvider } from "components-ui";

   export default function App() {
     // The adapter for your router - a 15-line recipe on the Routing page
     const router = useReactRouterAdapter();

     return (
       <UIProvider locale={cs} router={router}>
         <SnackbarProvider>
           <Button onClick={save}>Save</Button>
         </SnackbarProvider>
       </UIProvider>
     );
   }
   ```

See the [Installation](https://robertlib.github.io/components-ui/#/installation),
[Routing](https://robertlib.github.io/components-ui/#/routing) and
[Localization](https://robertlib.github.io/components-ui/#/localization) pages
of the docs for the details (the React Router, Next.js and TanStack Router
adapters, custom locales).

## Copying the source

You can also copy the library into your project's `src/`. All library
components and their internal helpers are in `src/components/ui/`, leaving
`src/components/` available for your application components.

To copy the library into an app - and to update the copy later - run in
this repository:

```sh
npm run sync:source -- ../my-app/src --dry-run   # what would change
npm run sync:source -- ../my-app/src
```

A manifest in the copy (`.components-ui.json`, commit it) lists the files the
library put there with their hashes and its version. An update replaces and
removes those alone: the app's own files next to them stay, as do its
`i18n/en.ts` and `i18n/cs.ts` (written once, as templates). A library file
changed in the copy stops the update - move the change into the library, or
replace it with `--force`. So does a file of the app at a path the library
takes up (one the manifest does not list) - rename it, or replace it with
`--adopt`; `--force` does not touch it. Give the options after the `--`, as
above: npm keeps those before it for itself. Line endings do not count, so a
checkout with CRLF is no change.

A file or a folder the library renamed only in case (`Badge.tsx` -
`badge.tsx`, `Data-Table/` - `data-table/`) is renamed in the copy too, a
folder with all in it. A folder with files of the app in it stops the sync: the
app imports them by the old name, which a build on Linux does not find - rename
it yourself, and the imports, or let `--adopt` rename it with all in it. Git
ignores case on macOS and Windows: it keeps the old names, also for a file
added in such a folder, and a build on Linux does not find them. The sync
prints the commands that record the renames, with the whole path of the copy -
also on a later run, while Git keeps the old names. Run them before you commit:

```sh
git -C /home/me/my-app/src rm -r --cached -q --ignore-unmatch -- components/ui/Data-Table
git -C /home/me/my-app/src add -- components/ui/data-table
```

The first sync of a copy made by hand, which has no manifest yet, takes over
the files equal to the library's and stops at the others: an older version of
the library or a change of the app, which the sync cannot tell apart. Check
them with `--dry-run` (it lists the whole plan, and exits with an error where a
real run would stop), then `--adopt` replaces them with the library's; nothing
is removed. The Installation page of the docs lists the lint and Prettier
settings that keep the copy out of the app's own rules.

To generate a clean copy in this repository instead, run:

```sh
npm run export:source
```

Merge the generated `dist-source/src/` into your project's `src/` and keep
`dist-source/LICENSE` with the copied library. The export omits tests, files
of the system and editors (`.DS_Store`, swap files) and the package entry
point, and names the stylesheet `ui-styles.css`, so it
does not replace your application's entry file. Each export regenerates
`dist-source/`; when updating an app, keep its own `i18n/en.ts` and
`i18n/cs.ts` catalogs.

Alternatively, copy the folders manually:

Copy `src/components/ui/` together with `src/providers/`, `src/hooks/`,
`src/utils/` and `src/i18n/`, keeping those relative locations. Leave out
`*.test.ts`, `*.test.tsx` and `src/test/`. Copy `src/styles.css` as
`src/ui-styles.css` and install `lucide-react` alongside React and Tailwind.
Keep the library's `LICENSE` with the copy. Use local imports:

```tsx
// src/App.tsx
import { Button, UIProvider, cs } from "./components/ui";
```

```css
/* src/index.css */
@import "tailwindcss";
@import "./ui-styles.css";
```

Keep `components/ui/index.ts` when copying the folder: it exports all public
components, providers, locales, hooks and helpers. Keep
`components/ui/package.json` too: its `"sideEffects": false` lets bundlers
(webpack, Turbopack) leave out the components the app does not import. You
can keep your project's entry file. `npm run sync:source` updates a source
copy (see above). For the CSS too, add the Vite plugin of the copy -
`import componentsUi from "./src/components/ui/vite.js"` in `vite.config.ts`
(see Quick start).

For source copies, include the browser APIs and ES2023 definitions in your
TypeScript configuration (this does not require `target: "ES2023"`):

```json
{
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  }
}
```

The source needs React's TypeScript types, but does not need Node or Vite
types, project-specific import aliases or the React Compiler (the Vite
plugin, `components/ui/vite.js`, is a module of Node in JavaScript, with its
types in `vite.d.ts`, which imports none of Vite's - also with
`skipLibCheck: false`). The compiler is optional; the source includes memoization
for expensive queries and list rows. `npm run test:source` checks an exported copy in a standalone Vite
app and runs the library's tests without the compiler.

### Application translations

The copied source is ready to translate your app with the same system as
the UI. Add texts to `src/i18n/en.ts` and their translations to
`src/i18n/cs.ts`; both catalogs start empty. Types and autocomplete are
inferred from the English catalog, so no type file needs updating.
UI translations, localization types and formatting helpers live in
`src/i18n/ui/`.

```ts
// src/i18n/en.ts
import type { MessageCatalog } from "./ui/types";

const en = {
  dashboard: { title: "Dashboard", welcome: "Hello, {name}!" },
} satisfies MessageCatalog;

export default en;
```

```ts
// src/i18n/cs.ts
import type { AppMessages } from "./ui/types";

const cs: AppMessages = {
  dashboard: { title: "Přehled", welcome: "Ahoj, {name}!" },
};

export default cs;
```

```tsx
// src/components/Dashboard.tsx
import { formatMessage, useMessages } from "./ui";

export default function Dashboard() {
  const messages = useMessages();
  return (
    <section>
      <h1>{messages.dashboard.title}</h1>
      <p>{formatMessage(messages.dashboard.welcome, { name: "Jana" })}</p>
    </section>
  );
}
```

Render it inside `<UIProvider locale={cs}>`. Changing the provider's locale
switches the app and UI texts together. Application texts are at the root
of `useMessages()`; library texts are under `useMessages().ui`, for example
`messages.ui.common.cancel`. Provider overrides follow the same shape.
Plurals use the existing
`formatPlural` helper and can have different categories in each language.
TypeScript reports missing translations; the
[Localization](https://robertlib.github.io/components-ui/#/localization)
guide also shows how to fall back to English for incomplete catalogs.
Keep your application catalogs when updating `i18n/ui/` from the library.

## Development

The tests need Node.js 22.22, 24.15 or 26 and newer (`devEngines` - jsdom
needs them); building the package needs 22.12 or newer.

| Script                  | What it does                                                             |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm run dev`           | the docs with hot reload                                                 |
| `npm run check`         | type check, lint, tests and formatting                                   |
| `npm run lint`          | Oxlint, React Compiler and canonical Tailwind class checks               |
| `npm run lint:tailwind` | canonical Tailwind classes in the library, docs and browser fixtures     |
| `npm test`              | the unit and component tests (Vitest)                                    |
| `npm run test:source`   | exported sources, the Vite plugin, the packed package, no React Compiler |
| `npm run test:browser`  | browser regressions in Chromium, Firefox and WebKit                      |
| `npm run build:lib`     | the package: `dist/` - a module per source file, the styles, the types   |
| `npm run build:docs`    | the docs as a static site in `dist-docs/`                                |
| `npm run export:source` | a clean source copy and license in `dist-source/`                        |
| `npm run sync:source`   | copies or updates the source copy in an app: `-- ../app/src`             |
| `npm run format`        | Prettier (with Tailwind class sorting)                                   |

The Tailwind check uses the installed Tailwind version and `docs/styles.css`
to suggest canonical utility and variant names, like VS Code's Tailwind CSS
IntelliSense (`suggestCanonicalClasses`, with a root font size of 16px).
It also checks class constants, code examples and CSS `@apply` rules.
Run `npm run lint:tailwind -- --fix` to apply the suggestions, then
`npm run format` to sort and format the updated classes.

Tests that change `process.env.TZ` are listed in `timeZoneTests` in
`vitest.config.ts`. They always run in process workers, since Node does not
apply time-zone changes in worker threads. `npm test -- --pool=threads` uses
threads for the other tests; `npm test -- --project=timezones` runs only the
time-zone tests.

The browser tests use Playwright and the real stylesheet in Chromium,
Firefox and WebKit, with mobile emulation in Chromium and WebKit too.
Install the browsers once with `npx playwright install chromium firefox webkit`,
then run `npm run test:browser`. The runner starts its own Vite server on
port 4174. Tests in `tests/browser/` cover focus navigation through dialogs
opened from menus, focus after menu items change, cursor pagination during
pending URL changes, and the CSV file downloaded after a failed inline edit.
They also cover canceling calendar moves after data or date-limit changes
and when React Activity hides the calendar, and resetting hidden form fields
while uploads are pending.
Failures keep a screenshot and trace in `test-results/`; open the HTML report
with `npx playwright show-report`.

```
src/          the library
  components/ui/  all UI components and their internal helpers
  i18n/       application catalogs: en.ts and cs.ts
    ui/       UI locales, localization types and formatting helpers
  providers/, hooks/, utils/, styles.css
  index.ts    the package entry point (re-exports components/ui/index.ts)
docs/         the documentation site (not published)
  pages/      one file per page, registered in docs/pages.ts
  examples/   the live examples - rendered and shown from the same file
  mocks/      the in-browser REST and GraphQL mock API of the examples
```

How to add a component (with its docs and tests) and how to release a version
is described on the
[Developing the library](https://robertlib.github.io/components-ui/#/guides/contributing)
page of the docs. The GitHub Actions workflow in `.github/workflows/ci.yml`
runs `npm run check` and both builds on every push to `main` and `development`
and on every pull request, plus the browser tests in all three engines, the
tests of the sync, the Vite plugin and the package on macOS and Windows, and
the package built with the oldest Node.js of `engines`;
`.github/workflows/pages.yml` deploys the docs. Changes are recorded
in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
