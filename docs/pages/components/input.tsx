import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const registerMask = `const zip = "### ##";

// The form value is the text as shown - "602 00"; setValueAs keeps "60200"
<Input
  label="Postal code"
  mask={zip}
  {...register("zip", { setValueAs: (text) => applyMask(zip, text).raw })}
/>`;

export default function InputPage() {
  return (
    <DocPage imports={["Input", "applyMask"]} title="Input">
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
      <Example
        description={
          <p>
            <code>dim</code> makes the field 22, 26, 34 or 46 px high - a{" "}
            <code>sm</code> field as high as a <code>sm</code> Button. The other
            fields of the library take the same heights.
          </p>
        }
        name="input/sizes"
        title="Sizes"
      />
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
            <code>label</code> takes content - an icon, a hint like
            &quot;(optional)&quot; - also as a floating label; the field is
            named by all of its text. <code>required</code> adds a star, which
            screen readers leave out (they hear &quot;required&quot; from the
            field) - see Field for hiding the stars. <code>readOnly</code>{" "}
            fields can be focused, selected and copied, and are submitted; they
            have no clear button and carry <code>data-readonly</code> for your
            styles - as an invalid field carries <code>data-invalid</code> and a
            disabled one <code>data-disabled</code> (see Forms &amp;
            validation).
          </p>
        }
        name="input/labels"
        title="Labels and read-only fields"
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
            <code>passwordStrength</code> shows a meter and the strength
            (&quot;Password strength: weak&quot;) under a password field once it
            has a value, and describes the field with it. Screen readers are
            told a new strength once the typing pauses. <code>true</code> scores
            with <code>getPasswordStrength</code> - a quick estimate from the
            length and the kinds of characters, where repeats, runs, years and
            common words (<code>heslo</code>, <code>P@ssw0rd</code>) count for
            little. It knows no dictionary: pass a scorer of your own (0 - 4)
            for your policy, or one built on a library such as zxcvbn, and check
            the password on the server too.
          </p>
        }
        name="input/password-strength"
        title="Password strength"
      />
      <Example
        description={
          <p>
            <code>mask</code> formats the text as it is typed: <code>#</code> is
            a digit, <code>@</code> a letter, <code>*</code> a letter or a
            digit, and any other character is written by the mask - put a
            backslash before <code>#</code>, <code>@</code> or <code>*</code> to
            write it too. A digit keyboard opens on phones for a mask of digits
            (<code>inputMode=&quot;numeric&quot;</code>). Typing moves past the
            literals, Backspace and Delete next to one delete the character
            beyond it, a selection is replaced, and pasted text is read with or
            without the literals (&quot;+420 777 123 456&quot; or
            &quot;777123456&quot;). Characters no placeholder takes are refused,
            and so is typing into a complete value, as with{" "}
            <code>maxLength</code>. <code>onMaskChange</code> gets the formatted
            text, the characters alone (<code>raw</code>) and whether the value
            is <code>complete</code> - to look the company up once an IČO is.
          </p>
        }
        name="input/mask"
        title="Masks"
      />
      <Example
        description={
          <p>
            The field shows and submits the formatted text (&quot;123 45&quot;)
            and gives it to <code>onChange</code>; with <code>unmask</code> a
            hidden input submits the characters alone, as{" "}
            <code>NumberInput</code> does its number. A value filled in only in
            part is invalid - the browser refuses to submit it and says why. A
            country code that is always the same reads better as a{" "}
            <code>prefix</code> than inside the mask. <code>maskTokens</code>{" "}
            adds placeholders of your own, with a <code>transform</code> - here
            the uppercase letters of a licence plate.
          </p>
        }
        name="input/mask-form"
        title="Masks in a form"
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

      <Section title="Mask values">
        <Prose>
          <ul>
            <li>
              A <code>value</code> or <code>defaultValue</code> is formatted as
              if it were pasted: <code>&quot;12345&quot;</code> and{" "}
              <code>&quot;123 45&quot;</code> both show as 123 45. A controlled
              field can keep the characters alone - pass back the{" "}
              <code>raw</code> of <code>onMaskChange</code>.
            </li>
            <li>
              React Hook Form&apos;s <code>register()</code> works as with a
              plain field - it gets the formatted text. Convert it with{" "}
              <code>setValueAs</code> and <code>applyMask</code>, which formats
              any text as the field does (<code>unmask</code> is for a form of
              its own - <code>register()</code> reads the field itself):
            </li>
          </ul>
        </Prose>
        <CodeBlock code={registerMask} />
        <Prose>
          <ul>
            <li>
              While an input method composes text (Japanese, or the word
              suggestions of an Android keyboard), the mask waits until the
              composition ends, then formats what it made.
            </li>
            <li>
              Tell the users the format - a <code>description</code> like
              &quot;e.g. 110 00&quot; or a <code>placeholder</code>. Screen
              readers read the formatted value.
            </li>
          </ul>
        </Prose>
        <Callout type="warning">
          <p>
            A mask has a fixed length - every placeholder is one character, and
            a value is complete once all are filled. Formats of a varying length
            do not fit one: a Czech bank account number (an optional prefix of
            up to 6 digits, 2 - 10 digits, a bank code) or cards whose numbers
            are grouped otherwise (American Express). Use a plain field with a{" "}
            <code>pattern</code> for them, or pass another <code>mask</code> as
            the value changes. With placeholders of different kinds, a deletion
            in the middle drops the characters after it that no longer fit their
            place (a digit moving to a letter). A value the field formats is
            written by a script, so the undo history of the browser does not go
            back through the typing.
          </p>
        </Callout>
      </Section>

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
        <PropsTable of="MaskedValue" />
      </Section>
    </DocPage>
  );
}
