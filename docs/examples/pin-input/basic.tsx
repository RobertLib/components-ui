import { useState } from "react";
import { PinInput } from "components-ui";

type Status = "idle" | "checking" | "invalid" | "verified";

// Try 123456 - a paste or the code a phone offers fills all cells
export default function Basic() {
  const [status, setStatus] = useState<Status>("idle");

  return (
    <div className="space-y-2">
      <PinInput
        description="We sent a 6-digit code to +420 777 123 456."
        disabled={status === "verified"}
        error={
          status === "invalid"
            ? "The code is not valid - try again."
            : undefined
        }
        label="Verification code"
        onChange={() => setStatus("idle")}
        onComplete={(code) => {
          setStatus("checking");
          // The server checks the code
          setTimeout(
            () => setStatus(code === "123456" ? "verified" : "invalid"),
            600,
          );
        }}
      />
      {status === "checking" && <p className="text-sm">Checking…</p>}
      {status === "verified" && (
        <p className="text-sm text-success-700 dark:text-success-400">
          Verified.
        </p>
      )}
    </div>
  );
}
