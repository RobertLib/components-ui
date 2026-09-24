import { useState } from "react";
import { Button, Switch, useSnackbar } from "components-ui";

// The API call - fails while the switch is on
const exportReport = (fail: boolean) =>
  new Promise<{ fileName: string }>((resolve, reject) =>
    setTimeout(
      () =>
        fail
          ? reject(new Error("The server is not reachable"))
          : resolve({ fileName: "sales-2026-09.xlsx" }),
      1500,
    ),
  );

export default function PromiseToast() {
  const [fail, setFail] = useState(false);
  const { promise } = useSnackbar();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        onClick={() =>
          promise(exportReport(fail), {
            error: (error) => `The export failed: ${(error as Error).message}`,
            loading: "Exporting the report…",
            success: (report) => `${report.fileName} is ready`,
          })
        }
      >
        Export report
      </Button>
      <Switch
        checked={fail}
        label="The server fails"
        onChange={(event) => setFail(event.target.checked)}
      />
    </div>
  );
}
