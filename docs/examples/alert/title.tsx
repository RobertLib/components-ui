import { useState } from "react";
import { Alert, Button } from "components-ui";

export default function Title() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Alert title="Scheduled maintenance" type="warning">
        The service will be unavailable on Sunday from 2:00 to 4:00.
      </Alert>
      <Alert noIcon type="info">
        An alert without the icon.
      </Alert>

      <Button
        onClick={() => setError(error ? null : "The server is not responding.")}
        size="sm"
        variant="outline"
      >
        Toggle error
      </Button>
      {/* Without children it renders nothing - no condition needed */}
      <Alert title="Could not save" type="danger">
        {error}
      </Alert>
    </div>
  );
}
