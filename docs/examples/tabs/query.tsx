import { Tabs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

// With includeQueryParams, tabs of one page differ by a query parameter.
// The first tab is active while the parameter is not in the URL.
export default function QueryTabs() {
  return (
    <DemoRouter initialPath="/orders">
      <Tabs
        includeQueryParams
        items={[
          { href: "/orders?status=open", label: "Open" },
          { href: "/orders?status=shipped", label: "Shipped" },
          { href: "/orders?status=cancelled", label: "Cancelled" },
        ]}
        size="sm"
      />
    </DemoRouter>
  );
}
