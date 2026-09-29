import { MoreHorizontal } from "lucide-react";
import {
  Button,
  Card,
  DescriptionList,
  Dropdown,
  IconButton,
  useSnackbar,
} from "components-ui";

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Card
      actions={
        <Dropdown
          buttonTrigger
          items={[
            { label: "Edit", onClick: () => enqueueSnackbar("Edit") },
            { label: "Archive", onClick: () => enqueueSnackbar("Archived") },
          ]}
          trigger={
            <IconButton aria-label="Customer actions" size="sm">
              <MoreHorizontal />
            </IconButton>
          }
        />
      }
      className="max-w-lg"
      description="Customer since March 2021"
      footer={
        <>
          <Button size="sm">New order</Button>
          <Button color="default" size="sm" variant="ghost">
            Send a message
          </Button>
        </>
      }
      title="Jana Nováková"
    >
      <DescriptionList
        items={[
          { desc: "jana@example.com", term: "Email" },
          { desc: "Prague", term: "City" },
          { desc: "12 orders", term: "Orders" },
        ]}
      />
    </Card>
  );
}
