import { Input, TagsInput } from "components-ui";

// The same heights as Input
export default function Sizes() {
  return (
    <div className="grid max-w-md gap-4">
      {(["xs", "sm", "md", "lg"] as const).map((dim) => (
        <div className="grid grid-cols-2 items-end gap-2" key={dim}>
          <Input dim={dim} placeholder={`Input ${dim}`} />
          <TagsInput
            aria-label={`Keywords ${dim}`}
            defaultValue={["invoice"]}
            dim={dim}
            placeholder={dim}
          />
        </div>
      ))}
    </div>
  );
}
