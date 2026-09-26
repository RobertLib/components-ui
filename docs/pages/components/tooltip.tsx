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
            pointer. Every tooltip stays open while the pointer moves onto it
            and hides a moment after it is left; <code>interactive</code> also
            keeps it open on a click in it, so long content can be scrolled.
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
          <p>
            It opens on the other side of its trigger when <code>position</code>{" "}
            has no room, and below or above a <code>left</code> /{" "}
            <code>right</code> tooltip when neither side has it (a phone). It
            always stays inside the viewport - over its trigger at last. It does
            not show over a modal dialog it is not in - one a shortcut opened
            while the pointer rested on the trigger.
          </p>
          <p>
            The tooltip wraps its children in an inline element as wide as they
            are. To let a child fill its container - a truncated title in a list
            or a table cell - give the tooltip the width:{" "}
            <code>{'<Tooltip className="w-full" …>'}</code> around a{" "}
            <code>w-full truncate</code> child.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Tooltip" />
      </Section>
    </DocPage>
  );
}
