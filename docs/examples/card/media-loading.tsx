import { useState } from "react";
import { Button, Card } from "components-ui";

const cover =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><rect width="320" height="160" fill="#bfdbfe"/><circle cx="250" cy="45" r="22" fill="#fde68a"/><path d="M0 160 90 70l60 60 40-35 130 65Z" fill="#3b82f6"/></svg>`,
  );

export default function MediaLoading() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 1500);
        }}
        size="sm"
        variant="outline"
      >
        Reload
      </Button>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          description="3 nights, from $420"
          headingLevel={4}
          href="#lake-house"
          loading={loading}
          media={<img alt="" className="h-40" src={cover} />}
          title="Lake house"
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            A quiet cabin by the water, an hour from the city.
          </p>
        </Card>
        <Card description="Updated daily" loading={loading} title="Weather">
          <p className="text-sm">Sunny, 24 °C</p>
        </Card>
      </div>
    </div>
  );
}
