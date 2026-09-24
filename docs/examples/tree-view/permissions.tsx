import { Button, TreeView, useSnackbar, type TreeItem } from "components-ui";

const permissions: TreeItem<string>[] = [
  {
    children: [
      { id: "orders.view", label: "View orders" },
      { id: "orders.edit", label: "Create and edit orders" },
      { id: "orders.refund", label: "Issue refunds" },
    ],
    id: "orders",
    label: "Orders",
  },
  {
    children: [
      { id: "customers.view", label: "View customers" },
      { id: "customers.export", label: "Export customers" },
    ],
    id: "customers",
    label: "Customers",
  },
  {
    children: [
      { id: "settings.users", label: "Users and roles" },
      // Only the owner of the account may change billing
      { disabled: true, id: "settings.billing", label: "Billing (owner only)" },
    ],
    id: "settings",
    label: "Settings",
  },
];

export default function Permissions() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const granted = new FormData(event.currentTarget).getAll("permissions");
        enqueueSnackbar(`Saved: ${granted.join(", ") || "no permissions"}`);
      }}
    >
      <TreeView
        aria-label="Permissions of the Sales role"
        checkable
        defaultChecked={["orders.view", "customers"]}
        defaultExpanded={["orders", "customers", "settings"]}
        items={permissions}
        name="permissions"
      />
      <div className="mt-4 flex gap-2">
        <Button type="submit">Save</Button>
        <Button color="default" type="reset" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  );
}
