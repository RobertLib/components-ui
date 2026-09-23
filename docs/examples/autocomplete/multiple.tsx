import { Autocomplete } from "components-ui";
import { cities } from "./cities";

export default function Multiple() {
  return (
    <div className="max-w-md">
      <Autocomplete
        defaultValue={["praha", "wien"]}
        label="Cities to visit (up to 4)"
        maxSelections={4}
        multiple
        name="cities"
        options={cities}
        placeholder="Add a city…"
      />
    </div>
  );
}
