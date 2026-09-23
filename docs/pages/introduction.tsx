import { Link } from "react-router";
import DocPage, { Prose, Section } from "../components/doc-page";
import Example from "../components/example";
import InlineCode from "../components/inline-code";
import docs from "../lib/docgen";
import { groups } from "../pages";

const principles = [
  {
    text: "Autocomplete, DataTable and FileUpload take functions and data instead of fetching - REST, GraphQL or rows in the browser all fit.",
    title: "Any backend",
  },
  {
    text: "Links and navigation go through a small adapter - React Router, Next.js, TanStack Router or plain links.",
    title: "Any router",
  },
  {
    text: "English and Czech built in, any other language as a locale object. Dates and names come from Intl.",
    title: "Localized",
  },
  {
    text: "Tailwind CSS v4 with color tokens you override in one @theme block. Dark mode included.",
    title: "Themable",
  },
  {
    text: "Written in strict TypeScript; every prop is typed and documented right in the source.",
    title: "Typed",
  },
  {
    text: "Labels, roles and keyboard control for the interactive parts - dialogs trap the focus, lists work with the arrows.",
    title: "Accessible",
  },
];

export default function Introduction() {
  return (
    <DocPage
      description="A React component library for business applications - forms, data tables, calendars, dialogs and the app layout - built on Tailwind CSS and independent of any backend or router."
      title="components-ui"
    >
      <Example collapsed name="intro/glance" title="At a glance" />

      <Section title="Principles">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {principles.map((principle) => (
            <div
              className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800 dark:bg-surface-dark"
              key={principle.title}
            >
              <div className="mb-1 font-semibold">{principle.title}</div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {principle.text}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Get started">
        <Prose>
          <ol>
            <li>
              <Link to="/installation">Install</Link> the package, import the
              stylesheet and render <code>UIProvider</code>.
            </li>
            <li>
              Pick your language on <Link to="/localization">Localization</Link>{" "}
              and connect your router on <Link to="/routing">Routing</Link>.
            </li>
            <li>
              Match your brand on <Link to="/theming">Theming</Link>.
            </li>
            <li>
              Wire up your API with the{" "}
              <Link to="/guides/data-fetching">REST &amp; GraphQL</Link> guide.
            </li>
          </ol>
          <p>
            The examples on every page are live - the component language (EN /
            CS) and the color theme switch in the top bar.
          </p>
        </Prose>
      </Section>

      <Section title="Components">
        <div className="space-y-8">
          {groups.slice(2).map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <group.icon size={18} /> {group.title}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.pages.map((page) => {
                  const description =
                    docs.components[page.title]?.description.split("\n\n")[0];

                  return (
                    <Link
                      className="rounded-xl border border-neutral-200 bg-surface p-4 transition-colors hover:border-primary-400 dark:border-neutral-800 dark:bg-surface-dark"
                      key={page.path}
                      to={page.path}
                    >
                      <div className="font-medium">{page.title}</div>
                      {description && (
                        <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                          <InlineCode text={description.replace(/\n/g, " ")} />
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </DocPage>
  );
}
