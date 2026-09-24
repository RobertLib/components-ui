import { useState } from "react";
import { Button, useSnackbar, type SnackbarId } from "components-ui";

export default function Close() {
  const [syncId, setSyncId] = useState<SnackbarId | null>(null);
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const start = () =>
    setSyncId(
      enqueueSnackbar("The price list is synchronized with the ERP.", "info", {
        persist: true,
        title: "Synchronizing",
      }),
    );

  const finish = () => {
    if (syncId !== null) closeSnackbar(syncId);
    setSyncId(null);
    enqueueSnackbar("1,204 prices were updated.", "success", {
      title: "Synchronized",
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={syncId !== null} onClick={start}>
        Start synchronizing
      </Button>
      <Button disabled={syncId === null} onClick={finish} variant="outline">
        Finish
      </Button>
      <Button onClick={() => closeSnackbar()} variant="ghost">
        Close all toasts
      </Button>
    </div>
  );
}
