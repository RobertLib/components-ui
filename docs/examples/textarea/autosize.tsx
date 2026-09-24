import { Textarea } from "components-ui";

export default function Autosize() {
  return (
    <div className="grid max-w-lg gap-5">
      <Textarea
        autosize
        label="Delivery instructions"
        maxRows={6}
        minRows={2}
        placeholder="Gate code, floor, whom to call…"
      />
      <Textarea
        autosize
        floating
        label="Comment (grows from one line)"
        minRows={1}
      />
    </div>
  );
}
