import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CheckboxPage() {
  return (
    <DocPage imports={["Checkbox"]} title="Checkbox">
      <Example
        description={
          <p>
            Controlled with <code>checked</code> + <code>onChange</code>, or
            uncontrolled with <code>defaultChecked</code>.
          </p>
        }
        name="checkbox/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>indeterminate</code> shows a partly checked state - e.g. a
            &quot;select all&quot; of a partly selected list. A click clears it
            like on a native checkbox, and the next render brings it back while
            the prop says so.
          </p>
        }
        name="checkbox/indeterminate"
        title="Indeterminate"
      />
      <Example
        description={
          <p>
            <code>dim</code> sizes the box and its label - as big as the boxes
            of a <code>CheckboxGroup</code> or a <code>RadioGroup</code> of the
            same <code>dim</code>; it stays a native checkbox, with{" "}
            <code>data-state</code> - <code>checked</code>,{" "}
            <code>unchecked</code> or <code>indeterminate</code> - telling what
            it shows, also after a click, a reset or React Hook Form setting it.
            The <code>label</code> takes any content, e.g. a link.{" "}
            <code>readOnly</code> shows the state and keeps the focus, but a
            click or Space changes nothing.
          </p>
        }
        name="checkbox/sizes"
        title="Sizes, read-only and rich labels"
      />

      <Section title="Read-only">
        <Prose>
          <p>
            A native checkbox has no read-only state - the checkbox emulates it:
            it stays enabled and focusable, a click, a click on its label and
            Space leave it as it is, and <code>onChange</code> is not called. It
            is marked <code>aria-readonly</code> (and <code>data-readonly</code>{" "}
            for styling). Unlike a disabled one, a checked read-only checkbox is
            submitted with the form; like a native read-only field it is not
            validated - <code>required</code> only marks it.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Checkbox" />
      </Section>
    </DocPage>
  );
}
