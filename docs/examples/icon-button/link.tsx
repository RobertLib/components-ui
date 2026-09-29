import { ExternalLink, Pencil } from "lucide-react";
import { IconButton } from "components-ui";

export default function LinkButton() {
  return (
    <div className="flex items-center gap-4">
      {/* A link of the router - it opens a page, it is no action */}
      <IconButton
        aria-label="Edit the order"
        color="primary"
        href="/components/icon-button"
        tooltip
      >
        <Pencil size={18} />
      </IconButton>
      {/* Disabled, it has no href - nothing opens it */}
      <IconButton aria-label="Open the invoice" disabled href="/invoices/42">
        <ExternalLink size={18} />
      </IconButton>
    </div>
  );
}
