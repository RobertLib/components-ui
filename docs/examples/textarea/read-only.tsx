import { Textarea } from "components-ui";

export default function ReadOnly() {
  return (
    <div className="grid max-w-lg gap-5">
      <Textarea
        label={
          <>
            Internal note{" "}
            <span className="font-normal text-neutral-500 dark:text-neutral-400">
              (not on the invoice)
            </span>
          </>
        }
        name="note"
      />
      <Textarea
        defaultValue="Delivered on 24 September 2026, signed by J. Nováková."
        description="Written by the carrier - it can be selected and copied."
        label="Delivery report"
        name="report"
        readOnly
      />
    </div>
  );
}
