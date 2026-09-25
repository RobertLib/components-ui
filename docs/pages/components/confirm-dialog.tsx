import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const setup = `import { ConfirmProvider, cs, SnackbarProvider, UIProvider } from "components-ui";

<UIProvider locale={cs}>
  <SnackbarProvider>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </SnackbarProvider>
</UIProvider>`;

const usage = `const confirm = useConfirm();

async function handleDelete() {
  if (
    await confirm({
      title: "Delete the customer?",
      message: "The customer and all their orders will be deleted.",
      confirmLabel: "Delete",
      confirmColor: "danger",
    })
  ) {
    await deleteCustomer(id);
  }
}`;

export default function ConfirmDialogPage() {
  return (
    <DocPage
      imports={["ConfirmDialog", "ConfirmProvider", "useConfirm"]}
      title="ConfirmDialog"
    >
      <Example
        description={
          <p>
            <code>loading</code> shows a spinner on the confirm button and
            disables cancelling while the action runs. The buttons are labelled
            in the active locale unless <code>confirmLabel</code> /{" "}
            <code>cancelLabel</code> are given. Screen readers announce it as an
            alert dialog and read the <code>message</code> along with the title.
          </p>
        }
        name="confirm-dialog/delete"
        title="Confirming a destructive action"
      />
      <Example
        description={
          <p>
            Opened from a <code>Dropdown</code> item: the pick closes the menu
            and opens the dialog in one go. Once the dialog closes, the focus
            goes back to the trigger of the menu.
          </p>
        }
        name="confirm-dialog/from-menu"
        title="From a menu"
      />

      <Section title="Asking with useConfirm">
        <Prose>
          <p>
            <code>useConfirm()</code> returns <code>confirm(options)</code>,
            which shows a <code>ConfirmDialog</code> and resolves{" "}
            <code>true</code> once the user confirms, <code>false</code> when
            they cancel - no <code>open</code> state to keep. The options are
            the props of <code>ConfirmDialog</code>. Render{" "}
            <code>ConfirmProvider</code> once, near the root:
          </p>
        </Prose>
        <CodeBlock code={setup} />
        <CodeBlock code={usage} />
        <Example
          description={
            <p>
              The focus goes back to the button that asked, as with a{" "}
              <code>ConfirmDialog</code> of your own.
            </p>
          }
          name="confirm-dialog/use-confirm"
          title="A question in one line"
        />
        <Example
          description={
            <p>
              <code>onConfirm</code> runs the action before the dialog closes:
              while its promise is pending the confirm button shows a spinner
              and the dialog cannot be cancelled. The dialog closes (and{" "}
              <code>confirm()</code> resolves <code>true</code>) once the
              promise resolves. Returning or resolving <code>false</code> keeps
              it open, and so does a rejection - the user can try again or
              cancel. Tell them about the error yourself, e.g. with a toast; a
              rejection is also logged in development.
            </p>
          }
          name="confirm-dialog/async-confirm"
          title="Running the action in the dialog"
        />
        <Prose>
          <ul>
            <li>
              Questions asked while one is open wait for it and open one by one,
              each resolving its own promise.
            </li>
            <li>
              The dialog opens above whatever is open - a <code>Sheet</code>, a{" "}
              <code>Dialog</code>, a popover - and Escape closes it first. A
              popover it is asked from stays open under it, with what was typed
              in it.
            </li>
            <li>
              When <code>ConfirmProvider</code> unmounts, the open and waiting
              questions resolve <code>false</code>, and so do the ones asked
              later by a callback that outlived it; one whose{" "}
              <code>onConfirm</code> runs resolves with its outcome.
            </li>
            <li>
              <code>useConfirm()</code> throws outside a{" "}
              <code>ConfirmProvider</code> - the message says what is missing.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="ConfirmDialog" />
        <PropsTable of="ConfirmOptions" title="confirm(options)" />
        <PropsTable of="ConfirmProvider" />
      </Section>
    </DocPage>
  );
}
