import { File as FileIcon, Upload, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import Button from "./button";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import IconButton from "./icon-button";
import logger from "../utils/logger";
import Progress from "./progress";
import Tooltip from "./tooltip";
import { formatMessage, formatNumber, formatPlural } from "../i18n/format";
import { useFieldsetDisabled, useFormReset } from "../hooks/use-form-control";
import { useLocale } from "../providers/ui-context";

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
  /** Name shown in the list - the name of the picked file by default. */
  filename?: string | null;
  /**
   * A small picture of the file shown with `preview` instead of the file
   * itself, e.g. a resized image or the first page of a PDF.
   */
  thumbnailUrl?: string | null;
  /** Makes the file name a download link - and the thumbnail of an image. */
  url?: string | null;
  /** Submitted in a hidden input named `name`, e.g. a signed blob id. */
  value?: string | null;
}

interface ListedFile {
  id: string;
  filename: string;
  /** An image - its `url` shows as the thumbnail. */
  isImage: boolean;
  thumbnailUrl?: string | null;
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
    isImage: isImageFile(attachment.filename ?? "", ""),
    thumbnailUrl: attachment.thumbnailUrl || undefined,
    url: attachment.url || undefined,
    value: attachment.value || undefined,
  }));

// Compares attachments by content - callers pass inline arrays
const attachmentsKey = (attachments: UploadedFile[]) =>
  JSON.stringify(
    attachments.map(({ filename, id, thumbnailUrl, url, value }) => [
      id,
      filename,
      thumbnailUrl,
      url,
      value,
    ]),
  );

