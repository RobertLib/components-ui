import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const layout = `import { AppShell, Drawer, Navbar, type DrawerItem } from "components-ui";

const menuItems: DrawerItem[] = [
  { href: "/orders", label: "Orders" },
  { href: "/customers", label: "Customers" },
];

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  user: { name: string; role: string };
}

export function Layout({ children, onLogout, user }: LayoutProps) {
  return (
    <AppShell
      drawer={<Drawer header={<strong>Acme</strong>} items={menuItems} />}
      navbar={
        <Navbar
          user={{
            name: user.name,
            description: user.role,
            menuItems: [{ label: "Log out", onClick: onLogout }],
          }}
        />
      }
    >
      {children}
    </AppShell>
  );
}`;

const custom = `// The pieces on their own - the navbar and main must follow the drawer as siblings
<DrawerProvider>
  <Drawer items={items} />
  <Navbar />
  <main>{children}</main>
</DrawerProvider>`;

export default function AppShellPage() {
  return (
    <DocPage
      description="The frame of an app: a side navigation that collapses to icons on desktop and slides in on phones, a top bar and the page content."
      imports={["AppShell", "Drawer", "Navbar"]}
      title="AppShell, Drawer & Navbar"
    >
      <Example
        description={
          <p>
            The drawer marks the item of the current path, expands the group
            containing it - also when you navigate into it - and remembers the
            collapsed state. Of items that link to the same path with different
            queries (<code>/tasks?filter=mine</code>,{" "}
            <code>/tasks?filter=all</code>) it marks the one whose query the
            page has. Collapsed to icons, a group shows its items in a popover
            on hover or keyboard focus, and Enter moves the focus into it; an
            item without an icon shows the first letter of its label. On phones
            the drawer slides in as a modal dialog. Try the toggle in the navbar
            and the user menu. (These docs use the same components.)
          </p>
        }
        name="app-shell/demo"
        title="An app layout"
      />

      <Section title="Usage">
        <CodeBlock code={layout} />
        <Prose>
          <p>
            <code>AppShell</code> provides the drawer state itself. To place the
            parts yourself, keep the navbar and <code>&lt;main&gt;</code> as
            siblings after the drawer - the layout CSS moves them aside as the
            drawer opens and collapses:
          </p>
        </Prose>
        <CodeBlock code={custom} />
        <Prose>
          <p>
            <code>useDrawer()</code> reads and toggles the state from anywhere
            inside. The widths come from the CSS variables{" "}
            <code>--drawer-width</code> (240px) and{" "}
            <code>--drawer-collapsed-width</code> (64px). Rendered on the
            server, the drawer stays out of sight on phones until the page has
            hydrated, and the remembered collapsed state is applied right after.
          </p>
          <p>
            For screen readers the drawer is the navigation landmark of the app,
            named "Main navigation" (pass <code>aria-label</code> for another
            name), and the navbar is inside the <code>&lt;header&gt;</code> of
            the page - the banner landmark - not a navigation of its own.
          </p>
        </Prose>
      </Section>

      <Example
        description={
          <p>
            <code>isLoading</code> shows placeholder items - e.g. while the
            permissions deciding the menu are loading. Groups without children
            are hidden, so a filtered menu needs no extra checks. An expanded
            group stays expanded when entries before it come and go - the items
            are told apart by their <code>href</code> or <code>label</code>, or
            by an <code>id</code> where a label changes (with the language).
          </p>
        }
        name="app-shell/loading"
        title="Loading the menu"
      />

      <Section title="Overlay">
        <Prose>
          <p>
            <code>Overlay</code> is the dimmed backdrop behind the drawer on
            phones. The drawer renders it right before itself, so a parent with
            a <code>transform</code> - like the frames of these examples - keeps
            both together. Use it for overlays of your own, see{" "}
            <Link to="/components/dialog">Dialog</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="AppShell" />
        <PropsTable of="Drawer" />
        <PropsTable of="DrawerItem" />
        <PropsTable of="Navbar" />
        <PropsTable of="NavbarUser" />
        <PropsTable of="DrawerState" title="useDrawer()" />
      </Section>
    </DocPage>
  );
}
