import { useState } from "react";
import {
  Button,
  DescriptionList,
  DialogFooter,
  Input,
  Sheet,
  Textarea,
  useSnackbar,
} from "components-ui";

interface Customer {
  city: string;
  email: string;
  id: number;
  name: string;
  note: string;
}

const initialCustomers: Customer[] = [
  {
    city: "Brno",
    email: "jana.novakova@example.com",
    id: 1,
    name: "Jana Nováková",
    note: "Prefers invoices by email.",
  },
  {
    city: "Praha",
    email: "petr.svoboda@example.com",
    id: 2,
    name: "Petr Svoboda",
    note: "",
  },
  {
    city: "Ostrava",
    email: "eva.dvorakova@example.com",
    id: 3,
    name: "Eva Dvořáková",
    note: "Key account - call before delivery.",
  },
];

export default function RecordDetail() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [open, setOpen] = useState(false);
  // Kept after closing, so the sheet slides out with its content
  const [customerId, setCustomerId] = useState(1);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const customer = customers.find((c) => c.id === customerId)!;

  const openCustomer = (id: number) => {
    setCustomerId(id);
    setEditing(false);
    setOpen(true);
  };

  const save = async (form: FormData) => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800)); // the API call
    const changes = {
      city: String(form.get("city")),
      email: String(form.get("email")),
      name: String(form.get("name")),
      note: String(form.get("note")),
    };
    setCustomers((current) =>
      current.map((c) => (c.id === customerId ? { ...c, ...changes } : c)),
    );
    setSaving(false);
    setEditing(false);
    enqueueSnackbar("The customer was saved", "success");
  };

  return (
    <>
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {customers.map((c) => (
          <li
            className="flex items-center justify-between gap-4 py-2"
            key={c.id}
          >
            <div className="min-w-0">
              <div className="font-medium">{c.name}</div>
              <div className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {c.email}
              </div>
            </div>
            <Button
              onClick={() => openCustomer(c.id)}
              size="sm"
              variant="outline"
            >
              Detail
            </Button>
          </li>
        ))}
      </ul>

      <Sheet
        closeDisabled={saving}
        onClose={() => setOpen(false)}
        open={open}
        title={customer.name}
      >
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save(new FormData(event.currentTarget));
            }}
          >
            {/* The focused Edit button is gone - the focus moves on here */}
            <Input
              autoFocus
              defaultValue={customer.name}
              label="Name"
              name="name"
              required
            />
            <Input
              defaultValue={customer.email}
              label="Email"
              name="email"
              required
              type="email"
            />
            <Input defaultValue={customer.city} label="City" name="city" />
            <Textarea
              defaultValue={customer.note}
              label="Note"
              name="note"
              rows={4}
            />
            {/* In the form, so Save submits it - pinned to the bottom */}
            <DialogFooter className="flex justify-end gap-2">
              <Button
                disabled={saving}
                onClick={() => setEditing(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button loading={saving} type="submit">
                Save
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DescriptionList
              items={[
                { desc: customer.email, term: "Email" },
                { desc: customer.city, term: "City" },
                { desc: customer.note || "-", term: "Note" },
              ]}
            />
            <DialogFooter className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)} variant="outline">
                Close
              </Button>
              <Button autoFocus onClick={() => setEditing(true)}>
                Edit
              </Button>
            </DialogFooter>
          </>
        )}
      </Sheet>
    </>
  );
}
