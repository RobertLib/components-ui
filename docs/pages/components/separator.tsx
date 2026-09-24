import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SeparatorPage() {
  return (
    <DocPage imports={["Separator"]} title="Separator">
      <Example
        description={
          <p>
            A horizontal line as wide as its container, or with{" "}
            <code>orientation="vertical"</code> as high as the flex row it
            stands in. <code>label</code> puts text into the line - in the
            middle, or with <code>labelPosition</code> at its start or end. It
            has no margin; add one with <code>className</code>.
          </p>
        }
        name="separator/basic"
        title="Lines and labels"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            A separator is announced as one (<code>role="separator"</code>, with{" "}
            <code>aria-orientation</code> when vertical), named by its label -
            "or, separator". A line that only helps the eye is{" "}
            <code>decorative</code>: hidden from assistive technology, while its
            label, if any, stays readable text.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Separator" />
      </Section>
    </DocPage>
  );
}
