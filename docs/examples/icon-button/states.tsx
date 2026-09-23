import { RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { IconButton, Tooltip } from "components-ui";

export default function States() {
  const [refreshing, setRefreshing] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <Tooltip position="top" title="Refresh">
        <IconButton
          aria-label="Refresh"
          loading={refreshing}
          onClick={() => {
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 1200);
          }}
        >
          <RefreshCw size={18} />
        </IconButton>
      </Tooltip>
      <IconButton aria-label="Delete" disabled variant="danger">
        <Trash2 size={18} />
      </IconButton>
    </div>
  );
}
