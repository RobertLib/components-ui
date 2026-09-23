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
            input.
          </p>
        }
        name="input/basic"
        title="Basic"
      />
      <Example name="input/sizes" title="Sizes" />
      <Example name="input/floating" title="Floating label" />
      <Example
        description={
          <p>
            <code>type="password"</code> adds a show / hide button.{" "}
            <code>error</code> marks the field invalid, shows the message and
            links it with <code>aria-describedby</code>.
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
