import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function RadioGroupPage() {
  return (
    <DocPage imports={["RadioGroup"]} title="RadioGroup">
      <Example
        description={
          <p>
            With a <code>label</code> the options are wrapped in a{" "}
            <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code>;
            without one, name the <code>radiogroup</code> with{" "}
            <code>aria-label</code> or <code>aria-labelledby</code>. An{" "}
            <code>error</code> marks and describes the whole group. Numeric
            option values are compared as strings, so they stay checked after a
            change. The form submits the picked value under <code>name</code> -
            without one the options still form a group, but are not submitted.
          </p>
        }
        name="radio-group/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            An option takes a <code>description</code> - it describes the radio
            for screen readers, and a click on it picks the option - and{" "}
            <code>disabled</code>, which the arrow keys skip. The{" "}
            <code>description</code> of the group goes under the options and
            describes the group.
          </p>
        }
        name="radio-group/options"
        title="Described and disabled options"
      />
      <Example
        description={
          <p>
            <code>orientation="horizontal"</code> puts the options in a row that
            wraps on narrow screens. The arrow keys move through the options in
            either orientation, as in any radio group.
          </p>
        }
        name="radio-group/horizontal"
        title="Horizontal"
      />
      <Example
        description={
          <p>
            <code>variant="card"</code> shows each option as a bordered card -
            its <code>icon</code>, label and <code>description</code>, the radio
            at its end. The whole card picks it, the picked card is outlined in
            the primary color, the keyboard focus draws an outline around the
            card, and the arrow keys move and pick as in any radio group.{" "}
            <code>columns</code> lays the options out in a grid - one column on
            phones.
          </p>
        }
        name="radio-group/cards"
        title="Cards"
      />
      <Example
        description={
          <p>
            <code>readOnly</code> shows the pick and keeps the focus: a click
            and Space change nothing, and the arrow keys move the focus through
            the options without picking them. The group is marked{" "}
            <code>aria-readonly</code>; unlike a disabled one, the pick is
            submitted with the form.
          </p>
        }
        name="radio-group/read-only"
        title="Read-only"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The <code>label</code> of the group and the labels of the options
              take any content. A read-only group is not validated - as a native
              read-only field, <code>required</code> only marks it.
            </li>
            <li>
              <code>dim</code> sizes the text of the options like the text of an{" "}
              <code>Input</code> of the same <code>dim</code>, and the radios
              like a <code>Checkbox</code>.
            </li>
            <li>
              <code>id</code>, <code>ref</code> and the other attributes of an
              element go to the group, which has <code>data-orientation</code>{" "}
              (and <code>data-disabled</code>, <code>data-invalid</code>,{" "}
              <code>data-readonly</code>); each radio has{" "}
              <code>data-state</code>, a picked card <code>data-selected</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="RadioGroup" />
        <PropsTable of="RadioOption" />
      </Section>
    </DocPage>
  );
}
