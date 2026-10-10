import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import FileUpload, { type UploadedFile } from "./file-upload";

const initial: UploadedFile[] = [
  { id: "one", filename: "one.pdf", value: "one" },
];
const remove = () => screen.getByRole("button", { name: "Remove one.pdf" });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe("FileUpload controlled attachments and removal", () => {
  it("handles a rejected cleanup notification after single-file replacement", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FileUpload
        defaultAttachments={initial}
        onRemove={() => Promise.reject(new Error("Cleanup failed"))}
        upload={async (file) => ({ filename: file.name, value: "new" })}
      />,
    );
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: { files: [new File(["x"], "new.pdf")] },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove new.pdf" }),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(logger).toHaveBeenCalledWith(
        "Replaced file cleanup failed",
        expect.any(Error),
      ),
    );
    expect(screen.queryByText("one.pdf")).toBeNull();
  });

  it("tells onRemove of the attachment a controlled single-file upload replaces", async () => {
    const onRemove = vi.fn();
    const onAttachmentsChange = vi.fn();
    function Field() {
      const [attachments, setAttachments] = useState(initial);
      return (
        <FileUpload
          attachments={attachments}
          onAttachmentsChange={(list) => {
            onAttachmentsChange(list);
            setAttachments(list);
          }}
          onRemove={onRemove}
          upload={async (file) => ({
            id: file.name,
            filename: file.name,
            value: file.name,
          })}
        />
      );
    }
    render(<Field />);
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: { files: [new File(["x"], "new.pdf")] },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove new.pdf" }),
      ).toBeInTheDocument(),
    );
    expect(onAttachmentsChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ id: "new.pdf" }),
    ]);
    // As without `attachments` - the app can delete the replaced file
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining(initial[0]),
    );
    expect(screen.queryByText("one.pdf")).toBeNull();
  });

  it("reports the attachment a controlled single-file pick replaces", () => {
    const onRemove = vi.fn();
    const onAttachmentsChange = vi.fn();
    const props = { name: "doc", onAttachmentsChange, onRemove };
    const { rerender } = render(
      <FileUpload {...props} attachments={initial} />,
    );
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: { files: [new File(["x"], "new.pdf")] },
    });

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining(initial[0]),
    );
    expect(onAttachmentsChange).toHaveBeenCalledExactlyOnceWith([]);
    // The parent's list decides what is attached
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(screen.getByText("new.pdf")).toBeInTheDocument();

    rerender(<FileUpload {...props} attachments={[]} />);
    expect(screen.queryByText("one.pdf")).toBeNull();
    expect(screen.getByText("new.pdf")).toBeInTheDocument();
  });

  it("keeps native picked files when controlled stored attachments refresh", async () => {
    const onFilesChange = vi.fn();
    const props = { multiple: true, onFilesChange };
    const { rerender } = render(
      <FileUpload {...props} attachments={initial} />,
    );
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: { files: [new File(["x"], "picked.pdf")] },
    });
    rerender(
      <FileUpload
        {...props}
        attachments={[{ ...initial[0], filename: "fresh.pdf" }]}
      />,
    );
    expect(screen.getByText("picked.pdf")).toBeInTheDocument();
    expect(screen.getByText("fresh.pdf")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove picked.pdf" }));
    expect(screen.queryByText("picked.pdf")).toBeNull();
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("reports removal and waits for the authoritative attachments", async () => {
    const onAttachmentsChange = vi.fn();
    const { rerender } = render(
      <FileUpload
        attachments={initial}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );
    await userEvent.setup().click(remove());
    expect(onAttachmentsChange).toHaveBeenCalledWith([]);
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    rerender(
      <FileUpload attachments={[]} onAttachmentsChange={onAttachmentsChange} />,
    );
    expect(screen.queryByText("one.pdf")).toBeNull();
    rerender(
      <FileUpload
        attachments={[{ id: "two", filename: "two.pdf" }]}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );
    expect(screen.getByText("two.pdf")).toBeInTheDocument();
  });

  it("reports a stored upload to a parent that applies the new list", async () => {
    function Field() {
      const [attachments, setAttachments] = useState(initial);
      return (
        <FileUpload
          attachments={attachments}
          multiple
          onAttachmentsChange={setAttachments}
          upload={async (file) => ({
            id: file.name,
            filename: file.name,
            value: file.name,
          })}
        />
      );
    }
    render(<Field />);
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: {
        files: [new File(["x"], "two.pdf"), new File(["y"], "three.pdf")],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove two.pdf" }),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove three.pdf" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove two.pdf" }),
    ).toBeInTheDocument();
  });

  it("keeps an attachment and blocks submission until asynchronous removal succeeds", async () => {
    const request = deferred<boolean>();
    const onRemove = vi.fn(() => request.promise);
    render(
      <form aria-label="Files">
        <FileUpload
          defaultAttachments={initial}
          name="files"
          onRemove={onRemove}
        />
      </form>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    const user = userEvent.setup();
    await user.click(remove());
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(remove()).toHaveAttribute("aria-disabled", "true");
    expect(form.checkValidity()).toBe(false);
    await act(async () => request.resolve(true));
    expect(screen.queryByText("one.pdf")).toBeNull();
    expect(form.checkValidity()).toBe(true);
  });

  it("retains a failed removal with feedback and permits a retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = deferred<boolean>();
    const onRemove = vi
      .fn()
      .mockReturnValueOnce(failure.promise)
      .mockResolvedValueOnce(true);
    render(<FileUpload defaultAttachments={initial} onRemove={onRemove} />);
    const user = userEvent.setup();
    await user.click(remove());
    await act(async () => failure.reject(new Error("Offline")));
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(
      screen.getByText("The file could not be removed. Please try again."),
    ).toBeInTheDocument();
    await user.click(remove());
    expect(screen.queryByText("one.pdf")).toBeNull();
  });

  it("retains both synchronous and asynchronous refusals", async () => {
    const onRemove = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockResolvedValueOnce(false);
    render(<FileUpload defaultAttachments={initial} onRemove={onRemove} />);
    const user = userEvent.setup();
    await user.click(remove());
    await user.click(remove());
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(remove()).not.toBeDisabled();
  });

  it("ignores a late removal after reset", async () => {
    const request = deferred<boolean>();
    render(
      <form aria-label="Files">
        <FileUpload
          defaultAttachments={initial}
          onRemove={() => request.promise}
        />
      </form>,
    );
    await userEvent.setup().click(remove());
    await act(async () =>
      (screen.getByRole("form") as HTMLFormElement).reset(),
    );
    await waitFor(() => expect(remove()).not.toHaveAttribute("aria-busy"));
    await act(async () => request.resolve(true));
    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(remove()).not.toBeDisabled();
  });

  it("does not delete an attachment whose metadata was refreshed meanwhile", async () => {
    const request = deferred<boolean>();
    const onAttachmentsChange = vi.fn();
    const props = { onAttachmentsChange, onRemove: () => request.promise };
    const { rerender } = render(
      <FileUpload {...props} attachments={initial} />,
    );
    await userEvent.setup().click(remove());
    rerender(
      <FileUpload
        {...props}
        attachments={[{ ...initial[0], filename: "updated.pdf" }]}
      />,
    );
    await act(async () => request.resolve(true));
    expect(screen.getByText("updated.pdf")).toBeInTheDocument();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });
});
