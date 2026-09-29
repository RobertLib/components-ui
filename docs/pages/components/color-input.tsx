import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const typed = `// Typed - taken on Enter or leaving the field, written in \`format\`
"rgb(37 99 235)"      → "#2563eb"
"2563EB", "#26e"      → "#2563eb", "#2266ee"
"hsl(221 83% 53%)"    → "#2463eb"
"#2563eb80"           → "#2563eb" - with \`alpha\`: "#2563eb80"
""                    → "" - no color`;

export default function ColorInputPage() {
  return (
    <DocPage imports={["ColorInput"]} title="ColorInput">
      <Example
        description={
          <p>
            A text field for a color with a swatch at its start that opens the
            picker: an area of saturation and brightness, a hue slider and -
            where the browser has the EyeDropper API - a button that takes a
            color from anywhere on the screen. Controlled with{" "}
            <code>value</code> + <code>onChange</code>, which gets the color as
            text, or uncontrolled with <code>defaultValue</code>.
          </p>
        }
        name="color-input/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>format</code> writes the value as hex (the default),{" "}
            <code>rgb()</code> or <code>hsl()</code>. <code>alpha</code> adds a
            slider of the opacity and keeps the alpha of a translucent color;
            without it the alpha is dropped. <code>swatches</code> are preset
            colors under the picker - in any format, with a <code>label</code>{" "}
            to name them for screen readers. <code>eyeDropper=false</code>{" "}
            leaves the eye dropper out.
          </p>
        }
        name="color-input/formats"
        title="Formats, alpha and swatches"
      />
      <Example
        description={
          <p>
            <code>dim</code> sizes the field as an <code>Input</code>. A
            read-only field shows its color and is submitted, a disabled one is
            not - neither opens the picker. With a <code>name</code>, a hidden
            input submits the color; <code>required</code> is enforced by the
            browser, and a reset brings back the <code>defaultValue</code>.
          </p>
        }
        name="color-input/states"
        title="Sizes, states and forms"
      />

      <Section title="Typing">
        <Prose>
          <p>
            The field reads the colors of CSS: hex of 3, 4, 6 or 8 digits (with
            or without <code>#</code>), <code>rgb()</code> / <code>rgba()</code>{" "}
            and <code>hsl()</code> / <code>hsla()</code>, with commas or spaces.
            A typed color is taken on Enter - which then submits no form - or
            when the focus leaves the field, and written in the{" "}
            <code>format</code>. A text that is no color is dropped, and a
            message under the field says why; Escape drops the typing.
          </p>
        </Prose>
        <CodeBlock code={typed} plain />
      </Section>

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              The swatch is a button: Enter or Space opens the picker, and its
              area of saturation and brightness takes the focus. Escape closes
              it and gives the focus back to the swatch; Tab moves through the
              picker and out of it to the text field.
            </li>
            <li>
              The area is one control for both: Left / Right change the
              saturation, Up / Down the brightness - by 1, with Shift by 10;
              Page Up / Page Down change the brightness by 10, Home / End set
              the saturation to 0 or 100 %. Screen readers read it as a 2D
              slider with both values.
            </li>
            <li>
              The hue and opacity sliders move by 1 (Shift: 10), Page Up / Page
              Down by 10, Home / End to their ends. In a right-to-left page they
              run from the right, and Right moves back.
            </li>
            <li>
              The swatches are a radio group: one tab stop, the arrow keys move
              to the next or the previous swatch and pick it.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="ColorInput" />
        <PropsTable of="ColorSwatch" />
      </Section>
    </DocPage>
  );
}
