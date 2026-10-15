import {
  Banknote,
  BellRing,
  FileText,
  History,
  ListOrdered,
  MessageSquare,
  Paperclip,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Tabs } from "components-ui";
import DemoRouter from "../../lib/demo-router";

const sections = [
  { icon: <FileText size={16} />, label: "Overview", value: "overview" },
  { icon: <ListOrdered size={16} />, label: "Items", value: "items" },
  { icon: <Banknote size={16} />, label: "Payments", value: "payments" },
  { icon: <Truck size={16} />, label: "Deliveries", value: "deliveries" },
  { icon: <BellRing size={16} />, label: "Reminders", value: "reminders" },
  { icon: <MessageSquare size={16} />, label: "Notes", value: "notes" },
  { icon: <Paperclip size={16} />, label: "Attachments", value: "attachments" },
  { icon: <History size={16} />, label: "History", value: "history" },
];

// Drag the corner of the frame - the tabs move into the "More" menu and back
export default function OverflowMenuTabs() {
  const [section, setSection] = useState("payments");

  return (
    <div className="space-y-6">
      <div className="w-120 max-w-full min-w-40 resize-x overflow-hidden rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
        <Tabs
          aria-label="Invoice 2026-0042"
          items={sections.map((item) => ({
            ...item,
            content: (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {item.label} of invoice 2026-0042.
              </p>
            ),
            // A disabled tab is disabled in the menu too
            disabled: item.value === "deliveries",
          }))}
          onChange={setSection}
          overflow="menu"
          value={section}
        />
      </div>

      {/* Link tabs - the menu has links, the current page stays in the bar */}
      <DemoRouter initialPath="/customers/118/contracts">
        <div className="w-96 max-w-full min-w-40 resize-x overflow-hidden rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
          <Tabs
            items={[
              { href: "/customers/118/overview", label: "Overview" },
              { href: "/customers/118/orders", label: "Orders" },
              { href: "/customers/118/invoices", label: "Invoices" },
              { href: "/customers/118/contracts", label: "Contracts" },
              { href: "/customers/118/contacts", label: "Contacts" },
              { href: "/customers/118/activity", label: "Activity" },
            ]}
            overflow="menu"
            size="sm"
          />
        </div>
      </DemoRouter>
    </div>
  );
}
