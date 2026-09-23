import { useState } from "react";
import { Button, ErrorBoundary } from "components-ui";

function Chart({ crash }: { crash: boolean }) {
  if (crash) throw new Error("Cannot read the chart data");
  return <p className="text-sm">The chart renders fine.</p>;
}

export default function Basic() {
  const [crash, setCrash] = useState(false);

  return (
    <div className="space-y-3">
      <Button onClick={() => setCrash(true)} size="sm" variant="outline">
        Break the chart
      </Button>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="rounded-md border border-danger-300 p-3 text-sm">
            <p className="mb-2">The chart failed: {error.message}</p>
            <Button
              onClick={() => {
                setCrash(false);
                reset();
              }}
              size="sm"
            >
              Try again
            </Button>
          </div>
        )}
        onError={(error) =>
          console.info("Report to your error tracker:", error.message)
        }
      >
        <Chart crash={crash} />
      </ErrorBoundary>
    </div>
  );
}
