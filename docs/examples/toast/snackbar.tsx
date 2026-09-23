import { Button, useSnackbar } from "components-ui";

// Needs a <SnackbarProvider> above - see Installation
export default function Snackbar() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => enqueueSnackbar("Changes saved", "success")}>
        Success
      </Button>
      <Button
        color="danger"
        onClick={() => enqueueSnackbar("Could not delete the file", "error")}
      >
        Error
      </Button>
      <Button
        color="warning"
        onClick={() => enqueueSnackbar("Your session expires soon", "warning")}
      >
        Warning
      </Button>
      <Button
        color="secondary"
        onClick={() => enqueueSnackbar("A new version is available", "info")}
      >
        Info
      </Button>
      <Button
        color="default"
        onClick={() =>
          enqueueSnackbar("Stays until dismissed", "default", { persist: true })
        }
      >
        Persistent
      </Button>
    </div>
  );
}
