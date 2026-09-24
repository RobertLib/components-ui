import { Slider } from "components-ui";

const priorities = ["Low", "Normal", "High", "Urgent"];

export default function Marks() {
  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="w-full max-w-md space-y-8">
        <Slider
          defaultValue={1}
          // Screen readers read the text too, not the number
          formatValue={(value) => priorities[value]}
          label="Priority"
          marks={priorities.map((label, value) => ({ label, value }))}
          max={3}
          name="priority"
        />
        <Slider
          defaultValue={[8, 17]}
          formatValue={(hour) => `${hour}:00`}
          label="Opening hours"
          marks={[0, 6, 12, 18, 24].map((hour) => ({
            label: `${hour}:00`,
            value: hour,
          }))}
          max={24}
          minDistance={1}
        />
      </div>
      <Slider
        aria-label="Temperature"
        className="h-40"
        defaultValue={21}
        formatValue={(value) => `${value} °C`}
        marks={[16, 20, 24, 28].map((value) => ({
          label: `${value} °C`,
          value,
        }))}
        max={28}
        min={16}
        orientation="vertical"
      />
    </div>
  );
}
