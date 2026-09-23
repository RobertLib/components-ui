import docs from "../lib/docgen";
import CodeBlock from "./code-block";
import InlineCode from "./inline-code";
import { slugify } from "./slugify";

interface DocPageProps {
  children: React.ReactNode;
  /** Lead text under the title - the component's JSDoc when left out. */
  description?: React.ReactNode;
  /** Names imported from "components-ui", shown as the import line. */
  imports?: string[];
  title: string;
}

/** The frame of a docs page: title, lead text and the import line. */
export default function DocPage({
  children,
  description,
  imports,
  title,
}: DocPageProps) {
  const sourceDescription = docs.components[title]?.description;

  return (
    <article className="pb-24">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          {title}
        </h1>
        {(description ?? sourceDescription) && (
          <div className="mt-3 max-w-3xl text-lg text-neutral-600 dark:text-neutral-400">
            {description ?? <InlineCode text={sourceDescription ?? ""} />}
          </div>
        )}
        {imports && (
          <CodeBlock
            className="mt-6 max-w-3xl"
            code={`import { ${imports.join(", ")} } from "components-ui";`}
          />
        )}
      </header>
      {children}
    </article>
  );
}

/** A second-level heading with an anchor id. */
export function Section({
  children,
  title,
}: {
  children?: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2
        className="mt-14 mb-3 scroll-mt-20 border-b border-neutral-200 pb-2 text-2xl font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100"
        id={slugify(title)}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Long-form text with the docs typography. */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose">{children}</div>;
}

/** A highlighted note. */
export function Callout({
  children,
  title,
  type = "info",
}: {
  children: React.ReactNode;
  title?: string;
  type?: "info" | "warning";
}) {
  return (
    <div
      className={
        type === "warning"
          ? "my-4 max-w-3xl rounded-r-lg border-l-4 border-warning-400 bg-warning-50 px-4 py-3 text-sm dark:bg-warning-950/40"
          : "my-4 max-w-3xl rounded-r-lg border-l-4 border-primary-400 bg-primary-50 px-4 py-3 text-sm dark:bg-primary-950/40"
      }
    >
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="prose text-sm [&_p]:my-1">{children}</div>
    </div>
  );
}
