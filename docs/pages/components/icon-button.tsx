import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function IconButtonPage() {
  return (
    <DocPage imports={["IconButton"]} title="IconButton">
      <Example name="icon-button/variants" title="Variants" />
      <Example
        description={
          <p>
            <code>loading</code> swaps the icon for a spinner and disables the
            button. Combine it with a <code>Tooltip</code> to name the action
            for sighted users too.
          </p>
        }
        name="icon-button/states"
        title="Loading, disabled and tooltips"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            An icon alone says nothing to a screen reader - always pass an{" "}
            <code>aria-label</code>. The focus ring shows for keyboard focus
            only (<code>focus-visible</code>).
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="IconButton" />
      </Section>
    </DocPage>
  );
}
