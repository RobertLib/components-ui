import DocPage, { Callout, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SplitterPage() {
  return (
    <DocPage imports={["Splitter"]} title="Splitter">
      <Example
        description={
          <p>
            Every child is a pane; <code>defaultSizes</code> sets their sizes in
            percent, <code>minSizes</code> / <code>maxSizes</code> their limits.
            Drag a handle with the mouse, a pen or a finger, or focus it and use
            the arrow keys (Shift for steps of 10 %), Home and End. The list
            here is <code>collapsible</code>: dragged below half its minimum it
            collapses, and Enter on the handle collapses and restores it. A
            double click brings back the default sizes. The sizes are remembered
            under the <code>storageKey</code> - resize and reload the page.
            Remembered sizes that no longer fit the limits (saved before a
            minimum was added) are moved into them, and unreadable ones give way
            to <code>defaultSizes</code>. On phones the panes stack.
          </p>
        }
        name="splitter/master-detail"
        title="Master and detail"
      />
      <Example
        description={
          <p>
            <code>orientation="vertical"</code> stacks the panes - give the
            splitter a height. The arrow keys up and down move its handle.
          </p>
        }
        name="splitter/vertical"
        title="Stacked panes"
      />
      <Example
        description={
          <p>
            A handle moves the space between its two neighbors only - the other
            panes keep their sizes. <code>paneLabels</code> name the handles
            after the pane before them. For a grid of panes, put a splitter into
            a pane of another one - with <code>className="h-full"</code>.
          </p>
        }
        name="splitter/three-panes"
        title="Three panes"
      />
      <Example
        description={
          <p>
            With <code>sizes</code> and <code>onSizesChange</code> the parent
            holds the sizes - e.g. to show and hide a panel from a button.{" "}
            <code>onSizesChange</code> comes with every move of a drag.
          </p>
        }
        name="splitter/controlled"
        title="Controlled"
      />

      <Callout title="Keyboard and screen readers">
        <p>
          A handle is a focusable separator (the ARIA window splitter) whose
          value is the size of the pane before it - announced as a percentage,
          with the smallest and largest size it can have. Name the handles with{" "}
          <code>paneLabels</code>; without them they are "Resize pane 1", "… 2".
          Escape cancels a drag. A collapsed pane is hidden and out of the Tab
          order. In a right-to-left page the first pane is on the right: the
          arrow keys and the pointer move the handle the way they point.
        </p>
      </Callout>

      <Callout title="Phones and server rendering">
        <p>
          Below the <code>md</code> breakpoint side-by-side panes stack at their
          natural height, without handles (<code>stackOnMobile</code> turns that
          off). Rendered on the server, a splitter with a{" "}
          <code>storageKey</code> shows <code>defaultSizes</code> and switches
          to the remembered sizes as it hydrates.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="Splitter" />
      </Section>
    </DocPage>
  );
}
