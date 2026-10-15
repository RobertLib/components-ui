import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function FormActionsPage() {
  return (
    <DocPage imports={["FormActions"]} title="FormActions">
      <Example
        description={
          <p>
            The bar of the buttons at the end of a form - Cancel, then the
            submit button. Side by side at the end of the bar, under each other
            and as wide as the bar where it is narrow (a phone). With{" "}
            <code>sticky</code> it stays at the bottom of the screen, or of the
            scrolling element around, while the end of the form is out of view -
            a line and a shadow over the fields that scroll under it, and room
            for the home indicator of a phone. Put it last in the form.
          </p>
        }
        name="form-actions/sticky"
        title="A sticky bar"
      />

      <Section title="Status">
        <Prose>
          <p>
            <code>dirty</code> says &quot;Unsaved changes&quot; at the start of
            the bar; <code>status</code> says something of your own - when the
            form was saved last, that it saves. Screen readers read the text as
            it changes.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="FormActions" />
      </Section>
    </DocPage>
  );
}
