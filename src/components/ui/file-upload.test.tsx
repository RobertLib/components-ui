import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRequire } from "node:module";
import { Activity, StrictMode, Suspense, use, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cs } from "../../i18n/ui/cs";
import FileUpload, { type UploadedFile } from "./file-upload";
import UIProvider from "../../providers/ui-provider";

const file = (name: string, type = "application/pdf", size = 10) =>
  new File(["x".repeat(size)], name, { type });

/** Drops files on the field, like a drag from the desktop. */
const drop = (target: Element, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files, types: ["Files"] } });

/** Pastes files - a screenshot, files copied in the file manager. */
const paste = (target: Element, files: File[]) =>
  fireEvent.paste(target, {
    clipboardData: { files, types: files.length ? ["Files"] : ["text/plain"] },
  });

/** The input of the native picker - the first file input of the field. */
const picker = () =>
  document.querySelector<HTMLInputElement>(
    "input[type=file]",
  ) as HTMLInputElement;

/** Picks files in the native picker. */
const pick = (files: File[]) =>
  fireEvent.change(picker(), { target: { files } });

/** The names of the files a form submits under `name`. */
const submitted = (form: HTMLFormElement, name: string) =>
  new FormData(form)
    .getAll(name)
    .map((entry) => (typeof entry === "string" ? entry : entry.name));

/** What the field last said to screen readers. */
const announced = () => screen.getByRole("status").textContent;

