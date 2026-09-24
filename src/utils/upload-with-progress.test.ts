import { describe, expect, it, vi } from "vitest";
import uploadWithProgress, { UploadError } from "./upload-with-progress";

/** Answers the request with `status`, like a server would. */
function respondWith(status: number, statusText: string, responseText = "") {
  return vi
    .spyOn(XMLHttpRequest.prototype, "send")
    .mockImplementation(function (this: XMLHttpRequest) {
      Object.defineProperties(this, {
        responseText: { value: responseText },
        status: { value: status },
        statusText: { value: statusText },
      });
      this.onload?.(new ProgressEvent("load"));
    });
}

describe("uploadWithProgress", () => {
  it("cancels the request with the signal", async () => {
    const abort = vi.spyOn(XMLHttpRequest.prototype, "abort");
    vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => {});
    const controller = new AbortController();

    const upload = uploadWithProgress("/upload", "data", {
      signal: controller.signal,
    });
    controller.abort();

    await expect(upload).rejects.toMatchObject({ name: "AbortError" });
    expect(abort).toHaveBeenCalled();
    await expect(
      uploadWithProgress("/upload", "data", { signal: controller.signal }),
    ).rejects.toThrow();
  });

  it("resolves with the body of a successful response", async () => {
    respondWith(201, "Created", '{"id":"42"}');

    await expect(uploadWithProgress("/upload", "data")).resolves.toBe(
      '{"id":"42"}',
    );
  });

  it("keeps the status and the body of a failed response", async () => {
    respondWith(413, "Payload Too Large", '{"error":"The file is too big"}');

    const failure = await uploadWithProgress("/upload", "data").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(UploadError);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({
      message: "Upload failed: 413 Payload Too Large",
      name: "UploadError",
      responseText: '{"error":"The file is too big"}',
      status: 413,
      statusText: "Payload Too Large",
    });
  });

  it("sends credentials and gives up after the timeout", async () => {
    const send = vi
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => {});

    const upload = uploadWithProgress("/upload", "data", {
      timeout: 5000,
      withCredentials: true,
    });
    const sent = send.mock.contexts[0] as XMLHttpRequest;

    expect(sent.withCredentials).toBe(true);
    expect(sent.timeout).toBe(5000);

    sent.ontimeout?.(new ProgressEvent("timeout"));
    await expect(upload).rejects.toMatchObject({
      name: "UploadError",
      status: 0,
    });
  });

  it("reports only the progress it can compute", () => {
    const send = vi
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => {});
    const onProgress = vi.fn();

    void uploadWithProgress("/upload", "", { onProgress });
    const sent = send.mock.contexts[0] as XMLHttpRequest;
    const progress = (init: ProgressEventInit) =>
      sent.upload.onprogress?.call(sent, new ProgressEvent("progress", init));

    // An empty body, and a size the browser does not know
    progress({ lengthComputable: true, loaded: 0, total: 0 });
    progress({ lengthComputable: false, loaded: 10, total: 0 });
    expect(onProgress).not.toHaveBeenCalled();

    progress({ lengthComputable: true, loaded: 25, total: 100 });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(25);
  });
});
