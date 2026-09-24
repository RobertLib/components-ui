import { SplitButton, useSnackbar } from "components-ui";

export default function Variants() {
  const { enqueueSnackbar } = useSnackbar();
  const items = [
    { label: "Schedule…", onClick: () => enqueueSnackbar("Schedule clicked") },
    { label: "Send a test", onClick: () => enqueueSnackbar("Test sent") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SplitButton items={items} size="sm">
        Publish
      </SplitButton>
      <SplitButton color="default" items={items} variant="outline">
        Export
      </SplitButton>
      <SplitButton color="success" items={items} size="lg">
        Approve
      </SplitButton>
      <SplitButton disabled items={items}>
        Merge
      </SplitButton>
    </div>
  );
}
