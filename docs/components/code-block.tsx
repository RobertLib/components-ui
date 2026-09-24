import { Check, Copy } from "lucide-react";
import { highlight } from "sugar-high";
import { useMemo, useState } from "react";
import { cn } from "components-ui";

interface CodeBlockProps {
  className?: string;
  code: string;
  /** Plain text without highlighting, e.g. shell commands. */
  plain?: boolean;
  /** Shown above the code, e.g. a file name. */
  title?: string;
}

/** Highlighted source code with a copy button. */
export default function CodeBlock({
  className,
  code,
  plain = false,
  title,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const trimmed = code.trim();

  // sugar-high escapes the source, so the HTML contains only its own spans
  const html = useMemo(
    () => (plain ? null : highlight(trimmed)),
    [plain, trimmed],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard not available (insecure context) - nothing to do
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-[#141414]",
        className,
      )}
    >
      {title && (
        <div className="border-b border-neutral-200 px-4 py-1.5 font-mono text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {title}
        </div>
      )}
      <button
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute top-2 right-2 rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-neutral-800 focus:opacity-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        onClick={copy}
        type="button"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6">
        {html ? (
          <code dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code>{trimmed}</code>
        )}
      </pre>
    </div>
  );
}
