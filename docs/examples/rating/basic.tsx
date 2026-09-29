import { useState } from "react";
import { Rating } from "components-ui";

export default function Basic() {
  const [quality, setQuality] = useState(4);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <Rating
          clearable
          description="Click the picked star again to take the rating back."
          label="Quality"
          name="quality"
          onChange={setQuality}
          value={quality}
        />
        <p className="mt-2 text-sm">
          Value: <code>{quality}</code>
        </p>
      </div>
      <Rating allowHalf defaultValue={3.5} label="Delivery (half stars)" />
    </div>
  );
}
