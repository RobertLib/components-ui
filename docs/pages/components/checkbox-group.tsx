import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CheckboxGroupPage() {
  return (
    <DocPage imports={["CheckboxGroup"]} title="CheckboxGroup">
      <Example
        description={
          <p>
            Controlled with <code>value</code> + <code>onChange</code>, or
            uncontrolled with <code>defaultValue</code>. <code>onChange</code>{" "}
            gets the picked values in the order of the options - numbers stay
            numbers. An option can have a <code>description</code> and be{" "}
            <code>disabled</code>; <code>orientation="horizontal"</code> puts
            the options on one line.
          </p>
        }
        name="checkbox-group/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>selectAll</code> adds a checkbox that picks all options - or
            clears them - and shows a partly picked group as partly checked. A
            disabled option keeps its state. Give it a text of your own, or{" "}
            <code>true</code> for &quot;Select all&quot; in the language of the
            locale.
          </p>
        }
        name="checkbox-group/select-all"
        title="Select all"
      />
      <Example
        description={
          <p>
            <code>min</code> is the fewest options to pick -{" "}
            <code>required</code> is <code>min={"{1}"}</code> - and the browser
            refuses to submit the form with fewer, with a message in the
            language of the locale. Once <code>max</code> options are picked,
            the others are disabled and the group says so. A reset brings back
            the <code>defaultValue</code>.
          </p>
        }
        name="checkbox-group/limits"
        title="Min, max and forms"
      />
      <Example
        description={
          <p>
            <code>variant="card"</code> shows each option as a bordered card -
            its <code>icon</code>, label and <code>description</code>, the
            checkbox at its end. The whole card toggles it, a picked card is
            outlined in the primary color, and the keyboard focus draws an
            outline around the card. <code>columns</code> lays the options out
            in a grid (one column on phones), <code>orientation</code>{" "}
            <code>horizontal</code> in a row that wraps. <code>readOnly</code>{" "}
            keeps the picks: they are shown, focusable and submitted, but a
            click or Space changes nothing - and neither <code>min</code> nor{" "}
            <code>max</code> is enforced.
          </p>
        }
        name="checkbox-group/cards"
        title="Cards and read-only"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              With a <code>label</code> the options are a{" "}
              <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code>;
              without one, name the <code>group</code> with{" "}
              <code>aria-label</code> or <code>aria-labelledby</code>. The{" "}
              <code>description</code> and the <code>error</code> describe the
              group, the <code>error</code> also marks the checkboxes of the
              options invalid (not the &quot;Select all&quot;).
            </li>
            <li>
              The checkboxes share <code>name</code> and submit the picked
              values under it: <code>formData.getAll(name)</code>. The
              checkboxes are not <code>required</code> one by one - the group
              counts them, and the first checkbox that can be changed carries
              the message the browser shows. A picked <code>disabled</code>{" "}
              option is not submitted, so it counts for neither <code>min</code>{" "}
              nor <code>max</code>.
            </li>
            <li>
              A <code>label</code> of the group and of an option takes any
              content; an option&apos;s <code>icon</code> goes before its label
              in the plain variant too, hidden from screen readers.
            </li>
            <li>
              The props mirror <code>RadioGroup</code> - <code>dim</code>,{" "}
              <code>id</code>, <code>ref</code> and the other attributes of the
              group element, <code>onBlur</code> / <code>onFocus</code> of the
              checkboxes - so the two fit side by side in a form.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <Prose>
          <p>
            <code>T</code> is the type of the option values -{" "}
            <code>string</code>, <code>number</code> or a union of literals,
            inferred from <code>options</code> and <code>value</code>, so{" "}
            <code>onChange={"{setPicked}"}</code> fits a <code>useState</code>{" "}
            of the same type.
          </p>
        </Prose>
        <PropsTable of="CheckboxGroup" />
        <PropsTable of="CheckboxOption" />
      </Section>
    </DocPage>
  );
}
