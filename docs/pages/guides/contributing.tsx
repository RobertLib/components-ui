import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";

const structure = `src/                     the library (what gets published)
  components/            one file or folder per component
  providers/             UIProvider (locale + router), DrawerProvider, SnackbarProvider
  i18n/                  Locale / Messages types, en.ts, cs.ts, formatting helpers
  hooks/, utils/         shared hooks and helpers (dates, server errors, …)
  styles.css             theme tokens and the CSS the components need
  index.ts               the public API - everything a project can import
docs/                    this documentation site (not published)
  pages/                 one file per page, listed in docs/pages.ts
  examples/              the live examples - shown and run from the same file
  mocks/                 the in-browser REST / GraphQL mock API
  plugins/docgen.ts      builds the prop tables from the TypeScript source
dist/                    the built package (npm run build:lib)`;

const scripts = `npm run dev          # the docs with hot reload - http://localhost:5173
npm run check        # type check, lint, tests and formatting - what CI runs
npm run lint         # oxlint and the React Compiler check
npm test             # the unit and component tests (Vitest)
npm run format       # Prettier, with Tailwind class sorting
npm run build:lib    # the package: dist/ (a module per source file), styles.css, types
npm run build:docs   # the docs as a static site in dist-docs/`;

const newComponent = `// src/components/badge.tsx
import cn from "../utils/cn";

export interface BadgeProps extends React.ComponentProps<"span"> {
  /** Number shown in the badge - hidden when 0. */
  count: number;
}

/** A small counter, e.g. of unread notifications. */
export default function Badge({ className, count, ...props }: BadgeProps) {
  if (count === 0) return null;
  return (
    <span {...props} className={cn("bg-danger-500 rounded-full px-1.5 text-xs text-white", className)}>
      {count}
    </span>
  );
}`;

const release = `# 1. bump the version in package.json (semver: breaking change = major)
npm version minor
# 2. push the commit and the tag
git push --follow-tags
# 3. projects update the dependency to the new tag
npm install git+https://github.com/RobertLib/components-ui.git#v0.2.0`;

export default function ContributingGuide() {
  return (
    <DocPage
      description="How the repository is organized, how to add a component with its documentation, and how to release a new version."
      title="Developing the library"
    >
      <Section title="Structure">
        <CodeBlock code={structure} plain />
      </Section>

      <Section title="Scripts">
        <CodeBlock code={scripts} plain />
        <Prose>
          <p>
            <code>npm run check</code> runs the type check (<code>tsc -b</code>{" "}
            - the library and these docs), the lint (oxlint and the React
            Compiler check), the tests and <code>prettier --check</code>. Run{" "}
            <code>npm run format</code> before committing.
          </p>
        </Prose>
      </Section>

      <Section title="Adding a component">
        <Prose>
          <ol>
            <li>
              Create it in <code>src/components/</code>. Export its props
              interface as <code>NameProps</code> and describe every prop with a
              JSDoc comment - the docs build the prop table from them.
            </li>
            <li>
              Export the component and its types from <code>src/index.ts</code>.
            </li>
            <li>
              Put every text it renders into <code>Messages</code> (
              <code>src/i18n/types.ts</code>) with an English and a Czech
              translation, and read it with <code>useMessages()</code>.
            </li>
            <li>
              Render links with <code>useRouter().Link</code> and navigate with{" "}
              <code>useRouter().navigate</code> - never import a router.
            </li>
            <li>
              Add examples under <code>docs/examples/name/</code>, a page under{" "}
              <code>docs/pages/components/</code> and register it in{" "}
              <code>docs/pages.ts</code>.
            </li>
            <li>
              Cover the logic with tests next to the source (
              <code>name.test.tsx</code>) and run <code>npm run check</code>.
            </li>
          </ol>
        </Prose>
        <CodeBlock code={newComponent} />
      </Section>

      <Section title="Rules of thumb">
        <Prose>
          <ul>
            <li>
              Nothing app-specific: no API calls, no auth, no fixed routes or
              texts. Data comes in through props and callbacks.
            </li>
            <li>
              Style with the theme tokens (<code>primary-*</code>,{" "}
              <code>neutral-*</code>, <code>surface</code>, …) and always add
              the <code>dark:</code> variant. Write whole class names - Tailwind
              finds them by scanning the source, it cannot see names built at
              runtime.
            </li>
            <li>
              Support both controlled and uncontrolled use where a component
              holds a value, and pass the native attributes through.
            </li>
            <li>
              Label interactive elements for screen readers and keep keyboard
              operation working.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Releasing">
        <Prose>
          <p>
            Projects install the library from its git repository by tag (or from
            a registry, see Installation). A release is a version bump and a
            tag; npm builds <code>dist/</code> on install through the{" "}
            <code>prepare</code> script.
          </p>
        </Prose>
        <CodeBlock code={release} plain />
        <Callout type="warning">
          <p>
            Note breaking changes in <code>CHANGELOG.md</code> - the projects
            using the library will look there first.
          </p>
        </Callout>
      </Section>
    </DocPage>
  );
}
