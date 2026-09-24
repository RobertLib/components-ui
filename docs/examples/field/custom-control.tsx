import { useState } from "react";
import { Star } from "lucide-react";
import { cn, Field } from "components-ui";

const keySteps: Record<string, number> = {
  ArrowDown: -1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: 1,
};

// A control of your own - a `div` with a role, which no <label> can name:
// `aria-labelledby` of the control props names it, and a click on the
// label focuses it
function Rating({
  onChange,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div
      {...props}
      aria-valuemax={5}
      aria-valuemin={1}
      aria-valuenow={value}
      aria-valuetext={`${value} of 5`}
      className="flex w-fit gap-1 rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      onKeyDown={(event) => {
        const change = keySteps[event.key];
        if (change === undefined) return;
        event.preventDefault();
        onChange(Math.min(5, Math.max(1, value + change)));
      }}
      role="slider"
      tabIndex={0}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          aria-hidden="true"
          className={cn(
            "cursor-pointer",
            star <= value
              ? "fill-warning-400 text-warning-400"
              : "text-neutral-300 dark:text-neutral-600",
          )}
          key={star}
          onClick={() => onChange(star)}
          size={20}
        />
      ))}
    </div>
  );
}

export default function CustomControl() {
  const [rating, setRating] = useState(4);

  return (
    <Field
      description="Use the arrow keys or click a star."
      label="Supplier rating"
    >
      {(controlProps) => (
        <Rating {...controlProps} onChange={setRating} value={rating} />
      )}
    </Field>
  );
}
