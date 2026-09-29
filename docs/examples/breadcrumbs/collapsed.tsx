import { ChevronRight } from "lucide-react";
import { Breadcrumbs } from "components-ui";

const path = [
  { href: "/components/breadcrumbs", label: "Projects" },
  { href: "/components/breadcrumbs", label: "Website redesign" },
  { href: "/components/breadcrumbs", label: "Pages" },
  { href: "/components/breadcrumbs", label: "About us" },
  { label: "Edit" },
];

export default function Collapsed() {
  return (
    <div className="space-y-4">
      {/* Home, "…" and the last two - the "…" shows the whole path */}
      <Breadcrumbs itemsAfterCollapse={2} items={path} maxItems={4} />
      <Breadcrumbs
        home={false}
        items={path}
        separator={<ChevronRight size={14} />}
      />
      <Breadcrumbs home={false} items={path} separator="/" />
    </div>
  );
}
