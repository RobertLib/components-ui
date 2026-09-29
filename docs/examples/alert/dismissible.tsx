import { useState } from "react";
import { Alert, Button } from "components-ui";

export default function Dismissible() {
  const [showTip, setShowTip] = useState(true);
  const [showError, setShowError] = useState(true);

  return (
    <div className="space-y-3">
      {showTip && (
        <Alert onClose={() => setShowTip(false)} title="New: saved filters">
          Save the filters of a table and open them again from the toolbar.
        </Alert>
      )}
      {showError && (
        <Alert
          actions={
            <>
              <Button color="danger" size="sm">
                Retry
              </Button>
              <Button color="default" size="sm" variant="ghost">
                View details
              </Button>
            </>
          }
          onClose={() => setShowError(false)}
          title="The export failed"
          type="danger"
        >
          The server did not respond in time.
        </Alert>
      )}
      {(!showTip || !showError) && (
        <Button
          onClick={() => {
            setShowTip(true);
            setShowError(true);
          }}
          size="sm"
          variant="outline"
        >
          Show the alerts again
        </Button>
      )}
    </div>
  );
}
