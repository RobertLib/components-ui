import { useMemo, useRef, useState } from "react";
import {
  Button,
  NumberInput,
  useLocale,
  VirtualList,
  type VirtualListHandle,
} from "components-ui";

interface Order {
  amount: number;
  customer: string;
  id: number;
  note?: string;
  number: string;
}

const customers = [
  "Stavby Novák s.r.o.",
  "Elektro Dvořák a.s.",
  "Pekárna U Mlýna s.r.o.",
  "Autodoprava Horák",
  "Tiskárna Svoboda s.r.o.",
  "Kovo Procházka s.r.o.",
  "Zahradnictví Zelený",
];
const notes = [
  "Deliver to the back gate, the warehouse closes at 3 pm.",
  "Split into two shipments - the second one after the customer confirms the colour of the panels.",
  "Prepaid.",
];

// 10 000 orders - every 7th with a note of one to three lines
const orders: Order[] = Array.from({ length: 10_000 }, (_, index) => ({
  amount: 1_000 + ((index * 7_919) % 90_000),
  customer: customers[index % customers.length],
  id: index + 1,
  note: index % 7 === 3 ? notes[index % notes.length] : undefined,
  number: `OBJ-2026-${String(index + 1).padStart(5, "0")}`,
}));

export default function Basic() {
  const { code } = useLocale();
  const czk = useMemo(
    () => new Intl.NumberFormat(code, { currency: "CZK", style: "currency" }),
    [code],
  );
  const listRef = useRef<VirtualListHandle>(null);
  const [target, setTarget] = useState<number | null>(5_000);

  return (
    <div className="space-y-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (target)
            listRef.current?.scrollToIndex(target - 1, { align: "start" });
        }}
      >
        <NumberInput
          label="Jump to order"
          max={orders.length}
          min={1}
          onChange={setTarget}
          value={target}
        />
        <Button type="submit" variant="outline">
          Go
        </Button>
      </form>
      <VirtualList
        aria-label="Orders"
        className="rounded-lg border border-neutral-200 dark:border-neutral-800"
        estimateSize={64}
        handleRef={listRef}
        height={400}
        itemClassName="border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800"
        items={orders}
        renderItem={(order) => (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{order.number}</span>
              <span className="tabular-nums">{czk.format(order.amount)}</span>
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {order.customer}
            </div>
            {order.note && (
              <p className="mt-1 text-sm text-warning-800 dark:text-warning-300">
                {order.note}
              </p>
            )}
          </>
        )}
      />
    </div>
  );
}
