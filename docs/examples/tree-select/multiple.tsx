import { useState } from "react";
import { TreeSelect } from "components-ui";
import { categories } from "./categories";

export default function Multiple() {
  const [cascade, setCascade] = useState(["computers", "plants"]);
  const [independent, setIndependent] = useState(["electronics", "lighting"]);

  return (
    <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <TreeSelect
          items={categories}
          label="Shown in"
          maxChips={3}
          multiple
          onChange={setCascade}
          placeholder="All categories"
          value={cascade}
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Value: <code>{cascade.join(", ") || "none"}</code>
        </p>
      </div>
      <div className="space-y-2">
        <TreeSelect
          checkMode="independent"
          items={categories}
          label="Listed in"
          multiple
          onChange={setIndependent}
          value={independent}
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Value: <code>{independent.join(", ") || "none"}</code>
        </p>
      </div>
    </div>
  );
}
