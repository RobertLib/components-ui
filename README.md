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

Requirements: React 19, Tailwind CSS 4.1 or newer and a bundler that sets
`process.env.NODE_ENV` (Vite, Next.js, webpack, …).

1. **Install** - from the git repository by tag (npm builds the package on
   install), a local folder, or your registry (publishing there needs a scoped
   name and `"private": true` removed - see the
   [Installation](https://robertlib.github.io/components-ui/#/installation)
   page):

   ```sh
   npm install git+https://github.com/RobertLib/components-ui.git#v0.2.2
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

| Script               | What it does                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| `npm run dev`        | the docs with hot reload                                                |
| `npm run check`      | type check, lint (incl. the React Compiler check), tests and formatting |
| `npm test`           | the unit and component tests (Vitest)                                   |
| `npm run build:lib`  | the package: `dist/` - a module per source file, the styles, the types  |
| `npm run build:docs` | the docs as a static site in `dist-docs/`                               |
| `npm run format`     | Prettier (with Tailwind class sorting)                                  |

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
runs `npm run check` and both builds on every push to `main` and on every pull
request; `.github/workflows/pages.yml` deploys the docs. Changes are recorded
in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
