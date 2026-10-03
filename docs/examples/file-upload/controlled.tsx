import { Button, FileUpload, type UploadedFile } from "components-ui";
import { useState } from "react";

export default function Controlled() {
  const [attachments, setAttachments] = useState<UploadedFile[]>([
    { id: "saved", filename: "Saved report.pdf", value: "saved" },
  ]);
  const [fail, setFail] = useState(true);
  return (
    <div className="space-y-3">
      <Button
        onClick={() =>
          setAttachments([
            { id: "fresh", filename: "Refreshed report.pdf", value: "fresh" },
          ])
        }
        variant="outline"
      >
        Refresh from server
      </Button>
      <FileUpload
        attachments={attachments}
        description="The first removal fails. The file stays listed and can be retried."
        label="Documents"
        multiple
        onAttachmentsChange={setAttachments}
        onRemove={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (fail) {
            setFail(false);
            throw new Error("Server unavailable");
          }
        }}
        upload={async (file) => ({
          id: file.name,
          filename: file.name,
          value: file.name,
        })}
      />
    </div>
  );
}
