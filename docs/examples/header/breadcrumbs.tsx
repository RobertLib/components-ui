import { Pencil, Printer } from "lucide-react";
import {
  Breadcrumbs,
  Button,
  Chip,
  DescriptionList,
  Header,
  Tabs,
} from "components-ui";
import DemoRouter from "../../lib/demo-router";

export default function HeaderWithBreadcrumbs() {
  return (
    <DemoRouter initialPath="/customers/118/overview">
      <div className="space-y-10">
        {/* The path above the title, the key facts and the pages of the
            record under it */}
        <Header
          actions={
            <>
              <Button startIcon={<Printer size={16} />} variant="outline">
                Print
              </Button>
              <Button startIcon={<Pencil size={16} />}>Edit</Button>
            </>
          }
          afterTitle={<Chip color="success">Active</Chip>}
          breadcrumbs={[
            { href: "/customers", label: "Customers" },
            { label: "Novák Stavby s.r.o." },
          ]}
          title="Novák Stavby s.r.o."
        >
          <DescriptionList
            className="mt-2"
            columns={3}
            items={[
              { desc: "27082440", term: "Company ID" },
              { desc: "Jana Nováková", term: "Account manager" },
              { desc: "128 400 CZK", term: "Unpaid" },
            ]}
          />
          <Tabs
            className="mt-4"
            items={[
              { href: "/customers/118/overview", label: "Overview" },
              { href: "/customers/118/orders", label: "Orders" },
              { href: "/customers/118/invoices", label: "Invoices" },
              { href: "/customers/118/contacts", label: "Contacts" },
            ]}
            overflow="menu"
          />
        </Header>

        {/* Breadcrumbs of your own - a long path collapsed */}
        <Header
          breadcrumbs={
            <Breadcrumbs
              items={[
                { href: "/settings", label: "Settings" },
                { href: "/settings/organization", label: "Organization" },
                { href: "/settings/organization/branches", label: "Branches" },
                { href: "/settings/organization/branches/7", label: "Brno" },
                { label: "Opening hours" },
              ]}
              maxItems={3}
            />
          }
          headingLevel={2}
          title="Opening hours"
        />
      </div>
    </DemoRouter>
  );
}
