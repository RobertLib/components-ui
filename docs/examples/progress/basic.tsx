import { useEffect, useState } from "react";
import { Progress } from "components-ui";

export default function Basic() {
  const [value, setValue] = useState(10);

  useEffect(() => {
    const timer = setInterval(
      () => setValue((v) => (v >= 100 ? 0 : v + 10)),
      700,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-lg space-y-5">
      <Progress
        description="report.pdf"
        label="Uploading"
        showPercentage
        value={value}
      />
      {/* Without a visible label, name the bar for screen readers */}
      <Progress
        aria-label="Storage used"
        size="sm"
        value={30}
        variant="success"
      />
      <Progress aria-label="Monthly quota" value={60} variant="warning" />
      <Progress
        aria-label="Failed checks"
        max={5}
        size="lg"
        value={4}
        variant="danger"
      />
    </div>
  );
}
