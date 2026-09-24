import { useState } from "react";
import { Button, Timeline } from "components-ui";

// An approval that is still to come - and placeholders while it loads
export default function Pending() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      <Button onClick={() => setLoading(!loading)} size="sm" variant="outline">
        {loading ? "Show data" : "Show loading"}
      </Button>
      <Timeline
        items={[
          {
            description: "Business trip to Vienna, 2 days",
            id: "submitted",
            time: new Date(2026, 8, 23, 10, 15),
            title: "Request submitted",
          },
          {
            color: "success",
            description: "Petr Svoboda",
            id: "lead",
            time: new Date(2026, 8, 23, 13, 40),
            title: "Approved by the team lead",
          },
          {
            description: "Usually within 2 working days",
            id: "finance",
            pending: true,
            title: "Waiting for the finance department",
          },
        ]}
        loading={loading}
      />
    </div>
  );
}
