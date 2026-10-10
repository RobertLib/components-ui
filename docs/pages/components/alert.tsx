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
            <code>{'<Alert type="danger">{error}</Alert>'}</code>. The{" "}
            <code>title</code> is a heading of level 3 - set{" "}
            <code>headingLevel</code> to the level below the headings around.
          </p>
        }
        name="alert/title"
        title="Title, no icon and conditional content"
      />
      <Example
        description={
          <p>
            <code>variant</code> is <code>subtle</code> by default - a tint with
            a border; <code>solid</code> fills the alert with its color,{" "}
            <code>outline</code> draws a colored border on the surface. Every
            text stands out from its background by at least 4.5:1.
          </p>
        }
        name="alert/variants"
        title="Variants"
      />
      <Example
        description={
          <p>
            <code>onClose</code> adds a close button at the end - named "Close
            alert" in the language of the page; remove the alert in it, or clear
            its message. When the button had the focus, the focus moves on to
            the next control of the page once the alert is gone.{" "}
            <code>actions</code> are buttons under the message - small ones fit
            best.
          </p>
        }
        name="alert/dismissible"
        title="Dismissible, with actions"
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
