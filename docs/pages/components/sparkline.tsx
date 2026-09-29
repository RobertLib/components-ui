import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SparklinePage() {
  return (
    <DocPage imports={["Sparkline"]} title="Sparkline">
      <Example
        description={
          <p>
            The <code>data</code> are drawn evenly from the start to the end,
            the lowest value at the bottom and the highest at the top.{" "}
            <code>area</code> tints the area under the line,{" "}
            <code>highlightLast</code> marks where the series stands now. The
            size comes from <code>className</code> (<code>h-8 w-24</code> by
            default) - the line keeps its <code>strokeWidth</code> however wide
            the chart is. Each <code>color</code> stands out from the surface by
            at least 3:1.
          </p>
        }
        name="sparkline/basic"
        title="Lines and areas"
      />
      <Example
        description={
          <p>
            <code>min</code> and <code>max</code> fix the scale - here one for
            all the rows, so that their lines compare. A <code>null</code> is a
            gap in the line. A <Link to="/components/stat">Stat</Link> draws a
            sparkline under its figure with its <code>sparkline</code> prop.
          </p>
        }
        name="sparkline/table"
        title="In a table, on one scale"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            A sparkline is an image named by a summary of its values - "From 42
            to 92, lowest 42, highest 92", after its <code>label</code>{" "}
            ("Visits: …"), written with <code>formatOptions</code> in the format
            of the language. <code>summary</code> replaces the generated text,
            e.g. with what the trend means. Without values it is hidden from
            screen readers. It has no axes nor a tooltip: show the numbers that
            matter as text beside it, as a stat or a table does.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Sparkline" />
      </Section>
    </DocPage>
  );
}
