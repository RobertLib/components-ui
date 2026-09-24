import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ButtonGroupPage() {
  return (
    <DocPage imports={["ButtonGroup"]} title="ButtonGroup">
      <Example
        description={
          <p>
            The buttons are joined into one piece: only the outer corners are
            round and the borders overlap. <code>color</code>, <code>size</code>{" "}
            and <code>variant</code> go to the buttons that do not set their
            own. A <code>Dropdown</code> with a <code>Button</code> trigger (or
            a <code>Tooltip</code> around one) joins the group like a button.
          </p>
        }
        name="button-group/basic"
        title="Record actions"
      />
      <Example
        description={
          <p>
            A button of the group can still set its own color. Toggle buttons
            tell their state with <code>aria-pressed</code>.
          </p>
        }
        name="button-group/variants"
        title="Colors, sizes and toggle buttons"
      />
      <Example
        description={
          <p>
            <code>orientation="vertical"</code> joins the buttons in a column,
            as wide as the widest of them.
          </p>
        }
        name="button-group/vertical"
        title="Vertical"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            The group is a <code>role="group"</code> - name it with{" "}
            <code>aria-label</code> (or <code>aria-labelledby</code>), so a
            screen reader tells what its buttons are for. Each button stays a
            tab stop of its own; the focused and the hovered button come to the
            front, so their focus ring and border show whole.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="ButtonGroup" />
      </Section>
    </DocPage>
  );
}
