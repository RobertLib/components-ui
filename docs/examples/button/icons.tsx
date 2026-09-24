import { ChevronDown, Download, Plus, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "components-ui";

export default function Icons() {
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1500);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button startIcon={<Plus size={16} />}>New invoice</Button>
      <Button endIcon={<ChevronDown size={16} />} variant="outline">
        Export
      </Button>
      <Button
        color="default"
        startIcon={<Download size={16} />}
        variant="ghost"
      >
        Download
      </Button>
      {/* The spinner takes the place of the start icon */}
      <Button loading={saving} onClick={save} startIcon={<Save size={16} />}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
