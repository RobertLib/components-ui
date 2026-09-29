import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function FieldPage() {
  return (
    <DocPage
      imports={["Field", "FormDescription", "RequiredMark"]}
      title="Field"
    >
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
      <Example
        description={
          <p>
            <code>label</code> takes content - an icon, a hint in another color.
            It names the control through <code>aria-labelledby</code> with all
            of its text.
          </p>
        }
        name="field/label-content"
        title="Label content"
      />

      <Section title="Required fields">
        <Prose>
          <p>
            The label of a <code>required</code> field ends with a star - of{" "}
            <code>Field</code> and of the library&apos;s fields.{" "}
            <code>RequiredMark</code> is that star for a label of your own. It
            is hidden from screen readers: they hear &quot;required&quot; from
            the control (<code>required</code> or <code>aria-required</code>). A
            form that marks its optional fields instead turns the stars off with{" "}
            <code>data-required-mark=&quot;hidden&quot;</code> on the form or
            any element around the fields - or everywhere with{" "}
            <code>.cui-required-mark {"{ display: none }"}</code> in your CSS.
          </p>
        </Prose>
        <Example name="field/required-mark" />
      </Section>

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
        <PropsTable of="RequiredMark" />
      </Section>
    </DocPage>
  );
}
