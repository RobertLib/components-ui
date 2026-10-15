import { useMemo } from "react";
import { cn, useLocale, useVirtualList } from "components-ui";

const counterparties = [
  "Stavby Novák s.r.o.",
  "ČEZ Prodej, a.s.",
  "Kovo Procházka s.r.o.",
  "Salary",
  "Tiskárna Svoboda s.r.o.",
];

// 5 000 bank transactions - incoming and outgoing
const transactions = Array.from({ length: 5_000 }, (_, index) => ({
  amount: (index % 4 === 3 ? 1 : -1) * (500 + ((index * 3_571) % 40_000)),
  counterparty: counterparties[index % counterparties.length],
  id: index + 1,
}));

// Markup of your own - a <ul> of rows in a scroll container
export default function Hook() {
  const { code } = useLocale();
  const czk = useMemo(
    () => new Intl.NumberFormat(code, { currency: "CZK", style: "currency" }),
    [code],
  );
  const { listRef, listStyle, measureRef, scrollRef, totalSize, virtualItems } =
    useVirtualList({ count: transactions.length, estimateSize: 41 });

  return (
    <div className="space-y-2">
      {/* The scroll container: positioned, with a height - a Tab stop and
          a named region, so that the keyboard scrolls it */}
      <div
        aria-label="Transactions"
        className="relative h-80 overflow-y-auto rounded-lg border border-neutral-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-hidden dark:border-neutral-800"
        ref={scrollRef}
        role="region"
        tabIndex={0}
      >
        {/* The list gets `listStyle` - its padding holds the room of the
            rows left out, so do not pad it otherwise */}
        {/* Safari drops the semantics of a list without bullets */}
        <ul ref={listRef} role="list" style={listStyle}>
          {virtualItems.map(({ index, key, style }) => {
            const transaction = transactions[index];
            return (
              <li
                aria-posinset={index + 1}
                aria-setsize={transactions.length}
                className="flex justify-between gap-4 border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800"
                data-index={index}
                key={key}
                ref={measureRef}
                style={style}
              >
                <span>{transaction.counterparty}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    transaction.amount > 0 &&
                      "text-success-700 dark:text-success-400",
                  )}
                >
                  {czk.format(transaction.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Rendered {virtualItems.length} of {transactions.length} rows,{" "}
        {Math.round(totalSize).toLocaleString(code)} px in all.
      </p>
    </div>
  );
}
