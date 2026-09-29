import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const submitted = `<Rating name="rating" defaultValue={4} />
formData.get("rating");   // "4"

<Rating name="rating" />
formData.get("rating");   // "" - nothing picked`;

export default function RatingPage() {
  return (
    <DocPage imports={["Rating"]} title="Rating">
      <Example
        description={
          <p>
            A rating of 1 to <code>max</code> (5 by default). Controlled with{" "}
            <code>value</code> + <code>onChange</code>, or uncontrolled with{" "}
            <code>defaultValue</code>; <code>0</code> is no rating. Hovering
            previews what a click picks. <code>clearable</code> takes the rating
            back on a click on the picked icon, <code>allowHalf</code> picks
            half an icon on a click on its start half.
          </p>
        }
        name="rating/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>icon</code> replaces the star - an SVG icon is filled with the{" "}
            <code>color</code> where it is picked; <code>emptyIcon</code> can
            differ. Say what the icons are with <code>formatValueText</code>,
            which screen readers read. <code>readOnly</code> shows any value,
            e.g. an average of 4.3 fills a third of the fifth star, and keeps
            the focus; <code>dim</code> sizes the icons.
          </p>
        }
        name="rating/variants"
        title="Icons, colors and sizes"
      />
      <Example
        description={
          <p>
            With a <code>name</code>, a hidden input submits the value - an
            empty one while nothing is picked. <code>required</code> keeps the
            form from being submitted without a rating, and a reset brings back
            the <code>defaultValue</code>.
          </p>
        }
        name="rating/form"
        title="In a form"
      />

      <Section title="Keyboard">
        <Prose>
          <p>
            The rating is one tab stop - a slider, as in the rating slider of
            WAI-ARIA. A slider takes half steps as well as whole ones and is
            read with its value (&quot;3.5 of 5 stars&quot;), where a radio
            group would need a radio for every half.
          </p>
          <ul>
            <li>
              Right / Up raise the rating by a step (a half with{" "}
              <code>allowHalf</code>), Left / Down lower it - Right lowers it in
              a right-to-left page. Page Up / Page Down move by a whole icon.
            </li>
            <li>
              Home picks the lowest rating, End the highest. With{" "}
              <code>clearable</code>, the lowest is none, and Backspace or
              Delete clear the rating.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Forms">
        <CodeBlock code={submitted} />
        <Prose>
          <p>
            A disabled rating - also one in a disabled{" "}
            <code>&lt;fieldset&gt;</code> - is neither focusable nor submitted;
            a read-only one is both. <code>id</code>, <code>ref</code> and the
            other attributes of a <code>div</code> belong to the slider, which
            the <code>label</code> names and the <code>description</code> and
            the <code>error</code> describe.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Rating" />
      </Section>
    </DocPage>
  );
}
