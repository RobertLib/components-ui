import { Textarea } from "components-ui";

export default function Basic() {
  return (
    <div className="grid max-w-lg gap-5">
      <Textarea
        description="Visible to the whole team."
        label="Note"
        name="note"
        placeholder="Anything to add?"
      />
      <Textarea floating label="Floating label" />
      <Textarea
        defaultValue="Too short"
        error="Write at least 20 characters."
        label="Description"
        required
      />
    </div>
  );
}
