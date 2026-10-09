import { Link } from "react-router";
import CodeBlock from "../components/code-block";
import DocPage, { Callout, Prose, Section } from "../components/doc-page";

const installGit = `# a tagged version from your git host - npm builds dist/ on install
npm install git+https://github.com/RobertLib/components-ui.git#v0.5.0

# the latest commit of a branch
npm install git+https://github.com/RobertLib/components-ui.git#main

# if npm refuses to run the build (install-scripts), allow it
npm install-scripts approve components-ui`;

const installLocal = `# working on the library and an app side by side
npm install ../components-ui       # a "file:" dependency - a symlink
# after a change in the library:
cd ../components-ui && npm run build:lib`;

const dedupeVite = `// vite.config.ts of the app
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
});`;

const dedupeWebpack = `// webpack.config.js of the app (Rsbuild / Rspack: the same resolve.alias)
resolve: {
  alias: {
    react: path.resolve("./node_modules/react"),
    "react-dom": path.resolve("./node_modules/react-dom"),
  },
},`;

const installTarball = `# a copy instead of a link - like an install from a registry
cd ../components-ui && npm pack    # builds dist/, writes components-ui-0.5.0.tgz
cd ../my-app && npm install ../components-ui/components-ui-0.5.0.tgz`;

const installRegistry = `# in the library: set a scoped name, remove "private": true, then
npm publish --registry https://npm.your-company.com

# in a project
npm install @your-company/components-ui`;

const registryImports = `import { Button, UIProvider } from "@your-company/components-ui";`;

const registryCss = `@import "tailwindcss";
@import "@your-company/components-ui/styles.css";`;

const sourceStructure = `src/
  components/ui/    copy src/components/ui/ from the library
    index.ts        named exports for the whole public API
  providers/        copy src/providers/
  hooks/            copy src/hooks/
  utils/            copy src/utils/
  i18n/             application catalogs: en.ts and cs.ts (initially empty)
    ui/             UI locales, localization types and formatting helpers
  ui-styles.css     copy src/styles.css under this name`;

const syncSource = `# in a clone of the library, at the version to take
git clone https://github.com/RobertLib/components-ui.git && cd components-ui
npm ci
npm run sync:source -- ../my-app/src --dry-run   # what would change
npm run sync:source -- ../my-app/src`;

const lintOverrides = `// .oxlintrc.json of the app - the copy keeps the library's own rules
{
  "overrides": [
    {
      "files": [
        "src/components/ui/**",
        "src/providers/**",
        "src/hooks/**",
        "src/utils/**",
        "src/i18n/ui/**"
      ],
      "rules": {
        "react/exhaustive-deps": "off",
        "react/purity": "off",
        "jsx-a11y/anchor-has-content": "off",
        "jsx-a11y/anchor-is-valid": "off",
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/control-has-associated-label": "off",
        "jsx-a11y/interactive-supports-focus": "off",
        "jsx-a11y/no-autofocus": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "jsx-a11y/no-redundant-roles": "off",
        "jsx-a11y/no-static-element-interactions": "off",
        "jsx-a11y/role-has-required-aria-props": "off",
        "jsx-a11y/role-supports-aria-props": "off",
        "jsx-a11y/scope": "off"
      }
    }
  ]
}

# .prettierignore - formatted by the library
src/components/ui
src/providers
src/hooks
src/utils
src/i18n/ui
src/ui-styles.css`;

const sourceImports = `// src/App.tsx - local imports for the provider example below
import {
  Button,
  ConfirmProvider,
  cs,
  SnackbarProvider,
  UIProvider,
} from "./components/ui";`;

const sourceCss = `/* src/index.css */
@import "tailwindcss";
@import "./ui-styles.css";`;

const sourceTypeScript = `// tsconfig.json - source copies need these API definitions
{
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  }
}`;

const css = `/* src/index.css (or app/globals.css in Next.js) */
@import "tailwindcss";
@import "components-ui/styles.css";

/* optional - your brand colors, see Theming */
@theme {
  --color-primary-500: oklch(60.6% 0.25 292.717);
}`;

