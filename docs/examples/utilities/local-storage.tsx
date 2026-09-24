import { Button, Tabs, useLocalStorage } from "components-ui";

type OrdersView = "table" | "cards" | "calendar";

export default function LocalStorage() {
  const [view, setView, resetView] = useLocalStorage<OrdersView>(
    "orders-view",
    "table",
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          aria-label="View of the orders"
          items={[
            { label: "Table", value: "table" },
            { label: "Cards", value: "cards" },
            { label: "Calendar", value: "calendar" },
          ]}
          onChange={(value) => setView(value as OrdersView)}
          value={view}
        />
        <Button onClick={resetView} size="sm" variant="ghost">
          Reset
        </Button>
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        The orders show as <b>{view}</b>. Reload the page, or open it in another
        tab and switch there - the choice follows.
      </p>
    </div>
  );
}
