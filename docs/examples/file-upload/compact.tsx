import { FileUpload, Input } from "components-ui";

const DIMS = ["xs", "sm", "md", "lg"] as const;

// A button with the list under it - it fits a row of fields. Its `dim` is
// that of the fields: the button is as high as an Input of the same `dim`.
export default function Compact() {
  return (
    <div className="grid gap-6">
      <FileUpload
        accept=".pdf,image/*"
        className="my-0!"
        label="Receipt"
        name="receipt"
        variant="button"
      />
      <div className="space-y-3">
        {DIMS.map((dim) => (
          <div className="flex flex-wrap items-start gap-2" key={dim}>
            <Input
              aria-label={`Note (${dim})`}
              className="w-48"
              dim={dim}
              placeholder={`dim="${dim}"`}
            />
            <FileUpload
              className="my-0!"
              dim={dim}
              multiple
              name={`files-${dim}`}
              variant="button"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