const sourceFallback = `/* Only if Tailwind does not pick up the classes of the components
   (an unusual setup, e.g. a monorepo with hoisted packages) */
@source "../node_modules/components-ui/dist";`;

const baseStyles = `/* A sensible base the components are designed for */
:root {
  color: #213547;
  background-color: var(--color-background);
}

@media (prefers-color-scheme: dark) {
  :root {
    color: rgb(255 255 255 / 0.87);
    background-color: var(--color-background-dark);
  }
}`;

const providers = `import {
  ConfirmProvider,
  cs,
  SnackbarProvider,
  UIProvider,
} from "components-ui";

export default function App() {
  return (
    <UIProvider locale={cs}>
      <SnackbarProvider>
        <ConfirmProvider>
          <YourRoutes />
        </ConfirmProvider>
      </SnackbarProvider>
    </UIProvider>
  );
}`;

const portalContainer = `// A web component - the app and its overlays in its shadow root
const shadow = host.attachShadow({ mode: "open" });
const app = document.createElement("div");
const overlays = document.createElement("div");
shadow.append(app, overlays);

createRoot(app).render(
  <UIProvider portalContainer={overlays}>
    <App />
  </UIProvider>,
);`;

const firstComponent = `import { Button, Input } from "components-ui";

export function Search() {
  return (
    <form className="flex gap-2">
      <Input name="q" placeholder="Search…" />
      <Button type="submit">Search</Button>
    </form>
  );
}`;

