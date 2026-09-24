import { useState } from "react";
import {
  Button,
  ConfirmProvider,
  Switch,
  useConfirm,
  useSnackbar,
} from "components-ui";

// The API call - fails while the switch is on
const archiveProject = (fail: boolean) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error("Offline")) : resolve()), 1000),
  );

function ProjectActions() {
  const [fail, setFail] = useState(true);
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();

  const handleArchive = async () => {
    const archived = await confirm({
      confirmLabel: "Archive",
      message: "The project moves to the archive with all its tasks.",
      // Runs before the dialog closes, with a spinner on the button
      onConfirm: async () => {
        try {
          await archiveProject(fail);
        } catch {
          enqueueSnackbar("The project could not be archived", "error");
          return false; // keeps the dialog open - try again or cancel
        }
      },
      title: "Archive the project?",
    });
    if (archived) enqueueSnackbar("The project was archived", "success");
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button onClick={handleArchive}>Archive project</Button>
      <Switch
        checked={fail}
        label="The server fails"
        onChange={(event) => setFail(event.target.checked)}
      />
    </div>
  );
}

export default function AsyncConfirm() {
  return (
    <ConfirmProvider>
      <ProjectActions />
    </ConfirmProvider>
  );
}
