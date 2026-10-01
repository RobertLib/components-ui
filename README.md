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
  object; dates, month and weekday names come from `Intl`.
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
`process.env.NODE_ENV` (Vite, Next.js, webpack, …).

1. **Install** - from the git repository by tag (npm builds the package on
   install), a local folder, or your registry (publishing there needs a scoped
   name and `"private": true` removed - see the
   [Installation](https://robertlib.github.io/components-ui/#/installation)
   page):

   ```sh
   npm install git+https://github.com/RobertLib/components-ui.git#v0.3.3
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

## Development

| Script                  | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | the docs with hot reload                                               |
| `npm run check`         | type check, lint, tests and formatting                                 |
| `npm run lint`          | Oxlint, React Compiler and canonical Tailwind class checks             |
| `npm run lint:tailwind` | canonical Tailwind classes in the library, docs and browser fixtures   |
| `npm test`              | the unit and component tests (Vitest)                                  |
| `npm run test:browser`  | browser regressions in Chromium, Firefox and WebKit                    |
| `npm run build:lib`     | the package: `dist/` - a module per source file, the styles, the types |
| `npm run build:docs`    | the docs as a static site in `dist-docs/`                              |
| `npm run format`        | Prettier (with Tailwind class sorting)                                 |

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
src/          the library - components, providers, i18n, hooks, utils, styles.css
  index.ts    the public API
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
and on every pull request, plus the browser tests in all three engines; `.github/workflows/pages.yml`
deploys the docs. Changes are recorded
in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
