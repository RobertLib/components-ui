import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function InputPage() {
  return (
    <DocPage imports={["Input"]} title="Input">
      <Example
        description={
          <p>
            All native input attributes work (<code>type</code>,{" "}
            <code>min</code>, <code>autoComplete</code>, …). With a{" "}
            <code>name</code> the field is submitted with its form like a plain
            input. <code>description</code> puts help text under the field and
            describes the field with it for screen readers (after the{" "}
            <code>error</code>, before your own <code>aria-describedby</code>).
          </p>
        }
        name="input/basic"
        title="Basic"
      />
      <Example name="input/sizes" title="Sizes" />
      <Example
        description={
          <p>
            <code>floating</code> puts the label inside the field. It floats up
            once the field has a value - also one the browser autofilled - and
            always in the date and time types, whose empty field shows the
            format.
          </p>
        }
        name="input/floating"
        title="Floating label"
      />
      <Example
        description={
          <p>
            <code>prefix</code> and <code>suffix</code> put an icon, a unit or a
            text like <code>https://</code> inside the border of the field. A
            click on them focuses the field; a button or a select in them stays
            usable. They may come and go with the value (a check mark once it is
            valid) - the field keeps the focus. With <code>floating</code> a
            prefix keeps the label floated above. Screen readers do not tie them
            to the field - put a unit that matters into the label or the
            description too. For numbers written as the locale writes them, see{" "}
            <code>NumberInput</code>.
          </p>
        }
        name="input/adornments"
        title="Prefix and suffix"
      />
      <Example
        description={
          <p>
            <code>clearable</code> adds a clear button while the field has a
            value - not to a password or number field, and not while the field
            is disabled or read-only. The clear is a change like typing:{" "}
            <code>onChange</code> gets an event with an empty value, an
            uncontrolled field empties itself, and the focus moves into the
            field.
          </p>
        }
        name="input/clearable"
        title="Clear button"
      />
      <Example
        description={
          <p>
            <code>type="password"</code> adds a show / hide button - also next
            to a floating label. <code>error</code> marks the field invalid,
            shows the message and links it with <code>aria-describedby</code>.
          </p>
        }
        name="input/password-error"
        title="Password, errors and disabled"
      />
      <Example
        description={
          <p>
            Pass <code>value</code> and <code>onChange</code> to control the
            field, or <code>defaultValue</code> to let it keep its own state.
          </p>
        }
        name="input/controlled"
        title="Controlled"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The label is connected to the field through a generated{" "}
              <code>id</code> - pass your own <code>id</code> if you need a
              stable one.
            </li>
            <li>
              Server validation messages can be read with{" "}
              <code>getFieldError(error, "email")</code> - see Forms &amp;
              validation.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Input" />
      </Section>
    </DocPage>
  );
}
