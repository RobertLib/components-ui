import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  Button,
  FormDialog,
  Input,
  getBaseError,
  getFieldError,
  useSnackbar,
} from "components-ui";

const saved = { email: "jana@example.com", name: "Jana Nováková" };

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Changed against what was saved - closing asks first
  const dirty = values.name !== saved.name || values.email !== saved.email;

  const save = async () => {
    setSaving(true);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSaving(false);
    if (values.email.endsWith("@example.org")) {
      // What a REST API answers - a general message and one of a field
      setError({
        errors: {
          base: ["The address is used by another account."],
          email: ["is taken"],
        },
      });
      return;
    }
    setOpen(false);
    enqueueSnackbar("Saved", "success");
  };

  return (
    <>
      <Button
        onClick={() => {
          setValues(saved);
          setError(null);
          setOpen(true);
        }}
        variant="outline"
      >
        Edit contact
      </Button>
      <FormDialog
        dirty={dirty}
        error={getBaseError(error)}
        footerStart={
          <Button
            color="danger"
            onClick={() => enqueueSnackbar("Deleted")}
            startIcon={<Trash2 size={16} />}
            variant="ghost"
          >
            Delete
          </Button>
        }
        onClose={() => setOpen(false)}
        onSubmit={() => void save()}
        open={open}
        saving={saving}
        submitIcon={<Check size={16} />}
        submitLabel="Save changes"
        title="Edit contact"
      >
        <Input
          label="Name"
          name="name"
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
          required
          value={values.name}
        />
        <Input
          description="An address ending in @example.org is taken."
          error={getFieldError(error, "email")}
          label="E-mail"
          name="email"
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
          type="email"
          value={values.email}
        />
      </FormDialog>
    </>
  );
}
