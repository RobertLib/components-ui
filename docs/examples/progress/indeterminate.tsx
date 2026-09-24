import { useEffect, useState } from "react";
import { Progress } from "components-ui";

export default function Indeterminate() {
  // Uploaded - now the server processes the file for a while
  const [uploaded, setUploaded] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setUploaded((value) => (value >= 100 ? 0 : value + 20)),
      800,
    );
    return () => clearInterval(timer);
  }, []);

  const processing = uploaded >= 100;

  return (
    <div className="max-w-lg space-y-5">
      {/* No value - the bar keeps moving */}
      <Progress label="Loading orders" />
      <Progress
        description="orders-2026.csv"
        indeterminate={processing}
        label={processing ? "Importing…" : "Uploading…"}
        showPercentage
        value={uploaded}
      />
      <Progress aria-label="Syncing" size="sm" variant="success" />
    </div>
  );
}
