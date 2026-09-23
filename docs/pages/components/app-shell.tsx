import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const layout = `import { AppShell, Drawer, Navbar } from "components-ui";

export function Layout({ user, children }) {
  return (
    <AppShell
      drawer={<Drawer header={<Logo />} items={menuItems} />}
      navbar={
        <Navbar
          user={{
            name: user.name,
            description: user.role,
            menuItems: [{ label: "Log out", onClick: logout }],
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
            containing it and remembers the collapsed state. Collapsed to icons,
            a group shows its items in a popover - on hover, or with Enter from
            the keyboard. Try the toggle in the navbar and the user menu. (These
            docs use the same components.)
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
            <code>--drawer-collapsed-width</code> (64px).
          </p>
        </Prose>
      </Section>

      <Example
        description={
          <p>
            <code>isLoading</code> shows placeholder items - e.g. while the
            permissions deciding the menu are loading. Groups without children
            are hidden, so a filtered menu needs no extra checks.
          </p>
        }
        name="app-shell/loading"
        title="Loading the menu"
      />

      <Section title="Overlay">
        <Prose>
          <p>
            <code>Overlay</code> is the dimmed backdrop behind the drawer on
            phones - a fixed, full-screen element rendered into{" "}
            <code>document.body</code> that you can use for your own overlays.
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
