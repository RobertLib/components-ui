import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TagsInputPage() {
  return (
    <DocPage imports={["TagsInput"]} title="TagsInput">
      <Example
        description={
          <p>
            Free-form values in one field. Enter or a comma adds the typed text,
            the × button of a value removes it. Controlled with{" "}
            <code>value</code> + <code>onChange</code> (an array of strings), or
            uncontrolled with <code>defaultValue</code>.
          </p>
        }
        name="tags-input/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>separators</code> end a value as they are typed and split
            pasted text, as line breaks do - paste a column of a spreadsheet.{" "}
            <code>validate</code> refuses a value with a message; the text stays
            in the input to be fixed. Values already in the list are refused
            (ignoring case) unless <code>allowDuplicates</code>, and{" "}
            <code>maxTags</code> caps their count. <code>addOnBlur</code> adds
            the typed text when the focus leaves the field.
          </p>
        }
        name="tags-input/recipients"
        title="E-mail recipients"
      />
      <Example
        description={
          <p>
            <code>suggestions</code> makes the input a combobox: the list offers
            the suggestions that match the typed text - ignoring case and
            diacritics, so <code>ucet</code> finds <code>Účetnictví</code> - and
            leaves out the values already in the list. ArrowDown opens it, Enter
            adds the highlighted suggestion, Escape closes it; any other text
            can still be added. The suggestions may arrive while the user types
            (loaded for the typed text) - the input keeps the focus.
          </p>
        }
        name="tags-input/suggestions"
        title="Suggestions"
      />

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              The field is one tab stop - the input. Enter adds the typed text;
              in an empty input it submits the form, as in any text field.
            </li>
            <li>
              Backspace in the empty input moves to the × button of the last
              value; a second Backspace removes it and moves to the value before
              it. ArrowLeft at the start of the input moves there too; the arrow
              keys move between the values and back to the input, Backspace or
              Delete remove the value with the focus, and typing goes on in the
              input.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Forms">
        <Prose>
          <ul>
            <li>
              With a <code>name</code>, every value is submitted in a hidden
              input: <code>formData.getAll(name)</code>. The typed text is no
              value until it is added - use <code>addOnBlur</code> so that
              clicking the submit button adds it.
            </li>
            <li>
              With <code>required</code> the browser refuses to submit the form
              without a value, with a message in the language of the locale. A
              reset brings back the <code>defaultValue</code> and clears the
              input.
            </li>
            <li>
              The values are rendered like the chips of a multiple{" "}
              <code>Autocomplete</code>. Native attributes (
              <code>placeholder</code>, <code>inputMode</code>,{" "}
              <code>maxLength</code>, <code>aria-*</code>, …) and{" "}
              <code>ref</code> go to the input; its key and paste handlers run
              first, and preventing the default skips the field's own handling.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="TagsInput" />
      </Section>
    </DocPage>
  );
}
