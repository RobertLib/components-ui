import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ProgressPage() {
  return (
    <DocPage imports={["Progress", "CircularProgress"]} title="Progress">
      <Example name="progress/basic" title="Basic" />
      <Example
        description={
          <p>
            Without a <code>value</code> (or with <code>indeterminate</code>)
            the bar keeps moving - for work of an unknown length, like the
            processing after an upload. Screen readers hear no value then, and
            no percentage is shown. For users who prefer reduced motion the bar
            does not travel - it fades in place.
          </p>
        }
        name="progress/indeterminate"
        title="Indeterminate"
      />
      <Example
        description={
          <p>
            <code>CircularProgress</code> is a ring of four sizes;{" "}
            <code>strokeWidth</code> is its thickness in percent of the
            diameter. <code>showPercentage</code> writes the percentage in the
            middle, <code>children</code> anything else ("3/5", an icon).
            Without a value the ring spins - slower for reduced motion, like the
            spinner.
          </p>
        }
        name="progress/circular"
        title="Circular"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            The bar is a <code>progressbar</code> named by its{" "}
            <code>label</code> and described by its <code>description</code>. A
            bar without a label needs <code>aria-label</code> or{" "}
            <code>aria-labelledby</code> - as does every{" "}
            <code>CircularProgress</code>. A value outside 0 - <code>max</code>{" "}
            is clamped, for the bar and for screen readers. The percentage is
            written as the language writes it ("40 %" in Czech) and rounded down
            - it says 100 % only once the work is done. The other props of a{" "}
            <code>div</code> go to the bar - <code>aria-valuetext</code> tells a
            count ("3 of 5 files") instead of the percentage screen readers hear
            otherwise; <code>className</code> and <code>style</code> go to the
            wrapper around the label and the bar.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Progress" />
        <PropsTable of="CircularProgress" />
      </Section>
    </DocPage>
  );
}
