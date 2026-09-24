import { Tabs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

// With includeQueryParams, tabs of one page differ by a query parameter.
// The tab matching the most parameters wins - "All" is active only while
// the URL has no status.
export default function QueryTabs() {
  return (
    <DemoRouter initialPath="/orders">
      <Tabs
        includeQueryParams
        items={[
          { href: "/orders", label: "All" },
          { href: "/orders?status=open", label: "Open" },
          { href: "/orders?status=shipped", label: "Shipped" },
          { href: "/orders?status=cancelled", label: "Cancelled" },
        ]}
        size="sm"
      />
    </DemoRouter>
  );
}
