import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SplitButtonPage() {
  return (
    <DocPage imports={["SplitButton"]} title="SplitButton">
      <Example
        description={
          <p>
            <code>onClick</code> runs the main action; the chevron opens a menu
            of related ones - <code>items</code> are those of{" "}
            <code>Dropdown</code>. <code>loading</code> shows the spinner on the
            main button and disables both, so no other action starts meanwhile.
          </p>
        }
        name="split-button/basic"
        title="Save with more options"
      />
      <Example
        description={
          <p>
            <code>color</code>, <code>variant</code>, <code>size</code> and{" "}
            <code>disabled</code> apply to both buttons.
          </p>
        }
        name="split-button/variants"
        title="Colors, variants and sizes"
      />

      <Section title="Accessibility">
        <Prose>
          <ul>
            <li>
              The two buttons are a group named by the main action; the menu
              button is named "More options" in the language of the app -{" "}
              <code>toggleLabel</code> changes it, e.g. to tell several split
              buttons apart.
            </li>
            <li>
              The menu button opens the menu with Enter, Space or ArrowDown at
              its first item, like a <code>Dropdown</code>, and Escape gives the
              focus back to it.
            </li>
            <li>
              The props of a button - <code>type="submit"</code>,{" "}
              <code>name</code>, <code>startIcon</code>, … - go to the main
              button; <code>className</code> and <code>style</code> to the
              group.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="SplitButton" />
      </Section>
    </DocPage>
  );
}
