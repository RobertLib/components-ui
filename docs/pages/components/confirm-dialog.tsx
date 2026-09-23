import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ConfirmDialogPage() {
  return (
    <DocPage imports={["ConfirmDialog"]} title="ConfirmDialog">
      <Example
        description={
          <p>
            <code>loading</code> shows a spinner on the confirm button and
            disables cancelling while the action runs. The buttons are labelled
            in the active locale unless <code>confirmLabel</code> /{" "}
            <code>cancelLabel</code> are given.
          </p>
        }
        name="confirm-dialog/delete"
        title="Confirming a destructive action"
      />

      <Section title="Props">
        <PropsTable of="ConfirmDialog" />
      </Section>
    </DocPage>
  );
}
