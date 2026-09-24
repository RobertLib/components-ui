import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SpinnerPage() {
  return (
    <DocPage
      description="Loading indicators: a spinner for short waits and skeletons that keep the layout while content loads."
      imports={["Spinner", "Skeleton"]}
      title="Spinner & Skeleton"
    >
      <Example name="spinner/basic" title="Spinners and skeletons" />
      <Example
        description={
          <p>
            <code>variant</code> shapes the skeleton: <code>rect</code> (a block
            of <code>width</code> × <code>height</code>), <code>circle</code>{" "}
            (an avatar) or <code>text</code> - <code>lines</code> as high as the
            text lines of the surrounding font, the last of several shorter, so
            nothing moves when the content arrives. Skeletons are hidden from
            screen readers - mark the region as busy (<code>aria-busy</code>)
            instead.
          </p>
        }
        name="spinner/skeleton-variants"
        title="Skeleton shapes"
      />
      <Section title="Reduced motion">
        <Prose>
          <p>
            For users who ask their system for less motion, the spinner turns
            slower and skeletons stop pulsing - <code>styles.css</code> tones
            down the animations (also Tailwind's <code>animate-spin</code> and{" "}
            <code>animate-pulse</code> in your own markup).
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="Spinner" />
        <PropsTable of="Skeleton" />
      </Section>
    </DocPage>
  );
}
