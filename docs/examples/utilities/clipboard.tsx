import { Check, Link } from "lucide-react";
import { Button, useClipboard } from "components-ui";

const url = "https://crm.example.com/invoices/2026-0042";

export default function Clipboard() {
  const { copied, copy, error } = useClipboard();

  return (
    <div className="space-y-2">
      <Button onClick={() => copy(url)} variant="outline">
        {copied ? (
          <Check className="mr-1.5" size={16} />
        ) : (
          <Link className="mr-1.5" size={16} />
        )}
        {copied ? "Link copied" : "Copy link to the invoice"}
      </Button>
      {error && (
        <p
          className="text-sm text-danger-700 dark:text-danger-400"
          role="alert"
        >
          The link could not be copied - select it below and copy it yourself.
        </p>
      )}
      <p className="text-sm break-all text-neutral-500 dark:text-neutral-400">
        {url}
      </p>
    </div>
  );
}
