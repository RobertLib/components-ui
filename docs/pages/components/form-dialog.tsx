import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const beforeClose = `// Uploads run - ask something else than "Discard changes?"
<FormDialog
  onBeforeClose={() =>
    pendingUploads > 0
      ? confirm({ title: "Stop the uploads?", confirmColor: "danger" })
      : true
  }
  …
/>`;

export default function FormDialogPage() {
  return (
    <DocPage imports={["FormDialog"]} title="FormDialog">
      <Example
        description={
          <p>
            A <code>Dialog</code> with a form: the fields, an <code>error</code>{" "}
            of the last save in an <code>Alert</code> above them, and Cancel
            with the submit button in a <code>DialogFooter</code> -{" "}
            <code>footerStart</code> takes e.g. a Delete button at the other
            end. <code>onSubmit</code> gets the event of the form with its
            default prevented, also for Enter in a field. While{" "}
            <code>saving</code> the submit button spins and the dialog cannot be
            closed. With <code>dirty</code>, Cancel, the close button, Escape
            and the backdrop ask &quot;Discard changes?&quot; first.
          </p>
        }
        name="form-dialog/basic"
        title="Edit form"
      />

      <Section title="Asking something else">
        <Prose>
          <p>
            <code>onBeforeClose</code> asks instead of the question of{" "}
            <code>dirty</code> - return <code>false</code>, or a promise of it,
            to keep the dialog open. Every <code>Dialog</code> and{" "}
            <code>Sheet</code> takes it too.
          </p>
        </Prose>
        <CodeBlock code={beforeClose} />
      </Section>

      <Section title="Validation">
        <Prose>
          <p>
            The form validates as a native one does: <code>required</code>,{" "}
            <code>type=&quot;email&quot;</code> and the like stop the submit and
            say why. For checks of your own, pass{" "}
            <code>{"formProps={{ noValidate: true }}"}</code> and show the
            messages in the <code>error</code> of the fields - see Forms &amp;
            validation for the errors of the server.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="FormDialog" />
      </Section>
    </DocPage>
  );
}
