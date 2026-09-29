import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const setup = `import { SnackbarProvider } from "components-ui";

<SnackbarProvider>
  <App />
</SnackbarProvider>`;

const promiseUsage = `const { promise } = useSnackbar();

// The toast follows the promise - and the promise is returned as it is
const invoice = await promise(saveInvoice(values), {
  loading: "Saving the invoice…",
  success: (invoice) => \`Invoice \${invoice.number} was saved\`,
  error: (error) => getBaseError(error) ?? "The invoice could not be saved",
});`;

export default function ToastPage() {
  return (
    <DocPage
      description="Short notifications at an edge of the screen. Queue them from anywhere with useSnackbar()."
      imports={["SnackbarProvider", "useSnackbar", "Toast"]}
      title="Toast & Snackbar"
    >
      <Section title="Setup">
        <Prose>
          <p>
            Render <code>SnackbarProvider</code> once, near the root. It shows
            the queued toasts above everything else - at most{" "}
            <code>maxToasts</code> (3) at once: further ones wait and show in
            their order as the shown ones go, so a burst of messages does not
            cover the page. They are rendered into the body, or the{" "}
            <code>portalContainer</code> of a <code>UIProvider</code> around it.
          </p>
          <p>
            A toast has <code>data-state=&quot;open&quot;</code> (
            <code>&quot;closed&quot;</code> while it slides out) and its{" "}
            <code>data-variant</code>; <code>ref</code> and the other props of a{" "}
            <code>Toast</code> go to it. The variants differ in their colors,
            which forced colors (Windows High Contrast) replace - there an icon
            tells them apart.
          </p>
        </Prose>
        <CodeBlock code={setup} />
      </Section>

      <Example
        description={
          <p>
            <code>position</code> of <code>SnackbarProvider</code> puts the
            toasts at the top or the bottom of the screen, at its{" "}
            <code>start</code>, <code>center</code> (the default is{" "}
            <code>top-center</code>) or <code>end</code> - the start is the
            right side in a right-to-left page. They slide in from that edge and
            back out to it; on phones they are centered there and get the whole
            width of the screen.
          </p>
        }
        name="toast/position"
        title="Position"
      />

      <Example
        description={
          <p>
            <code>enqueueSnackbar(message, variant, options)</code> - a toast
            hides itself after <code>duration</code> (3 s) unless{" "}
            <code>persist</code> is set - the time does not run while it is
            hovered or focused, nor while the page is hidden behind another tab.
            The same message with the same variant is not stacked twice while
            visible. <code>danger</code> is the variant of an error (
            <code>error</code>, its older name, still works). Screen readers
            announce the toasts, errors right away - also one enqueued while a
            server-rendered page hydrates, which shows a moment after the live
            regions are in the page. Escape or the close button dismisses the
            focused toast, and the focus goes back to where it was before; on a
            touch screen a toast is swiped away sideways.
          </p>
        }
        name="toast/snackbar"
        title="Queueing toasts"
      />
      <Example
        description={
          <p>
            <code>action</code> adds a button to the toast - pressing it runs{" "}
            <code>onClick</code> and closes the toast. Such a toast stays 6 s by
            default and is shown for every call, also when the same message is
            on screen: each action belongs to its own toast. Tab reaches the
            button - from a Dialog or a Sheet too. Keep the action a shortcut:
            the toast goes away by itself, so what it does should be possible
            elsewhere as well.
          </p>
        }
        name="toast/action"
        title="An action - undo"
      />
      <Example
        description={
          <p>
            <code>enqueueSnackbar</code> returns the id of the toast - the one
            already shown when the message is deduplicated.{" "}
            <code>closeSnackbar(id)</code> closes that toast, without an id
            every toast; it slides out as when its time is up.{" "}
            <code>title</code> is a heading above the message.
          </p>
        }
        name="toast/close"
        title="Closing a toast, with a title"
      />
      <Example
        description={
          <p>
            <code>updateSnackbar(id, update)</code> changes a toast in place: a
            new message, or the fields to change -{" "}
            <code>{"{ message, variant, loading, title, action, … }"}</code>.
            Screen readers announce the new text and its <code>duration</code>{" "}
            starts over. <code>loading</code> shows a spinner and keeps the
            toast on screen until it is updated with <code>loading: false</code>
            . A message is a text or any React node, e.g. with a link; a node is
            deduplicated only when the very same element is enqueued again - JSX
            written in the call is new each time.
          </p>
        }
        name="toast/update"
        title="Updating a toast, a message with a link"
      />

      <Section title="A toast for a promise">
        <Prose>
          <p>
            <code>promise(promise, messages, options)</code> shows one toast for
            a request: <code>messages.loading</code> with a spinner while it
            runs, then <code>success</code> or <code>error</code> in its place -
            a text, or a function of the value or the error. Leave one out to
            close the toast instead, e.g. when a form shows the error.{" "}
            <code>duration</code> counts from when the promise settles; the
            toast is announced as it changes (politely, also when it turns into
            an error). It returns the promise, so the caller still gets its
            value or error.
          </p>
        </Prose>
        <CodeBlock code={promiseUsage} />
        <Example name="toast/promise" title="Exporting a report" />
      </Section>

      <Example
        description={
          <p>
            <code>Toast</code> can also be rendered on its own, wherever you
            need it. It is a live region of its own then, and shows its text a
            moment (0.1 s) after it is in the page, so screen readers announce
            it. It renders nothing once it has hidden itself or was dismissed -{" "}
            <code>onClose</code> tells the parent; <code>open={"{false}"}</code>{" "}
            slides it out.
          </p>
        }
        name="toast/standalone"
        title="A standalone toast"
      />

      <Section title="Props">
        <PropsTable of="SnackbarProvider" />
        <PropsTable of="SnackbarApi" title="useSnackbar()" />
        <PropsTable of="SnackbarOptions" title="enqueueSnackbar options" />
        <PropsTable of="SnackbarUpdate" title="updateSnackbar(id, update)" />
        <PropsTable
          of="SnackbarPromiseMessages"
          title="promise(promise, messages)"
        />
        <PropsTable of="ToastAction" />
        <PropsTable of="Toast" />
      </Section>
    </DocPage>
  );
}