// The extensions of types that systems report differently - Windows with
// Excel installed calls a .csv `application/vnd.ms-excel`, and some files
// come without a type at all
const TYPE_EXTENSIONS: Record<string, string[]> = {
  "application/json": [".json"],
  "application/msword": [".doc"],
  "application/pdf": [".pdf"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/xml": [".xml"],
  "application/zip": [".zip"],
  "text/csv": [".csv"],
  "text/markdown": [".md"],
  "text/plain": [".txt"],
  "text/tab-separated-values": [".tsv"],
  "text/xml": [".xml"],
};

// The extensions of a group like `image/*` - for files the system reports
// without a type (HEIC photos on some systems), which the native picker of
// the group still offers
const GROUP_EXTENSIONS: Record<string, string[]> = {
  "audio/": [".aac", ".flac", ".m4a", ".mp3", ".oga", ".ogg", ".opus", ".wav"],
  "image/": [
    ".avif",
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".tif",
    ".tiff",
    ".webp",
  ],
  "video/": [".avi", ".m4v", ".mkv", ".mov", ".mp4", ".ogv", ".webm"],
};

/** Whether a file is of a group like `image/` - by its type or its name. */
function isOfGroup(name: string, type: string, group: string) {
  if (type) return type.startsWith(group);

  return !!GROUP_EXTENSIONS[group]?.some((extension) =>
    name.endsWith(extension),
  );
}

/** Whether a file is an image - by its type, or by its name without one. */
const isImageFile = (name: string, type: string) =>
  isOfGroup(name.toLowerCase(), type.toLowerCase(), "image/");

/**
 * A local URL of a picked file - for the thumbnail of an image while it
 * uploads. Revoke it once it is not shown. (Not in every environment - the
 * tests of an app may run without it.)
 */
const createLocalUrl = (file: File) =>
  typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : undefined;

/**
 * Whether a file fits an `accept` list like `.pdf,image/*`. The name counts
 * first: a type is also matched by its usual extensions, as the reported
 * type depends on the system. The wildcard `*` - also of the type and
 * subtype both - accepts any file.
 */
function isAccepted(file: File, accept: string | undefined) {
  if (!accept) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  // Empty tokens (`.pdf,`) are none - like the browser, which ignores them;
  // an empty one would match every file without a type
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.some((token) =>
    token === "*" || token === "*/*"
      ? true
      : token.startsWith(".")
        ? name.endsWith(token)
        : token.endsWith("/*")
          ? isOfGroup(name, type, token.slice(0, -1))
          : type === token ||
            !!TYPE_EXTENSIONS[token]?.some((extension) =>
              name.endsWith(extension),
            ),
  );
}

type UploadOutcome<TResult> = { result: TResult } | { error: unknown } | null;

/**
 * Runs `upload` and settles with its result or failure - or with `null` as
 * soon as `signal` aborts, whether `upload` stops or not: a late result of
 * an upload that ignores the signal is not waited for.
 */
function runUpload<TResult>(
  upload: () => Promise<TResult>,
  signal: AbortSignal,
): Promise<UploadOutcome<TResult>> {
  return new Promise((resolve) => {
    const cancel = () => resolve(null);
    signal.addEventListener("abort", cancel, { once: true });

    // Also an `upload` that throws right away fails like a rejected one
    new Promise<TResult>((resolveUpload) => resolveUpload(upload()))
      .then(
        (result) => resolve(signal.aborted ? null : { result }),
        (error: unknown) => resolve(signal.aborted ? null : { error }),
      )
      .finally(() => signal.removeEventListener("abort", cancel));
  });
}

/**
 * The picture of a file in the list, or an icon when there is none - or
 * when it does not load (a HEIC photo in a browser that cannot show it).
 */
function Thumbnail({ src }: { src?: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;

  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-400">
      {showImage ? (
        // The file name next to it says what it is
        <img
          alt=""
          className="size-full object-cover"
          decoding="async"
          loading="lazy"
          onError={() => setFailedSrc(src)}
          src={src}
        />
      ) : (
        <FileIcon aria-hidden="true" size={20} />
      )}
    </span>
  );
}

export interface FileUploadProps<TResult extends UploadedFile = UploadedFile> {
  /** Accepted file types, like the `accept` attribute of a file input. */
  accept?: string;
  /**
   * Ids of further elements describing the field - after its error message
   * and its `description`.
   */
  "aria-describedby"?: string;
  /**
   * Classes of the field. It keeps a vertical margin (`my-4`) - override it
   * with an important class such as `my-0!`.
   */
  className?: string;
  /**
   * Files attached before, e.g. when editing a record. Attachments arriving
   * later (loaded data) replace the list as long as the user has not changed
   * it. A reset of the form brings them back and drops the files uploaded
   * since - without `onRemove`: the reset React does after a form action
   * follows a save, which has kept them.
   */
  defaultAttachments?: UploadedFile[];
  /** Help text under the field, e.g. the accepted types and sizes. */
  description?: React.ReactNode;
  /**
   * No files can be added or removed - and, like a disabled field, none
   * are submitted. A disabled `<fieldset>` around the field disables it
   * too.
   */
  disabled?: boolean;
  /** Validation message from the form. */
  error?: string;
  /** Text above the field - also the name of its group. */
  label?: string;
  /** In megabytes. */
  maxFileSize?: number;
  /**
   * With `multiple`: the most files the list holds, the attached ones
   * included. Further picked or dropped files are refused with a message.
   */
  maxFiles?: number;
  /**
   * Several files can be picked or dropped at once - they are uploaded one
   * after another. Without it the field holds one file: a new one replaces
   * the listed one (reported through `onRemove`).
   */
  multiple?: boolean;
  /**
   * Id of a form elsewhere in the page - the hidden inputs belong to it, and
   * its reset resets the field.
   */
  form?: string;
  /** Name of the hidden inputs that submit the `value` of each file. */
  name?: string;
  /**
   * Called when a file is rejected (too large, not accepted) or `upload`
   * fails - e.g. to show a toast. The message is also shown under the field.
   */
  onError?: (error: unknown, file: File) => void;
  /**
   * Called when the user removes a file from the list - or replaces it with
   * a new one, without `multiple`. Not for the files a form reset drops (see
   * `defaultAttachments`).
   */
  onRemove?: (file: UploadedFile) => void;
  /** Called with the result of `upload` once a file is stored. */
  onUpload?: (result: TResult) => void;
  /**
   * Shows a thumbnail in front of each file: an image while it uploads
   * (from the computer), then its `thumbnailUrl` or `url`; other files get
   * an icon. Off by default - the pictures load the images from their URLs.
   */
  preview?: boolean;
  /**
   * At least one file has to be attached - the browser checks it on submit.
   * With a `name`, only files with a `value` count: they are what the form
   * submits.
   */
  required?: boolean;
  /**
   * Stores the picked file wherever the project keeps files and resolves with
   * what to list and submit for it. Report the progress (0-100) through
   * `onProgress`, and pass `signal` on to the request (`uploadWithProgress`,
   * `fetch`) - it aborts when the user cancels the upload or the field goes
   * away. The field is ready for another file as soon as the user cancels;
   * what `upload` resolves with after that is ignored.
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
  "aria-describedby": ariaDescribedBy,
  className,
  defaultAttachments = [],
  description,
  disabled: disabledProp = false,
  error,
  form,
  label,
  maxFileSize = MAX_FILE_SIZE,
  maxFiles,
  multiple = false,
  name,
  onError,
  onRemove,
  onUpload,
  preview = false,
  required,
  upload,
}: Readonly<FileUploadProps<TResult>>) {
  const locale = useLocale();
  const { messages } = locale;
  const labelId = useId();

  // The drop zone is no native field - a disabled fieldset around it leaves
  // it alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;
  const errorId = `${labelId}-error`;
  const descriptionId = `${labelId}-description`;

  // The file being uploaded: its progress - unknown until `upload` reports
  // it - and the local URL of its thumbnail
  const [uploading, setUploading] = useState<{
    name: string;
    previewUrl?: string;
    progress: number | null;
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
  // The callbacks of the last render - files uploaded one after another
  // outlive the render they were picked in, whose callbacks would see its
  // state (an `onUpload` adding to a list of the parent would lose files)
  const callbacksRef = useRef({ onError, onRemove, onUpload, upload });

  // In a layout effect - a render forced by `flushSync` updates them at once
  useLayoutEffect(() => {
    filesRef.current = files;
    callbacksRef.current = { onError, onRemove, onUpload, upload };
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  // Aborts the running upload - the cancel button, unmounting
  const uploadController = useRef<AbortController | null>(null);
  // The local URL of the thumbnail of the file being uploaded - it holds the
  // file in memory until revoked
  const previewUrl = useRef<string | null>(null);
  // Where the focus goes once the control it was on is gone: the cancel
  // button, the upload button, or the remove button at this index
  const pendingFocus = useRef<"cancel" | "upload" | number | null>(null);
  // Whether the field is on the page - a callback may take it away (an
  // `onUpload` closing its dialog), and the files still waiting stay then
  const mounted = useRef(false);

  const releasePreviewUrl = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  };

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      uploadController.current?.abort();
      releasePreviewUrl();
    };
  }, []);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;

    const removeButtons =
      listRef.current?.querySelectorAll<HTMLElement>("li button") ?? [];
    const next =
      typeof target === "number"
        ? removeButtons[Math.min(target, removeButtons.length - 1)]
        : target === "cancel"
          ? cancelButtonRef.current
          : null;

    (next ?? buttonRef.current ?? cancelButtonRef.current)?.focus();
  });

  // The upload button and the progress with its cancel button take turns -
  // the focus moves along from the one going away
  const moveFocusFrom = (
    control: HTMLElement | null,
    to: "cancel" | "upload",
  ) => {
    if (control && document.activeElement === control) {
      pendingFocus.current = to;
    }
  };

  const finishUpload = () => {
    uploadController.current = null;
    releasePreviewUrl();
    moveFocusFrom(cancelButtonRef.current, "upload");
    setUploading(null);
  };

  const cancelUpload = () => {
    uploadController.current?.abort();
    finishUpload();
  };

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultAttachments` and drops a running upload
  const formResetRef = useFormReset(() => {
    cancelUpload();
    setFiles(toListedFiles(defaultAttachments));
    setInteracted(false);
    setUploadError(null);
  }, form);

  const groupRef = useCallback(
    (element: HTMLDivElement | null) => {
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);

      return () => {
        detachReset?.();
        detachFieldset?.();
      };
    },
    [fieldsetRef, formResetRef],
  );

  const canAdd = !disabled && !uploading;

  // Renders the change of a file - the field's and what the callbacks
  // change in the parent - before the next file: of files told one right
  // after another (an `upload` that settles at once, several refused ones),
  // the later ones would go to the callbacks of the state before
  const report = (change: (callbacks: typeof callbacksRef.current) => void) =>
    flushSync(() => change(callbacksRef.current));

  const reject = (file: File, message: string) =>
    report(({ onError }) => {
      setUploadError(message);
      onError?.(new Error(message), file);
    });

  // Why a file cannot be added - null when it can. `room` is the number of
  // files the list takes still.
  const refusal = (file: File, room: number) =>
    !isAccepted(file, accept)
      ? messages.fileUpload.fileTypeNotAccepted
      : file.size > Math.pow(1024, 2) * maxFileSize
        ? formatMessage(messages.fileUpload.maxFileSizeExceeded, {
            size: formatNumber(locale.code, maxFileSize),
          })
        : room <= 0 && maxFiles !== undefined
          ? formatPlural(locale.code, messages.fileUpload.maxFiles, maxFiles)
          : null;

  const uploadFiles = async (picked: File[]) => {
    setUploadError(null);

    // All files are checked before the first one uploads - a refused one is
    // said at once, not after the uploads before it
    const room =
      multiple && maxFiles !== undefined
        ? maxFiles - filesRef.current.length
        : Infinity;
    const accepted: File[] = [];

    for (const file of picked) {
      const problem = refusal(file, room - accepted.length);
      if (problem) {
        reject(file, problem);
      } else {
        accepted.push(file);
      }
    }

    for (const file of accepted) {
      // A callback reported before took the field away
      if (!mounted.current) return;

      const controller = new AbortController();
      uploadController.current = controller;
      moveFocusFrom(buttonRef.current, "cancel");

      // The thumbnail of the previous file is done with
      releasePreviewUrl();
      const isImage = isImageFile(file.name, file.type);
      previewUrl.current = (preview && isImage && createLocalUrl(file)) || null;
      setUploading({
        name: file.name,
        previewUrl: previewUrl.current ?? undefined,
        progress: null,
      });

      const outcome = await runUpload(
        () =>
          callbacksRef.current.upload(file, {
            onProgress: (progress) => {
              // A cancelled upload that goes on reports nothing
              if (controller.signal.aborted) return;
              setUploading((current) => current && { ...current, progress });
            },
            signal: controller.signal,
          }),
        controller.signal,
      );

      // Cancelled - the field is ready again since the click, and the files
      // still waiting are not uploaded either
      if (!outcome) return;

      if ("error" in outcome) {
        logger.error("File upload failed", outcome.error);

        report(({ onError }) => {
          setUploadError(messages.fileUpload.uploadFailed);
          onError?.(outcome.error, file);
        });
        continue;
      }

      const { result } = outcome;
      const uploaded: ListedFile = {
        id: result.id || createFileId(),
        filename: result.filename || file.name,
        isImage,
        thumbnailUrl: result.thumbnailUrl,
        url: result.url,
        value: result.value,
      };

      // A single file field holds the new file only
      const replaced = multiple ? [] : filesRef.current;
      filesRef.current = multiple
        ? [...filesRef.current, uploaded]
        : [uploaded];
      report(({ onRemove, onUpload }) => {
        setFiles(filesRef.current);
        setInteracted(true);
        onUpload?.(result);
        replaced.forEach((replacedFile) => onRemove?.(replacedFile));
      });
    }

    if (mounted.current) finishUpload();
  };

  const handleChange = ({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(target.files ?? []);
    // The same file can be picked again
    target.value = "";

    if (picked.length > 0) uploadFiles(picked);
  };

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  // Files dropped anywhere but on a drop target open in the browser - so
  // the field takes them always and only ignores them when it cannot add
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = canAdd ? "copy" : "none";
    setIsDragOver(canAdd);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (!hasFiles(event)) return;

    event.preventDefault();
    if (!canAdd) return;

    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) uploadFiles(multiple ? dropped : [dropped[0]]);
  };

  const handleRemove = (file: ListedFile) => {
    // The focus stays in the list - on the file taking the place of the
    // removed one, the one before it, or the upload button
    pendingFocus.current = files.findIndex(({ id }) => id === file.id);
    setFiles((prev) => prev.filter(({ id }) => id !== file.id));
    setInteracted(true);
    onRemove?.(file);
  };

  const shownError = error || uploadError;
  // The error first, then the help text, then what the page adds
  const describedBy = joinTokens(
    shownError ? errorId : undefined,
    description ? descriptionId : undefined,
    ariaDescribedBy,
  );
  // Without a name nothing is submitted - any listed file will do
  const hasRequiredFile = name
    ? files.some((file) => file.value)
    : files.length > 0;

  return (
    <div
      aria-describedby={describedBy}
      aria-invalid={shownError ? "true" : undefined}
      aria-labelledby={label ? labelId : undefined}
      className={cn(
        "relative my-4 rounded-md transition-colors",
        isDragOver &&
          "bg-primary-50 ring-2 ring-primary-500 dark:bg-primary-950/40",
        className,
      )}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      ref={groupRef}
      role="group"
    >
      {label && (
        <div
          className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          id={labelId}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {required && (
            <span
              aria-hidden="true"
              className="text-danger-700 dark:text-danger-400"
            >
              *
            </span>
          )}
        </div>
      )}

      {files.length > 0 && (
        <ul
          className={cn(
            "mb-4 overflow-auto",
            preview ? "max-h-72" : "max-h-44",
          )}
          ref={listRef}
        >
          {files.map((file) => (
            <li
              className={cn(
                "mb-2 flex items-center rounded-md border border-neutral-200 bg-surface p-2 shadow-sm last:mb-0 dark:border-neutral-700 dark:bg-neutral-800",
                preview && "gap-3",
              )}
              key={file.id}
            >
              {preview && (
                <Thumbnail
                  src={file.thumbnailUrl ?? (file.isImage ? file.url : null)}
                />
              )}
              <div className="flex-1 truncate">
                {file.url ? (
                  <a
                    className="cui-link text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
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
          {preview && <Thumbnail src={uploading.previewUrl} />}
          <Progress
            className="flex-1"
            description={uploading.name}
            label={messages.fileUpload.uploading}
            showPercentage
            value={uploading.progress}
          />
          <IconButton
            aria-label={messages.common.cancel}
            onClick={cancelUpload}
            ref={cancelButtonRef}
          >
            <X size={16} />
          </IconButton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            ref={buttonRef}
            size="sm"
            variant="outline"
          >
            <Upload className="mr-2" size={16} />
            {messages.fileUpload.upload}
          </Button>
          {/* Nothing to drag on a touch screen */}
          {!disabled && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400 pointer-coarse:hidden">
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
          form={form}
          onChange={() => {}}
          onFocus={() => buttonRef.current?.focus()}
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={hasRequiredFile ? "valid" : ""}
        />
      )}

      <FormDescription className="mt-2" id={descriptionId}>
        {description}
      </FormDescription>

      {shownError && (
        <FormError className="mt-2" id={errorId}>
          {shownError}
        </FormError>
      )}

      {files.map(({ id, value }) =>
        value ? (
          <input
            disabled={disabled}
            form={form}
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
