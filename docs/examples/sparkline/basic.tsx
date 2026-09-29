import { Sparkline } from "components-ui";

const visits = [42, 48, 45, 60, 58, 71, 69, 80, 76, 92];
const errors = [12, 9, 14, 7, 6, 8, 4, 5, 3, 2];

export default function Basic() {
  return (
    <div className="flex flex-wrap items-end gap-8">
      <Sparkline data={visits} label="Visits" />
      <Sparkline area color="success" data={visits} label="Signups" />
      <Sparkline
        color="danger"
        data={errors}
        highlightLast
        label="Errors"
        strokeWidth={1.5}
      />
      {/* Any size - the line keeps its width */}
      <Sparkline
        area
        className="h-12 w-64"
        color="info"
        data={visits}
        highlightLast
        label="Visits this month"
      />
    </div>
  );
}
