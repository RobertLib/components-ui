import {
  BarChart3,
  FileText,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
} from "lucide-react";
import {
  AppShell,
  Drawer,
  Header,
  Navbar,
  Progress,
  useRouter,
  useSnackbar,
  type DrawerMenuEntry,
} from "components-ui";
import DemoRouter from "../../lib/demo-router";

function Page() {
  const { pathname } = useRouter();
  const title = pathname.split("/").filter(Boolean).pop() ?? "dashboard";

  return (
    <div className="p-6">
      <Header title={title.charAt(0).toUpperCase() + title.slice(1)} />
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Content of <code>{pathname}</code>. Collapse the drawer with the button
        in the navbar - the content makes room for it.
      </p>
    </div>
  );
}

export default function Demo() {
  const { enqueueSnackbar } = useSnackbar();

  const items: DrawerMenuEntry[] = [
    {
      href: "/dashboard",
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
    },
    { badge: 3, href: "/inbox", icon: <Inbox size={18} />, label: "Inbox" },
    { href: "/customers", icon: <Users size={18} />, label: "Customers" },
    {
      items: [
        {
          children: [
            { href: "/documents/invoices", label: "Invoices" },
            { href: "/documents/contracts", label: "Contracts" },
          ],
          icon: <FileText size={18} />,
          label: "Documents",
        },
        {
          badge: "New",
          href: "/reports",
          icon: <BarChart3 size={18} />,
          label: "Reports",
        },
      ],
      label: "Workspace",
      type: "section",
    },
    { type: "separator" },
    { href: "/settings", icon: <Settings size={18} />, label: "Settings" },
    {
      icon: <LifeBuoy size={18} />,
      label: "Help",
      onClick: () => enqueueSnackbar("Help opened"),
    },
  ];

  return (
    <DemoRouter initialPath="/dashboard">
      {/* In an app AppShell fills the page; the transform keeps its fixed
          drawer - and the backdrop behind it on phones - inside this frame */}
      <div className="relative h-140 transform-gpu overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <AppShell
          className="h-full bg-background dark:bg-background-dark"
          drawer={
            <Drawer
              footer={
                <Progress label="Storage" size="sm" showPercentage value={72} />
              }
              // A function renders while collapsed too - the logo mark
              header={({ isCollapsed }) =>
                isCollapsed ? (
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 font-bold text-white">
                    A
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-lg font-bold">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                      A
                    </span>
                    Acme
                  </span>
                )
              }
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
