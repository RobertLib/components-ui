import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const presignedUpload = `import { FileUpload, uploadWithProgress } from "components-ui";

// 1. Ask your API where to put the file, 2. send it there with progress
async function upload(file: File, { onProgress, signal }) {
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
}

<FileUpload name="attachments" upload={upload} />`;

const formDataUpload = `// A POST of FormData straight to your endpoint
async function upload(file: File, { onProgress, signal }) {
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

export default function FileUploadPage() {
  return (
    <DocPage
      imports={["FileUpload", "uploadWithProgress", "type UploadedFile"]}
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
            cancels the upload. A form reset brings back the{" "}
            <code>defaultAttachments</code>.
          </p>
        }
        name="file-upload/basic"
        title="Basic"
      />

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
            <code>headers</code>, <code>onProgress</code> and a{" "}
            <code>signal</code> of an <code>AbortController</code> that cancels
            the upload.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="FileUpload" />
        <PropsTable of="UploadedFile" />
      </Section>
    </DocPage>
  );
}
