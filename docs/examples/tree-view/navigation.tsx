import { BarChart3, LayoutDashboard, Receipt } from "lucide-react";
import { TreeView, type TreeItem } from "components-ui";
import DemoRouter from "../../lib/demo-router";

const sections: TreeItem<string>[] = [
  {
    href: "/dashboard",
    icon: <LayoutDashboard size={16} />,
    id: "dashboard",
    label: "Dashboard",
  },
  {
    children: [
      { href: "/sales/orders", id: "orders", label: "Orders" },
      { href: "/sales/invoices", id: "invoices", label: "Invoices" },
      { href: "/sales/returns", id: "returns", label: "Returns" },
    ],
    href: "/sales",
    icon: <Receipt size={16} />,
    id: "sales",
    label: "Sales",
  },
  {
    children: [
      { href: "/reports/revenue", id: "revenue", label: "Revenue" },
      { href: "/reports/stock", id: "stock", label: "Stock" },
    ],
    href: "/reports",
    icon: <BarChart3 size={16} />,
    id: "reports",
    label: "Reports",
  },
];

export default function Navigation() {
  return (
    <DemoRouter className="max-w-xs" initialPath="/sales/invoices">
      <nav aria-label="Sections">
        {/* A tree of links selects nothing - the current page is marked */}
        <TreeView aria-label="Sections" items={sections} />
      </nav>
    </DemoRouter>
  );
}
