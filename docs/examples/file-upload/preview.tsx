import { useEffect, useRef } from "react";
import { FileUpload, type UploadedFile } from "components-ui";

const photo =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#bae6fd"/><path d="M0 48 20 28l14 14 10-10 20 20v12H0z" fill="#0369a1"/><circle cx="46" cy="18" r="7" fill="#fcd34d"/></svg>`,
  );

// Stands in for a real upload - slower, so the picture of the photo shows
// next to the progress
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
      percent += 10;
      onProgress(percent);
      if (percent >= 100) {
        clearInterval(timer);
        // A real upload returns the URL of the stored file
        resolve({ url: URL.createObjectURL(file), value: file.name });
      }
    }, 300);

    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(signal.reason);
    });
  });
}

export default function Preview() {
  // The demo keeps the "stored" files in memory - released when a file is
  // removed and when the demo goes away
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
      accept="image/*,.pdf"
      defaultAttachments={[
        { filename: "delivery-note.jpg", id: "1", url: photo, value: "1" },
        { filename: "invoice-0141.pdf", id: "2", value: "2" },
      ]}
      description="Up to 5 photos of the goods or the delivery note - JPG, PNG or PDF up to 10 MB."
      label="Photos"
      maxFileSize={10}
      maxFiles={5}
      multiple
      name="photos"
      onRemove={(file) => release(file.url)}
      onUpload={(file) => {
        if (file.url) objectUrls.current.add(file.url);
      }}
      preview
      upload={fakeUpload}
    />
  );
}
