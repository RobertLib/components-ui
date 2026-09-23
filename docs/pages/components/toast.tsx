import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const setup = `import { SnackbarProvider } from "components-ui";

<SnackbarProvider>
  <App />
</SnackbarProvider>`;

export default function ToastPage() {
  return (
    <DocPage
      description="Short notifications at the top of the screen. Queue them from anywhere with useSnackbar()."
      imports={["SnackbarProvider", "useSnackbar", "Toast"]}
      title="Toast & Snackbar"
    >
      <Section title="Setup">
        <Prose>
          <p>
            Render <code>SnackbarProvider</code> once, near the root. It shows
            the queued toasts above everything else.
          </p>
        </Prose>
        <CodeBlock code={setup} />
      </Section>

      <Example
        description={
          <p>
            <code>enqueueSnackbar(message, variant, options)</code> - a toast
            hides itself after <code>duration</code> (3 s) unless{" "}
            <code>persist</code> is set - the time does not run while it is
            hovered or focused. The same message with the same variant is not
            stacked twice while visible. Screen readers announce the toasts,
            errors right away.
          </p>
        }
        name="toast/snackbar"
        title="Queueing toasts"
      />
      <Example
        description={
          <p>
            <code>Toast</code> can also be rendered on its own, wherever you
            need it.
          </p>
        }
        name="toast/standalone"
        title="A standalone toast"
      />

      <Section title="Props">
        <PropsTable of="SnackbarOptions" title="enqueueSnackbar options" />
        <PropsTable of="Toast" />
      </Section>
    </DocPage>
  );
}
