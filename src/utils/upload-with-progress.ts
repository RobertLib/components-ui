export interface UploadWithProgressOptions {
  headers?: Record<string, string>;
  method?: string;
  onProgress?: (percent: number) => void;
  /** Cancels the upload, e.g. when the user removes the file. */
  signal?: AbortSignal;
}

/**
 * Sends a file with XMLHttpRequest, which - unlike `fetch` - reports the
 * upload progress. Fits both a direct upload to a presigned storage URL (the
 * default `PUT` of the raw file) and a `POST` of `FormData` to an endpoint of
 * the app. Resolves with the response body.
 */
export default function uploadWithProgress(
  url: string,
  body: XMLHttpRequestBodyInit,
  {
    headers = {},
    method = "PUT",
    onProgress,
    signal,
  }: UploadWithProgressOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(`Network error: ${xhr.statusText || "Connection failed"}`),
      );
    };

    xhr.onabort = () => {
      reject(new Error("Upload aborted"));
    };

    // Rejects with the reason of the signal (an `AbortError`), not with the
    // error `xhr.abort()` would report
    const abort = () => {
      reject(signal?.reason);
      xhr.abort();
    };
    signal?.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", abort);

    xhr.send(body);
  });
}
