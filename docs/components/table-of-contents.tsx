import { useEffect, useState } from "react";

interface Heading {
  id: string;
  level: number;
  text: string;
}

const readHeadings = (): Heading[] =>
  Array.from(
    document.querySelectorAll<HTMLHeadingElement>(
      "#docs-content h2[id], #docs-content h3[id]",
    ),
  ).map((heading) => ({
    id: heading.id,
    level: heading.tagName === "H2" ? 2 : 3,
    text: heading.textContent ?? "",
  }));

/** "On this page" - the headings of the current page, on wide screens. */
export default function TableOfContents({ pathname }: { pathname: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    const content = document.getElementById("docs-content");
    if (!content) return;

    // Pages load lazily - follow the content as it renders
    const update = () => setHeadings(readHeadings());
    const observer = new MutationObserver(update);
    observer.observe(content, { childList: true, subtree: true });
    const frame = requestAnimationFrame(update);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  if (headings.length < 2) return <div className="hidden xl:block" />;

  return (
    <nav aria-label="On this page" className="hidden xl:block">
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto text-sm">
        <div className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">
          On this page
        </div>
        <ul className="space-y-1.5">
          {headings.map((heading) => (
            <li
              className={heading.level === 3 ? "pl-3" : undefined}
              key={heading.id}
            >
              <button
                className="text-left text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400"
                onClick={() =>
                  document
                    .getElementById(heading.id)
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                type="button"
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
