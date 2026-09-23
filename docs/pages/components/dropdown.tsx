import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function DropdownPage() {
  return (
    <DocPage imports={["Dropdown", "type DropdownItem"]} title="Dropdown">
      <Example
        description={
          <p>
            Items are <code>{"{ label, onClick }"}</code> objects. The menu
            opens on click, the arrow keys move through it, Enter picks an item
            and Escape closes it.
          </p>
        }
        name="dropdown/basic"
        title="Actions menu"
      />
      <Example
        description={
          <p>
            An item with <code>href</code> is a link rendered by the router
            configured in <code>UIProvider</code>. Any React element is rendered
            as it is - the arrow keys also reach one with a control (a switch, a
            button), which then takes the focus - and <code>false</code> /{" "}
            <code>null</code> entries are skipped, so conditional items are just{" "}
            <code>{"cond && item"}</code>.
          </p>
        }
        name="dropdown/custom-items"
        title="Links, custom content and conditional items"
      />

      <Section title="Notes">
        <Prose>
          <p>
            The menu is a <code>Popover</code> rendered into{" "}
            <code>document.body</code>, so it is never clipped by a table or a
            scrolling container. It aligns to the right edge of the trigger and
            flips upwards when there is no room below.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Dropdown" />
        <PropsTable of="DropdownItem" />
      </Section>
    </DocPage>
  );
}
