import { FileUpload, useSnackbar, type UploadedFile } from "components-ui";

// Stands in for a real upload - reports progress, then resolves with what
// the list shows and the form submits for the file
function fakeUpload(
  file: File,
  { onProgress }: { onProgress: (percent: number) => void },
): Promise<UploadedFile> {
  return new Promise((resolve) => {
    let percent = 0;
    const timer = setInterval(() => {
      percent += 20;
      onProgress(percent);
      if (percent >= 100) {
        clearInterval(timer);
        resolve({
          filename: file.name,
          url: URL.createObjectURL(file),
          value: `blob-${file.name}`,
        });
      }
    }, 250);
  });
}

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <FileUpload
      defaultAttachments={[
        { filename: "contract.pdf", id: "1", value: "existing-blob-1" },
      ]}
      label="Attachments"
      maxFileSize={5}
      name="attachments"
      onError={(error) =>
        enqueueSnackbar(
          error instanceof Error ? error.message : "Upload failed",
          "error",
        )
      }
      onUpload={(file) =>
        enqueueSnackbar(`${file.filename} uploaded`, "success")
      }
      upload={fakeUpload}
    />
  );
}
