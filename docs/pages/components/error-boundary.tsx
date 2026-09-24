import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const root = `<ErrorBoundary onError={(error) => Sentry.captureException(error)}>
  <App />
</ErrorBoundary>`;

const routed = `function Layout() {
  const { pathname } = useLocation();

  return (
    <AppShell /* … */>
      {/* A crashed page is left by a link - the next page renders */}
      <ErrorBoundary resetKeys={[pathname]}>
        <Outlet />
      </ErrorBoundary>
    </AppShell>
  );
}`;

export default function ErrorBoundaryPage() {
  return (
    <DocPage imports={["ErrorBoundary"]} title="ErrorBoundary">
      <Example
        description={
          <p>
            <code>fallback</code> is an element, or a function of the error and
            a <code>reset</code> that renders the children again. Without it a
            localized "Something went wrong" with a retry button is shown. Also
            a thrown value that is no <code>Error</code> (
            <code>throw "text"</code>, <code>throw undefined</code>) is caught
            and passed on as an <code>Error</code>, with the value as its{" "}
            <code>cause</code>.
          </p>
        }
        name="error-boundary/basic"
        title="Catching a crash"
      />

      <Section title="At the root of an app">
        <Prose>
          <p>
            Wrap the app (and optionally each page) so a crash shows a message
            instead of a blank screen, and report the errors:
          </p>
        </Prose>
        <CodeBlock code={root} />
      </Section>

      <Section title="Around routed content">
        <Prose>
          <p>
            A boundary around the pages keeps showing its fallback after a
            navigation - the error stays until something resets it. Pass the
            path as <code>resetKeys</code>: when any of the keys changes, the
            children render again. A <code>key</code> that changes (
            <code>{"<ErrorBoundary key={pathname}>"}</code>) resets it too, but
            it also remounts the page on every navigation - the state of its
            components is lost even without a crash.
          </p>
        </Prose>
        <CodeBlock code={routed} />
      </Section>

      <Section title="Props">
        <PropsTable of="ErrorBoundary" />
      </Section>
    </DocPage>
  );
}
