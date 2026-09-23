import { Autocomplete } from "components-ui";
import { cities } from "./cities";

// Matching ignores case and diacritics - try "zurich" or "lodz"
export default function Static() {
  return (
    <div className="max-w-sm">
      <Autocomplete
        label="City"
        name="city"
        options={cities}
        placeholder="Start typing…"
      />
    </div>
  );
}
