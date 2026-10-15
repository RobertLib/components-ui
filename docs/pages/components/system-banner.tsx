import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const usage = `<AppShell
  banner={
    <>
      {isTestEnvironment && (
        <SystemBanner variant="warning">TEST environment</SystemBanner>
      )}
      {/* Nothing without a message - place it unconditionally */}
      <SystemBanner
        dismissible
        storageKey={\`outage-\${outage?.id}\`}
        title={outage?.title}
        variant="warning"
      >
        {outage?.message}
      </SystemBanner>
    </>
  }
  drawer={<Drawer items={items} />}
  navbar={<Navbar user={user} />}
>
  {children}
</AppShell>`;

export default function SystemBannerPage() {
  return (
    <DocPage
      description="A message across the whole app - a planned outage, a test environment, the user the app is used as - above the navbar."
      imports={["SystemBanner"]}
      title="SystemBanner"
    >
      <Example
        description={
          <p>
            A filled strip with an icon and the message - <code>info</code>{" "}
            (default), <code>warning</code>, <code>danger</code> or{" "}
            <code>neutral</code>. <code>title</code> starts the message in bold;{" "}
            <code>action</code> adds a link (<code>href</code>, through the
            router of <code>UIProvider</code>) or a button (<code>onClick</code>
            ) after it. <code>icon</code> replaces the icon of the variant,{" "}
            <code>false</code> leaves it out. <code>danger</code> and{" "}
            <code>warning</code> are alerts (<code>role="alert"</code>), which
            screen readers announce at once; <code>info</code> and{" "}
            <code>neutral</code> are a status, read at a pause. Without a
            message the banner renders nothing, so it can be placed
            unconditionally.
          </p>
        }
        name="system-banner/variants"
        title="Variants"
      />
      <Example
        description={
          <p>
            <code>dismissible</code> adds a close button, which hides the banner
            and calls <code>onDismiss</code>; the focus moves on to the next
            control of the page. Without a <code>storageKey</code> the banner
            shows again on the next load of the app. With one it is remembered
            closed in <code>localStorage</code> - also in the other tabs of the
            app. Give every message a key of its own (
            <code>outage-2026-11-08</code>): a new message under a new key shows
            again. A page rendered on the server shows the banner until it
            hydrates, then hides a closed one.
          </p>
        }
        name="system-banner/dismissible"
        title="Dismissible"
      />
      <Example
        description={
          <p>
            The <code>banner</code> of{" "}
            <Link to="/components/app-shell">AppShell</Link> puts the banners
            above the navbar, one under another, beside the drawer as wide as
            the page. They scroll away with the page, the navbar stays.
          </p>
        }
        name="system-banner/app-shell"
        title="In the app layout"
      />

      <Section title="Usage">
        <CodeBlock code={usage} />
        <Prose>
          <p>
            Keep the banners few and short - each one pushes the app down. For
            the outcome of an action use a{" "}
            <Link to="/components/toast">toast</Link>, for a message about one
            page an <Link to="/components/alert">Alert</Link> in it. Banners are
            left out when the page is printed. <code>ref</code> and the other
            props go to the banner, which has <code>data-variant</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="SystemBanner" />
        <PropsTable of="SystemBannerAction" />
      </Section>
    </DocPage>
  );
}
