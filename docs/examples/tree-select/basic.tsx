import { useState } from "react";
import { TreeSelect } from "components-ui";
import { categories } from "./categories";

export default function Basic() {
  const [category, setCategory] = useState<string | null>("laptops");

  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <TreeSelect
        description="The field shows where the category is."
        items={categories}
        label="Category"
        onChange={setCategory}
        placeholder="Choose a category"
        showPath
        value={category}
      />
      <TreeSelect
        clearable={false}
        defaultValue="plants"
        items={categories}
        label="Without search"
        searchable={false}
      />
      <p className="text-sm text-neutral-600 sm:col-span-2 dark:text-neutral-400">
        Value: <code>{JSON.stringify(category)}</code>
      </p>
    </div>
  );
}
