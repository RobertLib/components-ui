import { useState } from "react";
import {
  Button,
  LoadingOverlay,
  Panel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components-ui";

const orders = [
  { customer: "Jana Nováková", id: 1041, total: "$120.00" },
  { customer: "Petr Svoboda", id: 1042, total: "$86.50" },
  { customer: "Eva Malá", id: 1043, total: "$240.00" },
];

export default function Basic() {
  const [loading, setLoading] = useState(false);
  const [blur, setBlur] = useState(false);

  const reload = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={loading} onClick={reload} size="sm">
          Reload the orders
        </Button>
        <Switch
          checked={blur}
          label="Blur"
          onChange={(event) => setBlur(event.target.checked)}
        />
      </div>

      {/* The region the overlay covers - its radius is that of the panel */}
      <LoadingOverlay
        blur={blur}
        className="rounded-md"
        label="Loading orders…"
        visible={loading}
      >
        <Panel className="space-y-3">
          <Table caption="Recent orders">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="end">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell header>#{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell align="end">{order.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Cannot be reached while covered - it is inert */}
          <Button onClick={reload} size="sm" variant="outline">
            Refresh
          </Button>
        </Panel>
      </LoadingOverlay>
    </div>
  );
}
