import { Link } from "react-router";
import CodeBlock from "../components/code-block";
import DocPage, { Callout, Prose, Section } from "../components/doc-page";

const installGit = `# a tagged version from your git host - npm builds dist/ on install
npm install git+https://github.com/RobertLib/components-ui.git#v0.2.1

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
cd ../components-ui && npm pack    # builds dist/, writes components-ui-0.2.1.tgz
cd ../my-app && npm install ../components-ui/components-ui-0.2.1.tgz`;

const installRegistry = `# in the library: set a scoped name, remove "private": true, then
npm publish --registry https://npm.your-company.com

# in a project
npm install @your-company/components-ui`;

const registryImports = `import { Button, UIProvider } from "@your-company/components-ui";`;

const registryCss = `@import "tailwindcss";
@import "@your-company/components-ui/styles.css";`;

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
              <strong>Tailwind CSS 4.1 or newer</strong> - the components are
              styled with its classes, which your build generates. The
              stylesheet of the library uses features of 4.1 (
              <code>@source not</code>, the <code>pointer-coarse:</code>{" "}
              variant), which 4.0 does not compile.
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
            You can also copy <code>src/</code> into a project - it has no
            imports outside itself except React and lucide-react. You lose easy
            updates, though.
          </p>
        </Callout>
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
              <strong>Next.js (App Router)</strong> - the components, hooks and
              providers are marked <code>"use client"</code>: server components
              can render the components, which then run on the client. The
              helper functions that need no React (
              <code>readQueryFromSearch</code> and the other DataTable query
              helpers, <code>getFieldError</code>, <code>formatMessage</code>,{" "}
              <code>cn</code>, <code>getColorSchemeScript</code>, …) work in
              server components too. Import the styles in{" "}
              <code>app/globals.css</code> and render the providers in a client
              component (see <Link to="/routing">Routing</Link> for the Next.js
              adapter).
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
