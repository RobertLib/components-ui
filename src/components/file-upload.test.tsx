import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileUpload, { type UploadedFile } from "./file-upload";

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

    drop(screen.getByRole("group", { name: "Attachments" }), [
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
    render(
      <form aria-label="Order">
        <FileUpload
          defaultAttachments={[{ filename: "a.pdf", value: "blob-a" }]}
          multiple
          name="files"
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

  it("describes the upload button and the group with the error", () => {
    render(
      <FileUpload
        error="Attach the invoice"
        label="Invoice"
        upload={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Invoice" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Attach the invoice");
    expect(
      screen.getByRole("button", { name: /Upload/ }),
    ).toHaveAccessibleDescription("Attach the invoice");
  });
});
