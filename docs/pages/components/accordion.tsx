import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function AccordionPage() {
  return (
    <DocPage
      imports={["Accordion", "AccordionGroup", "CollapsibleContent"]}
      title="Accordion"
    >
      <Example
        description={
          <p>
            <code>defaultOpen</code> sets whether the section starts expanded -
            or control it with <code>open</code> and <code>onOpenChange</code>.
            A click anywhere on the header toggles it - except on links, buttons
            and fields in it; from the keyboard, the button at its end does. The
            header is a heading for screen readers, who move between the
            sections by their headings - of level 3, or{" "}
            <code>headingLevel</code>; a header that is a heading element itself
            (<code>&lt;h2&gt;</code>) keeps its own.
          </p>
        }
        name="accordion/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>AccordionGroup</code> opens the accordions in it together:
            with <code>type="single"</code> (the default) opening a section
            closes the open one. Name the sections with <code>value</code> - the{" "}
            <code>defaultValue</code> of the group opens one at first. Without{" "}
            <code>collapsible</code> the open section stays open until another
            one opens; its toggle then says it cannot be used (
            <code>aria-disabled</code>).
          </p>
        }
        name="accordion/group"
        title="Accordion group"
      />
      <Example
        description={
          <p>
            With <code>type="multiple"</code> any of the sections can be open;{" "}
            <code>value</code> and <code>onValueChange</code> then work with
            arrays of the open ones. Pass <code>value</code> to control the
            group - here to expand or collapse all of it.
          </p>
        }
        name="accordion/group-multiple"
        title="Several open sections"
      />
      <Example
        description={
          <p>
            <code>CollapsibleContent</code> is the animation the accordion uses
            - drive it with your own state and trigger. For users who prefer
            reduced motion it opens and closes without the animation.
          </p>
        }
        name="accordion/collapsible"
        title="CollapsibleContent"
      />

      <Section title="Keyboard">
        <Prose>
          <p>
            Tab reaches the toggle button of each section; Enter or Space opens
            and closes it. In an <code>AccordionGroup</code> the arrow keys move
            between the toggles of its sections (up / down, around the ends),
            Home / End to the first / last one - as the WAI-ARIA accordion
            pattern describes. An accordion nested in the content of a section
            is on its own: it does not join the group, and the arrow keys skip
            it. In a group, the group opens and closes the sections - the{" "}
            <code>open</code> and <code>defaultOpen</code> of an accordion are
            ignored there.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Accordion" />
        <PropsTable of="AccordionGroup" />
        <PropsTable of="CollapsibleContent" />
      </Section>
    </DocPage>
  );
}
