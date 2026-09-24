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
            rejected with a message; failures are also reported to{" "}
            <code>onError</code>. Files can be dropped on the field too;{" "}
            <code>multiple</code> uploads several one after another - without it
            a new file replaces the listed one. The button next to the progress
            cancels the upload: the field is ready for another file at once,
            even if <code>upload</code> does not stop. A form reset brings back
            the <code>defaultAttachments</code>.
          </p>
        }
        name="file-upload/basic"
        title="Basic"
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

      <Section title="Forms">
        <Prose>
          <p>
            With a <code>name</code>, <code>required</code> counts the files
            with a <code>value</code> - they are what the form submits; without
            one, any listed file will do. A disabled{" "}
            <code>&lt;fieldset&gt;</code> around the field disables it - it
            takes no dropped files either. The field keeps a vertical margin (
            <code>my-4</code>); <code>className</code> adds classes to it, and
            an important class such as <code>my-0!</code> overrides the margin.
          </p>
          <p>
            The focus stays with the field: on the cancel button while a file
            uploads, back on the upload button afterwards, and on the next file
            when one is removed. Until <code>upload</code> reports progress, the
            bar moves without a value - an upload without progress events does
            not sit at 0 %.
          </p>
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

      <Section title="Props">
        <PropsTable of="FileUpload" />
        <PropsTable of="UploadedFile" />
      </Section>
    </DocPage>
  );
}
