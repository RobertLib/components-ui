import { Breadcrumbs, Button, Tabs, useRouter } from "components-ui";
import DemoRouter from "../../lib/demo-router";

function CurrentPage() {
  const { navigate, pathname } = useRouter();

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { href: "/settings", label: "Settings" },
          { label: pathname.split("/").pop() },
        ]}
      />
      <Tabs
        items={[
          { href: "/settings/profile", label: "Profile" },
          { href: "/settings/security", label: "Security" },
          { href: "/settings/billing", label: "Billing" },
        ]}
      />
      <div className="flex gap-2">
        <Button link="/settings/billing" size="sm" variant="outline">
          Button link
        </Button>
        <Button
          onClick={() => navigate("/settings/security")}
          size="sm"
          variant="outline"
        >
          navigate()
        </Button>
      </div>
    </div>
  );
}

// Everything that links - Tabs, Breadcrumbs, Button - goes through the
// router adapter; here it is an in-memory one that changes the address above
export default function Demo() {
  return (
    <DemoRouter initialPath="/settings/profile">
      <CurrentPage />
    </DemoRouter>
  );
}
