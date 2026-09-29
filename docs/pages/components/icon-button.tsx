import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function IconButtonPage() {
  return (
    <DocPage imports={["IconButton"]} title="IconButton">
      <Example
        description={
          <p>
            <code>color</code> colors the icon - it was <code>variant</code>,
            which still works for now.
          </p>
        }
        name="icon-button/colors"
        title="Colors"
      />
      <Example
        description={
          <p>
            Without a <code>size</code> the button is as big as the icon given,
            with a small padding that takes no room from the layout - it fits
            into a header or a row. With <code>sm</code>, <code>md</code> or{" "}
            <code>lg</code> it is as high as a <code>Button</code> of the same
            size and draws its icon at 16, 18 or 20 px, so that the two line up
            in a toolbar.
          </p>
        }
        name="icon-button/sizes"
        title="Sizes"
      />
      <Example
        description={
          <p>
            <code>loading</code> swaps the icon for a spinner and makes the
            button do nothing - it keeps the focus. <code>tooltip</code> shows
            the name for sighted users too: <code>true</code> shows the{" "}
            <code>aria-label</code>, a text names a button without one and shows
            it. Other content is a tooltip that describes the button.
          </p>
        }
        name="icon-button/states"
        title="Loading, disabled and tooltips"
      />
      <Example
        description={
          <p>
            With <code>href</code> the button is a link rendered by the router
            of <code>UIProvider</code>, like <code>Button</code> with{" "}
            <code>link</code>. A disabled link has no <code>href</code> -
            nothing opens it, and Tab skips it.
          </p>
        }
        name="icon-button/link"
        title="Links"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            An icon alone says nothing to a screen reader - always name the
            button with an <code>aria-label</code> or a text{" "}
            <code>tooltip</code>. The focus ring shows for keyboard focus only (
            <code>focus-visible</code>).
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="IconButton" />
      </Section>
    </DocPage>
  );
}
