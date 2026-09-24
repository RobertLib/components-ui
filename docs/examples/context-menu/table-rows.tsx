import { useState } from "react";
import { cn, ContextMenu, useLocale, useSnackbar } from "components-ui";

const orders = [
  { customer: "Acme s.r.o.", id: "2026-104", paid: true, total: 12400 },
  { customer: "Novák & syn", id: "2026-105", paid: false, total: 3890 },
  { customer: "Bistro U Mostu", id: "2026-106", paid: false, total: 780 },
];

export default function TableRows() {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const { code } = useLocale();
  const money = new Intl.NumberFormat(code, {
    currency: "CZK",
    style: "currency",
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-md text-left text-sm">
        <thead className="text-xs text-neutral-500 uppercase dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-semibold">Order</th>
            <th className="px-3 py-2 font-semibold">Customer</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <ContextMenu
              aria-label={`Order ${order.id}`}
              items={[
                {
                  label: "Open",
                  onClick: () => enqueueSnackbar(`Opening ${order.id}`),
                },
                {
                  description: order.paid ? "The order is paid" : undefined,
                  disabled: order.paid,
                  label: "Send a reminder",
                  onClick: () => enqueueSnackbar("Reminder sent", "success"),
                },
                { type: "separator" },
                {
                  danger: true,
                  label: "Cancel the order",
                  onClick: () =>
                    enqueueSnackbar(`${order.id} cancelled`, "error"),
                },
              ]}
              key={order.id}
              // The row stays marked while its menu is open
              onOpenChange={(open) => setMenuFor(open ? order.id : null)}
            >
              {/* The row itself takes the handlers - nothing comes between
                  the table and its rows */}
              <tr
                className={cn(
                  "border-t border-neutral-200 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-300 focus-visible:outline-solid dark:border-neutral-800",
                  menuFor === order.id &&
                    "bg-primary-50 dark:bg-primary-950/50",
                )}
                tabIndex={0}
              >
                <td className="px-3 py-2 font-medium">{order.id}</td>
                <td className="px-3 py-2">{order.customer}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money.format(order.total)}
                </td>
              </tr>
            </ContextMenu>
          ))}
        </tbody>
      </table>
    </div>
  );
}
