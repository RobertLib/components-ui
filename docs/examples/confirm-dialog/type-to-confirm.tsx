import {
  Button,
  ConfirmProvider,
  useConfirm,
  useSnackbar,
} from "components-ui";

function DangerZone() {
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();

  const handleDelete = async () => {
    const confirmed = await confirm({
      confirmColor: "danger",
      confirmLabel: "Delete the project",
      // Typed exactly before the button enables
      confirmationText: "acme-website",
      message:
        "The project, its 214 files and its history will be deleted for good.",
      title: "Delete acme-website?",
    });
    if (confirmed) enqueueSnackbar("The project was deleted", "success");
  };

  return (
    <Button color="danger" onClick={handleDelete}>
      Delete the project
    </Button>
  );
}

// In an app, render <ConfirmProvider> once near the root - this example
// brings its own
export default function TypeToConfirm() {
  return (
    <ConfirmProvider>
      <DangerZone />
    </ConfirmProvider>
  );
}
