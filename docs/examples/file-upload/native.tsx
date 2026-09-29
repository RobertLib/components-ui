import { useState } from "react";
import { Button, FileUpload } from "components-ui";

// No `upload` - the form submits the files, like a native file input. A
// React form action (or a server action) gets them in its FormData.
export default function Native() {
  const [sent, setSent] = useState<string[]>();

  return (
    <form
      action={(formData) => {
        setSent(
          formData
            .getAll("documents")
            .filter((entry) => entry instanceof File)
            .map(({ name, size }) => `${name} (${Math.ceil(size / 1024)} kB)`),
        );
      }}
      className="max-w-lg space-y-4"
      onReset={() => setSent(undefined)}
    >
      <FileUpload
        accept=".pdf,image/*"
        description="PDF or images up to 5 MB, at most 3 files."
        label="Documents"
        maxFileSize={5}
        maxFiles={3}
        multiple
        name="documents"
        required
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          Send
        </Button>
        <Button color="default" size="sm" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {sent && (
        <p className="text-sm break-all">
          The action got: <code>{JSON.stringify(sent)}</code>
        </p>
      )}
    </form>
  );
}
