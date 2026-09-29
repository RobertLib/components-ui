import { Input, TreeSelect } from "components-ui";
import { categories } from "./categories";

const dims = ["xs", "sm", "md", "lg"] as const;

export default function Sizes() {
  return (
    <div className="grid max-w-3xl gap-4">
      {dims.map((dim) => (
        // Beside an Input of the same size - one height
        <div className="grid items-end gap-2 sm:grid-cols-2" key={dim}>
          <TreeSelect
            defaultValue={["laptops", "plants"]}
            dim={dim}
            items={categories}
            label={`dim="${dim}"`}
            multiple
          />
          <Input dim={dim} placeholder="Input" />
        </div>
      ))}
    </div>
  );
}
