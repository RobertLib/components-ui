import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const root = `<ErrorBoundary onError={(error) => Sentry.captureException(error)}>
  <App />
</ErrorBoundary>`;

export default function ErrorBoundaryPage() {
  return (
    <DocPage imports={["ErrorBoundary"]} title="ErrorBoundary">
      <Example
        description={
          <p>
            <code>fallback</code> is an element, or a function of the error and
            a <code>reset</code> that renders the children again. Without it a
            localized "Something went wrong" with a retry button is shown.
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

      <Section title="Props">
        <PropsTable of="ErrorBoundary" />
      </Section>
    </DocPage>
  );
}
