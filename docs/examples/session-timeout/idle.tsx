import { useState } from "react";
import { Alert, Button, SessionTimeout, useSnackbar } from "components-ui";

// Refreshes the session on the server
const refreshSession = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 800));

export default function Idle() {
  const [signedIn, setSignedIn] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="space-y-4">
      {signedIn ? (
        <p className="text-sm">
          Signed in as <strong>Jana Dvořáková</strong> - do nothing for 10
          seconds and the warning counts down the last 20.
        </p>
      ) : (
        <Button
          onClick={() => {
            setEnded(null);
            setSignedIn(true);
          }}
        >
          Sign in
        </Button>
      )}
      {ended && <Alert type="info">{ended}</Alert>}

      <SessionTimeout
        // A demo - an app would use e.g. 15 minutes and a minute or two
        enabled={signedIn}
        idleTimeout={30_000}
        onExtend={async () => {
          await refreshSession();
          enqueueSnackbar("You stay signed in", "success");
        }}
        onLogout={() => {
          setSignedIn(false);
          setEnded("You signed out.");
        }}
        onTimeout={({ fromOtherTab }) => {
          setSignedIn(false);
          setEnded(
            fromOtherTab
              ? "You were signed out in another tab."
              : "You were signed out after a period of inactivity.",
          );
        }}
        syncKey="docs:session-idle"
        warningBefore={20_000}
      />
    </div>
  );
}
