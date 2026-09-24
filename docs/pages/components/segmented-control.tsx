import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SegmentedControlPage() {
  return (
    <DocPage imports={["SegmentedControl"]} title="SegmentedControl">
      <Example
        description={
          <p>
            A choice of one of a few short options - a period, a view, a filter.
            Controlled with <code>value</code> + <code>onChange</code>, which
            gets the value of the option (a number stays a number), or
            uncontrolled with <code>defaultValue</code>.
          </p>
        }
        name="segmented-control/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            An <code>icon</code> goes before the label. An option with an icon
            alone needs an <code>aria-label</code> - its accessible name, and
            the tooltip that tells mouse users what the icon means.
          </p>
        }
        name="segmented-control/icons"
        title="Icons"
      />
      <Example
        description={
          <p>
            <code>size</code> matches the sizes of <code>Tabs</code>;{" "}
            <code>fullWidth</code> stretches the bar and shares its width among
            the options. Options can be <code>disabled</code> one by one or all
            at once.
          </p>
        }
        name="segmented-control/sizes"
        title="Sizes and states"
      />
      <Example
        description={
          <p>
            With a <code>label</code> the bar is in a{" "}
            <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code>.
            The form submits the picked value under <code>name</code>;{" "}
            <code>required</code> is enforced by the browser, and a reset brings
            back the <code>defaultValue</code>.
          </p>
        }
        name="segmented-control/form"
        title="In a form"
      />

      <Section title="Keyboard">
        <Prose>
          <p>
            Radios underneath, as in the radio group pattern of WAI-ARIA: the
            control is one tab stop - the picked option, or the first one while
            none is picked - and the arrow keys move to the next or the previous
            option and pick it, skipping the disabled ones. Space picks the
            focused option.
          </p>
        </Prose>
      </Section>

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The selection slides to the picked option; for users who prefer
              reduced motion it moves at once. Until the page is hydrated, the
              picked option of a server-rendered control has a background of its
              own.
            </li>
            <li>
              On a narrow screen a bar wider than its container scrolls sideways
              - keep the options few and short, or use <code>fullWidth</code>.
            </li>
            <li>
              For switching the content of a page (tab panels) use{" "}
              <code>Tabs</code>; for more options, or ones with descriptions,{" "}
              <code>RadioGroup</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <Prose>
          <p>
            <code>T</code> is the type of the option values -{" "}
            <code>string</code>, <code>number</code> or a union of literals,
            inferred from <code>options</code> and <code>value</code>.
          </p>
        </Prose>
        <PropsTable of="SegmentedControl" />
        <PropsTable of="SegmentedControlOption" />
      </Section>
    </DocPage>
  );
}