export default function Installation() {
  return (
    <DocPage
      description="Add the library to a React project in three steps: install the package, import its stylesheet into Tailwind, render the provider."
      title="Installation"
    >
      <Section title="Requirements">
        <Prose>
          <ul>
            <li>
              <strong>React 19</strong> (the components use its APIs, such as{" "}
              <code>use()</code> and refs as props).
            </li>
            <li>
              <strong>Tailwind CSS 4.3 or newer</strong> - the components are
              styled with its classes, which your build generates. The library
              uses canonical logical positioning classes such as{" "}
              <code>inset-s-0</code> and the <code>scrollbar-thin</code>{" "}
              utility.
            </li>
            <li>
              A bundler that sets <code>process.env.NODE_ENV</code> - Vite,
              Next.js, webpack, Rsbuild and others do.
            </li>
          </ul>
          <p>
            <code>lucide-react</code> (the icons) is installed with the library.
          </p>
        </Prose>
      </Section>

      <Section title="1. Install">
        <Prose>
          <p>Pick the way that fits your team:</p>
        </Prose>
        <CodeBlock code={installGit} plain title="From a git repository" />
        <CodeBlock
          className="mt-4"
          code={installLocal}
          plain
          title="From a local folder"
        />
        <Callout title="Two copies of React" type="warning">
          <p>
            The linked folder brings its own <code>node_modules</code>, and the
            bundler resolves the <code>react</code> the library imports from
            there - the app then runs two copies of React and fails with
            "Invalid hook call" (in a production build "Cannot read properties
            of null"). Make the bundler take React from the app:
          </p>
        </Callout>
        <CodeBlock code={dedupeVite} title="Vite" />
        <CodeBlock className="mt-4" code={dedupeWebpack} title="webpack" />
        <Prose>
          <p>
            With other setups (Next.js and its Turbopack, …) test the library as
            a tarball - it installs as a copy, without its{" "}
            <code>node_modules</code>, so there is one React. Repeat both
            commands after each change:
          </p>
        </Prose>
        <CodeBlock code={installTarball} plain title="From a tarball" />
        <CodeBlock
          className="mt-4"
          code={installRegistry}
          plain
          title="From a (private) npm registry"
        />
        <Prose>
          <p>
            The scoped name changes the imports, the path of the stylesheet and
            of the <code>@source</code> fallback below - wherever these docs
            write <code>components-ui</code>, use the name you published:
          </p>
        </Prose>
        <CodeBlock code={registryImports} />
        <CodeBlock className="mt-4" code={registryCss} />
        <Callout>
          <p>
            You can also copy the source into your project, as described below.
            All library components live in <code>components/ui/</code>, so your
            application components can use <code>components/</code>.
          </p>
        </Callout>
      </Section>

      <Section title="Copying the source">
        <Prose>
          <p>
            As an alternative to installing the package, generate a clean copy
            in the library repository:
          </p>
        </Prose>
        <CodeBlock code="npm run export:source" plain />
        <Prose>
          <p>
            Merge the generated <code>dist-source/src/</code> into your
            project's <code>src/</code> and keep{" "}
            <code>dist-source/LICENSE</code> with the library. The export
            excludes tests and the package entry file, and names the stylesheet{" "}
            <code>ui-styles.css</code>. It regenerates <code>dist-source/</code>{" "}
            on every run; when updating your app, keep its own translation
            catalogs.
          </p>
          <p>
            You can also copy the following folders manually, keeping their
            relative locations. Include the shared hooks, providers, utilities
            and locales: the components import them. Leave out{" "}
            <code>*.test.ts</code>, <code>*.test.tsx</code> and{" "}
            <code>src/test/</code>, and keep the library's <code>LICENSE</code>.
          </p>
        </Prose>
        <CodeBlock code={sourceStructure} plain />
        <Prose>
          <p>
            Install <code>lucide-react</code> alongside React and Tailwind, then
            import from <code>./components/ui</code>. Keep its{" "}
            <code>index.ts</code> when copying: it exports all public
            components, providers, locales, hooks and helpers. You can keep your
            application's existing entry file.
          </p>
        </Prose>
        <CodeBlock code="npm install lucide-react" plain />
        <CodeBlock className="mt-4" code={sourceImports} />
        <Prose>
          <p>
            Import the copied stylesheet after Tailwind. Its{" "}
            <code>@source</code> scans the folders next to it, including{" "}
            <code>components/ui/</code>.
          </p>
        </Prose>
        <CodeBlock code={sourceCss} />
        <Prose>
          <p>
            Include ES2023 and browser API definitions in your TypeScript
            configuration. This is a <code>lib</code> setting, not a requirement
            to emit ES2023 JavaScript. Source copies need React's types but do
            not need Node types, import aliases or the React Compiler. The
            compiler is optional: expensive queries and list rows have their own
            memoization. <code>npm run test:source</code> checks the exported
            sources in a standalone Vite app and runs the tests without the
            compiler.
          </p>
        </Prose>
        <CodeBlock code={sourceTypeScript} />
        <h3 className="mt-8 mb-2 text-lg font-semibold">Updating the copy</h3>
        <Prose>
          <p>
            <code>npm run sync:source -- &lt;the src of the app&gt;</code> in
            the library repository copies the library into the app and updates
            it later. A manifest in the copy (<code>.components-ui.json</code>,
            commit it) lists the files the library put there with their hashes
            and its version - an update replaces and removes those alone, so the
            files of the app next to them in <code>hooks/</code>,{" "}
            <code>utils/</code> or <code>providers/</code> stay, and so do the
            catalogs of the app (<code>i18n/en.ts</code>,{" "}
            <code>i18n/cs.ts</code>, written once as templates). A library file
            changed in the copy stops the update with a list of them - move the
            change into the library, or replace it with <code>--force</code>;{" "}
            <code>--dry-run</code> shows what would change. The first sync of a
            copy made by hand takes it over: it replaces the library&apos;s
            files and removes nothing.
          </p>
        </Prose>
        <CodeBlock code={syncSource} plain />
        <Prose>
          <p>
            The copy follows the rules of the library, which its own tests check
            - also for accessibility. The rules of the app for keyboard handlers
            and roles (<code>jsx-a11y</code>) would report its composite widgets
            - the grid of a calendar, the rows of a tree, a listbox - and their
            hooks deliberate dependencies. Leave the copy out of them, and out
            of the formatter of the app, so that an update is a plain copy
            again:
          </p>
        </Prose>
        <CodeBlock code={lintOverrides} />
        <Prose>
          <p>
            Add your application's translations to <code>i18n/en.ts</code> and{" "}
            <code>i18n/cs.ts</code>, then read them with{" "}
            <code>useMessages()</code>. Library texts are under{" "}
            <code>useMessages().ui</code>. Types come from the English catalog,
            and <code>UIProvider</code> switches the language of your app and
            the UI together. See <Link to="/localization">Localization</Link>{" "}
            for the full recipe. Keep your application catalogs when copying
            updates to <code>i18n/ui/</code>.
          </p>
        </Prose>
      </Section>

      <Section title="2. Import the styles">
        <Prose>
          <p>
            Import the library's stylesheet right after Tailwind. It brings the
            color tokens and a few helper classes, and tells Tailwind (through{" "}
            <code>@source</code>) to scan the components for the classes they
            use.
          </p>
        </Prose>
        <CodeBlock code={css} />
        <CodeBlock className="mt-4" code={sourceFallback} />
        <Prose>
          <p>
            The library does not style <code>body</code> - add a base like this
            if your app has none:
          </p>
        </Prose>
        <CodeBlock code={baseStyles} />
      </Section>

      <Section title="3. Render the providers">
        <Prose>
          <p>
            <code>UIProvider</code> sets the language and connects your router
            (see <Link to="/routing">Routing</Link>).{" "}
            <code>SnackbarProvider</code> is needed only for toasts and{" "}
            <code>ConfirmProvider</code> only for <code>useConfirm</code>. All
            of them are optional - without <code>UIProvider</code> the
            components speak English and use plain links.
          </p>
        </Prose>
        <CodeBlock code={providers} />
      </Section>

      <Section title="Where the overlays are rendered">
        <Prose>
          <p>
            Dialogs, sheets, popovers, menus, tooltips, toasts and the{" "}
            <code>Overlay</code> backdrop are rendered into{" "}
            <code>document.body</code>, so no <code>overflow</code> or
            transformed parent clips them. <code>portalContainer</code> of{" "}
            <code>UIProvider</code> renders them into another element of the
            page - one of a fullscreen element, or of the shadow root of a web
            component, where the styles of the app reach them. A function (
            <code>{"() => element"}</code>) is read as an overlay opens; a
            nested <code>UIProvider</code> takes the container of the one around
            it, <code>null</code> goes back to the body.
          </p>
          <p>
            The overlays work there as in the body: the focus goes in and back,
            a modal dialog hides the page behind it from screen readers and
            stops it scrolling, and what follows the dialog in the container is
            taken to be opened from it (a list opened in the dialog) and stays
            reachable. Render the portals of other libraries there too - a modal
            dialog in the container hides what they add to the body. The
            container must be in the page itself, not in an iframe.
          </p>
        </Prose>
        <CodeBlock code={portalContainer} />
      </Section>

      <Section title="Use the components">
        <CodeBlock code={firstComponent} />
      </Section>

      <Section title="Frameworks">
        <Prose>
          <ul>
            <li>
              <strong>Vite</strong> - works as shown above.
            </li>
            <li>
              <strong>Next.js (App Router)</strong> - in the built package, the
              components, hooks and providers are marked{" "}
              <code>"use client"</code>: server components can render the
              components, which then run on the client. The helper functions
              that need no React (<code>readQueryFromSearch</code> and the other
              DataTable query helpers, <code>getFieldError</code>,{" "}
              <code>formatMessage</code>, <code>cn</code>,{" "}
              <code>getColorSchemeScript</code>, …) work in server components
              too. Import the styles in <code>app/globals.css</code> and render
              the providers in a client component (see{" "}
              <Link to="/routing">Routing</Link> for the Next.js adapter).
              Source files do not contain this directive: import interactive UI
              from a component marked <code>"use client"</code> when copying
              into an App Router project.
            </li>
            <li>
              <strong>TypeScript</strong> - the type declarations are included;
              no <code>@types</code> package is needed.
            </li>
          </ul>
        </Prose>
      </Section>
    </DocPage>
  );
}
