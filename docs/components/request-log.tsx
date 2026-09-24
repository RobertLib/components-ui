import { useSyncExternalStore } from "react";
import { cn } from "components-ui";
import { requestLog } from "../mocks/api";

interface RequestLogProps {
  /** Only requests whose URL starts with it. */
  filter?: string;
  /** Show the request body (GraphQL variables). */
  showBody?: boolean;
}

const describeBody = (body: string) => {
  try {
    const parsed = JSON.parse(body) as { variables?: unknown };
    return JSON.stringify(parsed.variables ?? parsed);
  } catch {
    return body;
  }
};

/** The latest requests to the mock API - shows what a component sends. */
export default function RequestLog({
  filter,
  showBody = false,
}: RequestLogProps) {
  const entries = useSyncExternalStore(
    requestLog.subscribe,
    requestLog.getSnapshot,
  ).filter((entry) => !filter || entry.url.startsWith(filter));

  return (
    <div
      className="mt-4 rounded-lg border border-dashed border-neutral-300 p-3 text-xs dark:border-neutral-700"
      data-testid="request-log"
    >
      <div className="mb-2 flex items-center justify-between font-semibold text-neutral-600 dark:text-neutral-400">
        Network (mock API)
        <button
          className="font-normal text-neutral-500 hover:underline dark:text-neutral-400"
          onClick={() => requestLog.clear()}
          type="button"
        >
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400">
          No requests yet - interact with the example.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto font-mono">
          {entries.slice(0, 8).map((entry) => (
            <li className="flex gap-2" key={entry.id}>
              <span
                className={cn(
                  "w-10 shrink-0",
                  entry.status === undefined && "text-neutral-400",
                  entry.status === 0 && "text-warning-600",
                  entry.status !== undefined &&
                    entry.status >= 200 &&
                    entry.status < 300 &&
                    "text-success-600",
                  entry.status !== undefined &&
                    entry.status >= 400 &&
                    "text-danger-600",
                )}
              >
                {entry.status === undefined
                  ? "…"
                  : entry.status === 0
                    ? "abort"
                    : entry.status}
              </span>
              <span className="w-10 shrink-0 text-neutral-500 dark:text-neutral-400">
                {entry.method}
              </span>
              <span className="min-w-0 break-all text-neutral-800 dark:text-neutral-200">
                {entry.url}
                {showBody && entry.body && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {" "}
                    {describeBody(entry.body)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
