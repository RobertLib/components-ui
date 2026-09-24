import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function StatPage() {
  return (
    <DocPage imports={["Stat"]} title="Stat">
      <Example
        description={
          <p>
            A numeric <code>value</code> is written in the format of the
            language - <code>formatOptions</code> are the options of{" "}
            <code>Intl.NumberFormat</code> (a currency, a unit, compact
            notation); other content is shown as it is. A numeric{" "}
            <code>change</code> is a share - <code>0.125</code> shows as
            "+12.5%" ("+12,5 %" in Czech) with an arrow, green for a rise and
            red for a fall - as written: a change that rounds to "0%" is
            neither; <code>invertTrend</code> turns the colors round for costs,
            churn or response times. A <code>change</code> that is no number is
            shown as it is, colored by <code>trend</code>.
          </p>
        }
        name="stat/grid"
        title="A grid of cards"
      />
      <Example
        description={
          <p>
            A stat has no frame of its own - several can share one{" "}
            <code>Panel</code>. <code>loading</code> shows placeholders as high
            as the value and the change, so nothing moves when the numbers
            arrive; the label stays.
          </p>
        }
        name="stat/panel"
        title="In one panel, loading"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            A stat is a description list: the label is the term, the value and
            the change its descriptions - screen readers read "Revenue,
            €128,400.00, +12.5% vs August". The arrow is decoration; the sign of
            the change says the same. While loading, the stat is{" "}
            <code>aria-busy</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Stat" />
      </Section>
    </DocPage>
  );
}
