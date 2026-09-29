import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CardPage() {
  return (
    <DocPage imports={["Card"]} title="Card">
      <Example
        description={
          <p>
            A <code>title</code> - a heading of level 3, or{" "}
            <code>headingLevel</code> - with a <code>description</code> under it
            and <code>actions</code> at the end of the header; the children are
            the content, the <code>footer</code> sits under a line. The other
            props go to the <Link to="/components/panel">Panel</Link> the card
            is drawn on - its <code>border</code>, <code>rounded</code> and{" "}
            <code>shadow</code> too.
          </p>
        }
        name="card/basic"
        title="Header, content and footer"
      />
      <Example
        description={
          <p>
            With <code>href</code> the whole card is a link (the router's{" "}
            <code>Link</code> of <code>UIProvider</code>), with{" "}
            <code>onClick</code> a button. The title is the link or the button,
            stretched over the card - screen readers hear the title alone, not
            all of the card, and the <code>actions</code> and the{" "}
            <code>footer</code> stay controls of their own above it: no control
            in a control. The focus ring goes around the card.
          </p>
        }
        name="card/clickable"
        title="Clickable cards"
      />
      <Example
        description={
          <p>
            <code>media</code> goes to the top, from edge to edge.{" "}
            <code>loading</code> shows placeholders in place of the media, the
            title, the description and the content, and makes the card{" "}
            <code>aria-busy</code>; the actions and the footer wait for the
            content.
          </p>
        }
        name="card/media-loading"
        title="Media and loading"
      />

      <Section title="Notes">
        <Prose>
          <p>
            A clickable card needs a <code>title</code> - it names the link. A
            link in the content of a clickable card lies under the stretched
            title: give it <code>relative z-10</code> to keep it clickable, or
            better, move it to the <code>actions</code> or the{" "}
            <code>footer</code>. For a plain surface without the parts use a{" "}
            <Link to="/components/panel">Panel</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Card" />
      </Section>
    </DocPage>
  );
}
