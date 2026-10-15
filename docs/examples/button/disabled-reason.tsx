import { Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Button,
  IconButton,
  SplitButton,
  Switch,
  useSnackbar,
} from "components-ui";

export default function DisabledReason() {
  const [isAccountant, setIsAccountant] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const paid = true;

  return (
    <div className="space-y-4">
      <Switch
        checked={isAccountant}
        label="Signed in as an accountant"
        onChange={(event) => setIsAccountant(event.target.checked)}
      />
      <div className="flex flex-wrap items-center gap-3">
        {/* Given while enabled too - the button stays the same element */}
        <Button
          disabled={!isAccountant}
          disabledReason="Only an accountant can approve invoices."
          onClick={() => enqueueSnackbar("Invoice FV-2026-0418 approved")}
          startIcon={<Check size={16} />}
        >
          Approve
        </Button>
        <SplitButton
          disabled={!isAccountant}
          disabledReason="Only an accountant can send reminders."
          items={[
            {
              label: "Send a reminder with a fee",
              onClick: () => enqueueSnackbar("Reminder with a fee sent"),
            },
          ]}
          onClick={() => enqueueSnackbar("Reminder sent")}
          variant="outline"
        >
          Send a reminder
        </SplitButton>
        <IconButton
          aria-label="Edit"
          bordered
          disabled={paid}
          disabledReason="A paid invoice cannot be edited - issue a credit note."
          href="/invoices/418/edit"
          tooltip
        >
          <Pencil />
        </IconButton>
        <IconButton
          aria-label="Delete"
          bordered
          color="danger"
          disabled={paid}
          disabledReason="A paid invoice cannot be deleted."
          tooltip
        >
          <Trash2 />
        </IconButton>
      </div>
    </div>
  );
}
