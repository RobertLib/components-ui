import {
  CreditCard,
  FileText,
  History,
  LayoutGrid,
  List,
  Paperclip,
} from "lucide-react";
import { useState } from "react";
import { Tabs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

export default function IconTabs() {
  const [tab, setTab] = useState("overview");
  const [view, setView] = useState("list");

  return (
    <div className="space-y-4">
      {/* A disabled tab cannot be selected - the arrow keys skip it */}
      <Tabs
        items={[
          {
            icon: <FileText size={16} />,
            label: "Overview",
            value: "overview",
          },
          {
            icon: <CreditCard size={16} />,
            label: "Payments",
            value: "payments",
          },
          { icon: <History size={16} />, label: "History", value: "history" },
          {
            disabled: true,
            icon: <Paperclip size={16} />,
            label: "Attachments",
            value: "attachments",
          },
        ]}
        onChange={setTab}
        value={tab}
      />

      {/* Icons alone - the names stay for screen readers */}
      <Tabs
        aria-label="View"
        items={[
          {
            icon: <List size={16} />,
            label: <span className="sr-only">List</span>,
            value: "list",
          },
          {
            icon: <LayoutGrid size={16} />,
            label: <span className="sr-only">Grid</span>,
            value: "grid",
          },
        ]}
        onChange={setView}
        size="sm"
        value={view}
      />

      {/* A disabled link tab has no href - nothing opens it */}
      <DemoRouter initialPath="/invoices/42/overview">
        <Tabs
          items={[
            { href: "/invoices/42/overview", label: "Overview" },
            { href: "/invoices/42/payments", label: "Payments" },
            {
              disabled: true,
              href: "/invoices/42/attachments",
              label: "Attachments",
            },
          ]}
        />
      </DemoRouter>
    </div>
  );
}
