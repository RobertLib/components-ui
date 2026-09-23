import { useState } from "react";
import { Button, DescriptionList } from "components-ui";

export default function Loading() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="space-y-4">
      <Button onClick={() => setLoading(!loading)} size="sm" variant="outline">
        {loading ? "Show data" : "Show loading"}
      </Button>
      <DescriptionList
        items={[
          { desc: "2026-0042", term: "Invoice" },
          { desc: "24.09.2026", term: "Issued" },
          { desc: "8 400 CZK", term: "Amount" },
        ]}
        loading={loading}
        termWidth="10rem"
      />
    </div>
  );
}
