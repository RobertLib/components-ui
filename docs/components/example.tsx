import { ChevronDown, Code } from "lucide-react";
import { useState } from "react";
import { cn, ErrorBoundary } from "components-ui";
import CodeBlock from "./code-block";
import { slugify } from "./slugify";

const modules = import.meta.glob<{ default: React.ComponentType }>(
  "../examples/**/*.tsx",
  { eager: true },
);

const sources = import.meta.glob<string>("../examples/**/*.tsx", {
  eager: true,
  import: "default",
  query: "?raw",
});

interface ExampleProps {
  /** Classes of the preview area, e.g. a minimum height. */
  className?: string;
  description?: React.ReactNode;
  /** Path of the example file under docs/examples, without `.tsx`. */
  name: string;
  /** Hide the code until "Show code" is clicked. */
  collapsed?: boolean;
  title?: string;
}

/**
 * A live example and its source. The code shown is the file that renders
 * the preview, so the two can never drift apart.
 */
export default function Example({
  className,
  collapsed,
  description,
  name,
  title,
}: ExampleProps) {
  const key = `../examples/${name}.tsx`;
  const Demo = modules[key]?.default;
  const source = sources[key] ?? "";

  // Short examples show their code right away, long ones on request
  const [showCode, setShowCode] = useState(
    () => !(collapsed ?? source.split("\n").length > 45),
  );

  if (!Demo) {
    throw new Error(`Example "${name}" not found in docs/examples`);
  }

  return (
    <section className="my-8">
      {title && (
        <h3
          className="mb-2 scroll-mt-20 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
          id={slugify(title)}
        >
          {title}
        </h3>
      )}
      {description && <div className="prose mb-3 max-w-3xl">{description}</div>}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div
          className={cn(
            "rounded-t-xl bg-surface p-6 dark:bg-surface-dark",
            !showCode && "rounded-b-xl",
            className,
          )}
        >
          <ErrorBoundary>
            <Demo />
          </ErrorBoundary>
        </div>
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <button
            aria-expanded={showCode}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            onClick={() => setShowCode((value) => !value)}
            type="button"
          >
            <Code size={14} />
            {showCode ? "Hide code" : "Show code"}
            <ChevronDown
              className={cn(
                "ml-auto transition-transform",
                showCode && "rotate-180",
              )}
              size={14}
            />
          </button>
          {showCode && (
            <CodeBlock
              className="rounded-t-none rounded-b-xl border-0 border-t"
              code={source}
            />
          )}
        </div>
      </div>
    </section>
  );
}
