import { describe, expect, it, vi } from "vitest";
import { readDroppedDirectories, snapshotDrop } from "./dropped-files";
const fileEntry = (name: string) =>
  ({
    name,
    isFile: true,
    isDirectory: false,
    file: (resolve: (file: File) => void) =>
      resolve(
        new File([name], name, { type: "text/plain", lastModified: 123 }),
      ),
  }) as FileSystemFileEntry;
const directory = (name: string, batches: FileSystemEntry[][]) =>
  ({
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => {
      let index = 0;
      return {
        readEntries: (resolve: (entries: FileSystemEntry[]) => void) =>
          resolve(batches[index++] ?? []),
      };
    },
  }) as FileSystemDirectoryEntry;

describe("dropped directories", () => {
  it("reads every batch and nested folder with paths, types and modification times", async () => {
    const root = directory("root", [
      [fileEntry("a.txt")],
      [directory("nested", [[fileEntry("b.txt")]])],
    ]);
    const files = await readDroppedDirectories(
      { files: [], entries: [root] },
      () => true,
    );
    expect(files.map((file) => file.webkitRelativePath)).toEqual([
      "root/a.txt",
      "root/nested/b.txt",
    ]);
    expect(files.map((file) => file.lastModified)).toEqual([123, 123]);
    expect(files.every((file) => file.type === "text/plain")).toBe(true);
  });
  it("propagates read failures and stops after reset or unmount", async () => {
    const failed = {
      name: "bad",
      isDirectory: true,
      isFile: false,
      createReader: () => ({
        readEntries: (
          _resolve: unknown,
          reject: (error: DOMException) => void,
        ) => reject(new DOMException("Denied", "NotReadableError")),
      }),
    } as FileSystemDirectoryEntry;
    await expect(
      readDroppedDirectories({ files: [], entries: [failed] }, () => true),
    ).rejects.toThrow("Denied");
    const read = vi.fn();
    const skipped = { ...fileEntry("a.txt"), file: read };
    await expect(
      readDroppedDirectories({ files: [], entries: [skipped] }, () => false),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(read).not.toHaveBeenCalled();
  });
  it("discards a file whose asynchronous read finishes after cancellation", async () => {
    let current = true;
    let finish = (_file: File) => {};
    const entry = {
      ...fileEntry("pending.txt"),
      file: (resolve: (file: File) => void) => {
        finish = resolve;
      },
    };
    const pending = readDroppedDirectories(
      { files: [], entries: [entry] },
      () => current,
    );
    current = false;
    finish(new File(["late"], "pending.txt"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("captures protected drag entries synchronously and retains file-only fallbacks", async () => {
    const file = new File(["test"], "test.txt");
    const entry = fileEntry("test.txt");
    const get = vi.fn(() => entry);
    const drop = snapshotDrop({
      files: [file],
      items: [{ kind: "string" }, { kind: "file", webkitGetAsEntry: get }],
    } as unknown as DataTransfer);
    expect(get).toHaveBeenCalledTimes(1);
    expect(drop.entries).toEqual([entry]);
    expect(
      await readDroppedDirectories(
        { files: [file], entries: [null] },
        () => true,
      ),
    ).toEqual([file]);
  });
});
