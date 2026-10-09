import {
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components-ui";

const orders = [
  { customer: "Jana Nováková", id: 42, status: "Paid", total: "$120" },
  { customer: "Petr Svoboda", id: 43, status: "Open", total: "$64" },
];

// A list whose rows open the detail - the link of the row is in its
// first cell, for the keyboard and screen readers
export default function RowLinks() {
  return (
    <Table aria-label="Orders">
      <TableHead>
        <TableRow>
          <TableCell>Order</TableCell>
          <TableCell>Customer</TableCell>
          <TableCell>Status</TableCell>
          <TableCell align="end">Total</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {orders.map((order) => {
          const href = `/components/table?order=${order.id}`;
          return (
            <TableRow href={href} key={order.id}>
              <TableCell header>
                <Link data-row-link="" href={href} underline="hover">
                  Order {order.id}
                </Link>
              </TableCell>
              <TableCell>{order.customer}</TableCell>
              <TableCell>
                <Chip color={order.status === "Paid" ? "success" : "warning"}>
                  {order.status}
                </Chip>
              </TableCell>
              <TableCell align="end">{order.total}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
