import { Breadcrumbs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

export default function Basic() {
  return (
    <DemoRouter initialPath="/customers/42/orders/1042">
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { href: "/customers", label: "Customers" },
            { href: "/customers/42", label: "Jana Nováková" },
            { label: "Order 1042" },
          ]}
        />
        {/* A label that is still loading shows "…" */}
        <Breadcrumbs
          items={[{ href: "/projects", label: "Projects" }, { label: null }]}
        />
        <Breadcrumbs
          home={{ href: "/dashboard", label: "Dashboard" }}
          items={[{ label: "Reports" }]}
        />
        <Breadcrumbs
          home={false}
          items={[{ href: "/settings", label: "Settings" }, { label: "Users" }]}
        />
      </div>
    </DemoRouter>
  );
}