/** An upload that resolves or fails when told to. */
function controllableUpload() {
  const pending: {
    file: File;
    progress: (percent: number) => void;
    reject: (error: unknown) => void;
    resolve: (result: UploadedFile) => void;
    signal: AbortSignal;
  }[] = [];

  const upload = vi.fn(
    (
      uploaded: File,
      {
        onProgress,
        signal,
      }: { onProgress: (percent: number) => void; signal: AbortSignal },
    ) =>
      new Promise<UploadedFile>((resolve, reject) => {
        pending.push({
          file: uploaded,
          progress: onProgress,
          reject,
          resolve,
          signal,
        });
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  );

  return { pending, upload };
}

/**
 * A `DataTransfer` whose `files` is a FileList of jsdom - jsdom has no
 * `DataTransfer`, and a FileList a file input takes cannot be made
 * otherwise. Built from its internals, so that `new FormData(form)` sees
 * the files put in an input.
 */
function stubDataTransfer() {
  const require = createRequire(import.meta.url);
  const utils = require("jsdom/lib/generated/idl/utils.js");
  const fileLists = require("jsdom/lib/generated/idl/FileList.js");
  const globalObject = utils.implForWrapper(document)._globalObject;

  class TestDataTransfer {
    readonly #list = fileLists.createImpl(globalObject);
    readonly items = {
      add: (added: File) => {
        this.#list.push(utils.implForWrapper(added));
      },
    };

    get files(): FileList {
      return utils.wrapperForImpl(this.#list);
    }
  }

  vi.stubGlobal("DataTransfer", TestDataTransfer);
}

describe("FileUpload", () => {
  it.each([false, true])(
    "unblocks its external form when hidden validation and upload finish, required=%s",
    async (required) => {
      const { pending, upload } = controllableUpload();
      let pass = () => {};
      const validate = () =>
        new Promise<undefined>((resolve) => {
          pass = () => resolve(undefined);
        });
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <form aria-label="Order" id="hidden-upload-order" onSubmit={onSubmit}>
            <button type="submit">Save</button>
          </form>
          <Activity mode={mode}>
            <FileUpload
              form="hidden-upload-order"
              name="file"
              required={required}
              upload={upload}
              validate={validate}
            />
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      drop(screen.getByRole("group"), [file("a.pdf")]);
      expect(form.checkValidity()).toBe(false);

      rerender(view("hidden"));
      expect(form.checkValidity()).toBe(false);
      await act(async () => pass());
      expect(upload).toHaveBeenCalledTimes(1);
      expect(form.checkValidity()).toBe(false);
      act(() => form.requestSubmit());
      expect(onSubmit).not.toHaveBeenCalled();

      await act(async () => pending[0].resolve({ value: "a" }));
      expect(submitted(form, "file")).toEqual(["a"]);
      expect(form.checkValidity()).toBe(true);
      act(() => form.requestSubmit());
      expect(onSubmit).toHaveBeenCalledTimes(1);

      rerender(view("visible"));
      expect(form.checkValidity()).toBe(true);
      expect(submitted(form, "file")).toEqual(["a"]);
    },
  );

  it.each([false, true])(
    "keeps parent state from uploads finishing while hidden, together=%s",
    async (together) => {
      const { pending, upload } = controllableUpload();
      function Order({ mode }: { mode: "hidden" | "visible" }) {
        const [stored, setStored] = useState<string[]>([]);
        return (
          <StrictMode>
            <output aria-label="Stored files">{stored.join(",")}</output>
            <Activity mode={mode}>
              <FileUpload
                multiple
                onUpload={(result) => setStored([...stored, result.value!])}
                upload={upload}
              />
            </Activity>
          </StrictMode>
        );
      }
      const { rerender } = render(<Order mode="visible" />);
      drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
      expect(upload).toHaveBeenCalledTimes(2);

      rerender(<Order mode="hidden" />);
      if (together) {
        await act(async () => {
          pending[0].resolve({ value: "a" });
          pending[1].resolve({ value: "b" });
        });
      } else {
        await act(async () => pending[0].resolve({ value: "a" }));
        expect(
          screen.getByRole("status", { name: "Stored files" }),
        ).toHaveTextContent("a");
        await act(async () => pending[1].resolve({ value: "b" }));
      }
      expect(
        screen.getByRole("status", { name: "Stored files" }),
      ).toHaveTextContent("a,b");
      rerender(<Order mode="visible" />);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    },
  );

  it("calls the new callbacks when a hidden upload finishes", async () => {
    const { pending, upload } = controllableUpload();
    const previous = vi.fn();
    const current = vi.fn();
    const view = (mode: "hidden" | "visible", onUpload: typeof current) => (
      <StrictMode>
        <Activity mode={mode}>
          <FileUpload data-mode={mode} onUpload={onUpload} upload={upload} />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible", previous));
    const group = screen.getByRole("group");
    drop(group, [file("a.pdf")]);
    rerender(view("hidden", current));
    await act(async () => {});
    expect(group).toHaveAttribute("data-mode", "hidden");

    await act(async () => pending[0].resolve({ value: "a" }));
    expect(current).toHaveBeenCalledExactlyOnceWith({ value: "a" });
    expect(previous).not.toHaveBeenCalled();
  });

  it.each(["reset", "canceled reset", "unmount"])(
    "handles %s before a hidden upload callback can receive fresh parent state",
    async (action) => {
      const { pending, upload } = controllableUpload();
      const onUpload = vi.fn();
      let resume = () => {};
      const ready = new Promise<void>((resolve) => {
        resume = resolve;
      });
      function WaitingContent({ wait }: { wait: boolean }) {
        if (wait) use(ready);
        return null;
      }
      function Order({ mode }: { mode: "hidden" | "visible" }) {
        const [stored, setStored] = useState<string[]>([]);
        return (
          <StrictMode>
            <form
              aria-label="Order"
              id="suspended-upload-order"
              onReset={
                action === "canceled reset"
                  ? (event) => event.preventDefault()
                  : undefined
              }
            />
            <Activity mode={mode}>
              <Suspense fallback={null}>
                <WaitingContent wait={stored.length > 0} />
                <FileUpload
                  defaultAttachments={[{ value: "default-file" }]}
                  form="suspended-upload-order"
                  multiple
                  name="files"
                  onUpload={(result) => {
                    onUpload(result);
                    setStored([...stored, result.value!]);
                  }}
                  upload={upload}
                />
              </Suspense>
            </Activity>
          </StrictMode>
        );
      }
      const { rerender, unmount } = render(<Order mode="visible" />);
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
      rerender(<Order mode="hidden" />);
      await act(async () => {
        pending[0].resolve({ value: "a" });
        pending[1].resolve({ value: "b" });
      });
      expect(onUpload).toHaveBeenCalledTimes(1);

      if (action === "unmount") unmount();
      else {
        act(() => form.reset());
        await act(() => new Promise((resolve) => setTimeout(resolve)));
      }
      await act(async () => resume());
      expect(onUpload).toHaveBeenCalledTimes(
        action === "canceled reset" ? 2 : 1,
      );
      if (action === "reset") {
        expect(submitted(form, "files")).toEqual(["default-file"]);
      }
    },
  );

  it("finishes asynchronous validation while hidden by Activity", async () => {
    const { pending, upload } = controllableUpload();
    let pass = () => {};
    const validate = () =>
      new Promise<undefined>((resolve) => {
        pass = () => resolve(undefined);
      });
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <Activity mode={mode}>
          <form aria-label="Order">
            <FileUpload name="file" upload={upload} validate={validate} />
          </form>
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible"));
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    drop(screen.getByRole("group"), [file("a.pdf")]);
    expect(form.checkValidity()).toBe(false);

    rerender(view("hidden"));
    await act(async () => pass());
    expect(upload).toHaveBeenCalledTimes(1);
    await act(async () => pending[0].resolve({ value: "a" }));
    rerender(view("visible"));

    expect(form.checkValidity()).toBe(true);
    expect(submitted(form, "file")).toEqual(["a"]);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it.each([false, true])(
    "blocks its external form until all uploads settle, with required=%s",
    async (required) => {
      const { pending, upload } = controllableUpload();
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      render(
        <>
          <form aria-label="Order" id="order" onSubmit={onSubmit}>
            <button type="submit">Save</button>
          </form>
          <form aria-label="Other">
            <FileUpload
              concurrency={1}
              defaultAttachments={[{ value: "old-file" }]}
              form="order"
              multiple
              name="files"
              required={required}
              upload={upload}
            />
          </form>
        </>,
      );
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      expect(form.checkValidity()).toBe(true);
      drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
      expect(form.checkValidity()).toBe(false);
      expect(
        screen
          .getByRole<HTMLFormElement>("form", { name: "Other" })
          .checkValidity(),
      ).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).not.toHaveBeenCalled();

      await act(async () => pending[0].resolve({ value: "a" }));
      expect(pending).toHaveLength(2);
      expect(form.checkValidity()).toBe(false);
      fireEvent.click(
        screen.getByRole("button", { name: "Cancel uploading b.pdf" }),
      );
      expect(form.checkValidity()).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(submitted(form, "files")).toEqual(["old-file", "a"]);
    },
  );

  it("releases an optional form after an upload fails or finishes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { pending, upload } = controllableUpload();
    render(
      <form aria-label="Order">
        <FileUpload name="file" upload={upload} />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    drop(screen.getByRole("group"), [file("a.pdf")]);
    expect(form.checkValidity()).toBe(false);
    await act(async () => pending[0].reject(new Error("Upload failed")));
    expect(form.checkValidity()).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry uploading a.pdf" }),
    );
    expect(form.checkValidity()).toBe(false);
    await act(async () => pending[1].resolve({ value: "a" }));
    expect(form.checkValidity()).toBe(true);
    expect(submitted(form, "file")).toEqual(["a"]);
  });

  it.each(["disabled", "readOnly", "fieldset"])(
    "ignores pending work while %s, and clears it on reset",
    async (mode) => {
      const { pending, upload } = controllableUpload();
      let pass = () => {};
      const validate = () =>
        new Promise<undefined>((resolve) => {
          pass = () => resolve(undefined);
        });
      const view = (locked: boolean) => (
        <UIProvider locale={cs}>
          <form aria-label="Order">
            <fieldset disabled={mode === "fieldset" && locked}>
              <FileUpload
                disabled={mode === "disabled" && locked}
                label="Files"
                name="file"
                readOnly={mode === "readOnly" && locked}
                upload={upload}
                validate={validate}
              />
            </fieldset>
          </form>
        </UIProvider>
      );
      const { rerender } = render(view(false));
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      drop(screen.getByRole("group", { name: "Files:" }), [file("a.pdf")]);
      expect(form.checkValidity()).toBe(false);
      expect(
        form.querySelector<HTMLInputElement>("input[type=text]")
          ?.validationMessage,
      ).toBe(cs.messages.ui.fileUpload.waitForValidation);
      rerender(view(true));
      expect(form.checkValidity()).toBe(true);
      rerender(view(false));
      expect(form.checkValidity()).toBe(false);

      await act(async () => pass());
      expect(
        form.querySelector<HTMLInputElement>("input[type=text]")
          ?.validationMessage,
      ).toBe(cs.messages.ui.fileUpload.waitForUpload);
      rerender(view(true));
      expect(form.checkValidity()).toBe(true);
      rerender(view(false));
      expect(form.checkValidity()).toBe(false);
      act(() => form.reset());
      await act(() => new Promise((resolve) => setTimeout(resolve)));
      expect(form.checkValidity()).toBe(true);
      expect(pending[0].signal.aborted).toBe(true);
    },
  );

  it("uploads dropped files side by side", async () => {
    const { pending, upload } = controllableUpload();
    render(
      <FileUpload label="Attachments" multiple name="files" upload={upload} />,
    );

    drop(screen.getByRole("group", { name: "Attachments:" }), [
      file("a.pdf"),
      file("b.pdf"),
    ]);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    // The list keeps the order of the files, whichever is stored first
    await act(async () => pending[1].resolve({ value: "blob-b" }));
    await act(async () => pending[0].resolve({ value: "blob-a" }));

    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
    expect(
      Array.from(
        document.querySelectorAll<HTMLInputElement>("input[name='files']"),
        (input) => input.value,
      ),
    ).toEqual(["blob-a", "blob-b"]);
  });

  it("holds the stored files in the form by onUpload and onAttachmentsChange", async () => {
    const { pending, upload } = controllableUpload();
    const seen: [string, string[], boolean][] = [];
    const record = (callback: string) => {
      const form = screen.getByRole<HTMLFormElement>("form", {
        name: "Order",
      });
      // Also whether the form waits no more for the upload
      seen.push([callback, submitted(form, "files"), form.checkValidity()]);
    };
    render(
      <form aria-label="Order">
        <FileUpload
          defaultAttachments={[
            { id: "old", filename: "old.pdf", value: "old" },
          ]}
          multiple
          name="files"
          onAttachmentsChange={() => record("attachments")}
          onUpload={() => record("upload")}
          upload={upload}
        />
      </form>,
    );

    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => pending[0].resolve({ value: "blob-a" }));
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove old.pdf" }));
    expect(seen).toEqual([
      ["attachments", ["old", "blob-a"], true],
      ["upload", ["old", "blob-a"], true],
      ["attachments", ["blob-a"], true],
    ]);
  });

  it.each([false, true])(
    "respects the caller's drop handler with preventDefault=%s",
    (preventDefault) => {
      const { upload } = controllableUpload();
      const onDrop = vi.fn((event: React.DragEvent<HTMLDivElement>) => {
        expect(upload).not.toHaveBeenCalled();
        if (preventDefault) event.preventDefault();
      });
      render(<FileUpload onDrop={onDrop} upload={upload} />);
      const group = screen.getByRole("group");
      const dataTransfer = {
        files: [file("a.pdf")],
        types: ["Files"],
      };

      fireEvent.dragOver(group, { dataTransfer });
      expect(group).toHaveClass("ring-2");
      fireEvent.drop(group, { dataTransfer });

      expect(onDrop).toHaveBeenCalledTimes(1);
      expect(upload).toHaveBeenCalledTimes(preventDefault ? 0 : 1);
      expect(screen.queryAllByRole("listitem")).toHaveLength(
        preventDefault ? 0 : 1,
      );
      expect(group).not.toHaveClass("ring-2");
    },
  );

  it("uploads one after another with a concurrency of 1", async () => {
    const { pending, upload } = controllableUpload();
    render(<FileUpload concurrency={1} multiple upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Waiting to upload…")).toBeInTheDocument();
    await act(async () => pending[0].resolve({ value: "blob-a" }));
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "b.pdf" }),
      expect.anything(),
    );
  });

  it("reports how many files wait for or run their upload", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    const { pending, upload } = controllableUpload();
    render(
      <FileUpload
        concurrency={1}
        multiple
        onPendingChange={onPendingChange}
        upload={upload}
      />,
    );
    // Not told of the 0 it starts with
    expect(onPendingChange).not.toHaveBeenCalled();

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    expect(onPendingChange).toHaveBeenLastCalledWith(2);

    await act(async () => pending[0].resolve({ value: "blob-a" }));
    expect(onPendingChange).toHaveBeenLastCalledWith(1);

    await act(async () => pending[1].reject(new Error("Offline")));
    expect(onPendingChange).toHaveBeenLastCalledWith(0);

    // A retry waits again
    await user.click(screen.getByRole("button", { name: /Retry/ }));
    expect(onPendingChange).toHaveBeenLastCalledWith(1);
    await user.click(
      screen.getByRole("button", { name: "Cancel uploading b.pdf" }),
    );
    expect(onPendingChange).toHaveBeenLastCalledWith(0);
  });

  it("reports no pending uploads once the field goes away with them", async () => {
    const onPendingChange = vi.fn();
    const { upload } = controllableUpload();
    const { unmount } = render(
      // StrictMode mounts the field twice - which ends no upload
      <StrictMode>
        <FileUpload onPendingChange={onPendingChange} upload={upload} />
      </StrictMode>,
    );

    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => {});
    expect(onPendingChange.mock.calls).toEqual([[1]]);

    // A submit button waiting for the upload comes back
    await act(async () => unmount());
    expect(onPendingChange.mock.calls).toEqual([[1], [0]]);
  });

  it("cancels the upload - and aborts it when it goes away", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const { unmount } = render(<FileUpload upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    await user.click(
      screen.getByRole("button", { name: "Cancel uploading a.pdf" }),
    );

    expect(pending[0].signal.aborted).toBe(true);
    expect(screen.queryByText("a.pdf")).toBeNull();
    expect(screen.getByRole("button", { name: /Upload/ })).toBeInTheDocument();

    drop(screen.getByRole("group"), [file("b.pdf")]);
    await act(async () => unmount());
    expect(pending[1].signal.aborted).toBe(true);
  });

  it("lets abort listeners update their owner after the field unmounts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { upload } = controllableUpload();
    function Page({ visible }: { visible: boolean }) {
      const [aborted, setAborted] = useState(false);
      return (
        <>
          {visible && (
            <FileUpload
              upload={(file, options) => {
                options.signal.addEventListener("abort", () =>
                  setAborted(true),
                );
                return upload(file, options);
              }}
            />
          )}
          <output>{aborted ? "Cancelled" : "Pending"}</output>
        </>
      );
    }
    const { rerender } = render(<Page visible />);
    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => rerender(<Page visible={false} />));
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled");
    expect(error).not.toHaveBeenCalled();
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
      "notes.txt: Files of this type cannot be uploaded here.",
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
    expect(screen.getByRole("group")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /Upload/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByText("or drag and drop here")).toBeNull();
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
      "c.pdf: You can attach up to 2 files.",
    );

    // An upload takes its room while it runs
    drop(screen.getByRole("group"), [file("d.pdf")]);
    expect(upload).toHaveBeenCalledTimes(1);

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
      "d.pdf: Připojit lze nejvýše 3 soubory.",
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
      "big.pdf: Maximální velikost souboru 2,5 MB byla překročena.",
    );
  });

  it("names the files refused for one reason once - many of them shortened", () => {
    const upload = vi.fn();
    const { rerender } = render(
      <FileUpload accept=".pdf" multiple upload={upload} />,
    );

    drop(
      screen.getByRole("group"),
      ["a", "b", "c", "d", "e", "f"].map((name) =>
        file(`${name}.txt`, "text/plain"),
      ),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "a.txt, b.txt, c.txt, and 3 more: Files of this type cannot be uploaded here.",
    );

    rerender(
      <UIProvider locale={cs}>
        <FileUpload accept=".pdf" maxFileSize={1} multiple upload={upload} />
      </UIProvider>,
    );
    drop(screen.getByRole("group"), [
      file("a.txt", "text/plain"),
      file("big.pdf", "application/pdf", 2e6),
      file("b.txt", "text/plain"),
    ]);
    // Czech keeps "a" on the line of the next word
    const lines = Array.from(screen.getByRole("alert").children, (line) =>
      line.textContent?.replace(/\s/g, " "),
    );
    expect(lines).toEqual([
      "a.txt a b.txt: Soubory tohoto typu sem nelze nahrát.",
      "big.pdf: Maximální velikost souboru 1 MB byla překročena.",
    ]);
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

    // While a file uploads it takes more
    rerender(<FileUpload multiple upload={upload} />);
    drop(group, [file("b.pdf")]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(fireEvent.dragOver(group, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(fireEvent.drop(group, { dataTransfer })).toBe(false);
    expect(upload).toHaveBeenCalledTimes(2);

    await act(async () =>
      pending[0].resolve({ filename: "b.pdf", id: "b", url: "/b.pdf" }),
    );
    expect(screen.getByRole("link", { name: "b.pdf" })).toBeInTheDocument();
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
    // Not while it uploads
    expect(form.checkValidity()).toBe(false);
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
    // The attached file stays until the new one is stored
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
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

  it("drops the running upload for a newer file without multiple", async () => {
    const { pending, upload } = controllableUpload();
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    drop(screen.getByRole("group"), [file("b.pdf")]);

    expect(pending[0].signal.aborted).toBe(true);
    expect(screen.queryByText("a.pdf")).toBeNull();
    await act(async () => pending[1].resolve({ value: "blob-b" }));
    expect(onUpload).toHaveBeenCalledExactlyOnceWith({ value: "blob-b" });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
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

  it("keeps a running upload when defaultAttachments arrive", () => {
    const { upload } = controllableUpload();
    const { rerender } = render(<FileUpload multiple upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    rerender(
      <FileUpload
        defaultAttachments={[{ filename: "b.pdf", id: "b" }]}
        multiple
        upload={upload}
      />,
    );
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(screen.queryByText("b.pdf")).toBeNull();
  });

  it("takes its defaultAttachments back when the form is reset", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const onRemove = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          accept=".pdf"
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
    drop(screen.getByRole("group"), [file("c.pdf"), file("x.exe", "")]);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    // The running upload is dropped with the rest, and the refusal
    expect(pending[1].signal.aborted).toBe(true);
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    await waitFor(() =>
      expect(new FormData(form).getAll("files")).toEqual(["blob-a"]),
    );
    expect(screen.queryByText("b.pdf")).toBeNull();
    expect(screen.queryByText("c.pdf")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

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

  it("cancels one upload, whatever upload does - the others go on", async () => {
    const user = userEvent.setup();
    // Ignores the signal and resolves later
    const late: ((result: UploadedFile) => void)[] = [];
    const upload = vi.fn(
      () => new Promise<UploadedFile>((resolve) => late.push(resolve)),
    );
    const onUpload = vi.fn();
    render(<FileUpload multiple onUpload={onUpload} upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await user.click(
      screen.getByRole("button", { name: "Cancel uploading a.pdf" }),
    );

    // The focus goes to the file taking its place
    expect(screen.queryByText("a.pdf")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Cancel uploading b.pdf" }),
    ).toHaveFocus();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);

    // The cancelled upload finishing late changes nothing
    await act(async () => late[0]({ value: "blob-a" }));
    expect(screen.queryByText("a.pdf")).toBeNull();
    expect(onUpload).not.toHaveBeenCalled();

    await act(async () => late[1]({ value: "blob-b" }));
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
    expect(onUpload).toHaveBeenCalledExactlyOnceWith({ value: "blob-b" });
  });

  it("keeps the focus where it is while files upload", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    render(<FileUpload multiple upload={upload} />);

    const button = screen.getByRole("button", { name: /Upload/ });
    await user.click(button);
    pick([file("a.pdf"), file("b.pdf")]);
    // The button stays - more files can be picked meanwhile
    expect(button).toHaveFocus();

    // The cancel button of a finished upload becomes its remove button
    act(() =>
      screen.getByRole("button", { name: "Cancel uploading a.pdf" }).focus(),
    );
    await act(async () => pending[0].resolve({ value: "blob-a" }));
    expect(screen.getByRole("button", { name: "Remove a.pdf" })).toHaveFocus();
  });

  it.each([false, true])(
    "keeps focus after removing files from the list, shadow root=%s",
    (inShadowRoot) => {
      const host = document.createElement("div");
      document.body.append(host);
      const root = inShadowRoot
        ? host.attachShadow({ mode: "open" })
        : document;
      const container = inShadowRoot
        ? root.appendChild(document.createElement("div"))
        : host;
      const { unmount } = render(
        <FileUpload
          defaultAttachments={[
            { filename: "a.pdf", id: "a" },
            { filename: "b.pdf", id: "b" },
            { filename: "c.pdf", id: "c" },
          ]}
          multiple
        />,
        { container },
      );
      const field = within(container);
      const remove = (filename: string) =>
        field.getByRole("button", { name: `Remove ${filename}` });

      try {
        act(() => remove("b.pdf").focus());
        fireEvent.click(remove("b.pdf"));
        expect(root.activeElement).toBe(remove("c.pdf"));
        fireEvent.click(remove("c.pdf"));
        expect(root.activeElement).toBe(remove("a.pdf"));
        fireEvent.click(remove("a.pdf"));
        expect(root.activeElement).toBe(
          field.getByRole("button", { name: /Upload/ }),
        );
      } finally {
        unmount();
        host.remove();
      }
    },
  );

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

  it("ignores empty tokens of accept", async () => {
    const upload = vi.fn(async () => ({ value: "blob" }));
    const onError = vi.fn();
    const { rerender } = render(
      <FileUpload accept=".pdf," onError={onError} upload={upload} />,
    );

    // A file of a type the system does not know - no empty token matches it
    drop(screen.getByRole("group"), [file("setup.exe", "")]);
    expect(upload).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);

    // No token at all - any file, like the browser takes it
    rerender(<FileUpload accept=" , " onError={onError} upload={upload} />);
    await act(async () =>
      drop(screen.getByRole("group"), [file("setup.exe", "")]),
    );
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("reports each of several files to the callbacks of the latest render", async () => {
    const { pending, upload } = controllableUpload();

    function Parent() {
      const [values, setValues] = useState<string[]>([]);
      return (
        <>
          <FileUpload
            multiple
            // A callback of the state of its render, like most are
            onUpload={(result) => setValues([...values, result.value ?? ""])}
            upload={upload}
          />
          <p data-testid="values">{values.join()}</p>
        </>
      );
    }
    render(<Parent />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await act(async () => pending[0].resolve({ value: "a" }));
    await act(async () => pending[1].resolve({ value: "b" }));

    expect(screen.getByTestId("values")).toHaveTextContent("a,b");
  });

  it("reports each file of an upload that settles at once to the latest callbacks", async () => {
    // A field that only collects the files, a cached result - the next file
    // finishes before the parent would render the one before
    function Parent() {
      const [values, setValues] = useState<string[]>([]);
      const [refused, setRefused] = useState<string[]>([]);
      return (
        <>
          <FileUpload
            accept=".pdf"
            multiple
            onError={(_, picked) => setRefused([...refused, picked.name])}
            onUpload={(result) => setValues([...values, result.value ?? ""])}
            upload={async (picked) => ({ value: picked.name })}
          />
          <p data-testid="values">{values.join()}</p>
          <p data-testid="refused">{refused.join()}</p>
        </>
      );
    }
    render(<Parent />);

    await act(async () =>
      drop(screen.getByRole("group"), [
        file("a.pdf"),
        file("x.exe", ""),
        file("b.pdf"),
        file("y.exe", ""),
        file("c.pdf"),
      ]),
    );

    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(3),
    );
    expect(screen.getByTestId("values")).toHaveTextContent("a.pdf,b.pdf,c.pdf");
    expect(screen.getByTestId("refused")).toHaveTextContent("x.exe,y.exe");
  });

  it.each(["onUpload", "onError"] as const)(
    "uploads none of the files still waiting once an %s takes the field away",
    async (callback) => {
      const signals: AbortSignal[] = [];
      const upload = vi.fn(
        (picked: File, { signal }: { signal: AbortSignal }) => {
          signals.push(signal);
          return new Promise<UploadedFile>((resolve) =>
            setTimeout(() => resolve({ value: picked.name }), 5),
          );
        },
      );
      const onUpload = vi.fn();
      // A dialog the field closes, a step of a wizard it moves on from
      function Parent() {
        const [open, setOpen] = useState(true);
        return open ? (
          <FileUpload
            accept=".pdf"
            concurrency={1}
            multiple
            onError={() => callback === "onError" && setOpen(false)}
            onUpload={(result) => {
              onUpload(result.value);
              if (callback === "onUpload") setOpen(false);
            }}
            upload={upload}
          />
        ) : (
          <p>Closed</p>
        );
      }
      render(<Parent />);

      await act(async () =>
        drop(screen.getByRole("group"), [
          ...(callback === "onError" ? [file("x.exe", "")] : []),
          file("a.pdf"),
          file("b.pdf"),
        ]),
      );

      await screen.findByText("Closed");
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(onUpload).toHaveBeenCalledTimes(callback === "onUpload" ? 1 : 0);
      expect(upload).toHaveBeenCalledTimes(callback === "onUpload" ? 1 : 0);
    },
  );

  it("aborts the uploads running side by side once an onUpload takes the field away", async () => {
    const { pending, upload } = controllableUpload();
    function Parent() {
      const [open, setOpen] = useState(true);
      return open ? (
        <FileUpload multiple onUpload={() => setOpen(false)} upload={upload} />
      ) : (
        <p>Closed</p>
      );
    }
    render(<Parent />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await act(async () => pending[0].resolve({ value: "a" }));

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(pending[1].signal.aborted).toBe(true);
  });

  it("takes classes and hides the required mark from screen readers", () => {
    render(
      <FileUpload className="w-80" label="Invoice" required upload={vi.fn()} />,
    );

    const group = screen.getByRole("group", { name: "Invoice:" });
    expect(group).toHaveClass("w-80");
    // No margin of its own - the form spaces its fields
    expect(group.className).not.toMatch(/\bm[ytb]?-/);
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("is named by a label of any content", () => {
    render(
      <FileUpload
        label={
          <>
            Invoice <em>(PDF)</em>
          </>
        }
        upload={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Invoice (PDF):" }),
    ).toBeInTheDocument();
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

  it("shows the error of the form and a refusal together", () => {
    render(
      <FileUpload
        accept=".pdf"
        error="Attach the invoice"
        label="Invoice"
        upload={vi.fn()}
      />,
    );

    drop(screen.getByRole("group"), [file("notes.txt", "text/plain")]);
    expect(
      Array.from(
        screen.getByRole("alert").children,
        (line) => line.textContent,
      ),
    ).toEqual([
      "Attach the invoice",
      "notes.txt: Files of this type cannot be uploaded here.",
    ]);
  });
});

describe("FileUpload uploads side by side", () => {
  it("starts up to concurrency uploads, and the next as one ends", async () => {
    const { pending, upload } = controllableUpload();
    render(<FileUpload concurrency={2} multiple upload={upload} />);

    drop(screen.getByRole("group"), [
      file("a.pdf"),
      file("b.pdf"),
      file("c.pdf"),
    ]);

    expect(upload).toHaveBeenCalledTimes(2);
    const [, , waiting] = screen.getAllByRole("listitem");
    expect(waiting).toHaveTextContent("c.pdfWaiting to upload…");

    await act(async () => pending[1].resolve({ value: "b" }));
    expect(upload).toHaveBeenCalledTimes(3);
    expect(upload).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "c.pdf" }),
      expect.anything(),
    );
  });

  it("shows the progress of each file", () => {
    const { pending, upload } = controllableUpload();
    render(<FileUpload multiple upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    act(() => {
      pending[0].progress(30);
      pending[1].progress(70.8);
    });

    const [a, b] = screen.getAllByRole("progressbar", { name: "Uploading…" });
    expect(a).toHaveAttribute("aria-valuenow", "30");
    expect(a).toHaveAccessibleDescription("a.pdf");
    expect(b).toHaveAttribute("aria-valuenow", "70.8");
    expect(b).toHaveAccessibleDescription("b.pdf");
    // Rounded down - done only at 100 %
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("shows a failed upload in its row, to be tried again", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const onError = vi.fn();
    const onUpload = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FileUpload
        label="Attachments"
        multiple
        name="files"
        onError={onError}
        onUpload={onUpload}
        upload={upload}
      />,
    );

    const failure = new Error("503 Service Unavailable");
    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => pending[0].reject(failure));

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("a.pdfThe upload failed.");
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      failure,
      expect.objectContaining({ name: "a.pdf" }),
    );
    // The message is the row's - the field is not invalid
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-invalid");
    expect(document.querySelector("input[name='files']")).toBeNull();

    // The retry button gives the focus to the cancel button of the row
    const retry = screen.getByRole("button", { name: "Retry uploading a.pdf" });
    expect(retry).toHaveTextContent("Retry");
    await user.click(retry);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Cancel uploading a.pdf" }),
    ).toHaveFocus();

    await act(async () => pending[1].resolve({ value: "blob-a" }));
    expect(onUpload).toHaveBeenCalledExactlyOnceWith({ value: "blob-a" });
    expect(
      document.querySelector<HTMLInputElement>("input[name='files']")?.value,
    ).toBe("blob-a");
  });

  it("removes a failed upload without onRemove", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    const onRemove = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FileUpload onRemove={onRemove} upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    await act(async () => pending[0].reject(new Error("Failed")));
    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Upload/ })).toHaveFocus();
  });

  it("cancels a waiting file before it starts", async () => {
    const user = userEvent.setup();
    const { pending, upload } = controllableUpload();
    render(<FileUpload concurrency={1} multiple upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await user.click(
      screen.getByRole("button", { name: "Cancel uploading b.pdf" }),
    );
    await act(async () => pending[0].resolve({ value: "a" }));

    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("says the uploads together - when they start and once they are over", async () => {
    const { pending, upload } = controllableUpload();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FileUpload multiple upload={upload} />);

    expect(announced()).toBe("");
    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    expect(announced()).toBe("Uploading 2 files…");

    // Not at every step, nor at each file
    act(() => pending[0].progress(50));
    await act(async () => pending[0].resolve({ value: "a" }));
    expect(announced()).toBe("Uploading 2 files…");

    await act(async () => pending[1].reject(new Error("Failed")));
    expect(announced()).toBe("1 file uploaded. 1 upload failed.");
  });

  it("says the uploads as the language does", async () => {
    const upload = vi.fn(async (picked: File) => ({ value: picked.name }));
    render(
      <UIProvider locale={cs}>
        <FileUpload multiple upload={upload} />
      </UIProvider>,
    );

    await act(async () =>
      drop(screen.getByRole("group"), [
        file("a.pdf"),
        file("b.pdf"),
        file("c.pdf"),
      ]),
    );
    await waitFor(() => expect(announced()).toBe("Byly nahrány 3 soubory."));
  });
});

describe("FileUpload without upload", () => {
  beforeEach(stubDataTransfer);
  afterEach(() => vi.unstubAllGlobals());

  it("submits files whose asynchronous validation finished while hidden", async () => {
    let pass = () => {};
    const validate = () =>
      new Promise<undefined>((resolve) => {
        pass = () => resolve(undefined);
      });
    const onFilesChange = vi.fn();
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <form aria-label="Order" id="hidden-native-order" />
        <Activity mode={mode}>
          <FileUpload
            form="hidden-native-order"
            name="file"
            onFilesChange={onFilesChange}
            required
            validate={validate}
          />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible"));
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    drop(screen.getByRole("group"), [file("a.pdf")]);
    expect(form.checkValidity()).toBe(false);
    rerender(view("hidden"));
    await act(async () => pass());

    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(form.checkValidity()).toBe(true);
    expect(submitted(form, "file")).toEqual(["a.pdf"]);
  });

  it("holds the picked files in the form by onFilesChange, which may submit it", async () => {
    const seen: string[][] = [];
    render(
      <form aria-label="Order">
        <FileUpload
          multiple
          name="files"
          onFilesChange={() =>
            seen.push(
              submitted(
                screen.getByRole<HTMLFormElement>("form", { name: "Order" }),
                "files",
              ),
            )
          }
        />
      </form>,
    );

    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove a.pdf" }));
    expect(seen).toEqual([["a.pdf", "b.pdf"], ["b.pdf"]]);
  });

  it("waits for every independent file check before submitting", async () => {
    const checks: ((message?: string) => void)[] = [];
    render(
      <form aria-label="Order">
        <FileUpload
          multiple
          name="files"
          validate={() =>
            new Promise<string | undefined>((resolve) => checks.push(resolve))
          }
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    drop(screen.getByRole("group"), [file("a.pdf")]);
    drop(screen.getByRole("group"), [file("b.pdf")]);
    expect(form.checkValidity()).toBe(false);
    await act(async () => checks[1]());
    expect(form.checkValidity()).toBe(false);
    await act(async () => checks[0]("File refused"));
    expect(form.checkValidity()).toBe(true);
    expect(submitted(form, "files")).toEqual(["b.pdf"]);
  });

  it.each(["replacement", "reset"])(
    "does not wait for a file check superseded by %s",
    async (action) => {
      const checks: ((message?: string) => void)[] = [];
      render(
        <form aria-label="Order">
          <FileUpload
            name="file"
            validate={(picked) =>
              picked.name === "old.pdf"
                ? new Promise<string | undefined>((resolve) =>
                    checks.push(resolve),
                  )
                : undefined
            }
          />
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      drop(screen.getByRole("group"), [file("old.pdf")]);
      expect(form.checkValidity()).toBe(false);
      if (action === "reset") {
        act(() => form.reset());
        await act(() => new Promise((resolve) => setTimeout(resolve)));
      } else {
        drop(screen.getByRole("group"), [file("new.pdf")]);
      }
      expect(form.checkValidity()).toBe(true);
      // Another pending check must stay blocked when the superseded one settles.
      drop(screen.getByRole("group"), [file("old.pdf")]);
      await act(async () => checks[0]());
      expect(form.checkValidity()).toBe(false);
      await act(async () => checks[1]());
      expect(form.checkValidity()).toBe(true);
    },
  );

  it("submits the picked, dropped and pasted files with the form", async () => {
    const user = userEvent.setup();
    const onFilesChange = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          label="Documents"
          multiple
          name="documents"
          onFilesChange={onFilesChange}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    pick([file("a.pdf"), file("b.pdf")]);
    // The same file can be picked again
    expect(picker().value).toBe("");
    expect(submitted(form, "documents")).toEqual(["a.pdf", "b.pdf"]);

    drop(screen.getByRole("group"), [file("c.pdf")]);
    paste(screen.getByRole("button", { name: /Upload/ }), [
      file("image.png", "image/png"),
    ]);
    expect(submitted(form, "documents")).toEqual([
      "a.pdf",
      "b.pdf",
      "c.pdf",
      "image.png",
    ]);
    expect(announced()).toBe("1 file added.");

    await user.click(screen.getByRole("button", { name: "Remove b.pdf" }));
    expect(submitted(form, "documents")).toEqual([
      "a.pdf",
      "c.pdf",
      "image.png",
    ]);
    expect(
      onFilesChange.mock.lastCall?.[0].map((picked: File) => picked.name),
    ).toEqual(["a.pdf", "c.pdf", "image.png"]);
    // Nothing is uploaded - no progress, no hidden inputs
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("gives the files to a form action - and is reset after it", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const onFilesChange = vi.fn();
    render(
      <form action={action}>
        <FileUpload multiple name="documents" onFilesChange={onFilesChange} />
        <button type="submit">Send</button>
      </form>,
    );

    pick([file("a.pdf"), file("b.pdf")]);
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.queryByText("a.pdf")).toBeNull());
    const files = action.mock.calls[0][0].getAll("documents");
    expect(files.map((sent: File) => sent.name)).toEqual(["a.pdf", "b.pdf"]);
    expect(files[0]).toBeInstanceOf(File);
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("submits the files it accepts only", () => {
    const onError = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          accept=".pdf"
          maxFileSize={1}
          maxFiles={2}
          multiple
          name="documents"
          onError={onError}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    pick([
      file("a.pdf"),
      file("notes.txt", "text/plain"),
      file("big.pdf", "application/pdf", 2e6),
      file("b.pdf"),
      file("c.pdf"),
    ]);

    expect(submitted(form, "documents")).toEqual(["a.pdf", "b.pdf"]);
    expect(onError.mock.calls.map(([, refused]) => refused.name)).toEqual([
      "notes.txt",
      "big.pdf",
      "c.pdf",
    ]);
  });

  it("keeps one file without multiple", () => {
    const onRemove = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          defaultAttachments={[{ filename: "old.pdf", value: "blob-old" }]}
          name="document"
          onRemove={onRemove}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    // The kept attachment submits its value under the same name
    expect(submitted(form, "document")).toEqual(["blob-old"]);
    drop(screen.getByRole("group"), [file("a.pdf"), file("b.pdf")]);

    expect(submitted(form, "document")).toEqual(["a.pdf"]);
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "old.pdf" }),
    );
  });

  it.each(["throw", "reject"])(
    "reports a native replacement when cleanup of the old attachment fails by %s",
    async (failure) => {
      const cleanupError = new Error("Cleanup failed");
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      const onFilesChange = vi.fn();
      const onAttachmentsChange = vi.fn();
      const onRemove = vi.fn(() => {
        if (failure === "throw") throw cleanupError;
        return Promise.reject(cleanupError);
      });
      const oldAttachment = {
        id: "old",
        filename: "old.pdf",
        value: "blob-old",
      };
      function Field() {
        const [attachments, setAttachments] = useState<UploadedFile[]>([
          oldAttachment,
        ]);
        return (
          <form aria-label="Order">
            <FileUpload
              attachments={attachments}
              name="document"
              onAttachmentsChange={(next) => {
                onAttachmentsChange(next);
                setAttachments(next);
              }}
              onFilesChange={onFilesChange}
              onRemove={onRemove}
            />
          </form>
        );
      }
      render(<Field />);
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      const replacement = file("new.pdf");

      pick([replacement]);

      expect(onRemove).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining(oldAttachment),
      );
      expect(onAttachmentsChange).toHaveBeenCalledExactlyOnceWith([]);
      expect(onFilesChange).toHaveBeenCalledExactlyOnceWith([replacement]);
      expect(screen.queryByText("old.pdf")).toBeNull();
      expect(screen.getByText("new.pdf")).toBeInTheDocument();
      expect(submitted(form, "document")).toEqual(["new.pdf"]);
      await waitFor(() =>
        expect(logger).toHaveBeenCalledExactlyOnceWith(
          "Replaced file cleanup failed",
          cleanupError,
        ),
      );
    },
  );

  it("requires a picked file", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <FileUpload name="document" required />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    expect(form.checkValidity()).toBe(false);
    pick([file("a.pdf")]);
    expect(form.checkValidity()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    expect(form.checkValidity()).toBe(false);
  });

  it("submits nothing while empty or disabled", () => {
    const { rerender } = render(
      <form aria-label="Order">
        <FileUpload name="documents" />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });

    // A native file input would submit an empty file
    expect(submitted(form, "documents")).toEqual([]);

    pick([file("a.pdf")]);
    rerender(
      <form aria-label="Order">
        <FileUpload disabled name="documents" />
      </form>,
    );
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(submitted(form, "documents")).toEqual([]);
  });

  it("submits to the form of its form attribute - and is reset with it", async () => {
    const onFilesChange = vi.fn();
    render(
      <>
        <form id="order" />
        <FileUpload
          form="order"
          multiple
          name="documents"
          onFilesChange={onFilesChange}
        />
      </>,
    );
    const form = document.getElementById("order") as HTMLFormElement;

    pick([file("a.pdf")]);
    expect(submitted(form, "documents")).toEqual(["a.pdf"]);

    act(() => form.reset());
    await waitFor(() => expect(screen.queryByText("a.pdf")).toBeNull());
    expect(submitted(form, "documents")).toEqual([]);
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("shows picked images with preview - and releases them", async () => {
    const user = userEvent.setup();
    const revoke = vi.fn();
    // jsdom has no object URLs
    Object.assign(URL, {
      createObjectURL: () => "blob:local",
      revokeObjectURL: revoke,
    });
    render(<FileUpload name="photos" preview />);

    pick([file("photo.png", "image/png")]);
    expect(document.querySelector("img")).toHaveAttribute("src", "blob:local");

    await user.click(screen.getByRole("button", { name: "Remove photo.png" }));
    expect(revoke).toHaveBeenCalledWith("blob:local");

    const url = URL as Partial<typeof URL>;
    delete url.createObjectURL;
    delete url.revokeObjectURL;
  });

  it("lists the files of a picked folder by their path", () => {
    render(
      <form aria-label="Order">
        <FileUpload directory multiple name="photos" />
      </form>,
    );

    expect(picker()).toHaveAttribute("webkitdirectory");
    const photo = file("a.jpg", "image/jpeg");
    Object.defineProperty(photo, "webkitRelativePath", {
      value: "holiday/a.jpg",
    });
    pick([photo]);

    expect(screen.getByText("holiday/a.jpg")).toBeInTheDocument();
  });
});

describe("FileUpload without DataTransfer", () => {
  it.each([undefined, "File refused"])(
    "blocks submission during native picker validation ending with %s",
    async (message) => {
      const checks: ((message?: string) => void)[] = [];
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      render(
        <form aria-label="Order" onSubmit={onSubmit}>
          <FileUpload
            name="file"
            validate={() =>
              new Promise<string | undefined>((resolve) => checks.push(resolve))
            }
          />
          <button type="submit">Save</button>
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      pick([file("a.pdf")]);
      expect(form.checkValidity()).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).not.toHaveBeenCalled();
      await act(async () => checks[0](message));
      expect(form.checkValidity()).toBe(true);
      expect(screen.queryByText("a.pdf") !== null).toBe(message === undefined);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the newest native pick when an earlier validation finishes late", async () => {
    const onFilesChange = vi.fn();
    const checks: ((message?: string) => void)[] = [];
    render(
      <FileUpload
        multiple
        name="documents"
        onFilesChange={onFilesChange}
        validate={() =>
          new Promise<string | undefined>((resolve) => checks.push(resolve))
        }
      />,
    );

    pick([file("older.pdf")]);
    pick([file("newer.pdf")]);
    await act(async () => checks[1]());
    expect(onFilesChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ name: "newer.pdf" }),
    ]);

    // A stale refusal must not clear the input holding the newer pick.
    await act(async () => checks[0]("The old file is invalid."));
    expect(picker().files?.[0].name).toBe("newer.pdf");
    expect(screen.getByText("newer.pdf")).toBeInTheDocument();
    expect(screen.queryByText("older.pdf")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onFilesChange).toHaveBeenCalledTimes(1);
  });

  it("submits what the native picker put in its input", () => {
    const onFilesChange = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload multiple name="documents" onFilesChange={onFilesChange} />
      </form>,
    );

    // The picker is the input the form submits
    expect(document.querySelectorAll("input[type=file]")).toHaveLength(1);
    expect(picker()).toHaveAttribute("name", "documents");

    pick([file("a.pdf"), file("b.pdf")]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: "a.pdf" }),
      expect.objectContaining({ name: "b.pdf" }),
    ]);
    // One of several files cannot be taken out of the input
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();

    // Like a native file input, a new pick replaces the files
    pick([file("c.pdf")]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("c.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove c.pdf" }));
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("refuses a pick with a file it does not accept whole", () => {
    render(<FileUpload accept=".pdf" multiple name="documents" />);

    pick([file("a.pdf")]);
    pick([file("b.pdf"), file("notes.txt", "text/plain")]);

    // The input held the refused file too - it is empty now
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "notes.txt: Files of this type cannot be uploaded here.",
    );
  });

  it("takes no dropped or pasted files", () => {
    render(<FileUpload multiple name="documents" />);
    const group = screen.getByRole("group");

    const dataTransfer = {
      dropEffect: "copy",
      files: [file("a.pdf")],
      types: ["Files"],
    };
    fireEvent.dragOver(group, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("none");
    // Still not opened in the browser
    expect(fireEvent.drop(group, { dataTransfer })).toBe(false);
    paste(screen.getByRole("button", { name: /Upload/ }), [file("b.pdf")]);

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.queryByText("or drag and drop here")).toBeNull();
  });

  it("still uploads with upload", () => {
    const { upload } = controllableUpload();
    render(<FileUpload multiple name="files" upload={upload} />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("or drag and drop here")).toBeInTheDocument();
  });
});

