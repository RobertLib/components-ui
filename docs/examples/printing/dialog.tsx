import { Printer } from "lucide-react";
import { useState } from "react";
import {
  Button,
  DescriptionList,
  Dialog,
  DialogFooter,
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableRow,
} from "components-ui";

const items = [
  { name: "Concrete C25/30", quantity: "12 m³", total: "34 680 Kč" },
  { name: "Reinforcing steel B500B", quantity: "1,4 t", total: "29 400 Kč" },
  { name: "Formwork rental (14 days)", quantity: "1", total: "8 900 Kč" },
  { name: "Delivery Brno - Modřice", quantity: "3", total: "4 200 Kč" },
];

// Print from the dialog - the dialog alone is printed, as long as its
// content, without the page behind it and without its buttons
export default function PrintDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Preview invoice
      </Button>
      <Dialog
        onClose={() => setOpen(false)}
        open={open}
        size="2xl"
        title="Invoice 2026-0042"
      >
        <div className="space-y-6">
          <DescriptionList
            columns={2}
            items={[
              { desc: "Novák Stavby s.r.o., IČO 27082440", term: "Customer" },
              { desc: "31 October 2026", term: "Due" },
            ]}
          />
          <Table caption="Items" density="compact">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="end">Quantity</TableCell>
                <TableCell align="end">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.name}>
                  <TableCell header>{item.name}</TableCell>
                  <TableCell align="end">{item.quantity}</TableCell>
                  <TableCell align="end">{item.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {/* Printed once, at the end */}
            <TableFoot>
              <TableRow>
                <TableCell colSpan={2}>Total incl. VAT</TableCell>
                <TableCell align="end">77 180 Kč</TableCell>
              </TableRow>
            </TableFoot>
          </Table>
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            Close
          </Button>
          <Button
            onClick={() => window.print()}
            startIcon={<Printer size={16} />}
          >
            Print
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
