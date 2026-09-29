import { FileUpload, type UploadedFile } from "components-ui";

const photo =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#bbf7d0"/><path d="M0 48 20 28l14 14 10-10 20 20v12H0z" fill="#15803d"/><circle cx="46" cy="18" r="7" fill="#fcd34d"/></svg>`,
  );

const attachments: UploadedFile[] = [
  { filename: "delivery-note.svg", id: "1", url: photo, value: "1" },
  { filename: "invoice-0141.pdf", id: "2", value: "2" },
];

// A closed order - its files are shown, and read-only submitted with the
// form; disabled, they are not submitted either
export default function ReadOnly() {
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      <FileUpload
        defaultAttachments={attachments}
        label="Read-only"
        multiple
        name="attachments"
        preview
        readOnly
      />
      <FileUpload
        defaultAttachments={attachments}
        disabled
        label="Disabled"
        multiple
        name="attachments"
        preview
      />
      <FileUpload label="Read-only, empty" readOnly />
    </div>
  );
}
