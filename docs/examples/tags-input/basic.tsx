import { useState } from "react";
import { TagsInput } from "components-ui";

export default function Basic() {
  const [keywords, setKeywords] = useState(["invoice", "overdue"]);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <TagsInput
          description="Press Enter or type a comma after each keyword."
          label="Keywords"
          name="keywords"
          onChange={setKeywords}
          placeholder="Add a keyword…"
          value={keywords}
        />
        <p className="mt-2 text-sm">
          Value: <code>{JSON.stringify(keywords)}</code>
        </p>
      </div>
      <TagsInput
        defaultValue={["archived"]}
        disabled
        label="Disabled"
        name="labels"
      />
    </div>
  );
}
