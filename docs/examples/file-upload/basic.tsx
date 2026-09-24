import { useEffect, useRef } from "react";
import { FileUpload, useSnackbar, type UploadedFile } from "components-ui";

// Stands in for a real upload - reports progress, stops when the signal
// aborts (the cancel button), then resolves with what the list shows and
// the form submits for the file
function fakeUpload(
  file: File,
  {
    onProgress,
    signal,
  }: { onProgress: (percent: number) => void; signal: AbortSignal },
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
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

    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(signal.reason);
    });
  });
}

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();
  // The object URLs of the uploaded files hold them in memory - released
  // when a file is removed and when the demo goes away
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const release = (url: string | null | undefined) => {
    if (url && objectUrls.current.delete(url)) URL.revokeObjectURL(url);
  };

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
      onRemove={(file) => release(file.url)}
      onUpload={(file) => {
        if (file.url) objectUrls.current.add(file.url);
        enqueueSnackbar(`${file.filename} uploaded`, "success");
      }}
      upload={fakeUpload}
    />
  );
}
