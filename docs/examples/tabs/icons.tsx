import {
  Activity,
  CreditCard,
  FileText,
  History,
  Info,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { useState } from "react";
import { Tabs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

export default function IconTabs() {
  const [tab, setTab] = useState("overview");
  const [panel, setPanel] = useState("comments");

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
        aria-label="Side panel"
        items={[
          {
            icon: <MessageSquare size={16} />,
            label: <span className="sr-only">Comments</span>,
            value: "comments",
          },
          {
            icon: <Activity size={16} />,
            label: <span className="sr-only">Activity</span>,
            value: "activity",
          },
          {
            icon: <Info size={16} />,
            label: <span className="sr-only">Details</span>,
            value: "details",
          },
        ]}
        onChange={setPanel}
        size="sm"
        value={panel}
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
