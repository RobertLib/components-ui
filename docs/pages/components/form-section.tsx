import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function FormSectionPage() {
  return (
    <DocPage imports={["FormSection", "FormGridItem"]} title="FormSection">
      <Example
        description={
          <p>
            A <code>&lt;fieldset&gt;</code> named by its heading - screen
            readers announce the group as the focus enters it - with a{" "}
            <code>description</code> (it describes the group too) and{" "}
            <code>actions</code> at the end of the header. A{" "}
            <code>FormGrid</code> lays out its fields: <code>columns</code> 1 to
            4 where the form is wide enough, one on a phone, and{" "}
            <code>FormGridItem</code> spans a field over more of them.
          </p>
        }
        name="form-section/basic"
        title="Sections of a form"
      />

      <Example
        description={
          <p>
            <code>readOnly</code> makes every field of the section read-only, as
            its own <code>readOnly</code> would: the values show, can be
            selected and copied and are submitted, but not changed - the same
            form for the detail and the edit of a record. A field with{" "}
            <code>readOnly={"{false}"}</code> stays editable; the fields of a
            dialog or a popover opened from the section are not affected, nor
            are the <code>actions</code>.
          </p>
        }
        name="form-section/detail-edit"
        title="Detail and edit"
      />

      <Section title="Disabled">
        <Prose>
          <p>
            <code>disabled</code> disables every field of the section, as a
            native fieldset does - also the custom ones. The{" "}
            <code>actions</code> are in its legend, so they stay usable, like
            the controls of a native legend: an &quot;Unlock&quot; button can
            enable the section again.
          </p>
        </Prose>
      </Section>

      <Section title="Labels beside the fields">
        <Prose>
          <p>
            <code>labelPosition=&quot;start&quot;</code> puts the labels in a
            column of <code>labelWidth</code> beside the fields - see{" "}
            <code>FormGrid</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="FormSection" />
      </Section>
    </DocPage>
  );
}
