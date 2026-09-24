import {
  Button,
  Checkbox,
  Dialog,
  DialogFooter,
  Input,
  Popover,
  useDisclosure,
} from "components-ui";

export default function Disclosure() {
  const dialog = useDisclosure();
  const filters = useDisclosure();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={dialog.onOpen}>Edit customer</Button>
      <Dialog onClose={dialog.onClose} open={dialog.open} title="Edit customer">
        <Input defaultValue="Jana Nováková" label="Name" />
        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button onClick={dialog.onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={dialog.onClose}>Save</Button>
          </div>
        </DialogFooter>
      </Dialog>

      <Popover
        buttonTrigger
        contentLabel="Filters"
        onOpenChange={filters.onOpenChange}
        open={filters.open}
        position="bottom"
        trigger={<Button variant="outline">Filters</Button>}
        triggerType="click"
      >
        <div className="space-y-2 p-3">
          <Checkbox label="Overdue only" />
          <Button onClick={filters.onClose} size="sm">
            Apply
          </Button>
        </div>
      </Popover>
    </div>
  );
}
