import { Trash2 } from "lucide-react";
import { IconButton, Link, VisuallyHidden } from "components-ui";

export default function Basic() {
  return (
    <div className="relative space-y-4 text-sm">
      {/* Press Tab to see it - it shows while it has the focus */}
      <VisuallyHidden
        className="absolute top-0 left-0 z-10 rounded-md bg-surface px-3 py-2 shadow-lg dark:bg-surface-dark"
        focusable
      >
        <Link
          href="#invoices"
          onClick={(event) => {
            // Moves the focus without touching the URL - a router owns it
            event.preventDefault();
            document.getElementById("invoices")?.focus();
          }}
        >
          Skip to the invoices
        </Link>
      </VisuallyHidden>

      <table
        className="w-full max-w-md text-left focus:outline-none"
        id="invoices"
        tabIndex={-1}
      >
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2">Invoice</th>
            <th className="py-2">Amount</th>
            <th className="py-2">
              {/* The column needs a name, the page no visible one */}
              <VisuallyHidden>Actions</VisuallyHidden>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-2">2026-0141</td>
            <td className="py-2">
              1,240
              {/* Read as "1,240 euros", seen as "1,240 €" */}
              <span aria-hidden="true"> €</span>
              <VisuallyHidden> euros</VisuallyHidden>
            </td>
            <td className="py-2 text-right">
              <IconButton variant="danger">
                <Trash2 size={16} />
                <VisuallyHidden>Delete invoice 2026-0141</VisuallyHidden>
              </IconButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
