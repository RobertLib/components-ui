import { Heart, ThumbsUp } from "lucide-react";
import { Rating } from "components-ui";

export default function Variants() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Rating
        color="danger"
        defaultValue={2}
        formatValueText={(value, max) => `${value} of ${max} hearts`}
        icon={<Heart />}
        label="Hearts"
      />
      <Rating
        color="primary"
        defaultValue={7}
        dim="sm"
        formatValueText={(value, max) => `${value} of ${max}`}
        icon={<ThumbsUp />}
        label="Out of 10 (small)"
        max={10}
      />
      {/* A value in between fills a part of the icon - an average */}
      <Rating
        aria-label="Average rating"
        description="4.3 from 128 reviews"
        dim="lg"
        readOnly
        value={4.3}
      />
      <Rating
        defaultValue={3}
        dim="xs"
        disabled
        label="Disabled (extra small)"
      />
    </div>
  );
}
