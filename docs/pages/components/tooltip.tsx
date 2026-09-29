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
      <Example
        description={
          <p>
            One tooltip shows at a time. Once one has shown, the next trigger
            the pointer rests on shows its tooltip at once - also within a
            moment (0.3 s) after the pointer left the last one - so moving along
            a toolbar reads one label after another without waiting for each{" "}
            <code>delay</code>. A tooltip hidden by Escape or a click waits
            again.
          </p>
        }
        name="tooltip/toolbar"
        title="A toolbar - one label after another"
      />
      <Example
        description={
          <p>
            <code>open</code> shows it while <code>true</code>;{" "}
            <code>onOpenChange</code> tells when hover, focus, Escape or a click
            (with <code>openOnClick</code>) would show or hide it. A controlled
            tooltip is left out of the grouping - others do not hide it.
          </p>
        }
        name="tooltip/controlled"
        title="Controlled"
      />

      <Section title="Notes">
        <Prose>
          <p>
            The tooltip is rendered in a portal (into the body, or the{" "}
            <code>portalContainer</code> of <code>UIProvider</code>), so it is
            not clipped by containers with <code>overflow: hidden</code>. For
            richer, clickable content use a <code>Popover</code>.
          </p>
          <p>
            It opens on the other side of its trigger when <code>position</code>{" "}
            has no room, and below or above a side tooltip when neither side has
            it (a phone). <code>start</code> / <code>end</code> follow the
            writing direction of the trigger - <code>end</code>, the default, is
            the left side right to left. It always stays inside the viewport -
            over its trigger at last - and hides while the trigger is scrolled
            out of view (out of the screen or a scrolling container around it).
            It does not show over a modal dialog it is not in - one a shortcut
            opened while the pointer rested on the trigger.
          </p>
          <p>
            The tooltip wraps its children in an inline element as wide as they
            are. To let a child fill its container - a truncated title in a list
            or a table cell - give the tooltip the width:{" "}
            <code>{'<Tooltip className="w-full" …>'}</code> around a{" "}
            <code>w-full truncate</code> child. <code>ref</code> and the other
            props go to that element, which has{" "}
            <code>data-state=&quot;open&quot;</code> or{" "}
            <code>&quot;closed&quot;</code>; the tooltip has{" "}
            <code>data-state=&quot;open&quot;</code> and the side it is shown on
            (<code>data-side</code>). In forced colors (Windows High Contrast),
            which take its background, an outline keeps it apart from the page.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Tooltip" />
      </Section>
    </DocPage>
  );
}
