import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";

const root = `// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css"; // @import "tailwindcss"; @import "components-ui/styles.css";
import App from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);`;

const app = `// app.tsx
import { Route, Routes } from "react-router";
import { cs, ErrorBoundary, SnackbarProvider, UIProvider } from "components-ui";
import useReactRouterAdapter from "./use-react-router-adapter"; // see Routing

export default function App() {
  const router = useReactRouterAdapter();

  return (
    <UIProvider locale={cs} router={router}>
      <ErrorBoundary>
        <SnackbarProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="customers/*" element={<Customers />} />
            </Route>
          </Routes>
        </SnackbarProvider>
      </ErrorBoundary>
    </UIProvider>
  );
}`;

const layout = `// layout.tsx
import { FileText, LayoutDashboard, Users } from "lucide-react";
import { Outlet } from "react-router";
import { AppShell, Drawer, Navbar, type DrawerEntry } from "components-ui";

export function Layout() {
  const { user, isLoading, logout } = useSession(); // your auth
  const can = usePermissions(user);

  // Falsy entries are skipped and a group left without children is hidden
  const items: DrawerEntry[] = [
    { href: "/", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    can.viewCustomers && {
      href: "/customers",
      icon: <Users size={18} />,
      label: "Customers",
    },
    {
      icon: <FileText size={18} />,
      label: "Documents",
      children: [
        can.viewInvoices && { href: "/invoices", label: "Invoices" },
        can.viewContracts && { href: "/contracts", label: "Contracts" },
      ],
    },
  ];

  return (
    <AppShell
      drawer={<Drawer header={<Logo />} isLoading={isLoading} items={items} />}
      navbar={
        <Navbar
          loading={isLoading}
          user={
            user && {
              name: user.name,
              description: user.role,
              menuItems: [{ label: "Log out", onClick: logout }],
            }
          }
        />
      }
    >
      <div className="p-6">
        <Outlet />
      </div>
    </AppShell>
  );
}`;

const page = `// A page inside the layout
import { Breadcrumbs, Button, DataTable, Header } from "components-ui";

export function CustomersPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Customers" }]} />
      <Header
        actions={<Button link="/customers/new">New customer</Button>}
        title="Customers"
      />
      <DataTable columns={columns} data={rows} /* … */ />
    </div>
  );
}`;

export default function AppLayoutGuide() {
  return (
    <DocPage
      description="How the pieces fit together in an app: the providers at the root, a layout route with the drawer and the navbar, and pages inside it."
      title="App layout"
    >
      <Section title="The root">
        <Prose>
          <p>
            <code>UIProvider</code> sets the language and connects the router,{" "}
            <code>SnackbarProvider</code> shows toasts and{" "}
            <code>ErrorBoundary</code> keeps a crash from blanking the screen.
          </p>
        </Prose>
        <CodeBlock code={root} />
        <CodeBlock className="mt-4" code={app} />
      </Section>

      <Section title="The layout route">
        <Prose>
          <p>
            <code>AppShell</code> places the <code>Drawer</code>, the{" "}
            <code>Navbar</code> and the page content, and holds the drawer
            state. The menu is plain data: entries the user may not see are
            written as <code>{"can.x && { … }"}</code>, and groups left without
            children disappear. Permissions that arrive later change the menu in
            place - an expanded group stays expanded, as the items are told
            apart by their <code>href</code> or <code>label</code> (or an{" "}
            <code>id</code>). See the live demo on the{" "}
            <Link to="/components/app-shell">AppShell page</Link>.
          </p>
        </Prose>
        <CodeBlock code={layout} />
      </Section>

      <Section title="Pages">
        <CodeBlock code={page} />
        <Prose>
          <p>
            Authentication, permissions and data loading stay in your app - the
            library only renders what you give it.
          </p>
        </Prose>
      </Section>
    </DocPage>
  );
}
