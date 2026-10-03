/** Snapshot drag data synchronously; its file entries are unavailable after the drop event returns. */
export function snapshotDrop(data: DataTransfer) {
  const files = Array.from(data.files);
  const items = Array.from(data.items ?? []).filter(
    (item) => item.kind === "file",
  );
  const entries = items.map((item) =>
    typeof item.webkitGetAsEntry === "function"
      ? item.webkitGetAsEntry()
      : null,
  );
  const itemFiles = items.map((item) =>
    typeof item.getAsFile === "function" ? item.getAsFile() : null,
  );
  return { files, entries, itemFiles };
}

/** Recursively reads directory batches, keeping the root folder in each relative path. */
export async function readDroppedDirectories(
  drop: {
    files: File[];
    entries: (FileSystemEntry | null)[];
    itemFiles?: (File | null)[];
  },
  isCurrent: () => boolean,
): Promise<File[]> {
  const check = () => {
    if (!isCurrent())
      throw new DOMException("The drop was canceled.", "AbortError");
  };
  const read = async (
    entry: FileSystemEntry,
    path: string,
  ): Promise<File[]> => {
    check();
    const relativePath = `${path}${entry.name}`;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      check();
      const result = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      Object.defineProperty(result, "webkitRelativePath", {
        value: relativePath,
      });
      return [result];
    }
    if (!entry.isDirectory) return [];
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const result: File[] = [];
    while (true) {
      check();
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!batch.length) break;
      for (const child of batch)
        result.push(...(await read(child, `${relativePath}/`)));
    }
    return result;
  };
  const result: File[] = [];
  for (let index = 0; index < drop.entries.length; index++) {
    const entry = drop.entries[index];
    if (entry) result.push(...(await read(entry, "")));
    else {
      const file = drop.itemFiles?.[index] ?? drop.files[index];
      if (file) result.push(file);
    }
  }
  return drop.entries.length ? result : drop.files;
}
