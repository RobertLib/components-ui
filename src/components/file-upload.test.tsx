import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cs } from "../i18n/cs";
import FileUpload, { type UploadedFile } from "./file-upload";
import UIProvider from "../providers/ui-provider";

const file = (name: string, type = "application/pdf", size = 10) =>
  new File(["x".repeat(size)], name, { type });

/** Drops files on the field, like a drag from the desktop. */
const drop = (target: Element, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files, types: ["Files"] } });

/** An upload that resolves when told to. */
function controllableUpload() {
  const pending: {
    file: File;
    resolve: (result: UploadedFile) => void;
    signal: AbortSignal;
  }[] = [];

  const upload = vi.fn(
    (uploaded: File, { signal }: { signal: AbortSignal }) =>
      new Promise<UploadedFile>((resolve, reject) => {
        pending.push({ file: uploaded, resolve, signal });
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  );

  return { pending, upload };
}

describe("FileUpload", () => {
  it("uploads dropped files one after another", async () => {
    const { pending, upload } = controllableUpload();
    render(
      <FileUpload label="Attachments" multiple name="files" upload={upload} />,
    );

    drop(screen.getByRole("group", { name: "Attachments:" }), [
      file("a.pdf"),
      file("b.pdf"),
    ]);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    await act(async () => pending[0].resolve({ value: "blob-a" }));
    expect(upload).toHaveBeenCalledTimes(2);
    await act(async () => pending[1].resolve({ value: "blob-b" }));

    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
    expect(
      Array.from(
        document.querySelectorAll<HTMLInputElement>("input[name='files']"),
        (input) => input.value,
      ),
    ).toEqual(["blob-a", "blob-b"]);
  });

  it("cancels the upload - and aborts it when it goes away", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const { unmount } = render(<FileUpload upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(pending[0].signal.aborted).toBe(true);
    expect(screen.queryByText("a.pdf")).toBeNull();
    expect(screen.getByRole("button", { name: /Upload/ })).toBeInTheDocument();

    drop(screen.getByRole("group"), [file("b.pdf")]);
    unmount();
    expect(pending[1].signal.aborted).toBe(true);
  });

  it("rejects dropped files it does not accept", () => {
    const onError = vi.fn();
    const upload = vi.fn();
    render(
      <FileUpload accept=".pdf,image/*" onError={onError} upload={upload} />,
    );

    drop(screen.getByRole("group"), [file("notes.txt", "text/plain")]);

    expect(upload).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Files of this type cannot be uploaded here.",
    );
  });

  it("takes no files and submits none when disabled", () => {
    const upload = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          defaultAttachments={[{ filename: "a.pdf", value: "blob-a" }]}
          disabled
          name="files"
          upload={upload}
        />
      </form>,
    );

    drop(screen.getByRole("group"), [file("b.pdf")]);

    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Upload/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect([...new FormData(form).keys()]).toEqual([]);
  });

  // user-event takes everything in a disabled fieldset for disabled - the
  // browser leaves the drop zone there alone
  it("takes no files in a disabled fieldset", () => {
    const upload = vi.fn();
    render(
      <fieldset disabled>
        <FileUpload
          defaultAttachments={[{ filename: "a.pdf", value: "blob-a" }]}
          label="Attachments"
          upload={upload}
        />
      </fieldset>,
    );

    const group = screen.getByRole("group", { name: /Attachments/ });
    const dataTransfer = {
      dropEffect: "copy",
      files: [file("b.pdf")],
      types: ["Files"],
    };
    fireEvent.dragOver(group, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("none");
    fireEvent.drop(group, { dataTransfer });

    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("holds no more than maxFiles files, the attached ones included", async () => {
    const { pending, upload } = controllableUpload();
    const onError = vi.fn();
    render(
      <FileUpload
        accept=".pdf"
        defaultAttachments={[{ filename: "a.pdf", value: "blob-a" }]}
        maxFiles={2}
        multiple
        name="files"
        onError={onError}
        upload={upload}
      />,
    );

    drop(screen.getByRole("group"), [
      file("b.pdf"),
      file("notes.txt", "text/plain"),
      file("c.pdf"),
    ]);

    // Refused at once, before the upload of the one there is room for - a
    // file refused for its type takes no room
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls.map(([, refused]) => refused.name)).toEqual([
      "notes.txt",
      "c.pdf",
    ]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You can attach up to 2 files.",
    );

    await act(async () => pending[0].resolve({ value: "blob-b" }));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("b.pdf")).toBeInTheDocument();

    // Full - a removed file makes room again
    drop(screen.getByRole("group"), [file("d.pdf")]);
    expect(upload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    drop(screen.getByRole("group"), [file("d.pdf")]);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("says the most files as the language does", () => {
    render(
      <UIProvider locale={cs}>
        <FileUpload
          maxFiles={3}
          multiple
          upload={controllableUpload().upload}
        />
      </UIProvider>,
    );

    drop(
      screen.getByRole("group"),
      ["a", "b", "c", "d"].map((name) => file(`${name}.pdf`)),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Připojit lze nejvýše 3 soubory.",
    );
  });

  it("writes the largest size as the language does", () => {
    render(
      <UIProvider locale={cs}>
        <FileUpload maxFileSize={2.5} upload={vi.fn()} />
      </UIProvider>,
    );

    drop(screen.getByRole("group"), [file("big.pdf", "application/pdf", 3e6)]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Maximální velikost souboru 2,5 MB byla překročena.",
    );
  });

  it("keeps files dropped while it cannot take them from opening in the browser", async () => {
    const { pending, upload } = controllableUpload();
    const { rerender } = render(<FileUpload disabled upload={upload} />);
    const group = screen.getByRole("group");

    const dataTransfer = {
      dropEffect: "copy",
      files: [file("a.pdf")],
      types: ["Files"],
    };
    // `false` - the default (opening the file) was prevented
    expect(fireEvent.dragOver(group, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("none");
    expect(fireEvent.drop(group, { dataTransfer })).toBe(false);
    expect(upload).not.toHaveBeenCalled();

    // Nor while uploading
    rerender(<FileUpload upload={upload} />);
    drop(group, [file("b.pdf")]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(fireEvent.dragOver(group, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("none");
    expect(fireEvent.drop(group, { dataTransfer })).toBe(false);
    expect(upload).toHaveBeenCalledTimes(1);

    await act(async () =>
      pending[0].resolve({ filename: "b.pdf", id: "b", url: "/b.pdf" }),
    );
    expect(fireEvent.dragOver(group, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("copy");
  });

  it("requires a file when required", async () => {
    const { pending, upload } = controllableUpload();
    render(
      <form aria-label="Order">
        <FileUpload required upload={upload} />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    expect(form.checkValidity()).toBe(false);
    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => pending[0].resolve({}));
    expect(form.checkValidity()).toBe(true);
  });

  it("keeps one file without multiple - a new one replaces it", async () => {
    const { pending, upload } = controllableUpload();
    const onRemove = vi.fn();
    render(
      <FileUpload
        defaultAttachments={[{ filename: "a.pdf", value: "blob-a" }]}
        name="file"
        onRemove={onRemove}
        upload={upload}
      />,
    );

    drop(screen.getByRole("group"), [file("b.pdf"), file("c.pdf")]);
    await act(async () => pending[0].resolve({ value: "blob-b" }));

    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("a.pdf")).toBeNull();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "a.pdf" }),
    );
    expect(
      Array.from(
        document.querySelectorAll<HTMLInputElement>("input[name='file']"),
        (input) => input.value,
      ),
    ).toEqual(["blob-b"]);
  });

  it("lists defaultAttachments arriving later until the user changes the list", async () => {
    const user = userEvent.setup();
    const upload = vi.fn();
    const { rerender } = render(<FileUpload multiple upload={upload} />);

    rerender(
      <FileUpload
        defaultAttachments={[
          { filename: "a.pdf", id: "a" },
          { filename: "b.pdf", id: "b" },
        ]}
        multiple
        upload={upload}
      />,
    );
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    rerender(
      <FileUpload
        defaultAttachments={[{ filename: "c.pdf", id: "c" }]}
        multiple
        upload={upload}
      />,
    );
    expect(screen.queryByText("c.pdf")).toBeNull();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
  });

  it("takes its defaultAttachments back when the form is reset", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const onRemove = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          defaultAttachments={[{ filename: "a.pdf", value: "blob-a" }]}
          multiple
          name="files"
          onRemove={onRemove}
          upload={upload}
        />
        <button type="reset">Reset</button>
      </form>,
    );

    drop(screen.getByRole("group"), [file("b.pdf")]);
    await act(async () => pending[0].resolve({ value: "blob-b" }));
    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    drop(screen.getByRole("group"), [file("c.pdf")]);

    await user.click(screen.getByRole("button", { name: "Reset" }));

    // The running upload is dropped with the rest
    expect(pending[1].signal.aborted).toBe(true);
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    await waitFor(() =>
      expect(new FormData(form).getAll("files")).toEqual(["blob-a"]),
    );
    expect(screen.queryByText("b.pdf")).toBeNull();
    expect(screen.queryByText("c.pdf")).toBeNull();

    // Only the file the user removed - the reset after a form action follows
    // a save, which has kept the uploaded files
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove.mock.calls[0][0]).toMatchObject({ filename: "a.pdf" });
  });

  it("is reset after a form action", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const action = vi.fn();
    render(
      <form action={action}>
        <FileUpload name="files" upload={upload} />
        <button type="submit">Save</button>
      </form>,
    );

    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => pending[0].resolve({ value: "blob-a" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("a.pdf")).toBeNull());
    expect(action.mock.calls[0][0].getAll("files")).toEqual(["blob-a"]);
  });

  it("is ready again at once when cancelled, whatever upload does", async () => {
    const user = userEvent.setup();
    // Ignores the signal and resolves later
    const late: ((result: UploadedFile) => void)[] = [];
    const upload = vi.fn(
      () => new Promise<UploadedFile>((resolve) => late.push(resolve)),
    );
    const onUpload = vi.fn();
    render(<FileUpload multiple onUpload={onUpload} upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("progressbar")).toBeNull();
    const button = screen.getByRole("button", { name: /Upload/ });
    expect(button).toHaveFocus();

    // The files after the cancelled one are dropped, a new one can be added
    drop(screen.getByRole("group"), [file("c.pdf")]);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "c.pdf" }),
      expect.anything(),
    );

    // The cancelled upload finishing late changes nothing
    await act(async () => late[0]({ value: "blob-a" }));
    expect(screen.queryByText("a.pdf")).toBeNull();
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await act(async () => late[1]({ value: "blob-c" }));
    expect(screen.getByText("c.pdf")).toBeInTheDocument();
  });

  it("keeps the focus on the upload controls around an upload", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const { container } = render(<FileUpload upload={upload} />);

    await user.click(screen.getByRole("button", { name: /Upload/ }));
    fireEvent.change(
      container.querySelector("input[type=file]") as HTMLInputElement,
      { target: { files: [file("a.pdf")] } },
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await act(async () => pending[0].resolve({ value: "blob-a" }));
    expect(screen.getByRole("button", { name: /Upload/ })).toHaveFocus();
  });

  it("moves the focus to the next file when one is removed", async () => {
    const user = userEvent.setup();
    render(
      <FileUpload
        defaultAttachments={[
          { filename: "a.pdf", id: "a" },
          { filename: "b.pdf", id: "b" },
          { filename: "c.pdf", id: "c" },
        ]}
        multiple
        upload={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove b.pdf" }));
    expect(screen.getByRole("button", { name: "Remove c.pdf" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Remove a.pdf" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Upload/ })).toHaveFocus();
  });

  it("requires a file that is submitted when it has a name", async () => {
    const { pending, upload } = controllableUpload();
    render(
      <form aria-label="Order">
        <FileUpload multiple name="files" required upload={upload} />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await act(async () => pending[0].resolve({}));
    // Listed, but nothing to submit
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(form.checkValidity()).toBe(false);

    await act(async () => pending[1].resolve({ value: "blob-b" }));
    expect(form.checkValidity()).toBe(true);
  });

  it("accepts a type by its extension, whatever type the system reports", () => {
    const upload = vi.fn(() => new Promise<UploadedFile>(() => {}));
    const onError = vi.fn();
    render(<FileUpload accept="text/csv" onError={onError} upload={upload} />);

    // Windows with Excel installed
    drop(screen.getByRole("group"), [
      file("export.csv", "application/vnd.ms-excel"),
    ]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("accepts any file with a wildcard of both parts", async () => {
    const upload = vi.fn(async () => ({ value: "blob" }));
    const onError = vi.fn();
    render(
      <FileUpload accept="*/*" multiple onError={onError} upload={upload} />,
    );

    await act(async () =>
      drop(screen.getByRole("group"), [
        file("notes.txt", "text/plain"),
        file("blob", ""),
      ]),
    );
    expect(upload).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("accepts a file without a type by the extensions of its group", async () => {
    const upload = vi.fn(async () => ({ value: "blob" }));
    const onError = vi.fn();
    render(
      <FileUpload
        accept="image/*"
        multiple
        onError={onError}
        upload={upload}
      />,
    );

    // HEIC photos come without a type on some systems. A reported type
    // still decides, and a name of no known extension without one fails.
    await act(async () =>
      drop(screen.getByRole("group"), [
        file("photo.HEIC", ""),
        file("fake.jpg", "text/plain"),
        file("notes", ""),
      ]),
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]).toEqual([
      expect.objectContaining({ name: "photo.HEIC" }),
      expect.anything(),
    ]);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("takes classes and hides the required mark from screen readers", () => {
    render(
      <FileUpload
        className="my-0! w-80"
        label="Invoice"
        required
        upload={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Invoice:" });
    expect(group).toHaveClass("my-0!", "w-80");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("describes the upload button and the group with the error", () => {
    render(
      <FileUpload
        error="Attach the invoice"
        label="Invoice"
        upload={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Invoice:" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Attach the invoice");
    expect(
      screen.getByRole("button", { name: /Upload/ }),
    ).toHaveAccessibleDescription("Attach the invoice");
  });
});

describe("FileUpload with preview", () => {
  /** Object URLs as the browser makes them - jsdom has none. */
  function stubObjectUrls() {
    let count = 0;
    const create = vi.fn(() => `blob:preview-${++count}`);
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    return { create, revoke };
  }

  afterEach(() => {
    const url = URL as Partial<typeof URL>;
    delete url.createObjectURL;
    delete url.revokeObjectURL;
  });

  const thumbnails = () =>
    Array.from(document.querySelectorAll("img"), (img) =>
      img.getAttribute("src"),
    );

  it("shows the picked image while it uploads, then the stored one", async () => {
    const { create, revoke } = stubObjectUrls();
    const { pending, upload } = controllableUpload();
    render(<FileUpload preview upload={upload} />);

    drop(screen.getByRole("group"), [file("photo.png", "image/png")]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(thumbnails()).toEqual(["blob:preview-1"]);
    // Decoration - the file name says what it is
    expect(document.querySelector("img")).toHaveAttribute("alt", "");

    await act(async () =>
      pending[0].resolve({ url: "/files/photo.png", value: "blob-1" }),
    );
    expect(thumbnails()).toEqual(["/files/photo.png"]);
    expect(revoke).toHaveBeenCalledWith("blob:preview-1");
  });

  it("releases the picked image when the upload stops", async () => {
    const user = userEvent.setup();
    const { revoke } = stubObjectUrls();
    const { upload } = controllableUpload();
    const { unmount } = render(<FileUpload preview upload={upload} />);

    drop(screen.getByRole("group"), [file("a.jpg", "image/jpeg")]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(revoke).toHaveBeenLastCalledWith("blob:preview-1");

    drop(screen.getByRole("group"), [file("b.jpg", "image/jpeg")]);
    unmount();
    expect(revoke).toHaveBeenLastCalledWith("blob:preview-2");
  });

  it("shows thumbnails of attachments - an icon for other files", () => {
    render(
      <FileUpload
        defaultAttachments={[
          { filename: "photo.JPG", id: "1", url: "/photo.jpg" },
          { filename: "contract.pdf", id: "2", url: "/contract.pdf" },
          {
            filename: "scan.pdf",
            id: "3",
            thumbnailUrl: "/scan-page-1.png",
            url: "/scan.pdf",
          },
          { filename: "logo.png", id: "4" },
        ]}
        multiple
        preview
        upload={vi.fn()}
      />,
    );

    expect(thumbnails()).toEqual(["/photo.jpg", "/scan-page-1.png"]);
    const [, contract, , logo] = screen.getAllByRole("listitem");
    expect(contract.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(logo.querySelector("img")).toBeNull();
  });

  it("shows an icon when a picture does not load", () => {
    render(
      <FileUpload
        defaultAttachments={[{ filename: "photo.heic", url: "/photo.heic" }]}
        preview
        upload={vi.fn()}
      />,
    );

    fireEvent.error(document.querySelector("img") as HTMLImageElement);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("listitem").querySelector("svg")).not.toBeNull();
  });

  it("shows no pictures without preview", () => {
    const { create } = stubObjectUrls();
    const { upload } = controllableUpload();
    render(
      <FileUpload
        defaultAttachments={[{ filename: "photo.jpg", url: "/photo.jpg" }]}
        multiple
        upload={upload}
      />,
    );

    drop(screen.getByRole("group"), [file("b.png", "image/png")]);
    expect(create).not.toHaveBeenCalled();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("FileUpload progress and description", () => {
  it("shows the progress as unknown until upload reports it", async () => {
    const reports: ((percent: number) => void)[] = [];
    const upload = vi.fn(
      (
        _file: File,
        { onProgress }: { onProgress: (percent: number) => void },
      ) =>
        new Promise<UploadedFile>(() => {
          reports.push(onProgress);
        }),
    );
    render(<FileUpload upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    const bar = screen.getByRole("progressbar", { name: "Uploading…" });
    expect(bar).not.toHaveAttribute("aria-valuenow");

    act(() => reports[0](40));
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("is described by its error, its description and more", () => {
    render(
      <>
        <p id="policy">Files are kept for 10 years.</p>
        <FileUpload
          aria-describedby="policy"
          description="PDF or images up to 5 MB"
          error="Attach the invoice"
          label="Invoice"
          upload={vi.fn()}
        />
      </>,
    );

    const group = screen.getByRole("group", { name: "Invoice:" });
    const description = screen.getByText("PDF or images up to 5 MB");
    expect(description.tagName).toBe("P");
    expect(group.getAttribute("aria-describedby")?.split(" ")).toEqual([
      screen.getByRole("alert").id,
      description.id,
      "policy",
    ]);
    expect(
      screen.getByRole("button", { name: /Upload/ }),
    ).toHaveAccessibleDescription(
      "Attach the invoice PDF or images up to 5 MB Files are kept for 10 years.",
    );
  });
});
