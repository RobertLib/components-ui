import { FlaskConical, UserRound } from "lucide-react";
import { SystemBanner, useSnackbar } from "components-ui";

export default function Variants() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="space-y-3">
      <SystemBanner
        action={{ href: "/changelog", label: "What's new" }}
        title="Version 4.2"
      >
        Invoices can now be split into instalments.
      </SystemBanner>
      <SystemBanner
        action={{ href: "/status", label: "Details" }}
        title="Planned outage"
        variant="warning"
      >
        Saturday 8 November, 22:00–24:00 - the app will be unavailable.
      </SystemBanner>
      <SystemBanner title="Bank connection is down." variant="danger">
        Payments from Fio banka are not imported since 9:40 - we are on it.
      </SystemBanner>
      {/* An icon of its own */}
      <SystemBanner
        action={{
          label: "Stop impersonating",
          onClick: () => enqueueSnackbar("Back to your account"),
        }}
        icon={<UserRound size={16} />}
        variant="neutral"
      >
        Signed in as Jana Nováková (Accounting) - changes are made in her name.
      </SystemBanner>
      <SystemBanner icon={<FlaskConical size={16} />} variant="warning">
        TEST environment - data is reset every night.
      </SystemBanner>
    </div>
  );
}
