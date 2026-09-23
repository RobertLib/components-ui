import { BarChart3, FileText, Settings, Users } from "lucide-react";
import {
  AppShell,
  Drawer,
  Header,
  Navbar,
  useRouter,
  useSnackbar,
  type DrawerItem,
} from "components-ui";
import DemoRouter from "../../lib/demo-router";

const items: DrawerItem[] = [
  { href: "/dashboard", icon: <BarChart3 size={18} />, label: "Dashboard" },
  { href: "/customers", icon: <Users size={18} />, label: "Customers" },
  {
    children: [
      { href: "/documents/invoices", label: "Invoices" },
      { href: "/documents/contracts", label: "Contracts" },
    ],
    icon: <FileText size={18} />,
    label: "Documents",
  },
  { href: "/settings", icon: <Settings size={18} />, label: "Settings" },
];

function Page() {
  const { pathname } = useRouter();
  const title = pathname.split("/").filter(Boolean).pop() ?? "dashboard";

  return (
    <div className="p-6">
      <Header title={title.charAt(0).toUpperCase() + title.slice(1)} />
      <p className="mt-2 text-sm text-neutral-500">
        Content of <code>{pathname}</code>. Collapse the drawer with the button
        in the navbar - the content makes room for it.
      </p>
    </div>
  );
}

export default function Demo() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <DemoRouter initialPath="/dashboard">
      {/* In an app AppShell fills the page; the transform keeps its fixed
          drawer inside this frame */}
      <div className="relative h-[420px] transform-gpu overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <AppShell
          className="h-full bg-background dark:bg-background-dark"
          drawer={
            <Drawer
              header={<span className="text-lg font-bold">Acme</span>}
              items={items}
            />
          }
          // Its own key, so the collapsed state is not shared with other drawers
          drawerStorageKey="demo-drawer-collapsed"
          navbar={
            <Navbar
              user={{
                description: "Administrator",
                menuItems: [
                  {
                    label: "Profile",
                    onClick: () => enqueueSnackbar("Profile"),
                  },
                  {
                    label: "Log out",
                    onClick: () => enqueueSnackbar("Logged out"),
                  },
                ],
                name: "Jana Nováková",
              }}
            />
          }
        >
          <Page />
        </AppShell>
      </div>
    </DemoRouter>
  );
}
