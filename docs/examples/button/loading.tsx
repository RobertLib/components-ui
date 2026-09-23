import { useState } from "react";
import { Button } from "components-ui";

export default function Loading() {
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1500);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button loading={saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}
