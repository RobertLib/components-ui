import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ButtonPage() {
  return (
    <DocPage imports={["Button"]} title="Button">
      <Example
        description={
          <p>
            <code>variant</code> sets the emphasis: <code>solid</code> for the
            main action, <code>outline</code> for secondary ones and{" "}
            <code>ghost</code> for the least important.
          </p>
        }
        name="button/variants"
        title="Variants"
      />
      <Example
        description={
          <p>
            Colors come from the theme tokens (<code>primary</code>,{" "}
            <code>danger</code>, …) - see Theming to change them.
          </p>
        }
        name="button/colors"
        title="Colors"
      />
      <Example name="button/sizes" title="Sizes and icons" />
      <Example
        description={
          <p>
            <code>loading</code> shows a spinner and disables the button, so a
            form cannot be submitted twice.
          </p>
        }
        name="button/loading"
        title="Loading and disabled"
      />
      <Example
        description={
          <p>
            With <code>link</code> the button is rendered as the router link
            configured in <code>UIProvider</code> - a React Router, Next.js or
            plain <code>&lt;a&gt;</code> link.
          </p>
        }
        name="button/link"
        title="As a link"
      />

      <Section title="Accessibility">
        <Prose>
          <ul>
            <li>
              The default <code>type</code> is <code>"button"</code>, so a
              button inside a form does not submit it by accident - pass{" "}
              <code>type="submit"</code> for the submit button.
            </li>
            <li>
              An icon-only button needs an <code>aria-label</code>.
            </li>
            <li>
              A disabled link is removed from the tab order and does not
              navigate.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Button" />
      </Section>
    </DocPage>
  );
}
