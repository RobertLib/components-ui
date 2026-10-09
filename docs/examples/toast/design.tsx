import { Button, SnackbarProvider, useSnackbar } from "components-ui";

function Notify() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => enqueueSnackbar("Grade 5th Kyu recorded", "success")}
      >
        Save
      </Button>
      <Button
        color="default"
        onClick={() => enqueueSnackbar("The connection failed", "danger")}
        variant="outline"
      >
        Fail
      </Button>
    </div>
  );
}

// The toasts of a design - a short dark confirmation with its icon, while
// errors keep their colors and stay to be read. In an app, set this up on
// the one SnackbarProvider near the root.
export default function Design() {
  return (
    <SnackbarProvider
      classNames={{
        success:
          "rounded-lg border-neutral-900 bg-neutral-900 text-white **:data-toast-close:text-neutral-400 **:data-toast-icon:text-success-400",
      }}
      durations={{ success: 1800 }}
      icons
      position="bottom-center"
    >
      <Notify />
    </SnackbarProvider>
  );
}
