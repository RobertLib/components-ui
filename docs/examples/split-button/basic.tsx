import { FileText, Save } from "lucide-react";
import { useState } from "react";
import { SplitButton, useSnackbar } from "components-ui";

export default function Basic() {
  const [saving, setSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const save = (message: string) => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      enqueueSnackbar(message, "success");
    }, 1200);
  };

  return (
    <SplitButton
      items={[
        {
          icon: <FileText size={16} />,
          label: "Save as draft",
          onClick: () => save("Saved as a draft"),
        },
        {
          label: "Save and close",
          onClick: () => save("Saved and closed"),
          shortcut: "mod+shift+s",
        },
        { type: "separator" },
        {
          label: "Save as template…",
          onClick: () => enqueueSnackbar("Template saved"),
        },
      ]}
      loading={saving}
      onClick={() => save("Invoice saved")}
      startIcon={<Save size={16} />}
    >
      Save
    </SplitButton>
  );
}
