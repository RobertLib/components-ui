import { Button, ButtonGroup, useSnackbar } from "components-ui";

export default function Vertical() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="max-w-60 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="mb-3 text-sm">
        Travel expenses, Brno - <strong>4&nbsp;820&nbsp;Kč</strong>
      </p>
      <ButtonGroup
        aria-label="Review of the expense report"
        className="w-full"
        color="default"
        orientation="vertical"
        variant="outline"
      >
        <Button onClick={() => enqueueSnackbar("Approved", "success")}>
          Approve
        </Button>
        <Button onClick={() => enqueueSnackbar("Changes requested")}>
          Request changes
        </Button>
        <Button onClick={() => enqueueSnackbar("Rejected", "error")}>
          Reject
        </Button>
      </ButtonGroup>
    </div>
  );
}
