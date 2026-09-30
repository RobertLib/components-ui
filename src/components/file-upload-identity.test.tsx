import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import FileUpload, { type UploadedFile } from "./file-upload";

it("keeps attachment ids separate from the identity of new uploads", async () => {
  const user = userEvent.setup();
  const attachment = {
    filename: "old.pdf",
    id: "file-1",
    value: "old-blob",
  };
  let finishUpload!: (result: UploadedFile) => void;
  const upload = vi.fn(
    () => new Promise<UploadedFile>((resolve) => (finishUpload = resolve)),
  );
  const onRemove = vi.fn();
  render(
    <form aria-label="Attachments">
      <FileUpload
        defaultAttachments={[attachment]}
        multiple
        name="files"
        onRemove={onRemove}
        upload={upload}
      />
    </form>,
  );
  const form = screen.getByRole<HTMLFormElement>("form");

  fireEvent.change(form.querySelector("input[type=file]")!, {
    target: {
      files: [new File(["new"], "new.pdf", { type: "application/pdf" })],
    },
  });

  expect(upload).toHaveBeenCalledOnce();
  expect(new FormData(form).getAll("files")).toEqual(["old-blob"]);
  await act(async () => finishUpload({ value: "new-blob" }));

  expect(new FormData(form).getAll("files")).toEqual(["old-blob", "new-blob"]);
  expect(screen.getByText("old.pdf")).toBeInTheDocument();
  expect(screen.getByText("new.pdf")).toBeInTheDocument();
  expect(onRemove).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Remove old.pdf" }));

  expect(onRemove).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining(attachment),
  );
  expect(new FormData(form).getAll("files")).toEqual(["new-blob"]);
  expect(screen.getByText("new.pdf")).toBeInTheDocument();
});
