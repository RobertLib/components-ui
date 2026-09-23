import { useState } from "react";
import { Button, FormError } from "components-ui";

export default function Basic() {
  const [error, setError] = useState<string>();

  return (
    <div className="space-y-3">
      <Button
        onClick={() => setError(error ? undefined : "Something is missing.")}
        size="sm"
        variant="outline"
      >
        Toggle error
      </Button>
      {/* Renders nothing without children - no condition needed */}
      <FormError>{error}</FormError>
    </div>
  );
}
