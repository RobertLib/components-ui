import DocPage, { Section } from "../../components/doc-page";
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
            no buttons.
          </p>
        }
        name="stepper/wizard"
        title="A wizard"
      />
      <Example name="stepper/numbers" title="Numbers and errors" />
      <Section title="Props">
        <PropsTable of="Stepper" />
        <PropsTable of="StepperStep" />
      </Section>
    </DocPage>
  );
}
