export interface UploadWithProgressOptions {
  /** Request headers - the `Content-Type` of a presigned upload, a token. */
  headers?: Record<string, string>;
  /** `PUT` (the default) for a presigned URL, `POST` for an endpoint. */
  method?: string;
  /** Called with the share of the body sent so far, 0-100. */
  onProgress?: (percent: number) => void;
  /** Cancels the upload, e.g. when the user removes the file. */
  signal?: AbortSignal;
  /**
   * Milliseconds after which the upload fails with an `UploadError` of
   * status 0 - no limit by default.
   */
  timeout?: number;
  /**
   * Sends the cookies and HTTP authentication of the page along to another
   * origin (`XMLHttpRequest.withCredentials`) - the server has to allow it.
   */
  withCredentials?: boolean;
}

/**
 * A failed `uploadWithProgress`. `status` and `responseText` are the
 * server's answer (e.g. `413` and the validation errors of your endpoint) -
 * status 0 when there was none: a network error or a timeout.
 */
export class UploadError extends Error {
  /** The HTTP status of the response, 0 without one. */
  readonly status: number;
  /** The status text of the response, e.g. `"Payload Too Large"`. */
  readonly statusText: string;
  /** The body of the response - parse it with `JSON.parse` if it is JSON. */
  readonly responseText: string;

  constructor(
    message: string,
    {
      responseText = "",
      status = 0,
      statusText = "",
    }: { responseText?: string; status?: number; statusText?: string } = {},
  ) {
    super(message);
    this.name = "UploadError";
    this.status = status;
    this.statusText = statusText;
    this.responseText = responseText;
  }
}

/**
 * Sends a file with XMLHttpRequest, which - unlike `fetch` - reports the
 * upload progress. Fits both a direct upload to a presigned storage URL (the
 * default `PUT` of the raw file) and a `POST` of `FormData` to an endpoint of
 * the app. Resolves with the response body; rejects with an `UploadError`
 * that keeps the status and body of a failed response, or with the reason
 * of `signal` when it aborts.
 */
export default function uploadWithProgress(
  url: string,
  body: XMLHttpRequestBodyInit,
  {
    headers = {},
    method = "PUT",
    onProgress,
    signal,
    timeout,
    withCredentials,
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

    if (timeout !== undefined) xhr.timeout = timeout;
    if (withCredentials !== undefined) xhr.withCredentials = withCredentials;

    xhr.upload.onprogress = (event) => {
      // An event of an empty body, or of an unknown size, has no share
      if (event.lengthComputable && event.total > 0) {
        onProgress?.((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(
          new UploadError(`Upload failed: ${xhr.status} ${xhr.statusText}`, {
            responseText: xhr.responseText,
            status: xhr.status,
            statusText: xhr.statusText,
          }),
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new UploadError(
          `Network error: ${xhr.statusText || "Connection failed"}`,
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(new UploadError(`Upload timed out after ${timeout} ms`));
    };

    xhr.onabort = () => {
      reject(new UploadError("Upload aborted"));
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
