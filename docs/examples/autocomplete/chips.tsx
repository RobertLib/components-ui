import { Autocomplete } from "components-ui";
import { cities } from "./cities";

export default function Chips() {
  return (
    <div className="max-w-md">
      <Autocomplete
        defaultValue={["amsterdam", "berlin", "brno", "praha", "wien"]}
        description="Three chips while the focus is elsewhere - all of them in the field."
        label="Cities"
        maxVisibleChips={3}
        multiple
        name="cities"
        options={cities}
        placeholder="Add a city…"
        selectAll
      />
    </div>
  );
}
