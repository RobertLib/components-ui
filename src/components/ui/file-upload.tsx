import {
  snapshotDrop,
  readDroppedDirectories,
} from "./file-upload/dropped-files";
import { File as FileIcon, RotateCw, Upload, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { getActiveElement } from "./overlay-stack";
import Button from "./button";
import cn, { joinTokens } from "../../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import IconButton from "./icon-button";
import isPromiseLike from "../../utils/is-promise-like";
import logger from "../../utils/logger";
import Progress from "./progress";
import Tooltip from "./tooltip";
import {
  formatMessage,
  formatNumber,
  formatPlural,
  toIntlLocale,
} from "../../i18n/ui/format";
import {
  attachRef,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import { useLocale } from "../../providers/ui-context";
import type { UIMessages } from "../../i18n/ui/types";
import RequiredMark from "./required-mark";

const MAX_FILE_SIZE = 200; // MB

// Uploads running side by side - more would share the bandwidth for no
// gain, and a browser opens only about six connections to one host
const DEFAULT_CONCURRENCY = 3;

// The names of refused files a line lists - more end in "and 4 more"
const MAX_LISTED_NAMES = 3;

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

/** An input still belongs to its form while Activity hides its field. */
function useRetainedInputRef() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldRef = useCallback((element: HTMLInputElement | null) => {
    if (!element) return;
    inputRef.current = element;

    return () => {
      // The same input can detach and reattach in one commit. An Activity
      // hide detaches it too, but its connected DOM node still submits.
      queueMicrotask(() => {
        if (inputRef.current === element && !element.isConnected) {
          inputRef.current = null;
        }
      });
    };
  }, []);

  useInsertionEffect(
    () => () => {
      inputRef.current = null;
    },
    [],
  );

  return [inputRef, fieldRef] as const;
}

// The button of the `button` variant has the height of an `Input` of the
// same `dim` - its padding, text and a border as wide as the field's
const buttonDimStyles = {
  xs: "border px-2 py-0 text-sm",
  sm: "border px-2 py-0.5 text-sm",
  md: "border px-3 py-1 text-base",
  lg: "border px-4 py-2 text-lg",
};
const buttonIconSizes = { xs: 14, sm: 14, md: 16, lg: 18 };

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

/**
 * Where a file of the list is: attached (`done`), waiting for its upload
 * (`queued`), uploading, or failed to upload.
 */
type FileStatus = "done" | "failed" | "queued" | "uploading";

interface ListedFile {
  /** Key of the row - it stays while the file uploads. */
  key: string;
  /** The id `onRemove` reports. */
  id: string;
  filename: string;
  /** An image - its `url` shows as the thumbnail. */
  isImage: boolean;
  status: FileStatus;
  /** Why the upload failed. */
  error?: string;
  /**
   * The picked file - kept without `upload` (the form submits it) and until
   * its upload is done.
   */
  file?: File;
  /**
   * A local URL of a picked image, for its thumbnail - it holds the file in
   * memory until revoked.
   */
  localUrl?: string;
  /** Of an upload, 0-100 - `null` until `upload` reports it. */
  progress?: number | null;
  thumbnailUrl?: string | null;
  url?: string | null;
  value?: string | null;
}

/** Why a file was not added - the text shown and what `onError` gets. */
interface Refusal {
  error: unknown;
  message: string;
}

/** The files refused for one message - a line under the field. */
interface RefusedGroup {
  message: string;
  names: string[];
}

let nextFileId = 0;

// crypto.randomUUID() exists only on HTTPS and localhost - a counter is
// enough for list keys
const createFileId = () => `file-${++nextFileId}`;

const toListedFiles = (attachments: UploadedFile[]): ListedFile[] =>
  attachments.map((attachment) => {
    const id = attachment.id || createFileId();
    return {
      filename: attachment.filename || "...",
      id,
      isImage: isImageFile(attachment.filename ?? "", ""),
      // A server id such as "file-1" can also be a generated local id.
      // Keep supplied ids in their own namespace without changing what
      // onRemove reports, or the row's identity when its metadata changes.
      key: attachment.id ? `attachment:${id}` : id,
      status: "done",
      thumbnailUrl: attachment.thumbnailUrl || undefined,
      url: attachment.url || undefined,
      value: attachment.value || undefined,
    };
  });

/** What `onRemove` gets of a listed file. */
const toUploadedFile = ({
  filename,
  id,
  thumbnailUrl,
  url,
  value,
}: ListedFile): UploadedFile => ({ filename, id, thumbnailUrl, url, value });

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

/** Waits for its upload - or runs it. */
const isPending = (file: ListedFile) =>
  file.status === "queued" || file.status === "uploading";

/** An attached file - not one picked to be submitted by the form. */
const isStored = (file: ListedFile) => file.status === "done" && !file.file;

/** The picked files the form submits - without `upload`. */
const pickedFiles = (files: ListedFile[]) =>
  files.flatMap((file) =>
    file.status === "done" && file.file ? file.file : [],
  );

/** The name of a picked file - its path in a picked folder. */
const nameOf = (file: File) => file.webkitRelativePath || file.name;

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
 * A local URL of a picked file - for the thumbnail of an image. Revoke it
 * once it is not shown. (Not in every environment - the tests of an app may
 * run without it.)
 */
const createLocalUrl = (file: File) =>
  typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : undefined;

const revokeLocalUrl = (url: string | undefined) => {
  if (url && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
};

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

/** What `run` returns - or what it threw. */
function attempt<T>(run: () => T): { value: T } | { thrown: unknown } {
  try {
    return { value: run() };
  } catch (thrown) {
    return { thrown };
  }
}

// The browser the field last checked, and whether it can write a FileList
let checkedTransfer: unknown;
let fileListsWritable = false;

/**
 * Whether the browser can put files into a file input - by a FileList of a
 * `DataTransfer` it makes (Safari 14.1, Chrome 60, Firefox 62 and later).
 * Checked once per `DataTransfer` - tests may stub it.
 */
function canWriteFileLists() {
  const Transfer =
    typeof DataTransfer === "undefined" ? undefined : DataTransfer;
  if (Transfer !== checkedTransfer) {
    checkedTransfer = Transfer;
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.files = new DataTransfer().files;
      fileListsWritable = true;
    } catch {
      fileListsWritable = false;
    }
  }
  return fileListsWritable;
}

// The check depends on nothing that changes while the page is open
const subscribeToNothing = () => () => {};
// The server renders the field of the browsers that can write the files
const assumeWritable = () => true;

/** What the paste handler reads of a React or a native paste event. */
interface PasteEvent {
  clipboardData: DataTransfer | null;
  preventDefault: () => void;
}

/**
 * Passes on the pastes while the focus is in `element` that do not reach
 * it - Safari fires them at the body when the focus is on a button, and
 * offers to paste there at all only when `beforepaste` is canceled.
 * `getHandler` gives the handler, or null while the field takes no files.
 */
function watchPastesAround(
  element: Element,
  getHandler: () => ((event: PasteEvent) => void) | null,
) {
  const document = element.ownerDocument;
  const hasFocus = () => element.contains(getActiveElement(document));

  const handleBeforePaste = (event: Event) => {
    if (getHandler() && hasFocus()) event.preventDefault();
  };
  const handlePaste = (event: ClipboardEvent) => {
    const handler = getHandler();
    if (
      handler &&
      !event.defaultPrevented &&
      hasFocus() &&
      !element.contains(event.target as Node | null)
    ) {
      handler(event);
    }
  };

  document.addEventListener("beforepaste", handleBeforePaste);
  document.addEventListener("paste", handlePaste);

  return () => {
    document.removeEventListener("beforepaste", handleBeforePaste);
    document.removeEventListener("paste", handlePaste);
  };
}

/** Puts `files` into a file input - what the form submits from it. */
function writeFileList(input: HTMLInputElement, files: File[]) {
  if (files.length === 0) {
    input.value = "";
    return;
  }

  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } catch (error) {
    logger.error("The picked files cannot be put in the file input", error);
  }
}

