import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function NumberInputPage() {
  return (
    <DocPage imports={["NumberInput"]} title="NumberInput">
      <Example
        description={
          <p>
            <code>min</code>, <code>max</code> and <code>step</code> bound and
            step the value. Arrow Up / Down add or take a step, Page Up / Down
            ten steps, Home / End jump to <code>min</code> / <code>max</code>.
            The buttons repeat the step while held - on touch screens they are
            larger plus and minus buttons. The steps count from <code>min</code>{" "}
            (or 0) like those of a native number input: 1.23 with a step of 0.1
            moves to 1.3. And like there, a step up never lowers the value: with
            a <code>max</code> of 10 and a step of 3 the last step is 9, and
            from 10 a step up changes nothing.
          </p>
        }
        name="number-input/basic"
        title="Basic"
      />

      <Section title="Typing">
        <Prose>
          <ul>
            <li>
              Without the focus the field shows the number as the language of{" "}
              <code>UIProvider</code> writes it - &quot;1,234.5&quot; in
              English, &quot;1 234,5&quot; in Czech. With the focus it shows the
              plain number (&quot;1234,5&quot;) for editing.
            </li>
            <li>
              It reads what the user types in that notation, and leniently where
              the text is unambiguous: in Czech &quot;1.5&quot; is 1.5 too,
              spaces and apostrophes group, &quot;1.234,5&quot; and
              &quot;1,234.5&quot; are 1234.5 in any language, so are
              &quot;1.234.567&quot; and &quot;1,234,567&quot; 1234567,
              &quot;0,5&quot; is 0.5 in English too, and a pasted &quot;1 234,50
              Kč&quot; is read without the currency (&quot;($1,234.50)&quot; of
              an accounting format as a negative number). The digits of the
              language&apos;s own numbering system (Arabic &quot;١٢٣&quot;)
              count as the Latin ones. Letters are refused as they are typed,
              and so is a minus sign when <code>min</code> is 0 or more, or a
              decimal separator with <code>maximumFractionDigits={"{0}"}</code>.
            </li>
            <li>
              When the field loses the focus, or on Enter, a typed value outside{" "}
              <code>min</code> - <code>max</code> is moved to the nearest bound,
              and the value is rounded to the fraction digits of the format.
              Until then - and for a value outside them the parent passes - the
              field is invalid like a native number input: a form submitted from
              a script meanwhile (<code>form.requestSubmit()</code>) is refused,
              with a message of the language.
            </li>
          </ul>
        </Prose>
      </Section>

      <Example
        description={
          <p>
            <code>formatOptions</code> are the options of{" "}
            <code>Intl.NumberFormat</code>: a currency, a percentage (the value
            0.21 shows as 21 % and is typed as 21, and a step is 0.01 - one
            percent - by default) or a unit. The value keeps the fraction digits
            the format shows - 3 by default, 2 for most currencies, more for a
            finer <code>step</code> (0.0001) unless the options set them;{" "}
            <code>maximumFractionDigits</code> is a shorthand for the one of the
            options.
          </p>
        }
        name="number-input/formats"
        title="Currencies, percentages and units"
      />
      <Example
        description={
          <p>
            <code>value</code> is a <code>number</code> or <code>null</code> for
            an empty field, and <code>onChange</code> gets the new one - while
            typing whenever the text stands for another number, then the value
            moved into its bounds when the field loses the focus, and on every
            step. A value the parent does not take is not shown.
          </p>
        }
        name="number-input/controlled"
        title="Controlled"
      />
      <Example
        description={
          <p>
            With a <code>name</code> a hidden input submits the plain number
            (&quot;1234.5&quot;, empty for no value) - the visible field has no
            name. <code>required</code> is checked by the browser on the visible
            field, and a form reset brings back the <code>defaultValue</code>.
          </p>
        }
        name="number-input/form"
        title="In a form"
      />
      <Example
        description={
          <p>
            It is an <code>Input</code> underneath: <code>dim</code>,{" "}
            <code>floating</code>, <code>error</code>, <code>description</code>,{" "}
            <code>prefix</code> / <code>suffix</code> and <code>disabled</code>{" "}
            work the same. <code>hideStepper</code> hides the buttons.
          </p>
        }
        name="number-input/sizes"
        title="Sizes and states"
      />

      <Section title="Accessibility">
        <Prose>
          <ul>
            <li>
              The field is a <code>spinbutton</code> with{" "}
              <code>aria-valuenow</code>, <code>aria-valuemin</code>,{" "}
              <code>aria-valuemax</code> and the formatted value as{" "}
              <code>aria-valuetext</code>.
            </li>
            <li>
              The step buttons are out of the tab order - the arrow keys do what
              they do - and named &quot;Increase&quot; / &quot;Decrease&quot; in
              the language of the page. At a bound a button is{" "}
              <code>aria-disabled</code>.
            </li>
            <li>
              <code>inputMode</code> opens a numeric keyboard on phones - the
              one with a minus sign where negative numbers are allowed (a text
              keyboard on an iPhone, whose numeric keyboards have none). Pass
              your own <code>inputMode</code> to override it.
            </li>
          </ul>
        </Prose>
        <Callout>
          <p>
            The mouse wheel changes the value only with{" "}
            <code>changeOnWheel</code>, and only while the field has the focus -
            otherwise scrolling a long form over a focused field would change
            it.
          </p>
        </Callout>
      </Section>

      <Section title="Props">
        <PropsTable of="NumberInput" />
      </Section>
    </DocPage>
  );
}
