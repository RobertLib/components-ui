import { Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import Button from "./button";
import cn from "../utils/cn";
import FormError from "./form-error";
import IconButton from "./icon-button";
import logger from "../utils/logger";
import Progress from "./progress";
import Tooltip from "./tooltip";
import { formatMessage } from "../i18n/format";
import { useFormReset } from "../hooks/use-form-control";
import { useMessages } from "../providers/ui-context";

const MAX_FILE_SIZE = 200; // MB

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

export interface UploadedFile {
  /** Stable key of an already attached file. */
  id?: string;
  filename?: string | null;
  /** Makes the file name a download link. */
  url?: string | null;
  /** Submitted in a hidden input named `name`, e.g. a signed blob id. */
  value?: string | null;
}

interface ListedFile {
  id: string;
  filename: string;
  url?: string | null;
  value?: string | null;
}

let nextFileId = 0;

// crypto.randomUUID() exists only on HTTPS and localhost - a counter is
// enough for list keys
const createFileId = () => `file-${++nextFileId}`;

const toListedFiles = (attachments: UploadedFile[]): ListedFile[] =>
  attachments.map((attachment) => ({
    id: attachment.id || createFileId(),
    filename: attachment.filename || "...",
    url: attachment.url || undefined,
    value: attachment.value || undefined,
  }));

// Compares attachments by content - callers pass inline arrays
const attachmentsKey = (attachments: UploadedFile[]) =>
  JSON.stringify(
    attachments.map(({ filename, id, url, value }) => [
      id,
      filename,
      url,
      value,
    ]),
  );

/**
 * Whether a file fits an `accept` list like `.pdf,image/*` - the file
 * dialog applies it, dropped files have to be checked.
 */
function isAccepted(file: File, accept: string | undefined) {
  if (!accept) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .some((token) =>
      token.startsWith(".")
        ? name.endsWith(token)
        : token.endsWith("/*")
          ? type.startsWith(token.slice(0, -1))
          : type === token,
    );
}

export interface FileUploadProps<TResult extends UploadedFile = UploadedFile> {
  /** Accepted file types, like the `accept` attribute of a file input. */
  accept?: string;
  /**
   * Files attached before, e.g. when editing a record. Attachments arriving
   * later (loaded data) replace the list as long as the user has not changed
   * it; a reset of the form brings them back.
   */
  defaultAttachments?: UploadedFile[];
  /**
   * No files can be added or removed - and, like a disabled field, none
   * are submitted.
   */
  disabled?: boolean;
  /** Validation message from the form. */
  error?: string;
  label?: string;
  /** In megabytes. */
  maxFileSize?: number;
  /**
   * Several files can be picked or dropped at once - they are uploaded one
   * after another. Without it the field holds one file: a new one replaces
   * the listed one (reported through `onRemove`).
   */
  multiple?: boolean;
  /** Name of the hidden inputs that submit the `value` of each file. */
  name?: string;
  /**
   * Called when a file is rejected (too large, not accepted) or `upload`
   * fails - e.g. to show a toast. The message is also shown under the field.
   */
  onError?: (error: unknown, file: File) => void;
  /**
   * Called when the user removes a file from the list - or replaces it with
   * a new one, without `multiple`.
   */
  onRemove?: (file: UploadedFile) => void;
  /** Called with the result of `upload` once a file is stored. */
  onUpload?: (result: TResult) => void;
  /** At least one file has to be attached - the browser checks it on submit. */
  required?: boolean;
  /**
   * Stores the picked file wherever the project keeps files and resolves with
   * what to list and submit for it. Report the progress (0-100) through
   * `onProgress`, and pass `signal` on to the request (`uploadWithProgress`,
   * `fetch`) - it aborts when the user cancels the upload or the field goes
   * away.
   */
  upload: (
    file: File,
    options: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) => Promise<TResult>;
}

/**
 * Uploads files and lists them - picked with the button or dropped on the
 * field. Storing a file is up to the `upload` callback, so it works with any
 * backend - a REST endpoint, a presigned S3 URL, a GraphQL mutation, …
 */
export default function FileUpload<
  TResult extends UploadedFile = UploadedFile,
>({
  accept,
  defaultAttachments = [],
  disabled = false,
  error,
  label,
  maxFileSize = MAX_FILE_SIZE,
  multiple = false,
  name,
  onError,
  onRemove,
  onUpload,
  required,
  upload,
}: Readonly<FileUploadProps<TResult>>) {
  const messages = useMessages();
  const labelId = useId();
  const errorId = `${labelId}-error`;

  // The file being uploaded, and its progress
  const [uploading, setUploading] = useState<{
    name: string;
    progress: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [files, setFiles] = useState<ListedFile[]>(() =>
    toListedFiles(defaultAttachments),
  );
  // The user added or removed a file - later `defaultAttachments` no longer
  // replace the list
  const [interacted, setInteracted] = useState(false);

  // `defaultAttachments` arriving later (data of an edit form) are listed
  // unless the user has changed the list meanwhile
  const defaultKey = attachmentsKey(defaultAttachments);
  const [appliedDefaultKey, setAppliedDefaultKey] = useState(defaultKey);

  if (defaultKey !== appliedDefaultKey) {
    setAppliedDefaultKey(defaultKey);
    if (!interacted) setFiles(toListedFiles(defaultAttachments));
  }

  // The list as of the last render - read after an upload finished
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Aborts the running upload - the cancel button, unmounting
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => () => uploadController.current?.abort(), []);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultAttachments` and drops a running upload
  const formResetRef = useFormReset(() => {
    uploadController.current?.abort();
    setFiles(toListedFiles(defaultAttachments));
    setInteracted(false);
    setUploadError(null);
  });

  const canAdd = !disabled && !uploading;

  const reject = (file: File, message: string) => {
    setUploadError(message);
    onError?.(new Error(message), file);
  };

  const uploadFiles = async (picked: File[]) => {
    setUploadError(null);

    for (const file of picked) {
      if (!isAccepted(file, accept)) {
        reject(file, messages.fileUpload.fileTypeNotAccepted);
        continue;
      }

      if (file.size > Math.pow(1024, 2) * maxFileSize) {
        reject(
          file,
          formatMessage(messages.fileUpload.maxFileSizeExceeded, {
            size: maxFileSize,
          }),
        );
        continue;
      }

      const controller = new AbortController();
      uploadController.current = controller;
      setUploading({ name: file.name, progress: 0 });

      try {
        const result = await upload(file, {
          onProgress: (progress) =>
            setUploading((current) => current && { ...current, progress }),
          signal: controller.signal,
        });

        // Cancelled, although `upload` did not stop - the file is not kept
        if (controller.signal.aborted) break;

        const uploaded: ListedFile = {
          id: result.id || createFileId(),
          filename: result.filename || file.name,
          url: result.url,
          value: result.value,
        };

        // A single file field holds the new file only
        const replaced = multiple ? [] : filesRef.current;
        filesRef.current = multiple
          ? [...filesRef.current, uploaded]
          : [uploaded];
        setFiles(filesRef.current);
        setInteracted(true);

        onUpload?.(result);
        replaced.forEach((replacedFile) => onRemove?.(replacedFile));
      } catch (uploadFailure) {
        // Cancelled - the files still waiting are not uploaded either
        if (controller.signal.aborted) break;

        logger.error("File upload failed", uploadFailure);

        setUploadError(messages.fileUpload.uploadFailed);
        onError?.(uploadFailure, file);
      }
    }

    uploadController.current = null;
    setUploading(null);
  };

  const handleChange = ({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(target.files ?? []);
    // The same file can be picked again
    target.value = "";

    if (picked.length > 0) uploadFiles(picked);
  };

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAdd || !hasFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (!canAdd || !hasFiles(event)) return;

    event.preventDefault();
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) uploadFiles(multiple ? dropped : [dropped[0]]);
  };

  const handleRemove = (file: ListedFile) => {
    setFiles((prev) => prev.filter(({ id }) => id !== file.id));
    setInteracted(true);
    onRemove?.(file);
  };

  const shownError = error || uploadError;

  return (
    <div
      aria-describedby={shownError ? errorId : undefined}
      aria-invalid={shownError ? "true" : undefined}
      aria-labelledby={label ? labelId : undefined}
      className={cn(
        "relative my-4 rounded-md transition-colors",
        isDragOver &&
          "bg-primary-50 ring-2 ring-primary-400 dark:bg-primary-950/40",
      )}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      ref={formResetRef}
      role="group"
    >
      {label && (
        <div
          className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          id={labelId}
        >
          {label} {required && <span className="text-danger-500">*</span>}
        </div>
      )}

      {files.length > 0 && (
        <ul className="mb-4 max-h-44 overflow-auto">
          {files.map((file) => (
            <li
              className="mb-2 flex items-center rounded-md border border-neutral-200 bg-surface p-2 shadow-sm last:mb-0 dark:border-neutral-700 dark:bg-neutral-800"
              key={file.id}
            >
              <div className="flex-1 truncate">
                {file.url ? (
                  <a
                    className="link text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    href={file.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {file.filename}
                  </a>
                ) : (
                  file.filename
                )}
              </div>
              {!disabled && (
                <Tooltip title={messages.fileUpload.remove} position="left">
                  <IconButton
                    aria-label={`${messages.fileUpload.remove} ${file.filename}`}
                    onClick={() => handleRemove(file)}
                    variant="danger"
                  >
                    <X size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploading ? (
        <div className="flex items-end gap-2">
          <Progress
            className="flex-1"
            description={uploading.name}
            label={messages.fileUpload.uploading}
            showPercentage
            value={uploading.progress}
          />
          <IconButton
            aria-label={messages.common.cancel}
            onClick={() => uploadController.current?.abort()}
          >
            <X size={16} />
          </IconButton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-describedby={shownError ? errorId : undefined}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            ref={buttonRef}
            size="sm"
            variant="outline"
          >
            <Upload className="mr-2" size={16} />
            {messages.fileUpload.upload}
          </Button>
          {!disabled && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {messages.fileUpload.dropHint}
            </span>
          )}
        </div>
      )}

      <input
        accept={accept}
        aria-hidden="true"
        disabled={disabled}
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        style={{ display: "none" }}
        tabIndex={-1}
        type="file"
      />

      {/* Lets the browser enforce `required` - it leads the user to the button */}
      {required && (
        <input
          aria-hidden="true"
          disabled={disabled}
          onChange={() => {}}
          onFocus={() => buttonRef.current?.focus()}
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={files.length > 0 ? "valid" : ""}
        />
      )}

      {shownError && (
        <FormError className="mt-2" id={errorId}>
          {shownError}
        </FormError>
      )}

      {files.map(({ id, value }) =>
        value ? (
          <input
            disabled={disabled}
            key={id}
            name={name}
            type="hidden"
            value={value}
          />
        ) : null,
      )}
    </div>
  );
}
