import { Tabs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

// The tabs are links; the active one follows the current path. The
// DemoRouter stands in for your app's router (React Router, Next.js, …).
export default function LinkTabs() {
  return (
    <DemoRouter initialPath="/customers/42/overview">
      <Tabs
        items={[
          { href: "/customers/42/overview", label: "Overview" },
          { href: "/customers/42/orders", label: "Orders" },
          { href: "/customers/42/documents", label: "Documents" },
        ]}
      />
    </DemoRouter>
  );
}
