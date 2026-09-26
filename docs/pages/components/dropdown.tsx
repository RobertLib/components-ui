import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function DropdownPage() {
  return (
    <DocPage
      imports={["Dropdown", "type DropdownEntry", "type DropdownItem"]}
      title="Dropdown"
    >
      <Example
        description={
          <p>
            Items are <code>{"{ label, onClick }"}</code> objects. The menu
            opens on click, or from the keyboard (Enter, Space, ArrowDown) at
            its first item - ArrowUp opens it at the last one. The arrow keys
            and Home / End move through it, typed letters jump to the next item
            starting with them, Enter or Space picks an item (a link item is
            followed as on a click) and Escape closes it. Tab and Shift+Tab
            leave the menu as if it followed the trigger. A trigger without text
            is named with <code>aria-label</code> - it names the menu too.
          </p>
        }
        name="dropdown/basic"
        title="Actions menu"
      />
      <Example
        description={
          <p>
            <code>icon</code> goes before the label, <code>description</code>{" "}
            under it and <code>shortcut</code> at the end, in the notation of
            the platform (the syntax of <code>Kbd</code>). The shortcut is
            announced by <code>aria-keyshortcuts</code> but only shown - the
            menu does not listen for it; handle it in the app with{" "}
            <code>matchesShortcut</code>. <code>danger</code> marks a
            destructive action. A <code>disabled</code> item stays reachable
            with the arrow keys, as the ARIA menu pattern asks - screen readers
            announce it as unavailable - but cannot be picked.{" "}
            <code>{'{ type: "separator" }'}</code> draws a line.
          </p>
        }
        name="dropdown/rich-items"
        title="Icons, shortcuts and descriptions"
      />
      <Example
        description={
          <p>
            An item with <code>checked</code> is a checkbox;{" "}
            <code>{'{ type: "radio", value, onChange, options }'}</code> is a
            group of options of which one is checked, and{" "}
            <code>{'{ type: "group", label, items }'}</code> puts items under a
            heading that names their group. Space toggles a checkbox or checks
            an option and keeps the menu open; Enter and a click close it -
            unless the item has <code>keepOpen</code>. The app holds the state:
            pass the current <code>checked</code> / <code>value</code> back.
          </p>
        }
        name="dropdown/checkable"
        title="Checkboxes, radio options and groups"
      />
      <Example
        description={
          <p>
            <code>items</code> on an item opens a submenu next to it - after a
            moment of hovering, on a click or tap, or with ArrowRight, Enter or
            Space, which move the focus into it. ArrowLeft or Escape close it
            and go back to its item. The pointer can cross other items on its
            way to an open submenu. A submenu opens to the left near the right
            edge of the screen, and below its item where there is room on
            neither side, as on a phone. In a right-to-left page (or part of
            one, <code>dir=&quot;rtl&quot;</code>) all of it is mirrored:
            ArrowLeft opens a submenu, ArrowRight closes it, and it opens to the
            left.
          </p>
        }
        name="dropdown/submenus"
        title="Submenus"
      />
      <Example
        description={
          <p>
            A <code>Button</code> or an <code>IconButton</code> as the trigger
            takes <code>buttonTrigger</code>: it becomes the menu button itself
            instead of a button wrapped around another one. A button with a menu
            next to a main action is a <code>SplitButton</code>.
          </p>
        }
        name="dropdown/button-trigger"
        title="A button as the trigger"
      />
      <Example
        description={
          <p>
            An item with <code>href</code> is a link rendered by the router
            configured in <code>UIProvider</code>. Any React element is rendered
            as it is - the arrow keys also reach one with a control (a switch, a
            button), which then takes the focus - and <code>false</code> /{" "}
            <code>null</code> entries are skipped, so conditional items are just{" "}
            <code>{"cond && item"}</code>. Custom content keeps its own roles -
            an <code>&lt;hr&gt;</code> is a separator of the menu.
          </p>
        }
        name="dropdown/custom-items"
        title="Links, custom content and conditional items"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The menu is a <code>Popover</code> rendered into{" "}
              <code>document.body</code>, so it is never clipped by a table or a
              scrolling container. It aligns to the right edge of the trigger,
              flips upwards when there is no room below and scrolls when it is
              taller than 24rem or the room. Closed with the focus in it - also
              after a pick in a submenu - it gives the focus back to the
              trigger, or to the Tab stop next to it when the pick removed the
              trigger with its row.
            </li>
            <li>
              The menu takes the focus when it opens - opened with the mouse (or
              by a screen reader clicking the trigger) with no item highlighted,
              from the keyboard with its first one. The focus stays on the menu,
              which announces its highlighted item (
              <code>aria-activedescendant</code>); the pointer and the keys move
              the same highlight. Submenus are overlays of their own: Escape
              closes the innermost one first.
            </li>
            <li>
              The same items build a <code>ContextMenu</code> and the menu of a{" "}
              <code>SplitButton</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Dropdown" />
        <PropsTable of="DropdownItem" />
        <PropsTable of="DropdownGroup" />
        <PropsTable of="DropdownRadioGroup" />
        <PropsTable of="DropdownRadioOption" />
      </Section>
    </DocPage>
  );
}
