import { Autocomplete } from "components-ui";
import { cities } from "./cities";

// Shown and submitted, but not changed - e.g. a record the user may not edit
export default function ReadOnly() {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Autocomplete
        defaultValue="praha"
        label="Head office"
        name="office"
        options={cities}
        readOnly
      />
      <Autocomplete
        defaultValue={["wien", "zurich"]}
        label="Branches"
        multiple
        name="branches"
        options={cities}
        readOnly
      />
    </div>
  );
}
