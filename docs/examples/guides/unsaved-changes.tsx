import { useState } from "react";
import {
  Button,
  ConfirmProvider,
  FormActions,
  Input,
  Link,
  Tabs,
  useRouter,
  useUnsavedChanges,
} from "components-ui";
import DemoRouter from "../../lib/demo-router";

function EditOrder({
  onSave,
  saved,
}: {
  onSave: (items: string) => void;
  saved: string;
}) {
  const [items, setItems] = useState(saved);
  const dirty = items !== saved;
  // Links, `navigate` and `back` that leave the page ask first - and the
  // browser before a reload or closing the tab
  useUnsavedChanges(dirty);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(items);
      }}
    >
      <Input
        description="Change it, then follow a link."
        label="Items"
        onChange={(event) => setItems(event.target.value)}
        value={items}
      />
      <FormActions className="mt-4" dirty={dirty}>
        <Button onClick={() => setItems(saved)} variant="outline">
          Discard
        </Button>
        <Button disabled={!dirty} type="submit">
          Save
        </Button>
      </FormActions>
    </form>
  );
}

function OrderPages() {
  const { pathname } = useRouter();
  const [saved, setSaved] = useState("Bearings 6204-2RS, 40 pcs");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        items={[
          { href: "/orders/118/edit", label: "Edit" },
          { href: "/orders/118/history", label: "History" },
        ]}
      />
      {pathname === "/orders/118/edit" ? (
        <EditOrder onSave={setSaved} saved={saved} />
      ) : pathname === "/orders/118/history" ? (
        <p className="text-sm">Created on 12 October 2026 - {saved}.</p>
      ) : (
        <p className="text-sm">The list of the orders.</p>
      )}
      <Link href="/orders">Back to the orders</Link>
    </div>
  );
}

// The DemoRouter stands in for the router of your app
export default function UnsavedChanges() {
  return (
    <ConfirmProvider>
      <DemoRouter initialPath="/orders/118/edit">
        <OrderPages />
      </DemoRouter>
    </ConfirmProvider>
  );
}
