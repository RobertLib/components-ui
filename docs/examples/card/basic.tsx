import { MoreHorizontal } from "lucide-react";
import {
  Button,
  Card,
  Chip,
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
      afterTitle={<Chip color="success">Active</Chip>}
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
      padding="responsive"
      title="Jana Nováková"
    >
      <DescriptionList
        columns={2}
        emphasis="desc"
        items={[
          { desc: "jana@example.com", term: "Email" },
          { desc: "Prague", term: "City" },
          { desc: "12 orders", term: "Orders" },
        ]}
      />
    </Card>
  );
}
