import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function PinInputPage() {
  return (
    <DocPage imports={["PinInput"]} title="PinInput">
      <Example
        description={
          <p>
            A one-time code in a row of cells. <code>onComplete</code> gets the
            code once all cells are filled - by typing, by a paste into any
            cell, or by the code the phone offers from a text message (the first
            cell has <code>autocomplete="one-time-code"</code>, the field
            spreads the code over the others). <code>onChange</code> gets every
            change.
          </p>
        }
        name="pin-input/basic"
        title="Verification code"
      />
      <Example
        description={
          <p>
            <code>length</code> sets the number of cells,{" "}
            <code>type="alphanumeric"</code> takes letters too (and opens the
            text keyboard of phones instead of the number pad),{" "}
            <code>mask</code> hides the characters and <code>placeholder</code>{" "}
            marks the empty cells. The value is a string - controlled with{" "}
            <code>value</code> + <code>onChange</code>, which may change it,
            e.g. to capitals.
          </p>
        }
        name="pin-input/variants"
        title="Variants"
      />
      <Example
        description={
          <p>
            With a <code>name</code>, a hidden input submits the code. With{" "}
            <code>required</code> every cell is required - the browser points at
            the first empty one. A reset brings back the{" "}
            <code>defaultValue</code>.
          </p>
        }
        name="pin-input/form"
        title="In a form"
      />

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              The cells are one tab stop - the first empty cell, or the last one
              of a complete code. Typing moves on to the next cell; characters
              the code does not take are ignored. A digit key types its digit
              also where the keyboard layout puts a letter on it (the ě š č of a
              Czech keyboard).
            </li>
            <li>
              Backspace clears the character of the cell, or - in an empty cell
              - the one before it; Delete clears the character of the cell. The
              characters after a cleared one move up: the code has no gaps.
            </li>
            <li>
              The arrow keys move between the filled cells, Home / End to the
              first cell and to the first empty one. A click on a cell after the
              first empty one fills that one.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The cells are a <code>group</code> named by the <code>label</code>{" "}
              (or <code>aria-label</code>) and described by the{" "}
              <code>description</code> and the <code>error</code>; each cell is
              named by its position - &quot;Digit 2 of 6&quot; in the language
              of the locale.
            </li>
            <li>
              <code>id</code> and <code>ref</code> belong to the first cell -
              the label focuses the cell the next character goes to.{" "}
              <code>onFocus</code> / <code>onBlur</code> come when the focus
              enters and leaves the cells, not as it moves between them.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="PinInput" />
      </Section>
    </DocPage>
  );
}
