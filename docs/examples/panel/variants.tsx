import { Panel } from "components-ui";

export default function Variants() {
  return (
    <div className="grid gap-4 bg-neutral-100 p-4 sm:grid-cols-3 dark:bg-neutral-950">
      <Panel>Default</Panel>
      <Panel border="neutral" shadow="none">
        Neutral border, no shadow
      </Panel>
      <Panel rounded="2xl" shadow="xl">
        Rounded 2xl, shadow xl
      </Panel>
    </div>
  );
}
