import { Autocomplete, Input } from "components-ui";
import { cities } from "./cities";

// The same heights as Input - side by side in a toolbar or a filter row
export default function Sizes() {
  return (
    <div className="grid max-w-xl gap-4">
      {(["xs", "sm", "md", "lg"] as const).map((dim) => (
        <div className="grid grid-cols-3 items-end gap-2" key={dim}>
          <Input dim={dim} placeholder={`Input ${dim}`} />
          <Autocomplete dim={dim} options={cities} placeholder={dim} />
          <Autocomplete
            aria-label={`Cities ${dim}`}
            defaultValue={["praha"]}
            dim={dim}
            multiple
            options={cities}
          />
        </div>
      ))}
    </div>
  );
}
