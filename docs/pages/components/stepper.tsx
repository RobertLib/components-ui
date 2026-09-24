import DocPage, { Callout, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function StepperPage() {
  return (
    <DocPage imports={["Stepper", "type StepperStep"]} title="Stepper">
      <Example
        description={
          <p>
            The steps before the current one are completed unless{" "}
            <code>isCompleted</code> says otherwise. <code>icon</code> takes any
            icon component (lucide-react, heroicons, your own SVG). Without{" "}
            <code>onStepClick</code> the steps only show the progress - they are
            no buttons. The horizontal stepper is compact: the{" "}
            <code>title</code> and <code>description</code> of a step are its
            tooltip.
          </p>
        }
        name="stepper/wizard"
        title="A wizard"
      />
      <Example
        description={
          <p>
            The state is not told by color alone: screen readers hear the
            current step (<code>aria-current="step"</code>) and "Completed" or
            "Error" after the name of a step.
          </p>
        }
        name="stepper/numbers"
        title="Numbers and errors"
      />
      <Example
        description={
          <p>
            <code>orientation="vertical"</code> lists the steps under each other
            and writes out their titles and descriptions.
          </p>
        }
        name="stepper/vertical"
        title="Vertical"
      />
      <Example
        description={
          <p>
            The <code>content</code> of the current step is shown right under it
            - a vertical wizard, with the fields and the buttons of each step in
            its content. Only the content of the current step is rendered, so
            keep the values of the steps in state (or a form library). When the
            step changes while the focus is in the content of the last one - a
            "Next" button - the focus moves to the content of the new step,
            which is a group named after it, instead of being lost.
          </p>
        }
        name="stepper/vertical-wizard"
        title="A vertical wizard"
      />
      <Example
        description={
          <p>
            <code>orientation="responsive"</code> is horizontal from the{" "}
            <code>md</code> breakpoint, with the <code>content</code> of the
            current step under the row, and vertical on phones - where a row of
            many steps gets cramped. Narrow the window to see it switch.
          </p>
        }
        name="stepper/responsive"
        title="Responsive"
      />

      <Callout title="Responsive layout and server rendering">
        <p>
          The layout of <code>orientation="responsive"</code> follows{" "}
          <code>useIsMobile()</code>. A page rendered on the server starts
          horizontal and switches to the column once it hydrates on a phone -
          its content is then mounted again, like when a tablet turns across the
          breakpoint. Keep the values of the steps in state, as a wizard does
          anyway.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="Stepper" />
        <PropsTable of="StepperStep" />
      </Section>
    </DocPage>
  );
}
