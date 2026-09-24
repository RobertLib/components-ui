import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function AlertPage() {
  return (
    <DocPage imports={["Alert"]} title="Alert">
      <Example name="alert/types" title="Types" />
      <Example
        description={
          <p>
            An alert without children renders nothing, so an error message can
            be placed unconditionally:{" "}
            <code>{'<Alert type="danger">{error}</Alert>'}</code>.
          </p>
        }
        name="alert/title"
        title="Title, no icon and conditional content"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            <code>danger</code> and <code>warning</code> alerts have{" "}
            <code>role="alert"</code> and are announced at once - also when they
            appear with their message. <code>success</code> and{" "}
            <code>info</code> have <code>role="status"</code>, announced in a
            pause.
          </p>
          <p>
            A status that appears already filled is often not announced, and an
            alert without children renders nothing - an empty live region kept
            in the page would add to the spacing of its parent (in{" "}
            <code>space-y-*</code> or <code>gap-*</code>). Tell of the outcome
            of an action, like a saved form, with a{" "}
            <Link to="/components/toast">toast</Link>; an alert shows what stays
            true on the page.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Alert" />
      </Section>
    </DocPage>
  );
}
