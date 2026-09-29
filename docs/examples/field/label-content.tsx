import { Palette } from "lucide-react";
import { Field } from "components-ui";

export default function LabelContent() {
  return (
    <div className="max-w-md">
      <Field
        description="Used in the header of your invoices."
        label={
          <span className="inline-flex items-center gap-1">
            <Palette aria-hidden="true" size={14} />
            Brand color
            <span className="font-normal text-neutral-500 dark:text-neutral-400">
              (optional)
            </span>
          </span>
        }
      >
        {(controlProps) => (
          <input
            {...controlProps}
            className="h-9 w-16 cursor-pointer rounded-md border border-neutral-300 bg-surface p-1 dark:border-neutral-700 dark:bg-surface-dark"
            defaultValue="#2563eb"
            type="color"
          />
        )}
      </Field>
    </div>
  );
}
