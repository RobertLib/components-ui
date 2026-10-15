import { Archive, Copy, MoreHorizontal, Trash2, UserCog } from "lucide-react";
import { Dropdown, IconButton, useSnackbar } from "components-ui";

export default function DisabledReason() {
  const { enqueueSnackbar } = useSnackbar();
  // The permissions of the signed-in user and the state of the record
  const canManageUsers = false;
  const hasOpenOrders = true;

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="min-w-0">
        <div className="truncate font-medium">Stavby Morava a.s.</div>
        <div className="truncate text-sm text-neutral-500 dark:text-neutral-400">
          IČO 25596641 · 3 open orders
        </div>
      </div>
      <Dropdown
        buttonTrigger
        items={[
          {
            icon: <Copy size={16} />,
            label: "Duplicate",
            onClick: () => enqueueSnackbar("Customer duplicated", "success"),
          },
          {
            disabled: !canManageUsers,
            disabledReason:
              "Only an administrator can change the account manager.",
            icon: <UserCog size={16} />,
            label: "Change account manager",
            onClick: () => enqueueSnackbar("Account manager changed"),
          },
          {
            disabled: hasOpenOrders,
            disabledReason: "Close or cancel the 3 open orders first.",
            icon: <Archive size={16} />,
            label: "Archive",
            onClick: () => enqueueSnackbar("Customer archived"),
          },
          { type: "separator" },
          {
            danger: true,
            disabled: hasOpenOrders,
            disabledReason: "A customer with orders cannot be deleted.",
            icon: <Trash2 size={16} />,
            label: "Delete",
            onClick: () => enqueueSnackbar("Customer deleted", "danger"),
          },
        ]}
        trigger={
          <IconButton aria-label="Customer actions">
            <MoreHorizontal size={18} />
          </IconButton>
        }
      />
    </div>
  );
}
