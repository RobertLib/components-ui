import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TooltipPage() {
  return (
    <DocPage imports={["Tooltip"]} title="Tooltip">
      <Example
        description={
          <p>
            <code>title</code> is the content (any React node), shown after{" "}
            <code>delay</code> ms of hovering - keyboard focus shows it right
            away, and screen readers read it as the description of the focused
            element.
          </p>
        }
        name="tooltip/positions"
        title="Positions"
      />
      <Example
        description={
          <p>
            <code>openOnClick</code> toggles it on tap, for devices without a
            pointer. <code>interactive</code> keeps it open while the pointer is
            on it, so long content can be scrolled.
          </p>
        }
        name="tooltip/interactive"
        title="Click and interactive tooltips"
      />

      <Section title="Notes">
        <Prose>
          <p>
            The tooltip is rendered in a portal, so it is not clipped by
            containers with <code>overflow: hidden</code>. For richer, clickable
            content use a <code>Popover</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Tooltip" />
      </Section>
    </DocPage>
  );
}
