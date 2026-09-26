import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ContextMenuPage() {
  return (
    <DocPage imports={["ContextMenu"]} title="ContextMenu">
      <Example
        description={
          <p>
            Wrap the element the menu belongs to. A right click opens the menu
            at the pointer, a long press opens it on a touch screen, and Shift +
            F10 or the context menu key open it below the focused element with
            its first item highlighted - make the element focusable with{" "}
            <code>tabIndex={"{0}"}</code>. The items are those of{" "}
            <code>Dropdown</code>: icons, shortcuts, separators, submenus,
            checkboxes and radio options, and the same keys.
          </p>
        }
        name="context-menu/file-list"
        title="A file list"
      />
      <Example
        description={
          <p>
            A single element - a <code>&lt;tr&gt;</code> here - gets the event
            handlers itself, so the table keeps its markup; anything else is
            wrapped in a <code>&lt;div&gt;</code>. <code>onOpenChange</code>{" "}
            tells when the menu opens and closes, e.g. to mark the row.
          </p>
        }
        name="context-menu/table-rows"
        title="Table rows"
      />

      <Section title="Behavior">
        <Prose>
          <ul>
            <li>
              The menu closes on Escape (a submenu first), on a press outside,
              when the page scrolls or resizes, and after a pick. The focus goes
              back to where it was before the menu opened - to the Tab stop next
              to it when the pick removed that element (a deleted row). Tab
              leaves the menu as if it were not there, Shift + Tab goes back to
              that element.
            </li>
            <li>
              Right to left - the page, or a part of it with{" "}
              <code>dir=&quot;rtl&quot;</code> - it opens from the pointer to
              the left, and ArrowLeft opens its submenus.
            </li>
            <li>
              The browser's own menu shows while <code>disabled</code>, without
              items, and over the menu itself no second menu opens. Of nested
              context menus - a cell in a row - the innermost one opens.
            </li>
            <li>
              A long press is a touch held still for half a second - a finger
              that moves scrolls the page instead. The element does not select
              its text on touch screens, so the press is not taken for a
              selection.
            </li>
            <li>
              The keys the menu uses do not reach the page, so a list or a table
              with keys of its own stays where it is. The handlers the element
              has run first; one that calls <code>preventDefault()</code> keeps
              the menu closed.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="ContextMenu" />
      </Section>
    </DocPage>
  );
}
