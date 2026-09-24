import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function FieldPage() {
  return (
    <DocPage imports={["Field", "FormDescription"]} title="Field">
      <Example
        description={
          <p>
            Give <code>Field</code> a function as its child: it gets the control
            props - <code>id</code>, <code>aria-labelledby</code>,{" "}
            <code>aria-describedby</code>, <code>aria-invalid</code> and{" "}
            <code>aria-required</code> - to spread on the element that takes the
            focus. The label, the description and the error message look and
            behave as those of the library&apos;s own fields.{" "}
            <code>required</code> marks the label and sets{" "}
            <code>aria-required</code>; the control itself still has to be{" "}
            <code>required</code> for the browser to check it.
          </p>
        }
        name="field/basic"
        title="A control of another library"
      />
      <Example
        description={
          <p>
            A <code>&lt;label&gt;</code> names only native controls. The control
            props also carry <code>aria-labelledby</code>, which names a{" "}
            <code>div</code> with a role, and a click on the label focuses such
            a control too.
          </p>
        }
        name="field/custom-control"
        title="A control of your own"
      />

      <Section title="Ids">
        <Prose>
          <p>
            The control gets the <code>id</code> of the field - generated, or
            the one you pass. The description is{" "}
            <code>{"${id}-description"}</code>, the error message{" "}
            <code>{"${id}-error"}</code> and the label{" "}
            <code>{"${id}-label"}</code>, and <code>aria-describedby</code>{" "}
            lists the error before the description, as in every field of the
            library. A child that is no function is rendered as it is - it can
            use these ids itself.
          </p>
        </Prose>
      </Section>

      <Section title="FormDescription">
        <Prose>
          <p>
            The help text under a field - what the <code>description</code> prop
            of the fields renders. Use it on its own with <code>FormError</code>{" "}
            when you lay out a field by hand. Like <code>FormError</code> it
            renders nothing without children, so it can be placed
            unconditionally.
          </p>
        </Prose>
        <Example name="field/form-description" />
      </Section>

      <Section title="Props">
        <PropsTable of="Field" />
        <PropsTable of="FieldControlProps" />
        <PropsTable of="FormDescription" />
      </Section>
    </DocPage>
  );
}