describe("FileUpload validation", () => {
  it.each([undefined, "The old file is invalid."])(
    "ignores a superseded single-file validation returning %s",
    async (message) => {
      const { pending, upload } = controllableUpload();
      const onError = vi.fn();
      const checks: ((message?: string) => void)[] = [];
      render(
        <FileUpload
          onError={onError}
          upload={upload}
          validate={() =>
            new Promise<string | undefined>((resolve) => checks.push(resolve))
          }
        />,
      );

      drop(screen.getByRole("group"), [file("older.pdf")]);
      drop(screen.getByRole("group"), [file("newer.pdf")]);
      await act(async () => checks[1]());
      expect(upload).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ name: "newer.pdf" }),
        expect.anything(),
      );

      await act(async () => checks[0](message));
      expect(pending[0].signal.aborted).toBe(false);
      expect(upload).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
      expect(screen.getByText("newer.pdf")).toBeInTheDocument();
      expect(screen.queryByText("older.pdf")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("supersedes an async check with a synchronously validated single-file pick", async () => {
    const { pending, upload } = controllableUpload();
    let pass = () => {};
    render(
      <FileUpload
        upload={upload}
        validate={(checked) =>
          checked.name === "older.pdf"
            ? new Promise<undefined>((resolve) => {
                pass = () => resolve(undefined);
              })
            : undefined
        }
      />,
    );

    drop(screen.getByRole("group"), [file("older.pdf")]);
    drop(screen.getByRole("group"), [file("newer.pdf")]);
    await act(async () => pass());

    expect(upload).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "newer.pdf" }),
      expect.anything(),
    );
    expect(pending[0].signal.aborted).toBe(false);
    expect(screen.queryByText("older.pdf")).toBeNull();
  });

  it("keeps independently validated picks with multiple when they finish out of order", async () => {
    const { pending, upload } = controllableUpload();
    const checks: ((message?: string) => void)[] = [];
    render(
      <FileUpload
        multiple
        upload={upload}
        validate={() =>
          new Promise<string | undefined>((resolve) => checks.push(resolve))
        }
      />,
    );

    drop(screen.getByRole("group"), [file("older.pdf")]);
    drop(screen.getByRole("group"), [file("newer.pdf")]);
    await act(async () => checks[1]());
    await act(async () => checks[0]());

    expect(upload).toHaveBeenCalledTimes(2);
    expect(pending.every(({ signal }) => !signal.aborted)).toBe(true);
    expect(screen.getByText("older.pdf")).toBeInTheDocument();
    expect(screen.getByText("newer.pdf")).toBeInTheDocument();
  });

  it("refuses a file its validate refuses - with the name of the file", () => {
    const { upload } = controllableUpload();
    const onError = vi.fn();
    render(
      <FileUpload
        multiple
        onError={onError}
        upload={upload}
        validate={(checked) =>
          checked.size < 100 ? "The file is too small." : undefined
        }
      />,
    );

    drop(screen.getByRole("group"), [
      file("tiny.pdf", "application/pdf", 10),
      file("big.pdf", "application/pdf", 200),
    ]);

    expect(upload).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "big.pdf" }),
      expect.anything(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "tiny.pdf: The file is too small.",
    );
    const [[error, refused]] = onError.mock.calls;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("The file is too small.");
    expect(refused.name).toBe("tiny.pdf");
  });

  it("checks a file after accept and maxFileSize", () => {
    const validate = vi.fn(() => undefined);
    render(
      <FileUpload
        accept=".pdf"
        multiple
        upload={controllableUpload().upload}
        validate={validate}
      />,
    );

    drop(screen.getByRole("group"), [
      file("notes.txt", "text/plain"),
      file("a.pdf"),
    ]);
    expect(validate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "a.pdf" }),
    );
  });

  it("waits for an async validate - a refused file takes no room", async () => {
    const { upload } = controllableUpload();
    const checks: ((message?: string) => void)[] = [];
    render(
      <FileUpload
        maxFiles={2}
        multiple
        upload={upload}
        validate={() =>
          new Promise<string | undefined>((resolve) => checks.push(resolve))
        }
      />,
    );

    drop(screen.getByRole("group"), [
      file("a.png", "image/png"),
      file("b.png", "image/png"),
      file("c.png", "image/png"),
    ]);
    expect(upload).not.toHaveBeenCalled();

    await act(async () => {
      checks[0]("The image must be at least 800 × 600 px.");
      checks[1]();
      checks[2]();
    });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "a.png: The image must be at least 800 × 600 px.",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("refuses a file its validate fails on", async () => {
    const onError = vi.fn();
    const broken = new Error("Cannot decode the image");
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FileUpload
        multiple
        onError={onError}
        upload={controllableUpload().upload}
        validate={async (checked) => {
          if (checked.name === "broken.png") throw broken;
          return undefined;
        }}
      />,
    );

    await act(async () =>
      drop(screen.getByRole("group"), [
        file("broken.png", "image/png"),
        file("fine.png", "image/png"),
      ]),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "broken.png: The file could not be checked.",
    );
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ name: "broken.png" }),
    );
    expect(screen.getByText("fine.png")).toBeInTheDocument();
  });

  it("adds none of the files still checked when the form is reset", async () => {
    const { upload } = controllableUpload();
    let pass = () => {};
    render(
      <form aria-label="Order">
        <FileUpload
          upload={upload}
          validate={() =>
            new Promise<undefined>((resolve) => {
              pass = () => resolve(undefined);
            })
          }
        />
      </form>,
    );

    drop(screen.getByRole("group"), [file("a.pdf")]);
    act(() =>
      screen.getByRole<HTMLFormElement>("form", { name: "Order" }).reset(),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    await act(async () => pass());

    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});

describe("FileUpload paste", () => {
  it("adds files pasted while the focus is in the field", () => {
    const { upload } = controllableUpload();
    render(<FileUpload accept="image/*" multiple upload={upload} />);

    const button = screen.getByRole("button", { name: /Upload/ });
    // `false` - the paste was handled
    expect(
      paste(button, [
        file("image.png", "image/png"),
        file("notes.txt", "text/plain"),
      ]),
    ).toBe(false);

    expect(upload).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "image.png" }),
      expect.anything(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "notes.txt: Files of this type cannot be uploaded here.",
    );
  });

  it.each([false, true])(
    "respects the caller's paste handler with preventDefault=%s",
    (preventDefault) => {
      const { upload } = controllableUpload();
      const onPaste = vi.fn((event: React.ClipboardEvent<HTMLDivElement>) => {
        expect(upload).not.toHaveBeenCalled();
        if (preventDefault) event.preventDefault();
      });
      render(<FileUpload onPaste={onPaste} upload={upload} />);
      const button = screen.getByRole("button", { name: /Upload/ });
      act(() => button.focus());

      paste(button, [file("a.pdf")]);

      expect(onPaste).toHaveBeenCalledTimes(1);
      expect(upload).toHaveBeenCalledTimes(preventDefault ? 0 : 1);
      expect(screen.queryAllByRole("listitem")).toHaveLength(
        preventDefault ? 0 : 1,
      );
    },
  );

  // Safari fires it at the body while a button has the focus - and pastes
  // at all only when `beforepaste` is canceled
  it("takes files pasted at the body while the focus is in the field", () => {
    const { upload } = controllableUpload();
    render(
      <>
        <button type="button">Elsewhere</button>
        <FileUpload multiple upload={upload} />
      </>,
    );
    const beforePaste = () =>
      fireEvent(
        document.body,
        new Event("beforepaste", { bubbles: true, cancelable: true }),
      );

    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    expect(beforePaste()).toBe(true);
    paste(document.body, [file("a.png", "image/png")]);
    expect(upload).not.toHaveBeenCalled();

    act(() => screen.getByRole("button", { name: /Upload/ }).focus());
    // `false` - canceled, which offers to paste
    expect(beforePaste()).toBe(false);
    expect(paste(document.body, [file("b.png", "image/png")])).toBe(false);
    expect(upload).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "b.png" }),
      expect.anything(),
    );

    // Taken once when it reaches the field
    paste(screen.getByRole("button", { name: /Upload/ }), [file("c.png")]);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("leaves a paste of text alone", () => {
    const upload = vi.fn();
    render(<FileUpload upload={upload} />);

    expect(paste(screen.getByRole("button", { name: /Upload/ }), [])).toBe(
      true,
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([{ disabled: true }, { readOnly: true }])(
    "takes no pasted files when %o",
    (props) => {
      const upload = vi.fn();
      render(
        <FileUpload
          {...props}
          defaultAttachments={[{ filename: "a.pdf", url: "/a.pdf" }]}
          upload={upload}
        />,
      );

      paste(screen.getByRole("link", { name: "a.pdf" }), [file("b.pdf")]);
      expect(upload).not.toHaveBeenCalled();
    },
  );
});

describe("FileUpload read-only", () => {
  it("shows and submits its files - none can be added or removed", () => {
    const upload = vi.fn();
    render(
      <form aria-label="Order">
        <FileUpload
          defaultAttachments={[
            { filename: "contract.pdf", url: "/contract.pdf", value: "1" },
            { filename: "scan.pdf", value: "2" },
          ]}
          label="Attachments"
          multiple
          name="files"
          readOnly
          required
          upload={upload}
        />
      </form>,
    );

    const group = screen.getByRole("group", { name: "Attachments:" });
    expect(group).toHaveAttribute("data-readonly");
    expect(screen.getByRole("link", { name: "contract.pdf" })).toHaveAttribute(
      "href",
      "/contract.pdf",
    );
    expect(screen.queryByRole("button")).toBeNull();

    const dataTransfer = {
      dropEffect: "copy",
      files: [file("b.pdf")],
      types: ["Files"],
    };
    fireEvent.dragOver(group, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("none");
    fireEvent.drop(group, { dataTransfer });
    expect(upload).not.toHaveBeenCalled();

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(new FormData(form).getAll("files")).toEqual(["1", "2"]);
  });

  it("says it has no files - and is not required, like a native field", () => {
    render(
      <form aria-label="Order">
        <FileUpload readOnly required upload={vi.fn()} />
      </form>,
    );

    expect(screen.getByText("No files")).toBeInTheDocument();
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(form.checkValidity()).toBe(true);
  });
});

describe("FileUpload button variant", () => {
  it("puts the list under a compact button", () => {
    render(
      <FileUpload
        defaultAttachments={[{ filename: "a.pdf", id: "a" }]}
        upload={vi.fn()}
        variant="button"
      />,
    );

    const button = screen.getByRole("button", { name: "Upload" });
    const list = screen.getByRole("list");
    expect(
      button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("or drag and drop here")).toBeNull();
  });

  it.each([
    ["xs", "py-0"],
    ["sm", "py-0.5"],
    ["md", "py-1"],
    ["lg", "py-2"],
  ] as const)("is as high as an Input of dim %s", (dim, padding) => {
    render(<FileUpload dim={dim} upload={vi.fn()} variant="button" />);

    const button = screen.getByRole("button", { name: "Upload" });
    expect(button).toHaveClass(padding, "border");
    // One width of the border, as the field has
    expect(button).not.toHaveClass("border-[1.5px]");
  });

  it("takes dropped files too", () => {
    const upload = vi.fn(() => new Promise<UploadedFile>(() => {}));
    render(<FileUpload upload={upload} variant="button" />);

    drop(screen.getByRole("group"), [file("a.pdf")]);
    expect(upload).toHaveBeenCalledTimes(1);
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

  it.each([false, true])(
    "keeps uploads and previews across Activity hiding (finish hidden: %s)",
    async (finishHidden) => {
      const { revoke } = stubObjectUrls();
      const { pending, upload } = controllableUpload();
      const onUpload = vi.fn();
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <Activity mode={mode}>
            <form aria-label="Order">
              <FileUpload
                concurrency={1}
                multiple
                name="files"
                onUpload={onUpload}
                preview
                upload={upload}
              />
            </form>
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
      drop(screen.getByRole("group"), [
        file("a.png", "image/png"),
        file("b.png", "image/png"),
      ]);
      expect(thumbnails()).toEqual(["blob:preview-1", "blob:preview-2"]);
      expect(form.checkValidity()).toBe(false);

      rerender(view("hidden"));
      expect(pending[0].signal.aborted).toBe(false);
      expect(revoke).not.toHaveBeenCalled();
      if (!finishHidden) rerender(view("visible"));
      await act(async () => pending[0].resolve({ url: "/a.png", value: "a" }));
      expect(upload).toHaveBeenCalledTimes(2);
      await act(async () => pending[1].resolve({ url: "/b.png", value: "b" }));
      if (finishHidden) rerender(view("visible"));

      expect(form.checkValidity()).toBe(true);
      expect(submitted(form, "files")).toEqual(["a", "b"]);
      expect(thumbnails()).toEqual(["/a.png", "/b.png"]);
      expect(onUpload).toHaveBeenCalledTimes(2);
      expect(revoke).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("progressbar")).toBeNull();
    },
  );

  it("aborts uploads and releases previews when a hidden Activity unmounts", async () => {
    const { revoke } = stubObjectUrls();
    const { pending, upload } = controllableUpload();
    const view = (mode: "hidden" | "visible") => (
      <Activity mode={mode}>
        <FileUpload preview upload={upload} />
      </Activity>
    );
    const { rerender, unmount } = render(view("visible"));
    drop(screen.getByRole("group"), [file("a.png", "image/png")]);
    rerender(view("hidden"));
    expect(pending[0].signal.aborted).toBe(false);
    expect(revoke).not.toHaveBeenCalled();

    await act(async () => unmount());
    expect(pending[0].signal.aborted).toBe(true);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
  });

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
    await user.click(
      screen.getByRole("button", { name: "Cancel uploading a.jpg" }),
    );
    expect(revoke).toHaveBeenLastCalledWith("blob:preview-1");

    drop(screen.getByRole("group"), [file("b.jpg", "image/jpeg")]);
    await act(async () => unmount());
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
    expect(screen.queryByText("0%")).toBeNull();

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

describe("FileUpload on the server", () => {
  it.each([{}, { variant: "button" as const }])(
    "hydrates without an upload %o",
    async (props) => {
      const page = (
        <form aria-label="Order">
          <FileUpload
            {...props}
            defaultAttachments={[{ filename: "a.pdf", value: "1" }]}
            label="Documents"
            name="documents"
          />
        </form>
      );
      const container = document.createElement("div");
      container.innerHTML = renderToString(page);
      document.body.append(container);
      const onRecoverableError = vi.fn();

      const root = await act(async () =>
        hydrateRoot(container, page, { onRecoverableError }),
      );

      expect(onRecoverableError).not.toHaveBeenCalled();
      // jsdom cannot write a FileList - the picker takes the name after the
      // hydration
      expect(picker()).toHaveAttribute("name", "documents");
      act(() => root.unmount());
      container.remove();
    },
  );
});
