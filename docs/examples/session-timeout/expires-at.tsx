import { useState } from "react";
import { Button, SessionTimeout, useFormatDate } from "components-ui";

const SESSION_LENGTH = 45_000;

// The server refreshes the session and tells when it ends now
const refreshToken = () =>
  new Promise<number>((resolve) =>
    setTimeout(() => resolve(Date.now() + SESSION_LENGTH), 800),
  );

export default function ExpiresAt() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const formatDate = useFormatDate();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setExpiresAt(Date.now() + SESSION_LENGTH)}>
          Start a 45-second session
        </Button>
        {expiresAt !== null && (
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Ends at {formatDate(new Date(expiresAt), "dateTime")}
          </span>
        )}
      </div>

      <SessionTimeout
        enabled={expiresAt !== null}
        expiresAt={expiresAt}
        // The new end - this tab and the others take it
        onExtend={async () => {
          const until = await refreshToken();
          setExpiresAt(until);
          return until;
        }}
        onTimeout={() => setExpiresAt(null)}
        syncKey="docs:session-expiry"
        warningBefore={30_000}
      />
    </div>
  );
}
