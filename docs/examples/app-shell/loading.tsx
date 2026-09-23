import { useState } from "react";
import { Button, Drawer, DrawerProvider } from "components-ui";
import DemoRouter from "../../lib/demo-router";

// While the menu depends on data that is still loading (permissions, …)
export default function Loading() {
  const [loading, setLoading] = useState(true);

  return (
    <DemoRouter initialPath="/orders">
      <Button
        className="mb-3"
        onClick={() => setLoading(!loading)}
        size="sm"
        variant="outline"
      >
        {loading ? "Finish loading" : "Load again"}
      </Button>
      <div className="relative h-64 transform-gpu overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <DrawerProvider storageKey={null}>
          <Drawer
            isLoading={loading}
            items={[
              { href: "/orders", label: "Orders" },
              { href: "/products", label: "Products" },
              { href: "/reports", label: "Reports" },
            ]}
          />
        </DrawerProvider>
      </div>
    </DemoRouter>
  );
}
