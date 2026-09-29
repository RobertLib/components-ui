import { useState } from "react";
import { RichTextEditor, Switch } from "components-ui";

export default function ReadOnly() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <Switch
        checked={isEditing}
        label="Edit the terms"
        onChange={(event) => setIsEditing(event.target.checked)}
      />
      <RichTextEditor
        defaultValue={
          "<h3>Terms of the offer</h3>" +
          "<ul><li>Valid until <strong>October 31</strong></li><li>Payment within 14 days</li></ul>"
        }
        label="Terms"
        minRows={4}
        name="terms"
        readOnly={!isEditing}
      />
    </div>
  );
}
