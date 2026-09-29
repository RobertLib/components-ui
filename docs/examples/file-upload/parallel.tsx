import { FileUpload, type UploadedFile } from "components-ui";

let uploads = 0;

// Stands in for a real upload - each file at its own speed, and every third
// one fails halfway, so that its row offers to retry it
function fakeUpload(
  file: File,
  {
    onProgress,
    signal,
  }: { onProgress: (percent: number) => void; signal: AbortSignal },
): Promise<UploadedFile> {
  const fails = ++uploads % 3 === 0;
  const step = 5 + Math.random() * 15;

  return new Promise((resolve, reject) => {
    let percent = 0;
    const timer = setInterval(() => {
      percent = Math.min(percent + step, 100);
      onProgress(percent);

      if (fails && percent >= 50) {
        clearInterval(timer);
        reject(new Error("503 Service Unavailable"));
      } else if (percent >= 100) {
        clearInterval(timer);
        resolve({ filename: file.name, value: `blob-${file.name}` });
      }
    }, 300);

    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(signal.reason);
    });
  });
}

export default function Parallel() {
  return (
    <FileUpload
      concurrency={2}
      description="Drop a few files - two upload at a time, the others wait."
      label="Documents"
      multiple
      name="documents"
      upload={fakeUpload}
    />
  );
}
