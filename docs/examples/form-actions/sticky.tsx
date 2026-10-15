import { useState } from "react";
import {
  Button,
  FormActions,
  FormSection,
  Input,
  NumberInput,
  Textarea,
  useSnackbar,
} from "components-ui";

const lines = ["Frame", "Wheels", "Brakes", "Gears", "Lights", "Saddle"];

// A long form in a scrolling box - the bar of its buttons stays at the
// bottom until the end of the form scrolls into view
export default function Sticky() {
  const { enqueueSnackbar } = useSnackbar();
  const [dirty, setDirty] = useState(false);

  return (
    <div className="max-h-96 overflow-y-auto rounded-md border border-neutral-200 px-4 pt-4 dark:border-neutral-800">
      <form
        className="flex flex-col gap-6"
        onChange={() => setDirty(true)}
        onReset={() => setDirty(false)}
        onSubmit={(event) => {
          event.preventDefault();
          setDirty(false);
          enqueueSnackbar("Inspection saved", "success");
        }}
      >
        <FormSection labelPosition="start" title="Bicycle inspection">
          <Input defaultValue="Kolo Brno s.r.o." label="Customer" />
          {lines.map((line) => (
            <NumberInput
              defaultValue={0}
              formatOptions={{ currency: "CZK", style: "currency" }}
              key={line}
              label={line}
              min={0}
              name={line.toLowerCase()}
            />
          ))}
          <Textarea label="Findings" name="findings" />
        </FormSection>
        <FormActions dirty={dirty} sticky>
          <Button type="reset" variant="outline">
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </FormActions>
      </form>
    </div>
  );
}
