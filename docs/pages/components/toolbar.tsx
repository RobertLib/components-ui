import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ToolbarPage() {
  return (
    <DocPage
      description="The actions of a view in a row - what does not fit moves into a More menu."
      imports={["Toolbar"]}
      title="Toolbar"
    >
      <Example
        description={
          <>
            <p>
              The items are data: buttons (a command with <code>onClick</code>,
              a link with <code>href</code>), toggles (
              <code>type: "toggle"</code>, a button with{" "}
              <code>aria-pressed</code>), separators and custom content. The
              buttons take the <code>size</code>, <code>variant</code> (
              <code>ghost</code> by default) and <code>color</code> of the
              toolbar, or their own. A button with <code>iconOnly</code> shows
              its icon alone - the label names it and shows in a tooltip.
            </p>
            <p>
              The items the row has no room for move into a "More" menu at its
              end, and back as it widens - those of the lowest{" "}
              <code>priority</code> first (0 by default), of the same priority
              those at the end; <code>Infinity</code> keeps an item in the row.
              In the menu a button is an item with its icon and label (red with{" "}
              <code>color: "danger"</code>), a toggle a checkbox, and a
              separator divides their groups. <code>menuOnly</code> items are
              always in the menu - actions used rarely, like "Archive" or
              "Delete".
            </p>
          </>
        }
        name="toolbar/basic"
        title="Actions of a view"
      />
      <Example
        description={
          <p>
            <code>type: "custom"</code> renders content of your own -{" "}
            <code>render</code> gets the props to spread on its control, so that
            the arrow keys of the toolbar reach it. In a text field they move
            the caret, and on along the toolbar at the end of the text (the
            start for the previous item); a select keeps the up and down arrows.
            In the menu the item becomes its <code>menuItem</code> - an item,
            radio options (<code>{`{ type: "radio" }`}</code>) or an element of
            the <Link to="/components/dropdown">Dropdown</Link>; without one it
            stays in the row.
          </p>
        }
        name="toolbar/custom"
        title="Custom content"
      />

      <Section title="Notes">
        <Prose>
          <p>
            The toolbar is <code>role="toolbar"</code> and one stop of Tab - it
            stops at the item the focus was on last. The arrow keys move along
            the items in the row and the "More" button, around the ends, past
            the disabled items; in a right-to-left page the left arrow moves on.
            Home and End go to the first and the last one. ArrowDown, Enter or
            Space open the menu. An item with the focus that moves into the menu
            leaves it to the "More" button. Name the toolbar with{" "}
            <code>aria-label</code>.
          </p>
          <p>
            The toolbar takes the width of its container - in a flex row give it
            the room (<code>className="min-w-0 flex-1"</code>). It measures its
            items in the page and follows its size (a{" "}
            <code>ResizeObserver</code>), also as a label changes or a web font
            loads. Rendered on the server, all items are in the row until the
            page is laid out. A toolbar is left out when the page is printed -
            add <code>print:flex!</code> to keep one.
          </p>
          <p>
            For a few buttons joined into one piece use a{" "}
            <Link to="/components/button-group">ButtonGroup</Link>, for an
            application menu a <Link to="/components/menubar">Menubar</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Toolbar" />
        <PropsTable of="ToolbarButtonItem" />
        <PropsTable of="ToolbarToggleItem" />
        <PropsTable of="ToolbarCustomItem" />
        <PropsTable of="ToolbarSeparatorItem" />
      </Section>
    </DocPage>
  );
}
