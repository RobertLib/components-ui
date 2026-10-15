import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Button,
  DateTimePicker,
  FormActions,
  FormSection,
  Input,
  NumberInput,
  RadioGroup,
  Switch,
  useSnackbar,
} from "components-ui";

const states = [
  { label: "Draft", value: "draft" },
  { label: "Signed", value: "signed" },
  { label: "Terminated", value: "terminated" },
];

// One form for the detail and the edit of a record: read-only, the fields
// show the values (and still submit them), "Edit" makes them editable
export default function DetailEdit() {
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  return (
    <form
      className="flex flex-col gap-6"
      onChange={() => setDirty(true)}
      onReset={() => {
        setEditing(false);
        setDirty(false);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        enqueueSnackbar(`Contract ${String(data.get("number"))} saved`);
        setEditing(false);
        setDirty(false);
      }}
    >
      <FormSection
        actions={
          !editing && (
            <Button
              onClick={() => setEditing(true)}
              size="sm"
              startIcon={<Pencil size={14} />}
              variant="outline"
            >
              Edit
            </Button>
          )
        }
        columns={2}
        readOnly={!editing}
        title="Service contract"
      >
        <Input defaultValue="SM-2026-0142" label="Number" name="number" />
        <DateTimePicker
          defaultValue="2026-03-01"
          label="Signed on"
          name="signedOn"
        />
        <NumberInput
          defaultValue={48500}
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Yearly fee"
          name="fee"
        />
        <RadioGroup
          defaultValue="signed"
          label="State"
          name="state"
          options={states}
          orientation="horizontal"
        />
        <Switch defaultChecked label="Renews automatically" name="renews" />
      </FormSection>

      {editing && (
        <FormActions dirty={dirty}>
          <Button type="reset" variant="outline">
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </FormActions>
      )}
    </form>
  );
}
