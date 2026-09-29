import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const layout = `import { AppShell, Drawer, Navbar, type DrawerMenuEntry } from "components-ui";

const menuItems: DrawerMenuEntry[] = [
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

const entries = `const items: DrawerMenuEntry[] = [
  { href: "/inbox", icon: <Inbox size={18} />, label: "Inbox", badge: unread || undefined },
  {
    type: "section",
    label: "Administration",
    // Hidden with all its items when the user may see none of them
    items: [
      canManageUsers && { href: "/admin/users", label: "Users" },
      canManageRoles && { href: "/admin/roles", label: "Roles" },
    ],
  },
  { type: "separator" },
  // No href - a button that only calls onClick
  { icon: <Search size={18} />, label: "Search", onClick: openSearch },
];`;

const slots = `<Drawer
  items={items}
  // A function renders while the drawer is collapsed too
  header={({ isCollapsed }) => (isCollapsed ? <LogoMark /> : <Logo />)}
  // A plain node is hidden while collapsed
  footer={<StorageUsage />}
/>`;

const custom = `// The pieces on their own - the navbar and main must follow the drawer as siblings
<DrawerProvider shortcut="mod+b">
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
            page has; a closed group with the current page is marked in its
            place. Items can have a badge, sit in sections under a heading and
            be separated by lines, and a footer stays below the scrolling menu.
            Collapsed to icons, an item shows its name in a tooltip and a group
            its items in a popover beside the drawer, on hover or keyboard focus
            - Enter moves the focus into it; an item without an icon shows the
            first letter of its label, a badge is a dot. On phones the drawer
            slides in as a modal dialog. Try the toggle in the navbar and the
            user menu. (These docs use the same components - their drawer
            collapses with ⌘B / Ctrl+B.)
          </p>
        }
        name="app-shell/demo"
        title="An app layout"
      />

      <Section title="Usage">
        <CodeBlock code={layout} />
        <Prose>
          <p>
            Besides items and their groups, the menu takes{" "}
            <code>{`{ type: "section" }`}</code> items under a heading - the
            heading names their list for screen readers, and becomes a line
            while the drawer is collapsed - and{" "}
            <code>{`{ type: "separator" }`}</code> lines, of which none is shown
            at an end or twice in a row. A <code>badge</code> is read after the
            label ("Inbox 12"). An item with <code>onClick</code> and no{" "}
            <code>href</code> is a button, e.g. to open a search or a dialog -
            on phones the drawer slides out first, and the dialog gives the
            focus back to the toggle of the navbar.
          </p>
        </Prose>
        <CodeBlock code={entries} />
        <Prose>
          <p>
            <code>header</code> and <code>footer</code> are hidden while the
            drawer is collapsed; given as a function, they render in both
            states:
          </p>
        </Prose>
        <CodeBlock code={slots} />
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
            <code>drawerShortcut</code> of <code>AppShell</code> (
            <code>shortcut</code> of <code>DrawerProvider</code>) toggles the
            drawer with a key, e.g. <code>"mod+b"</code> - not while the user
            types in a field, nor under a modal dialog; the toggle of the navbar
            shows it in its tooltip. <code>useDrawer()</code> reads and toggles
            the state from anywhere inside. The widths come from the CSS
            variables <code>--drawer-width</code> (240px) and{" "}
            <code>--drawer-collapsed-width</code> (64px). Rendered on the
            server, the drawer stays out of sight on phones until the page has
            hydrated, and the remembered collapsed state is applied right after.
            A page opened by its address scrolls the menu - not the page - to
            its item when that is out of sight.
          </p>
          <p>
            For screen readers the drawer is the navigation landmark of the app,
            named "Main navigation" (pass <code>aria-label</code> for another
            name), and the navbar is inside the <code>&lt;header&gt;</code> of
            the page - the banner landmark - not a navigation of its own.
          </p>
          <p>
            The drawer is at the start edge of the page - the right one in a
            right-to-left page (<code>dir=&quot;rtl&quot;</code> on{" "}
            <code>&lt;html&gt;</code>), where it slides in from the right and
            the navbar and <code>&lt;main&gt;</code> make room on that side; the
            panel icons of the toggle are mirrored. <code>ref</code> and the
            other props go to the <code>&lt;nav&gt;</code> of the drawer, the
            bar inside the <code>&lt;header&gt;</code> of the navbar and the{" "}
            <code>&lt;main&gt;</code> of <code>AppShell</code>. For styling, the
            drawer has <code>data-state=&quot;open&quot;</code> or{" "}
            <code>&quot;closed&quot;</code> (slid out on a phone), and so do a
            group of the menu and the toggle of the navbar, like their{" "}
            <code>aria-expanded</code>. The current page keeps the system colors
            of a selection in forced colors (Windows High Contrast).
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
        <PropsTable of="DrawerSection" />
        <PropsTable of="Navbar" />
        <PropsTable of="NavbarUser" />
        <PropsTable of="DrawerState" title="useDrawer()" />
      </Section>
    </DocPage>
  );
}
