import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SpinnerPage() {
  return (
    <DocPage
      description="Loading indicators: a spinner for short waits and skeletons that keep the layout while content loads."
      imports={["Spinner", "Skeleton"]}
      title="Spinner & Skeleton"
    >
      <Example name="spinner/basic" title="Spinners and skeletons" />
      <Section title="Props">
        <PropsTable of="Spinner" />
        <PropsTable of="Skeleton" />
      </Section>
    </DocPage>
  );
}
