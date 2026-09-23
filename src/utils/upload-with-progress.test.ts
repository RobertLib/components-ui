import { describe, expect, it, vi } from "vitest";
import uploadWithProgress from "./upload-with-progress";

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
});