const listFormats = new Map<string, Intl.ListFormat>();

/** "a.pdf, b.pdf and c.pdf" as the language joins a list. */
function formatList(localeCode: string, items: string[]) {
  let format = listFormats.get(localeCode);

  if (!format) {
    format = new Intl.ListFormat(toIntlLocale(localeCode), {
      type: "conjunction",
    });
    listFormats.set(localeCode, format);
  }

  return format.format(items);
}

const percentFormats = new Map<string, Intl.NumberFormat>();

/**
 * A percentage (0-100) as the language writes it ("40 %" in Czech) -
 * rounded down like that of `Progress`: 99.6 % is not done yet.
 */
function formatPercent(localeCode: string, percent: number) {
  let format = percentFormats.get(localeCode);

  if (!format) {
    format = new Intl.NumberFormat(toIntlLocale(localeCode), {
      maximumFractionDigits: 0,
      roundingMode: "floor",
      style: "percent",
    });
    percentFormats.set(localeCode, format);
  }

  const share = Number.isFinite(percent) ? percent / 100 : 0;
  return format.format(Math.min(Math.max(share, 0), 1));
}

/** Adds a refused file to the line of its message. */
function addRefused(groups: RefusedGroup[], message: string, name: string) {
  const index = groups.findIndex((group) => group.message === message);
  if (index === -1) return [...groups, { message, names: [name] }];

  return groups.map((group, i) =>
    i === index ? { ...group, names: [...group.names, name] } : group,
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

/** A file of the list - attached, waiting, uploading or failed. */
function FileItem({
  canChange,
  file,
  localeCode,
  messages,
  onRemove,
  removing,
  removalError,
  onRetry,
  preview,
}: {
  /** Shows its buttons - cancel, retry, remove. */
  canChange: boolean;
  file: ListedFile;
  localeCode: string;
  messages: UIMessages;
  onRemove: () => void;
  removing: boolean;
  removalError?: string;
  onRetry: () => void;
  preview: boolean;
}) {
  const nameId = useId();
  const { common, fileUpload } = messages;
  const pending = isPending(file);
  const failed = file.status === "failed";

  const name = file.url ? (
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
  );

  return (
    <li
      className={cn(
        "mb-2 flex items-center rounded-md border bg-surface p-2 shadow-sm last:mb-0 dark:bg-neutral-800",
        failed
          ? "border-danger-300 dark:border-danger-800"
          : "border-neutral-200 dark:border-neutral-700",
        preview ? "gap-3" : "gap-2",
      )}
    >
      {preview && (
        <Thumbnail
          src={
            file.localUrl ??
            file.thumbnailUrl ??
            (file.isImage ? file.url : null)
          }
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate" id={nameId}>
            {name}
          </span>
          {file.status === "uploading" && file.progress != null && (
            <span className="shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-400">
              {formatPercent(localeCode, file.progress)}
            </span>
          )}
        </div>
        {file.status === "uploading" && (
          <Progress
            aria-describedby={nameId}
            aria-label={fileUpload.uploading}
            className="mt-1"
            size="sm"
            value={file.progress}
          />
        )}
        {file.status === "queued" && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {fileUpload.queued}
          </div>
        )}
        {(failed || removalError) && (
          <div
            className="text-sm text-danger-700 dark:text-danger-400"
            role={removalError ? "alert" : undefined}
          >
            {removalError ?? file.error}
          </div>
        )}
      </div>
      {canChange && failed && (
        <Button
          aria-label={formatMessage(fileUpload.retryUpload, {
            name: file.filename,
          })}
          onClick={onRetry}
          size="sm"
          startIcon={<RotateCw size={14} />}
          variant="ghost"
        >
          {fileUpload.retry}
        </Button>
      )}
      {canChange && (
        <Tooltip
          // Above - beside it, it would stand out of a right-to-left field
          position="top"
          title={pending ? common.cancel : fileUpload.remove}
        >
          <IconButton
            aria-label={
              pending
                ? formatMessage(fileUpload.cancelUpload, {
                    name: file.filename,
                  })
                : `${fileUpload.remove} ${file.filename}`
            }
            color={pending ? "default" : "danger"}
            onClick={onRemove}
            loading={removing}
          >
            <X size={16} />
          </IconButton>
        </Tooltip>
      )}
    </li>
  );
}

/**
 * `id`, `ref` and the attributes of an HTML element not listed here -
 * `data-*`, `style`, `title`, event handlers - go to the group element
 * around the field (`role="group"`), which also takes the dropped and
 * pasted files.
 */
export interface FileUploadProps<
  TResult extends UploadedFile = UploadedFile,
> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "children"
  | "dangerouslySetInnerHTML"
  | "defaultChecked"
  | "defaultValue"
  | "onChange"
  | "onError"
> {
  /** Accepted file types, like the `accept` attribute of a file input. */
  accept?: string;
  /**
   * Ids of further elements describing the field - after its error message
   * and its `description`.
   */
  "aria-describedby"?: string;
  /**
   * Classes of the field. It has no margin of its own - the form around
   * spaces it like its other fields.
   */
  className?: string;
  /**
   * How many files upload at once - the others wait in the list and start
   * as those before them finish. `1` uploads them one after another. Only
   * with `upload`.
   */
  concurrency?: number;
  /**
   * Files attached before, e.g. when editing a record. Attachments arriving
   * later (loaded data) replace the list as long as the user has not changed
   * it. A reset of the form brings them back and drops the files uploaded
   * or picked since - without `onRemove`: the reset React does after a form
   * action follows a save, which has kept them.
   */
  defaultAttachments?: UploadedFile[];
  /**
   * Controlled attached files; queued and uploading files stay internal. A
   * file the user adds or removes changes the list once the parent applies
   * `onAttachmentsChange` - also the attachment a new file replaces without
   * `multiple`, of which `onRemove` hears as without `attachments`.
   */
  attachments?: UploadedFile[];
  /**
   * The attached list after an upload, a removal or a replacement. Use with
   * `attachments`.
   */
  onAttachmentsChange?: (attachments: UploadedFile[]) => void;
  /** Help text under the field, e.g. the accepted types and sizes. */
  description?: React.ReactNode;
  /**
   * Size of the button of the `button` variant - it is as high as an
   * `Input` of the same `dim`.
   */
  dim?: "xs" | "sm" | "md" | "lg";
  /**
   * The picker picks a folder, with all the files in it (`webkitdirectory`)
   * - use it with `multiple`. The list shows the path of each file in the
   * folder. Dropped folders are read recursively when this is enabled.
   */
  directory?: boolean;
  /** Reading a dropped folder failed; a localized error is also shown. */
  onDropError?: (error: unknown) => void;
  /**
   * No files can be added, removed, retried or cancelled - and, like a
   * disabled field, none are submitted or required. The links of the
   * attachments still open. A disabled `<fieldset>` around the field
   * disables it too.
   */
  disabled?: boolean;
  /** Validation message from the form. */
  error?: string;
  /**
   * Id of a form elsewhere in the page - the inputs of the field belong to
   * it, and its reset resets the field.
   */
  form?: string;
  /**
   * Id of the group element - the ids of the label and the messages derive
   * from it.
   */
  id?: string;
  /** Text above the field - also the name of its group. */
  label?: React.ReactNode;
  /** In megabytes. */
  maxFileSize?: number;
  /**
   * With `multiple`: the most files the list holds - the attached ones, and
   * those uploading or failed, included. Further picked, dropped or pasted
   * files are refused with a message.
   */
  maxFiles?: number;
  /**
   * Several files can be picked, dropped or pasted at once - they upload
   * side by side (`concurrency`). Without it the field holds one file: a new
   * one replaces the listed one (reported through `onRemove`) - with
   * `upload`, once it is uploaded.
   */
  multiple?: boolean;
  /**
   * Name of the hidden inputs that submit the `value` of each file - and,
   * without `upload`, of the file input that submits the picked files.
   */
  name?: string;
  /**
   * Called when a file is refused - not accepted, too large, over
   * `maxFiles`, refused by `validate` - or its upload fails, e.g. to show a
   * toast. A refusal is also shown under the field with the name of the
   * file, a failed upload in its row, with a button to retry it.
   */
  onError?: (error: unknown, file: File) => void;
  /**
   * Without `upload`: called with the picked files - the ones the form
   * submits - whenever they change, also by a form reset. The form holds
   * them by then - it can be submitted from here.
   */
  onFilesChange?: (files: File[]) => void;
  /**
   * Called before removal. A promise keeps the file with a spinner until it
   * settles; rejection or `false` retains it. Also notified when a new file replaces
   * an old one (that replacement is already complete).
   * Called when the user removes a file from the list - or replaces it with
   * a new one, without `multiple`. Not for the files a form reset drops (see
   * `defaultAttachments`), nor for a failed or cancelled upload.
   */
  onRemove?: (file: UploadedFile) => unknown;
  /**
   * Called with how many files wait for their upload or are uploading,
   * whenever that changes - e.g. to disable the submit button, to show
   * "3 of 5 uploaded" or to ask before a dialog with running uploads
   * closes. `0` once they have all finished, failed or been cancelled.
   */
  onPendingChange?: (pending: number) => void;
  /**
   * Called with the result of `upload` once a file is stored - its hidden
   * input is in the form by then (that of a controlled field once the
   * parent applies `onAttachmentsChange`).
   */
  onUpload?: (result: TResult) => void;
  /**
   * Shows a thumbnail in front of each file: a picked image from the
   * computer, then - once uploaded - its `thumbnailUrl` or `url`; other
   * files get an icon. Off by default - the pictures load the images from
   * their URLs.
   */
  preview?: boolean;
  /**
   * The files are shown - their links open - and submitted, but none can be
   * added or removed: there is no upload button, and dropped or pasted files
   * are ignored. Like a read-only native field, it is not `required`.
   */
  readOnly?: boolean;
  /** Ref to the group element (see `id`). */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * At least one file has to be attached - the browser checks it on submit.
   * With a `name`, only files the form submits count: those with a `value`,
   * or the picked files without `upload`.
   */
  required?: boolean;
  /**
   * Stores the picked file wherever the project keeps files and resolves with
   * what to list and submit for it. Report the progress (0-100) through
   * `onProgress`, and pass `signal` on to the request (`uploadWithProgress`,
   * `fetch`) - it aborts when the user cancels the upload or the field goes
   * away. What `upload` resolves with after that is ignored.
   * The form cannot be submitted while files are queued or uploading,
   * also when the field is optional or already has an attachment.
   *
   * Without it the field uploads nothing: the picked files stay files, and
   * the form submits them in a file input named `name` - `formData` of a
   * submit or of a React form action has them.
   */
  upload?: (
    file: File,
    options: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) => Promise<TResult>;
  /**
   * Checks a file after `accept` and `maxFileSize` - returns why it cannot
   * be added, or nothing when it is fine. It may be async, e.g. to read the
   * dimensions of an image. The message is shown under the field after the
   * name of the file (leave the name out of it), and `onError` gets it as an
   * `Error`. A refused file takes no room of `maxFiles`.
   * The form cannot be submitted while an async check is pending.
   */
  validate?: (
    file: File,
  ) => string | null | undefined | Promise<string | null | undefined>;
  /**
   * `dropzone` - the list with the upload button under it and the hint that
   * files can be dropped. `button` - a compact button (`dim`) with the list
   * under it; files can still be dropped on the field.
   */
  variant?: "dropzone" | "button";
}

/**
 * Uploads files and lists them - picked with the button, dropped on the
 * field or pasted into it. Storing a file is up to the `upload` callback, so
 * it works with any backend - a REST endpoint, a presigned S3 URL, a GraphQL
 * mutation, … Without `upload`, the form submits the picked files.
 */
export default function FileUpload<
  TResult extends UploadedFile = UploadedFile,
>({
  accept,
  attachments,
  onAttachmentsChange,
  "aria-describedby": ariaDescribedBy,
  className,
  concurrency = DEFAULT_CONCURRENCY,
  defaultAttachments = [],
  description,
  dim = "md",
  directory = false,
  onDropError,
  disabled: disabledProp = false,
  error,
  form,
  id,
  label,
  maxFileSize = MAX_FILE_SIZE,
  maxFiles,
  multiple = false,
  name,
  onError,
  onFilesChange,
  onPendingChange,
  onRemove,
  onUpload,
  preview = false,
  readOnly = false,
  ref,
  required,
  upload,
  validate,
  variant = "dropzone",
  ...props
}: Readonly<FileUploadProps<TResult>>) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const labelId = `${groupId}-label`;

  // The drop zone is no native field - a disabled fieldset around it leaves
  // it alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;
  const errorId = `${labelId}-error`;
  const descriptionId = `${labelId}-description`;

  // Without `upload` the form submits the picked files - from a file input
  // the field puts them in. A browser that cannot do that submits what its
  // native picker put in the input.
  const isNative = !upload;
  const canWriteFiles = useSyncExternalStore(
    subscribeToNothing,
    canWriteFileLists,
    assumeWritable,
  );
  const isFallback = isNative && !canWriteFiles;
  const canAdd = !disabled && !readOnly;
  // Dropped and pasted files have to be put in the input
  const canDrop = canAdd && !isFallback;

  const [refused, setRefused] = useState<RefusedGroup[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  // What the live region says - a new id repeats the same text
  const [announcement, setAnnouncement] = useState<{
    id: number;
    text: string;
  } | null>(null);

  const [files, setFiles] = useState<ListedFile[]>(() =>
    toListedFiles(attachments ?? defaultAttachments),
  );
  // Independent picks with `multiple` may still be checked after another
  // pick has finished. Every current check must settle before submitting.
  const [checkingPicks, setCheckingPicks] = useState(0);
  // The user added or removed a file - later `defaultAttachments` no longer
  // replace the list
  const [interacted, setInteracted] = useState(false);

  // `defaultAttachments` arriving later (data of an edit form) are listed
  // unless the user has changed the list meanwhile
  const defaultKey = attachmentsKey(defaultAttachments);
  const [appliedDefaultKey, setAppliedDefaultKey] = useState(defaultKey);

  if (defaultKey !== appliedDefaultKey) {
    setAppliedDefaultKey(defaultKey);
    if (!interacted && attachments === undefined)
      setFiles(toListedFiles(defaultAttachments));
  }

  const [removing, setRemoving] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const removingRef = useRef(new Set<string>());
  const [removalErrors, setRemovalErrors] = useState<Record<string, string>>(
    {},
  );
  const controlledAttachmentsKey =
    attachments === undefined ? null : attachmentsKey(attachments);
  const [appliedAttachmentsKey, setAppliedAttachmentsKey] = useState(
    controlledAttachmentsKey,
  );
  if (controlledAttachmentsKey !== appliedAttachmentsKey) {
    setAppliedAttachmentsKey(controlledAttachmentsKey);
    if (attachments !== undefined)
      setFiles([
        ...toListedFiles(attachments),
        ...files.filter((file) => file.status !== "done" || file.file),
      ]);
  }

  // The list as of the last change - read by the uploads, which outlive the
  // render they started in
  const filesRef = useRef(files);
  // The list the page shows - the rows of the DOM
  const shownFiles = useRef(files);
  // What the uploads read of the last render - its callbacks: those of the
  // render a file was picked in would see its state (an `onUpload` adding
  // to a list of the parent would lose files)
  const latest = useRef({
    concurrency,
    canDrop,
    onDropError,
    onError,
    attachments,
    onAttachmentsChange,
    onFilesChange,
    onPendingChange,
    onRemove,
    onUpload,
    upload,
    validate,
  });
  const [reportVersion, setReportVersion] = useState(0);
  const reports = useRef({
    committed: 0,
    pending: 0,
    queue: [] as ((callbacks: typeof latest.current) => void)[],
  });

  // Insertion effects also run for the commits of a hidden Activity.
  // Uploads finishing there must see the parent's latest callbacks too.
  useInsertionEffect(() => {
    filesRef.current = files;
    latest.current = {
      concurrency,
      canDrop,
      onDropError,
      onError,
      attachments,
      onAttachmentsChange,
      onFilesChange,
      onPendingChange,
      onRemove,
      onUpload,
      upload,
      validate,
    };
  });

  useLayoutEffect(() => {
    shownFiles.current = files;
  });

  // `onPendingChange` - told only of a change, not of the 0 it starts with
  const pendingCount = files.filter(isPending).length;
  const reportedPending = useRef(0);

  useEffect(() => {
    if (pendingCount === reportedPending.current) return;
    reportedPending.current = pendingCount;
    latest.current.onPendingChange?.(pendingCount);
  }, [pendingCount]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [storeRef, retainStoreRef] = useRetainedInputRef();
  const [validationRef, retainValidationRef] = useRetainedInputRef();
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Abort the running uploads, by the key of their row
  const controllers = useRef<Map<string, AbortController>>(new Map());
  // The focused element of a row as the list changed, with the row - the
  // focus moves on when the change took the element away
  const pendingFocus = useRef<{
    element: Element;
    index: number;
    key: string;
  } | null>(null);
  // Whether the field is still alive, also while Activity hides it. A
  // callback may remove it (an `onUpload` closing its dialog).
  const mounted = useRef(false);
  // Invalidates pending checks on a reset, unmount or a pick that replaces
  // the previous one (a single file, or the native picker of the fallback)
  const generation = useRef(0);
  // The uploads that ended since the field last had none running - said
  // together once all have ended
  const session = useRef({ failed: 0, uploaded: 0 });

  // Insertion effects follow the actual lifetime, unlike effects replayed
  // by Activity and StrictMode. Hidden fields keep their uploads, pending
  // validation and previews until they finish or the field unmounts.
  useInsertionEffect(() => {
    mounted.current = true;
    const running = controllers.current;
    // The list and the count as they are when the field goes away
    const listed = filesRef;
    const rounds = generation;
    const reported = reportedPending;
    const callbacks = latest;

    return () => {
      mounted.current = false;
      reports.current.queue = [];
      rounds.current++;
      const pending = [...running.values()];
      const remaining = listed.current;
      running.clear();
      // Abort listeners may update their owner's state, which insertion
      // effects cannot do. Ignore late results now and notify after commit.
      queueMicrotask(() => {
        pending.forEach((controller) => controller.abort());
        remaining.forEach((file) => revokeLocalUrl(file.localUrl));
        // The uploads it told of end with the field - a submit button
        // waiting for them comes back
        if (reported.current === 0) return;
        reported.current = 0;
        callbacks.current.onPendingChange?.(0);
      });
    };
  }, []);

  // The form submits the picked files from this input, including a pick
  // whose asynchronous validation finishes in a hidden Activity.
  const storeFieldRef = useCallback(
    (element: HTMLInputElement | null) => {
      const detach = retainStoreRef(element);
      if (element) writeFileList(element, pickedFiles(filesRef.current));
      return detach;
    },
    [retainStoreRef],
  );

  useInsertionEffect(() => {
    if (storeRef.current) writeFileList(storeRef.current, pickedFiles(files));
  }, [files, isFallback, name]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;

    // Still on the page - the focus stays on it
    if (target.element.isConnected) return;

    // The row of the element - a failed upload tried again gets a cancel
    // button in place of its retry button - or the row that took the place
    // of the removed one, the one before it, the upload button
    const own = files.findIndex((file) => file.key === target.key);
    const index = own === -1 ? Math.min(target.index, files.length - 1) : own;
    const next =
      index >= 0
        ? listRef.current?.children[index]?.querySelector("button")
        : null;

    (next ?? buttonRef.current)?.focus();
  });

  const announce = (text: string) =>
    setAnnouncement((prev) => ({ id: (prev?.id ?? 0) + 1, text }));

  // A hidden Activity renders in the background even inside flushSync.
  // Report one change per commit, so callbacks for simultaneous uploads
  // receive the parent state produced by the previous upload.
  const report = useCallback(
    (change?: (callbacks: typeof latest.current) => void) => {
      const state = reports.current;
      if (change) state.queue.push(change);
      if (state.pending !== state.committed) return;

      const next = state.queue.shift();
      if (!next) return;

      const version = ++state.pending;
      // The inputs hold the files of the change before the callbacks, which
      // may submit the form - then what they set renders at once too
      flushSync(() => setReportVersion(version));
      flushSync(() => next(latest.current));
    },
    [],
  );

  useInsertionEffect(() => {
    const state = reports.current;
    state.committed = reportVersion;
    if (state.pending !== reportVersion || state.queue.length === 0) return;

    // Insertion effects cannot call a callback that updates parent state.
    queueMicrotask(() => {
      if (mounted.current) report();
    });
  }, [report, reportVersion]);

  // Notes the focused element of a row before the list changes
  const rememberFocus = () => {
    const list = listRef.current;
    const active = getActiveElement();
    if (pendingFocus.current || !list || !active || !list.contains(active)) {
      return;
    }

    const index = Array.from(list.children).findIndex((row) =>
      row.contains(active),
    );
    const row = shownFiles.current[index];
    if (row) pendingFocus.current = { element: active, index, key: row.key };
  };

  const commit = (next: ListedFile[]) => {
    rememberFocus();
    filesRef.current = next;
    setFiles(next);
  };

  const update = (key: string, change: Partial<ListedFile>) => {
    if (!filesRef.current.some((file) => file.key === key)) return;
    commit(
      filesRef.current.map((file) =>
        file.key === key ? { ...file, ...change } : file,
      ),
    );
  };

  // Stops the upload of a file leaving the list, and frees its thumbnail
  const release = (file: ListedFile) => {
    controllers.current.get(file.key)?.abort();
    controllers.current.delete(file.key);
    revokeLocalUrl(file.localUrl);
  };

  const announceUploading = () =>
    announce(
      formatPlural(
        locale.code,
        messages.fileUpload.uploadingCount,
        filesRef.current.filter(isPending).length,
      ),
    );

  // Once no upload waits or runs, says how those since the last time went
  const endSessionWhenIdle = () => {
    if (filesRef.current.some(isPending)) return;

    const { failed, uploaded } = session.current;
    session.current = { failed: 0, uploaded: 0 };
    const text = [
      uploaded > 0 &&
        formatPlural(locale.code, messages.fileUpload.uploadedCount, uploaded),
      failed > 0 &&
        formatPlural(locale.code, messages.fileUpload.failedCount, failed),
    ]
      .filter(Boolean)
      .join(" ");

    if (text) announce(text);
  };

  const finishUpload = (
    key: string,
    file: File,
    controller: AbortController,
    outcome: UploadOutcome<TResult>,
  ) => {
    if (controllers.current.get(key) === controller) {
      controllers.current.delete(key);
    }

    // Cancelled, reset or gone - the field has moved on
    if (!outcome || !mounted.current) return;
    const entry = filesRef.current.find((listed) => listed.key === key);
    if (!entry) return;

    if ("error" in outcome) {
      logger.error("File upload failed", outcome.error);
      session.current.failed++;
      update(key, {
        error: messages.fileUpload.uploadFailed,
        progress: undefined,
        status: "failed",
      });
      report(({ onError }) => onError?.(outcome.error, file));
    } else {
      const { result } = outcome;
      // The stored file shows from now on
      revokeLocalUrl(entry.localUrl);
      const uploaded: ListedFile = {
        filename: result.filename || entry.filename,
        id: result.id || entry.id,
        isImage: entry.isImage,
        key,
        status: "done",
        thumbnailUrl: result.thumbnailUrl,
        url: result.url,
        value: result.value,
      };

      // A single file field holds the new file only - a controlled one
      // once its parent applies the new list, still told what it replaced
      const replaced = multiple
        ? []
        : filesRef.current.filter((listed) => listed.key !== key);
      replaced.forEach(release);
      session.current.uploaded++;
      commit(
        latest.current.attachments !== undefined
          ? filesRef.current.filter((listed) => listed.key !== key)
          : multiple
            ? filesRef.current.map((listed) =>
                listed.key === key ? uploaded : listed,
              )
            : [uploaded],
      );
      report(({ attachments, onAttachmentsChange, onRemove, onUpload }) => {
        setInteracted(true);
        const list =
          attachments === undefined
            ? filesRef.current
                .filter((listed) => listed.status === "done")
                .map(toUploadedFile)
            : multiple
              ? [...attachments, toUploadedFile(uploaded)]
              : [toUploadedFile(uploaded)];
        onAttachmentsChange?.(list);
        onUpload?.(result);
        replaced.forEach((listed) => {
          if (listed.status !== "done" || !onRemove) return;
          const outcome = attempt(() => onRemove(toUploadedFile(listed)));
          if ("thrown" in outcome) {
            logger.error("Replaced file cleanup failed", outcome.thrown);
          } else if (isPromiseLike(outcome.value)) {
            void Promise.resolve(outcome.value).catch((error) => {
              logger.error("Replaced file cleanup failed", error);
            });
          }
        });
      });
    }

    // A callback took the field away - the files still waiting stay
    if (!mounted.current) return;
    endSessionWhenIdle();
    startUploads();
  };

  const startUpload = (entry: ListedFile) => {
    const send = latest.current.upload;
    const { file } = entry;
    if (!send || !file) return;

    const controller = new AbortController();
    controllers.current.set(entry.key, controller);
    update(entry.key, {
      error: undefined,
      progress: null,
      status: "uploading",
    });

    void runUpload(
      () =>
        send(file, {
          onProgress: (progress) => {
            // A cancelled upload that goes on reports nothing
            if (mounted.current && !controller.signal.aborted) {
              update(entry.key, { progress });
            }
          },
          signal: controller.signal,
        }),
      controller.signal,
    ).then((outcome) => finishUpload(entry.key, file, controller, outcome));
  };

  // Starts the waiting uploads there is room for
  const startUploads = () => {
    if (!mounted.current || !latest.current.upload) return;

    const limit = Math.max(1, Math.floor(latest.current.concurrency) || 1);
    let running = filesRef.current.filter(
      (file) => file.status === "uploading",
    ).length;

    for (const file of filesRef.current) {
      if (running >= limit) break;
      if (file.status !== "queued") continue;
      running++;
      startUpload(file);
    }
  };

  const refusal = (message: string): Refusal => ({
    error: new Error(message),
    message,
  });

  // Why a file cannot be added - null when it can, a promise while an async
  // `validate` decides
  const checkFile = (file: File): Refusal | null | Promise<Refusal | null> => {
    if (!isAccepted(file, accept)) {
      return refusal(messages.fileUpload.fileTypeNotAccepted);
    }
    if (file.size > Math.pow(1024, 2) * maxFileSize) {
      return refusal(
        formatMessage(messages.fileUpload.maxFileSizeExceeded, {
          size: formatNumber(locale.code, maxFileSize),
        }),
      );
    }

    const check = latest.current.validate;
    if (!check) return null;

    const toRefusal = (message: string | null | undefined) =>
      message ? refusal(message) : null;
    // A check that breaks refuses the file - `onError` gets what it threw
    const broken = (thrown: unknown): Refusal => {
      logger.error("File validation failed", thrown);
      return { error: thrown, message: messages.fileUpload.validationFailed };
    };

    const outcome = attempt(() => check(file));
    if ("thrown" in outcome) return broken(outcome.thrown);

    const { value } = outcome;
    return isPromiseLike<string | null | undefined>(value)
      ? Promise.resolve(value).then(toRefusal, broken)
      : toRefusal(value);
  };

  // Adds the files that passed their checks. `pickerInput` holds them in a
  // browser that cannot put files into an input - the form submits what it
  // holds, so it has to be the whole list of picked files.
  const addChecked = (
    taken: File[],
    results: (Refusal | null)[],
    pickerInput?: HTMLInputElement,
  ) => {
    const current = filesRef.current;
    // What stays besides the new files: a single file field replaces its
    // file - an upload only once it is stored - and the input of the
    // fallback holds the new files only
    const kept = pickerInput
      ? multiple
        ? current.filter((file) => !file.file)
        : []
      : multiple
        ? current
        : isNative
          ? []
          : current.filter((file) => file.status === "done");

    // All files are checked before the first one is added - a refused one
    // is said at once, and one refused for its type takes no room
    const room =
      multiple && maxFiles !== undefined ? maxFiles - kept.length : Infinity;
    let accepted: File[] = [];
    const refusals: { file: File; refusal: Refusal }[] = [];

    taken.forEach((file, index) => {
      const problem =
        results[index] ??
        (accepted.length >= room
          ? refusal(
              formatPlural(
                locale.code,
                messages.fileUpload.maxFiles,
                maxFiles ?? 0,
              ),
            )
          : null);

      if (problem) refusals.push({ file, refusal: problem });
      else accepted.push(file);
    });

    for (const { file, refusal: problem } of refusals) {
      report(({ onError }) => {
        setRefused((groups) =>
          addRefused(groups, problem.message, nameOf(file)),
        );
        onError?.(problem.error, file);
      });
      // A callback took the field away
      if (!mounted.current) return;
    }

    // The input holds the refused files too - the pick is refused whole
    if (pickerInput && refusals.length > 0) {
      pickerInput.value = "";
      accepted = [];
    }

    const added = accepted.map((file): ListedFile => {
      const key = createFileId();
      const isImage = isImageFile(file.name, file.type);
      return {
        file,
        filename: nameOf(file),
        id: key,
        isImage,
        key,
        localUrl: (preview && isImage && createLocalUrl(file)) || undefined,
        status: isNative ? "done" : "queued",
      };
    });
    const leaving = current.filter((file) => !kept.includes(file));
    if (added.length === 0 && (!pickerInput || leaving.length === 0)) return;

    // Attachments of a parent stay listed until it applies the list without
    // them - only a single file field replaces them, all of them
    const controlled = latest.current.attachments !== undefined;
    const replacesStored = controlled && leaving.some(isStored);
    leaving.forEach(release);
    commit([
      ...(controlled
        ? current.filter((file) => kept.includes(file) || isStored(file))
        : kept),
      ...added,
    ]);

    if (!isNative) {
      setInteracted(true);
      announceUploading();
      startUploads();
      return;
    }

    report(({ onAttachmentsChange, onFilesChange, onRemove }) => {
      setInteracted(true);
      leaving.forEach((file) => onRemove?.(toUploadedFile(file)));
      if (replacesStored) onAttachmentsChange?.([]);
      onFilesChange?.(pickedFiles(filesRef.current));
    });
    if (added.length > 0) {
      announce(
        formatPlural(locale.code, messages.fileUpload.addedCount, added.length),
      );
    }
  };

  const addFiles = (picked: File[], pickerInput?: HTMLInputElement) => {
    setRefused([]);

    // Additive picks keep their checks; a replacement makes the previous
    // pick obsolete even when its validation finishes after this one's.
    if (!multiple || pickerInput) {
      generation.current++;
      reports.current.queue = [];
      setCheckingPicks(0);
    }
    const taken = multiple ? picked : picked.slice(0, 1);
    const round = generation.current;
    const results = taken.map(checkFile);

    // A check of `validate` that takes time - the files are added once all
    // are checked, unless this pick was superseded, the form was reset or
    // the field went away
    if (results.some((result) => isPromiseLike(result))) {
      setCheckingPicks((count) => count + 1);
      void Promise.all(results)
        .then((settled) => {
          if (round === generation.current) {
            addChecked(taken, settled, pickerInput);
          }
        })
        .finally(() => {
          // A reset, unmount or replacing pick has already forgotten this
          // check. It must not release a newer one still on its way.
          if (round === generation.current) {
            setCheckingPicks((count) => count - 1);
          }
        });
    } else {
      addChecked(taken, results as (Refusal | null)[], pickerInput);
    }
  };

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultAttachments` and drops the uploads and the picked files
  const formResetRef = useFormReset(() => {
    generation.current++;
    reports.current.queue = [];
    setCheckingPicks(0);
    const current = filesRef.current;
    current.forEach(release);
    session.current = { failed: 0, uploaded: 0 };
    commit(toListedFiles(attachments ?? defaultAttachments));
    setRemoving(new Set());
    removingRef.current.clear();
    setRemovalErrors({});
    setInteracted(false);
    setRefused([]);
    if (pickedFiles(current).length > 0) latest.current.onFilesChange?.([]);
  }, form);

  // Handles the pastes of the last render - null while it takes no files
  const pasteHandler = useRef<((event: PasteEvent) => void) | null>(null);

  const groupRef = useCallback(
    (element: HTMLDivElement | null) => {
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);
      const detachPastes =
        element && watchPastesAround(element, () => pasteHandler.current);
      const detachRef = attachRef(ref, element);

      return () => {
        detachRef();
        detachReset?.();
        detachFieldset?.();
        detachPastes?.();
      };
    },
    [fieldsetRef, formResetRef, ref],
  );

  const handleChange = ({ target }: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(target.files ?? []);

    // The input keeps what the browser put in it - the form submits it
    if (isFallback) {
      addFiles(picked, target);
      return;
    }

    // The same file can be picked again
    target.value = "";
    if (picked.length > 0) addFiles(picked);
  };

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  // Files dropped anywhere but on a drop target open in the browser - so
  // the field takes them always and only ignores them when it cannot add
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = canDrop ? "copy" : "none";
    setIsDragOver(canDrop);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (event.defaultPrevented || !hasFiles(event)) return;

    event.preventDefault();
    if (!canDrop) return;

    const drop = snapshotDrop(event.dataTransfer);
    if (!directory || !drop.entries.some((entry) => entry?.isDirectory)) {
      if (drop.files.length > 0) addFiles(drop.files);
      return;
    }
    if (!multiple) {
      generation.current++;
      reports.current.queue = [];
      setCheckingPicks(0);
    }
    const round = generation.current;
    const current = () =>
      mounted.current && round === generation.current && latest.current.canDrop;
    setCheckingPicks((count) => count + 1);
    void readDroppedDirectories(drop, current)
      .then(
        (dropped) => {
          if (current() && dropped.length) addFiles(dropped);
        },
        (error: unknown) => {
          if (!current()) return;
          setRefused([
            {
              message: messages.fileUpload.folderReadFailed,
              names: drop.entries
                .filter((entry) => entry?.isDirectory)
                .map((entry) => entry!.name),
            },
          ]);
          latest.current.onDropError?.(error);
        },
      )
      .finally(() => {
        if (mounted.current && round === generation.current)
          setCheckingPicks((count) => Math.max(0, count - 1));
      });
  };

  // A screenshot or files copied in the file manager, pasted while the
  // focus is in the field - text pastes as usual
  const handlePaste = (event: PasteEvent) => {
    const pasted = Array.from(event.clipboardData?.files ?? []);
    if (pasted.length === 0 || !canDrop) return;

    event.preventDefault();
    addFiles(pasted);
  };

  useLayoutEffect(() => {
    pasteHandler.current = canDrop ? handlePaste : null;
  });

  const handleRemove = (file: ListedFile) => {
    if (removingRef.current.has(file.key)) return;
    const round = generation.current;
    const isCurrent = () => {
      const current = filesRef.current.find(
        (listed) => listed.key === file.key,
      );
      return (
        !!current &&
        attachmentsKey([toUploadedFile(current)]) ===
          attachmentsKey([toUploadedFile(file)])
      );
    };
    const complete = () => {
      if (!mounted.current || round !== generation.current || !isCurrent())
        return;
      release(file);
      if (isFallback && file.file && inputRef.current)
        inputRef.current.value = "";
      const attachmentIndex = filesRef.current
        .filter((listed) => listed.status === "done")
        .findIndex((listed) => listed.key === file.key);
      if (
        latest.current.attachments === undefined ||
        file.status !== "done" ||
        file.file
      )
        commit(filesRef.current.filter(({ key }) => key !== file.key));
      setInteracted(true);
      if (isPending(file)) {
        endSessionWhenIdle();
        startUploads();
      } else if (file.status === "done") {
        report(({ attachments, onAttachmentsChange, onFilesChange }) => {
          if (file.file) {
            onFilesChange?.(pickedFiles(filesRef.current));
            return;
          }
          const list =
            attachments === undefined
              ? filesRef.current
                  .filter((listed) => listed.status === "done")
                  .map(toUploadedFile)
              : attachments.filter((item, index) =>
                  file.id && item.id
                    ? item.id !== file.id
                    : index !== attachmentIndex,
                );
          onAttachmentsChange?.(list);
        });
      }
    };
    if (file.status !== "done" || !onRemove) {
      complete();
      return;
    }
    setRemovalErrors((previous) => ({ ...previous, [file.key]: "" }));
    const outcome = attempt(() => onRemove(toUploadedFile(file)));
    const fail = (error: unknown) => {
      if (!mounted.current || round !== generation.current || !isCurrent())
        return;
      logger.error("File removal failed", error);
      setRemovalErrors((previous) => ({
        ...previous,
        [file.key]: messages.fileUpload.removeFailed,
      }));
    };
    if ("thrown" in outcome) {
      fail(outcome.thrown);
      return;
    }
    if (!isPromiseLike(outcome.value)) {
      if (outcome.value !== false) complete();
      return;
    }
    removingRef.current.add(file.key);
    setRemoving((previous) => new Set(previous).add(file.key));
    void Promise.resolve(outcome.value)
      .then((accepted) => {
        if (accepted !== false) complete();
      }, fail)
      .finally(() => {
        if (!mounted.current || round !== generation.current) return;
        removingRef.current.delete(file.key);
        setRemoving((previous) => {
          const next = new Set(previous);
          next.delete(file.key);
          return next;
        });
      });
  };

  const handleRetry = (file: ListedFile) => {
    update(file.key, { error: undefined, progress: null, status: "queued" });
    announceUploading();
    startUploads();
  };

  const hasError = !!error || refused.length > 0;
  // The error first, then the help text, then what the page adds
  const describedBy = joinTokens(
    hasError ? errorId : undefined,
    description ? descriptionId : undefined,
    ariaDescribedBy,
  );
  // Without a name nothing is submitted - any attached file will do
  const hasRequiredFile = files.some(
    (file) => file.status === "done" && (!name || !!file.value || !!file.file),
  );
  const validationMessage =
    checkingPicks > 0
      ? messages.fileUpload.waitForValidation
      : removing.size > 0
        ? messages.fileUpload.waitForRemoval
        : files.some(isPending)
          ? messages.fileUpload.waitForUpload
          : "";
  const validates = !!required || !!validationMessage;

  // Retained inputs are available in hidden commits. A newly mounted one
  // gets its validity in the ref callback, after insertion effects finish.
  const validationFieldRef = useCallback(
    (element: HTMLInputElement | null) => {
      const detach = retainValidationRef(element);
      element?.setCustomValidity(validationMessage);
      return detach;
    },
    [retainValidationRef, validationMessage],
  );

  useInsertionEffect(() => {
    validationRef.current?.setCustomValidity(validationMessage);
  }, [validationMessage]);

  const picked = pickedFiles(files);
  // The input of the fallback cannot lose one of several files
  const canRemovePicked = !isFallback || picked.length <= 1;

  const refusedLines = refused.map(({ message, names }) => {
    // "a.pdf, b.pdf, c.pdf and 4 more" - a whole list when it is short
    const shown =
      names.length > MAX_LISTED_NAMES + 1
        ? [
            ...names.slice(0, MAX_LISTED_NAMES),
            formatPlural(
              locale.code,
              messages.fileUpload.moreFiles,
              names.length - MAX_LISTED_NAMES,
            ),
          ]
        : names;

    return formatMessage(messages.fileUpload.refused, {
      files: formatList(locale.code, shown),
      message,
    });
  });

  const list = files.length > 0 && (
    <ul
      className={cn(
        "overflow-auto",
        // Room for 5 rows - of uploads, errors - before it scrolls
        preview ? "max-h-72" : "max-h-60",
        // Apart from the button - there is none in a read-only field
        !readOnly && (variant === "button" ? "mt-2" : "mb-4"),
        disabled && "opacity-60",
      )}
      ref={listRef}
    >
      {files.map((file) => (
        <FileItem
          canChange={canAdd && (!file.file || canRemovePicked)}
          file={file}
          key={file.key}
          localeCode={locale.code}
          messages={messages}
          onRemove={() => handleRemove(file)}
          removing={removing.has(file.key)}
          removalError={removalErrors[file.key]}
          onRetry={() => handleRetry(file)}
          preview={preview}
        />
      ))}
    </ul>
  );

  return (
    <div
      {...props}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-invalid={hasError ? "true" : undefined}
      aria-labelledby={label ? labelId : undefined}
      className={cn(
        "relative rounded-md transition-colors motion-reduce:transition-none",
        // Forced colors (Windows High Contrast) draw no tint and no ring -
        // an outline of the system's highlight color then
        isDragOver &&
          "bg-primary-50 ring-2 ring-primary-500 dark:bg-primary-950/40 forced-colors:outline-2 forced-colors:outline-[Highlight]",
        className,
      )}
      data-disabled={disabled ? "" : undefined}
      data-invalid={hasError ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      id={groupId}
      onDragLeave={(event) => {
        props.onDragLeave?.(event);
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDragOver={(event) => {
        props.onDragOver?.(event);
        if (!event.defaultPrevented) handleDragOver(event);
      }}
      onDrop={(event) => {
        props.onDrop?.(event);
        handleDrop(event);
      }}
      onPaste={(event) => {
        props.onPaste?.(event);
        if (!event.defaultPrevented) handlePaste(event);
      }}
      ref={groupRef}
      role="group"
    >
      {label ? (
        <div
          className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          id={labelId}
        >
          {label}
          {messages.form.labelSuffix} {required && <RequiredMark />}
        </div>
      ) : null}

      {variant === "dropzone" && list}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {variant === "button" ? (
            <Button
              aria-describedby={describedBy}
              className={buttonDimStyles[dim]}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              ref={buttonRef}
              startIcon={<Upload size={buttonIconSizes[dim]} />}
              variant="outline"
            >
              {messages.fileUpload.upload}
            </Button>
          ) : (
            <>
              <Button
                aria-describedby={describedBy}
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                ref={buttonRef}
                size="sm"
                variant="outline"
              >
                <Upload className="me-2" size={16} />
                {messages.fileUpload.upload}
              </Button>
              {/* Nothing to drag on a touch screen */}
              {canDrop && (
                <span className="text-sm text-neutral-500 dark:text-neutral-400 pointer-coarse:hidden">
                  {messages.fileUpload.dropHint}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {variant === "button" && list}

      {readOnly && files.length === 0 && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {messages.fileUpload.noFiles}
        </p>
      )}

      <input
        accept={accept}
        aria-hidden="true"
        disabled={disabled}
        // The fallback submits the files from here
        form={isFallback ? form : undefined}
        multiple={multiple}
        name={isFallback ? name : undefined}
        onChange={handleChange}
        ref={inputRef}
        style={{ display: "none" }}
        tabIndex={-1}
        type="file"
        {...(directory ? { webkitdirectory: "" } : undefined)}
      />

      {/* The picked files - nothing is submitted without one, where a
          native file input would submit an empty file */}
      {isNative && !isFallback && name && (
        <input
          aria-hidden="true"
          disabled={disabled || picked.length === 0}
          form={form}
          multiple={multiple}
          name={name}
          ref={storeFieldRef}
          style={{ display: "none" }}
          tabIndex={-1}
          type="file"
        />
      )}

      {/* Lets the browser enforce `required` and wait for checks and uploads
          before submitting, even with an attachment already present. It
          leads the user to the button. Read-only, it is not validated. */}
      {validates && (
        <input
          aria-hidden="true"
          disabled={disabled}
          form={form}
          onChange={() => {}}
          onFocus={() => buttonRef.current?.focus()}
          readOnly={readOnly}
          ref={validationFieldRef}
          required={required}
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={hasRequiredFile ? "valid" : ""}
        />
      )}

      <FormDescription className="mt-2" id={descriptionId}>
        {description}
      </FormDescription>

      {hasError && (
        <FormError className="mt-2" id={errorId}>
          {error && <div>{error}</div>}
          {refusedLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </FormError>
      )}

      {/* The uploads said together - when they start and once they are
          over, not at every step of their progress */}
      <div className="sr-only" role="status">
        {announcement && <span key={announcement.id}>{announcement.text}</span>}
      </div>

      {files.map(({ key, status, value }) =>
        status === "done" && value ? (
          <input
            disabled={disabled}
            form={form}
            key={key}
            name={name}
            type="hidden"
            value={value}
          />
        ) : null,
      )}
    </div>
  );
}
