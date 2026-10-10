import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";
export default function MenubarPage() {
  return (
    <DocPage imports={["Menubar", "type MenubarMenu"]} title="Menubar">
      <Example
        name="menubar/basic"
        title="Application commands"
        description={
          <p>
            Each menu uses the same commands, links, separators, checkboxes,
            radios and nested submenus as <code>Dropdown</code>. Supply stable
            unique menu ids and an accessible name for the bar.
          </p>
        }
      />
      <Section title="Keyboard and state">
        <Prose>
          <p>
            The bar has one Tab stop. Left and Right wrap between enabled menus,
            Home and End choose the first or last menu, and typing a name
            selects a menu. Enter, Space or Down opens its commands. When a menu
            is open, arrows on a top-level command switch menus; nested submenus
            keep their own arrow navigation, and so does a control in custom
            content (the caret of a field). Escape closes the menu and restores
            focus.
          </p>
          <p>
            Hovering another trigger switches the open menu. RTL reverses
            horizontal arrows. Use <code>openMenu</code> and{" "}
            <code>onOpenMenuChange</code> for controlled state, or{" "}
            <code>defaultOpenMenu</code> for an initially open menu.
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="Menubar" />
        <PropsTable of="MenubarMenu" />
      </Section>
    </DocPage>
  );
}
