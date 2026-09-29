import { useState } from "react";
import {
  Button,
  SegmentedControl,
  SnackbarProvider,
  useSnackbar,
  type SnackbarPosition,
} from "components-ui";

const positions: SnackbarPosition[] = [
  "top-start",
  "top-center",
  "top-end",
  "bottom-start",
  "bottom-center",
  "bottom-end",
];

function Notify() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Button onClick={() => enqueueSnackbar("The order was shipped", "success")}>
      Show a toast
    </Button>
  );
}

// In an app, render one <SnackbarProvider> near the root - this example
// brings its own, whose toasts show where it says
export default function Position() {
  const [position, setPosition] = useState<SnackbarPosition>("bottom-end");

  return (
    <div className="flex flex-wrap items-end gap-4">
      <SegmentedControl
        label="Position"
        onChange={setPosition}
        options={positions.map((value) => ({ label: value, value }))}
        value={position}
      />
      <SnackbarProvider position={position}>
        <Notify />
      </SnackbarProvider>
    </div>
  );
}
