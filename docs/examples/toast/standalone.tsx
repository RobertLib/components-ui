import { useState } from "react";
import { Button, Toast } from "components-ui";

export default function Standalone() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-3">
      <Button onClick={() => setVisible(true)} size="sm" variant="outline">
        Show a toast here
      </Button>
      {visible && (
        <Toast
          duration={2000}
          message="Rendered in place, hides after 2 seconds."
          onClose={() => setVisible(false)}
          variant="info"
        />
      )}
    </div>
  );
}
