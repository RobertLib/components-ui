import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const presignedUpload = `import { FileUpload, uploadWithProgress, type FileUploadProps } from "components-ui";

// 1. Ask your API where to put the file, 2. send it there with progress
const upload: FileUploadProps["upload"] = async (file, { onProgress, signal }) => {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
    signal,
  });
  if (!response.ok) throw new Error(\`Upload refused: \${response.status}\`);
  const { uploadUrl, signedId } = await response.json();

  await uploadWithProgress(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    onProgress,
    signal, // aborted when the user cancels the upload
  });

  return { filename: file.name, value: signedId };
};

<FileUpload name="attachments" upload={upload} />`;

const formDataUpload = `// A POST of FormData straight to your endpoint
async function upload(
  file: File,
  { onProgress, signal }: { onProgress: (percent: number) => void; signal: AbortSignal },
) {
  const body = new FormData();
  body.append("file", file);

  const responseText = await uploadWithProgress("/api/files", body, {
    method: "POST",
    headers: { Authorization: \`Bearer \${token}\` },
    onProgress,
    signal,
  });
  const { id, url } = JSON.parse(responseText);

  return { filename: file.name, url, value: id };
}`;

const failedUpload = `<FileUpload
  onError={(error) => {
    // A response of the server: its status and body
    if (error instanceof Error && "status" in error && error.status === 413) {
      enqueueSnackbar("The file is too large for the server", "error");
    }
  }}
  upload={upload}
/>`;

