import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ChartPage() {
  return (
    <DocPage
      imports={["Chart", "type ChartSeries", "type ChartDataPoint"]}
      title="Chart"
    >
      <Example
        name="chart/basic"
        title="Lines, areas and grouped bars"
        description={
          <p>
            Each point has a <code>label</code> and numeric values keyed by{" "}
            <code>series</code>. Choose <code>line</code>, <code>area</code> or{" "}
            <code>bar</code>. Null, missing and non-finite values leave gaps.
            Legend buttons toggle series; hover, tap or focus a category to
            inspect its values.
          </p>
        }
      />
      <Section title="Scale and formatting">
        <Prose>
          <p>
            <code>min</code> and <code>max</code> fix the vertical scale; bars
            and areas include zero. <code>formatOptions</code> formats axes,
            tooltips and the table with the provider's locale.{" "}
            <code>formatValue</code> replaces that formatter. The SVG fills its
            container and uses <code>height</code> for its proportions.
          </p>
        </Prose>
      </Section>
      <Section title="Accessibility">
        <Prose>
          <p>
            The required <code>title</code> names the chart. Use{" "}
            <code>description</code> to explain the result. Every category has a
            focusable point named by its series values: arrows, Home and End
            move between them; Escape hides the tooltip. The data table
            disclosure provides every value, including hidden series. Keep it
            enabled when exact values matter.
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="Chart" />
        <PropsTable of="ChartSeries" />
        <PropsTable of="ChartDataPoint" />
      </Section>
    </DocPage>
  );
}
