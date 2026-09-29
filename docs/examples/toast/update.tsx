import { Button, useSnackbar } from "components-ui";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Update() {
  const { enqueueSnackbar, updateSnackbar } = useSnackbar();

  const upload = async () => {
    // A spinner until it is updated with `loading: false`
    const id = enqueueSnackbar("Uploading report.pdf… 0 %", "default", {
      loading: true,
    });
    for (const percent of [25, 50, 75]) {
      await wait(600);
      // A new text in place - screen readers announce it
      updateSnackbar(id, `Uploading report.pdf… ${percent} %`);
    }
    await wait(600);
    updateSnackbar(id, {
      loading: false,
      // Any React node - here with a link
      message: (
        <>
          report.pdf was uploaded -{" "}
          <a className="font-semibold underline" href="#files">
            open the files
          </a>
        </>
      ),
      variant: "success",
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={upload}>Upload a file</Button>
      <Button
        color="danger"
        onClick={() => enqueueSnackbar("The file is too large", "danger")}
        variant="outline"
      >
        Danger
      </Button>
    </div>
  );
}
