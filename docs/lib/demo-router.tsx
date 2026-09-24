import { ArrowLeft } from "lucide-react";
import { use, useCallback, useMemo, useState } from "react";
import {
  UIProvider,
  useLocale,
  type LinkComponentProps,
  type RouterAdapter,
} from "components-ui";
import { DemoNavigateContext } from "./demo-router-context";

/** A link of the demo router - navigates inside the demo only. */
function DemoLink({ href, onClick, ...props }: LinkComponentProps) {
  const navigate = use(DemoNavigateContext);

  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}

const resolve = (href: string, current: string) =>
  new URL(href, new URL(current, "http://demo")).pathname +
  new URL(href, new URL(current, "http://demo")).search;

interface DemoRouterProps {
  children: React.ReactNode;
  className?: string;
  initialPath?: string;
}

/**
 * An in-memory router for demos of navigation components: links change the
 * address shown above the demo instead of leaving the docs page. It is a
 * complete `RouterAdapter`, just like one for React Router or Next.js.
 */
export default function DemoRouter({
  children,
  className,
  initialPath = "/",
}: DemoRouterProps) {
  const locale = useLocale();
  const [history, setHistory] = useState([initialPath]);
  const current = history[history.length - 1];

  const navigate = useCallback(
    (href: string, options?: { replace?: boolean }) =>
      setHistory((previous) => {
        const next = resolve(href, previous[previous.length - 1]);
        return options?.replace
          ? [...previous.slice(0, -1), next]
          : [...previous, next];
      }),
    [],
  );

  const back = useCallback(
    () =>
      setHistory((previous) =>
        previous.length > 1 ? previous.slice(0, -1) : previous,
      ),
    [],
  );

  const router = useMemo<RouterAdapter>(() => {
    const index = current.indexOf("?");
    return {
      back,
      Link: DemoLink,
      navigate,
      pathname: index === -1 ? current : current.slice(0, index),
      search: index === -1 ? "" : current.slice(index),
    };
  }, [back, current, navigate]);

  return (
    <DemoNavigateContext value={navigate}>
      <UIProvider locale={locale} router={router}>
        <div className={className}>
          <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <button
              aria-label="Back"
              className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-neutral-800"
              disabled={history.length < 2}
              onClick={back}
              type="button"
            >
              <ArrowLeft size={14} />
            </button>
            <span aria-live="polite">{current}</span>
          </div>
          {children}
        </div>
      </UIProvider>
    </DemoNavigateContext>
  );
}
