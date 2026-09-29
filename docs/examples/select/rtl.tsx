import { Select } from "components-ui";

// The arrow and the room for it are on the end side - the left one in a
// right-to-left page
export default function RightToLeft() {
  return (
    <div className="grid max-w-md gap-4" dir="rtl" lang="ar">
      <Select
        defaultValue="cairo"
        label="المدينة"
        options={[
          { label: "القاهرة", value: "cairo" },
          { label: "الإسكندرية", value: "alexandria" },
          { label: "الجيزة", value: "giza" },
        ]}
      />
    </div>
  );
}
