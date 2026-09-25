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
            <code>danger</code>, …) - see Theming to change them. Every text
            reaches the 4.5:1 contrast of WCAG AA against its fill, also on
            hover - which is why <code>warning</code> is yellow with dark text.
            The focus ring of a filled button keeps a gap to the fill.
          </p>
        }
        name="button/colors"
        title="Colors"
      />
      <Example
        description={
          <p>
            <code>size="icon"</code> is a square button for a single icon - name
            it with <code>aria-label</code>.
          </p>
        }
        name="button/sizes"
        title="Sizes"
      />
      <Example
        description={
          <p>
            <code>startIcon</code> and <code>endIcon</code> sit next to the
            label with a spacing that fits the size. They are decorative - the
            label names the button. While <code>loading</code>, the spinner
            takes the place of the start icon.
          </p>
        }
        name="button/icons"
        title="Icons"
      />
      <Example
        description={
          <p>
            <code>loading</code> shows a spinner and makes the button do
            nothing, so a form cannot be submitted twice. Unlike{" "}
            <code>disabled</code> it keeps the focus - the keyboard stays on the
            button just pressed.
          </p>
        }
        name="button/loading"
        title="Loading and disabled"
      />
      <Example
        description={
          <p>
            <code>fullWidth</code> stretches the button to its container, e.g.
            in a narrow form or on a phone.
          </p>
        }
        name="button/full-width"
        title="Full width"
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
              An icon-only button needs an <code>aria-label</code>; the icons of{" "}
              <code>startIcon</code> / <code>endIcon</code> are hidden from
              screen readers.
            </li>
            <li>
              A disabled link is removed from the tab order and does not
              navigate - nor open in a new tab by a middle click or a drag.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Notes">
        <Prose>
          <p>
            Buttons joined into one piece are a <code>ButtonGroup</code> - it
            can also set the <code>size</code>, <code>variant</code> and{" "}
            <code>color</code> of the buttons that do not set their own. A main
            action with a menu of related ones is a <code>SplitButton</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Button" />
      </Section>
    </DocPage>
  );
}