export default function FileUploadPage() {
  return (
    <DocPage
      imports={[
        "FileUpload",
        "uploadWithProgress",
        "type FileUploadProps",
        "type UploadedFile",
      ]}
      title="FileUpload"
    >
      <Example
        description={
          <p>
            Picks a file, stores it with your <code>upload</code> function while
            showing the progress, and lists it. Each file's <code>value</code>{" "}
            is submitted in a hidden input named <code>name</code>. A file over{" "}
            <code>maxFileSize</code> (MB) or not matching <code>accept</code> is
            refused with a message under the field that names it; refusals and
            failed uploads are also reported to <code>onError</code>. Files can
            be dropped on the field or pasted into it too. Without{" "}
            <code>multiple</code> a new file replaces the listed one once it is
            stored. The × button of an upload cancels it: the field takes
            another file at once, even if <code>upload</code> does not stop.
          </p>
        }
        name="file-upload/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            With <code>multiple</code> several files upload side by side -{" "}
            <code>concurrency</code> of them at once (3 by default, 1 uploads
            them one after another); the others wait in the list and start as
            those before them finish. Each file shows its own progress and can
            be cancelled; more files can be added meanwhile. A failed upload
            stays in the list with its message and a Retry button (this demo
            fails every third one); removing it calls no <code>onRemove</code>.{" "}
            <code>maxFiles</code> caps the list, the attached, uploading and
            failed files included.
          </p>
        }
        name="file-upload/parallel"
        title="Uploads side by side"
      />
      <Example
        description={
          <p>
            <code>preview</code> puts a thumbnail in front of each file: a
            picked image shows from the computer while it uploads, a stored one
            by its <code>thumbnailUrl</code> - a smaller picture the server made
            - or its <code>url</code>. Other files, and pictures that do not
            load, get an icon. It is off by default, as the thumbnails load the
            images from their URLs. <code>description</code> is the help text
            under the field - it describes the field for screen readers too.
          </p>
        }
        name="file-upload/preview"
        title="Thumbnails and help text"
      />
      <Example
        description={
          <p>
            Without <code>upload</code> the field uploads nothing: the picked,
            dropped and pasted files stay files, and the form submits them in a
            file input named <code>name</code> - <code>new FormData(form)</code>{" "}
            and a React form action (or a server action) get them.{" "}
            <code>accept</code>, <code>maxFileSize</code>, <code>maxFiles</code>
            , <code>validate</code> and <code>required</code> work as with{" "}
            <code>upload</code>; <code>onFilesChange</code> gets the files
            whenever they change. React resets the form after its action - the
            list empties.
          </p>
        }
        name="file-upload/native"
        title="Without upload - the form submits the files"
      />
      <Example
        description={
          <p>
            <code>validate</code> checks each file after <code>accept</code> and{" "}
            <code>maxFileSize</code> - here the dimensions of an image, read in
            the browser. It returns why the file cannot be added, or nothing; it
            may be async. The message is shown under the field after the name of
            the file (leave the name out of it) and reaches <code>onError</code>{" "}
            as an <code>Error</code>; a check that throws refuses the file with
            a general message. A refused file takes no room of{" "}
            <code>maxFiles</code>. Several files refused for one reason share a
            line. Screenshots and files copied in the file manager can be pasted
            (⌘V / Ctrl+V) while the focus is in the field.
          </p>
        }
        name="file-upload/validation"
        title="Validation and pasting"
      />
      <Example
        description={
          <p>
            <code>variant="button"</code> is a compact button with the list
            under it, for a row of fields - files can still be dropped on it.
            Its <code>dim</code> is that of the form fields: the button is as
            high as an <code>Input</code> of the same <code>dim</code> - 22, 26,
            34 or 46 px. The default <code>variant="dropzone"</code> lists the
            files above the button and says that they can be dropped.{" "}
            <code>id</code>, <code>ref</code> and the other attributes of a{" "}
            <code>div</code> go to the group of the field, which takes the
            dropped files.
          </p>
        }
        name="file-upload/compact"
        title="Compact"
      />
      <Example
        description={
          <p>
            <code>readOnly</code> shows the files - their links open - and
            submits their values, but none can be added or removed: there is no
            upload button, and dropped or pasted files are ignored. Like a
            read-only native field it is not <code>required</code>, and without
            files it says so. <code>disabled</code> takes no files either and
            submits none, as a disabled field; a disabled{" "}
            <code>&lt;fieldset&gt;</code> around the field disables it too.
          </p>
        }
        name="file-upload/read-only"
        title="Read-only and disabled"
      />
      <Example
        description={
          <p>
            <code>directory</code> makes the picker pick a folder with all its
            files (<code>webkitdirectory</code>) - use it with{" "}
            <code>multiple</code>. The list shows the path of each file in the
            folder, and <code>upload</code> gets files whose{" "}
            <code>webkitRelativePath</code> has it. Dropped folders are read
            recursively, including every directory batch. Where directory
            entries are unavailable, ordinary dropped files are accepted.
            Reading blocks submission; reset or unmount cancels the pending
            result. <code>onDropError</code> reports a failed read.
          </p>
        }
        name="file-upload/folder"
        title="Folders"
      />

      <Section title="Forms">
        <Prose>
          <p>
            The form cannot be submitted while files are being checked by an
            async <code>validate</code>, queued, uploading or being removed -
            also when the field is optional or already has an attachment. A
            disabled or read-only field does not block submission.
          </p>
          <p>
            With a <code>name</code>, <code>required</code> counts the files the
            form submits - those with a <code>value</code>, or the picked files
            without <code>upload</code>; without a name, any attached file will
            do. A file still uploading does not count. A disabled{" "}
            <code>&lt;fieldset&gt;</code> around the field disables it - it
            takes no dropped files either.
          </p>
          <p>
            Without <code>upload</code>, the field puts the picked files into
            its file input by a <code>DataTransfer</code> - every browser
            Tailwind CSS 4 supports can do that. While no file is picked,
            nothing is submitted (a native file input submits an empty file).
            The <code>defaultAttachments</code> kept in the list submit their{" "}
            <code>value</code> under the same name - the server gets the new
            files and the ids of the kept ones: <code>getAll(name)</code>. A
            browser without the <code>DataTransfer</code> constructor (Safari
            before 14.1, Chrome before 60, or jsdom in tests) cannot put files
            into an input: the field then submits what its native picker put in
            it. A new pick replaces the listed files, a pick with a refused file
            is refused whole, one of several picked files cannot be removed, and
            dropped or pasted files are not taken - the hint is not shown.{" "}
            <code>onFilesChange</code> still gets the files.
          </p>
          <p>
            A form reset brings back the <code>defaultAttachments</code> and
            drops the files uploaded or picked since - and cancels the running
            uploads - without calling <code>onRemove</code>: it is for files the
            user removes. React resets a form after its <code>action</code> too,
            when the files have just been saved: deleting them there would lose
            them. To clean up after a reset that discards them (a Reset button),
            listen to the <code>reset</code> event of the form and compare with
            what <code>onUpload</code> reported.
          </p>
          <p>
            The field has no margin of its own - the form spaces it like its
            other fields (<code>space-y-*</code>, <code>gap-*</code>);{" "}
            <code>className</code> adds classes to it.
          </p>
          <p>
            <code>onPendingChange</code> reports how many files wait for their
            upload or are uploading - to disable the submit button of a dialog,
            show &quot;3 of 5 uploaded&quot; or ask before closing it while
            uploads run - and <code>0</code> when the field goes away with them,
            cancelled. The form itself cannot be submitted meanwhile anyway.
          </p>
        </Prose>
      </Section>

      <Section title="Keyboard and screen readers">
        <Prose>
          <ul>
            <li>
              The field is a group named by its <code>label</code> and described
              by its error and <code>description</code>. The upload button opens
              the picker; files can be pasted while the focus is on it or on a
              button of the list.
            </li>
            <li>
              The focus stays with the field: on the upload button while files
              upload, on the remove button that takes the place of the cancel
              button of a finished upload, on the cancel button of a file tried
              again, and on the next file when one is removed.
            </li>
            <li>
              The uploads are said together in a live region - &quot;Uploading 3
              files…&quot; as they start and &quot;2 files uploaded. 1 upload
              failed.&quot; once all are over - not at every step of their
              progress. Without <code>upload</code> it says how many files were
              added. Refusals are said at once, as an alert.
            </li>
            <li>
              Until <code>upload</code> reports progress, the bar of a file
              moves without a value - an upload without progress events does not
              sit at 0 %. It fades in place for users who prefer reduced motion.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Storing the files">
        <Prose>
          <p>
            The component does not know where files go - <code>upload</code>{" "}
            decides. <code>uploadWithProgress</code> sends a file with{" "}
            <code>XMLHttpRequest</code>, which unlike <code>fetch</code> reports
            the upload progress. A direct upload to storage (S3, Azure, Active
            Storage) through a presigned URL:
          </p>
        </Prose>
        <CodeBlock code={presignedUpload} />
        <Prose>
          <p>Or a multipart upload to your own endpoint:</p>
        </Prose>
        <CodeBlock code={formDataUpload} />
        <Prose>
          <p>
            Its options are <code>method</code> (<code>PUT</code> by default),{" "}
            <code>headers</code>, <code>onProgress</code>, a <code>signal</code>{" "}
            of an <code>AbortController</code> that cancels the upload,{" "}
            <code>withCredentials</code> (cookies for another origin) and a{" "}
            <code>timeout</code> in milliseconds. A response outside 2xx rejects
            with an error that keeps the server's answer - <code>status</code>,{" "}
            <code>statusText</code> and <code>responseText</code> (status 0 for
            a network error or a timeout):
          </p>
        </Prose>
        <CodeBlock code={failedUpload} />
      </Section>

      <Example
        name="file-upload/controlled"
        title="Controlled attachments and asynchronous removal"
        description={
          <p>
            <code>attachments</code> is the authoritative stored list; apply{" "}
            <code>onAttachmentsChange</code> to reflect uploads and removals.
            Queued and running uploads remain internal. Updated attachments
            replace stored rows even after interaction. <code>onRemove</code>{" "}
            may return a promise: the file stays with a spinner until success,{" "}
            <code>false</code> retains it, and rejection shows an error for
            retry. Submission waits for pending removals. Responses from before
            a reset or an attachment metadata refresh cannot remove the newer
            file. Use stable attachment <code>id</code> values when controlling
            the list.
          </p>
        }
      />
      <Section title="Props">
        <PropsTable of="FileUpload" />
        <PropsTable of="UploadedFile" />
      </Section>
    </DocPage>
  );
}
