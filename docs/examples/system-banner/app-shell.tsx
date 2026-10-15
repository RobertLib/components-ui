import { FlaskConical } from "lucide-react";
import {
  AppShell,
  Drawer,
  Header,
  Navbar,
  SystemBanner,
  type DrawerMenuEntry,
} from "components-ui";
import DemoRouter from "../../lib/demo-router";

const items: DrawerMenuEntry[] = [
  { href: "/orders", label: "Orders" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
];

export default function BannersInAppShell() {
  return (
    <DemoRouter initialPath="/orders">
      {/* In an app AppShell fills the page; the transform keeps its fixed
          drawer inside this frame */}
      <div className="relative h-80 transform-gpu overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <AppShell
          banner={
            <>
              <SystemBanner icon={<FlaskConical size={16} />} variant="warning">
                TEST environment - data is reset every night.
              </SystemBanner>
              <SystemBanner
                dismissible
                storageKey="demo-banner-release-4-2"
                variant="info"
              >
                Version 4.2 is out - invoices can be split into instalments.
              </SystemBanner>
            </>
          }
          className="h-full bg-background p-6 dark:bg-background-dark"
          drawer={<Drawer header={<strong>Acme</strong>} items={items} />}
          drawerStorageKey="demo-banner-drawer-collapsed"
          navbar={
            <Navbar
              user={{ description: "Accountant", name: "Jana Nováková" }}
            />
          }
        >
          <Header description="1 284 orders this year" title="Orders" />
        </AppShell>
      </div>
    </DemoRouter>
  );
}
