import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const submitted = `<Slider name="volume" defaultValue={40} />
formData.get("volume");     // "40"

<Slider name="price" defaultValue={[2000, 8000]} />
formData.getAll("price");   // ["2000", "8000"] - the start first`;

export default function SliderPage() {
  return (
    <DocPage imports={["Slider"]} title="Slider">
      <Example
        description={
          <p>
            A value between <code>min</code> and <code>max</code> on steps of{" "}
            <code>step</code>. <code>formatValue</code> writes it - above the
            thumb while it is dragged, hovered or focused from the keyboard,
            next to the label with <code>showValue</code>, and for screen
            readers (<code>aria-valuetext</code>).{" "}
            <code>valueLabel="always"</code> keeps the value above the thumb.
          </p>
        }
        name="slider/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            A <code>value</code> (or <code>defaultValue</code>) of{" "}
            <code>[start, end]</code> makes a range with two thumbs, which do
            not cross - <code>minDistance</code> keeps them apart. A press on
            the track moves the nearest thumb there. <code>onChange</code> comes
            with every step of a drag, <code>onChangeEnd</code> once it is done
            - the time to load data.
          </p>
        }
        name="slider/range"
        title="Range"
      />
      <Example
        description={
          <p>
            <code>marks</code> put ticks on the track, with a label under those
            that have one. <code>orientation="vertical"</code> turns the slider
            upright - give it a height with <code>className</code>.
          </p>
        }
        name="slider/marks"
        title="Marks and vertical sliders"
      />
      <Example name="slider/sizes" title="Sizes and states" />

      <Section title="Keyboard and pointer">
        <Prose>
          <ul>
            <li>
              Each thumb is a tab stop. The arrow keys move it by a{" "}
              <code>step</code> (Right is back in a right-to-left page), Page Up
              / Page Down by a tenth of the range, Home / End to the ends - a
              thumb of a range to the other thumb.
            </li>
            <li>
              A thumb follows the pointer while it is dragged - also off the
              slider. Escape during a drag puts it back where it was. A finger
              on the track of a horizontal slider may still scroll the page: the
              thumb moves once the finger moves sideways, or when it lifts
              without moving.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Forms">
        <Prose>
          <p>
            With a <code>name</code>, hidden inputs submit the value - a range
            two values under the same name. Name it <code>price[]</code> for a
            backend that wants the brackets. A reset brings back the{" "}
            <code>defaultValue</code>. A disabled <code>&lt;fieldset&gt;</code>{" "}
            around the slider disables it as it disables a native field.
          </p>
        </Prose>
        <CodeBlock code={submitted} />
        <Prose>
          <p>
            A slider always has a value, so <code>required</code> only marks the
            label. The thumbs of a range are named by the label and
            &quot;minimum&quot; / &quot;maximum&quot; in the language of the
            locale; <code>id</code> and <code>ref</code> belong to the first
            thumb.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <Prose>
          <p>
            <code>T</code> is <code>number</code>, or{" "}
            <code>[number, number]</code> for a range - inferred from{" "}
            <code>value</code> or <code>defaultValue</code>.
          </p>
        </Prose>
        <PropsTable of="Slider" />
        <PropsTable of="SliderMark" />
      </Section>
    </DocPage>
  );
}
